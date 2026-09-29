/* scoring.js — moteur de notation.
   Fichier unique de vérité : chargé à la fois par le Web Worker et par les tests.
   Aucune dépendance au DOM. */
(function(root){
"use strict";

var VERSION = "3.0.0";

// ---------- utilitaires ----------
function angDiff(a,b){var d=Math.abs(a-b)%360;return d>180?360-d:d;}
function inWin(d,a,b){return a<=b?(d>=a&&d<=b):(d>=a||d<=b);}
function clamp(v,a,b){return v<a?a:v>b?b:v;}
// rampe douce entre a et b (0 -> 1), lissée en cosinus pour éviter les à-coups
function ramp(v,a,b){
  if(a===b)return v>=b?1:0;
  var t=clamp((v-a)/(b-a),0,1);
  return t*t*(3-2*t);
}
function plateau(v,lo0,lo1,hi1,hi0){ return Math.min(ramp(v,lo0,lo1), 1-ramp(v,hi1,hi0)); }

// ---------- physique de la vague ----------
// Gain de levée : une houle longue lève beaucoup plus qu'une houle courte de même hauteur.
function shoal(T){ return Math.min(1.45, 0.55 + 0.055*T); }
// Hauteur de houle au spot : abri du spot + angle d'incidence.
function nearshore(spot,H0,dir){
  var inc=angDiff(dir,spot.orient);
  var kd=Math.pow(Math.max(Math.cos(inc*Math.PI/180),0.08),0.25);
  return H0*spot.shelter*kd;
}
// Hauteur de face : ce que l'on voit déferler.
function faceHeight(Hs,T){ return Hs*shoal(T)*1.45; }

// Coefficient de marée à la bretonne, estimé depuis le marnage du jour.
// C'est un nombre unique référencé à Brest, pas une valeur par plage :
// il se calcule donc sur un point de référence, et l'échelle officielle va de 20 à 120.
function tideCoef(range){ return Math.round(clamp(range/6.1*100,20,120)); }

// ---------- fenêtres de marée ----------
var TIDE_WINDOWS={
  mi:[0.33,0.67], mihaute:[0.50,0.97], mibasse:[0.03,0.50],
  bassemi:[0.03,0.50], mimontante:[0.33,0.78], toutes:[0,1]
};
function tideQuality(code,level,rising){
  if(code==="toutes")return 0.75;
  var w=TIDE_WINDOWS[code]||TIDE_WINDOWS.mi;
  var q;
  if(level>=w[0]&&level<=w[1]) q=1;
  else {
    var d=level<w[0]?w[0]-level:level-w[1];
    q=1-ramp(d,0,0.22)*0.8;           // dégradé progressif hors fenêtre
  }
  if(code==="mimontante"&&!rising) q*=0.55;
  return clamp(q,0.15,1);
}

// ---------- qualité du vent ----------
// delta = écart angulaire entre le vent et l'axe offshore du spot.
function windQuality(delta,speed){
  // axe : l'offshore pur vaut 1, l'onshore pur garde une valeur faible mais non nulle
  var axis=1-0.72*Math.pow(delta/180,1.15);
  // vent quasi nul : la direction ne compte plus, c'est glassy
  var calm=1-ramp(speed,0,5);
  axis=axis+(1-axis)*calm*0.9;
  // force : l'offshore tolère, l'onshore détruit vite
  var strength;
  if(delta<=60)       strength=1-ramp(speed,12,36)*0.70;
  else if(delta<=110) strength=1-ramp(speed,8,26)*0.80;
  else                strength=1-ramp(speed,5,20)*0.92;
  return clamp(axis*strength,0,1);
}
// Rafales : un vent moyen honnête avec de grosses rafales reste injouable.
function gustFactor(mean,gust){
  if(gust==null) return 1;
  var spread=gust-mean;
  return clamp(1-ramp(gust,26,46)*0.6-ramp(spread,8,22)*0.25,0.15,1);
}

// ---------- mer croisée ----------
// Deux trains sous des angles et des périodes différents => pics désordonnés.
function crossFactor(H0,dir,T,others){
  var worst=1,found=null;
  for(var i=0;i<others.length;i++){
    var o=others[i];
    if(!o||o.h==null||o.d==null||o.p==null||H0<=0)continue;
    var ratio=o.h/H0;
    if(ratio<0.35)continue;
    var sep=angDiff(o.d,dir), dp=Math.abs(o.p-T);
    if(sep<35||dp<2.5)continue;
    var sev=clamp(ratio,0,1)*ramp(sep,35,80)*ramp(dp,2.5,6);
    var f=1-sev*0.30;
    if(f<worst){worst=f;found={h:o.h,d:o.d,p:o.p,sev:sev};}
  }
  return {factor:worst,detail:found};
}

// ---------- notation d'une heure ----------
var WEIGHTS={size:0.55,clean:0.25,tide:0.20};

function scoreHour(spot,s){
  // s : {H0,dir,T,sec,ter,wind,wdir,gust,level,rising,range,air,rain,sst,windMem}
  var out={fail:null,score:0,stars:0,q:{size:0,clean:0,tide:0}};
  if(s.H0==null||s.dir==null||s.T==null) return null;

  var Hs=nearshore(spot,s.H0,s.dir);
  var face=faceHeight(Hs,s.T);
  out.H0=s.H0; out.dir=s.dir; out.T=s.T; out.Hs=Hs; out.face=face;
  out.wind=s.wind; out.wdir=s.wdir; out.gust=s.gust;
  out.tideLevel=s.level; out.rising=s.rising; out.range=s.range;
  out.coef=tideCoef(s.range);
  out.air=s.air; out.rain=s.rain; out.sst=s.sst;

  var off=(spot.orient+180)%360, delta=angDiff(s.wdir,off);
  out.delta=delta;
  out.wcat = delta<=45?0 : delta<=90?1 : delta<=135?2 : 3;

  // --- hors fenêtre de houle : le spot est plat, rien d'autre à dire
  if(!inWin(s.dir,spot.win[0],spot.win[1])){ out.fail="fenetre"; return out; }

  // --- taille : rampes douces autour des seuils du spot, exprimées en hauteur de face
  var fmin=spot.size[0]*1.6, fmax=spot.size[1]*1.6;
  var inRange=plateau(face, fmin*0.62, fmin*1.45, fmax*0.85, fmax*1.40);
  // préférence de taille : un spot a un optimum, pas un plateau plat
  var opt=fmin+(fmax-fmin)*0.55, spread=(fmax-fmin)*0.75||1;
  var pref=Math.exp(-Math.pow((face-opt)/spread,2));
  var sizeQ=inRange*(0.55+0.45*pref);
  // garde-fou période : du clapot court ne fait pas une vague, même haut
  var gate=ramp(s.T, spot.perMin-2, spot.perMin+1);
  // bonus de puissance pour les houles longues
  var power=0.85+0.15*ramp(s.T,10,15);
  out.q.size=clamp(sizeQ*gate*power,0,1);

  if(face<fmin*0.62||gate<0.05){ out.fail = face>fmax*1.40 ? "gros" : (gate<0.05?"periode":"petit"); return out; }
  if(face>fmax*1.40){ out.fail="gros"; return out; }

  // --- propreté : vent, rafales, mémoire de vent, mer croisée
  var wq=windQuality(delta,s.wind);
  var gf=gustFactor(s.wind,s.gust);
  var cr=crossFactor(s.H0,s.dir,s.T,[s.sec,s.ter]);
  out.cross=cr.detail;
  // la mer garde la trace du vent des heures précédentes
  var mem=s.windMem==null?wq:(0.65*wq+0.35*s.windMem);
  out.q.clean=clamp(mem*gf*cr.factor,0,1);
  out.windMem=s.windMem;

  if(out.q.clean<0.12){ out.fail="vent"; return out; }

  // --- marée
  out.q.tide=tideQuality(spot.tide,s.level,s.rising);

  var total=WEIGHTS.size*out.q.size + WEIGHTS.clean*out.q.clean + WEIGHTS.tide*out.q.tide;
  // la propreté joue aussi en multiplicateur : une belle houle dans un vent dedans
  // ne fait pas une bonne session, quelle que soit la taille.
  total *= 0.45+0.55*out.q.clean;
  // sans vague, rien d'autre ne compte : la taille commande le reste,
  // ce qui évite aussi qu'un spot passe de 0 à 11/20 pour deux centimètres.
  total *= clamp(out.q.size/0.40,0,1);
  // bonus bodyboard : shorebreak dans sa fenêtre de marée, sur houle ordonnée
  if(spot.shore && out.q.tide>0.9 && s.T>=11) total+=0.03;
  out.score=Math.round(clamp(total,0,1)*200)/10;
  out.stars=starsFor(out.score);
  // il y a bien des vagues, mais rien qui vaille le déplacement :
  // on le dit, plutôt que de laisser une case muette.
  if(out.stars<1) out.fail="faible";
  return out;
}

function starsFor(sc){
  if(sc<9)return 0;
  if(sc<10)return 1;      if(sc<11.5)return 1.5;
  if(sc<13)return 2;      if(sc<14)return 2.5;
  if(sc<15.5)return 3;    if(sc<17)return 3.5;
  return 4;
}

// ---------- grille complète ----------
// marine[i] et wx[i] : réponses Open-Meteo pour le spot i (ou null si l'appel a échoué)
function buildGrid(spots,marine,wx){
  var ref=null;
  for(var k=0;k<marine.length;k++){ if(marine[k]&&marine[k].hourly){ref=marine[k];break;} }
  if(!ref) return null;
  var times=ref.hourly.time;
  var days=[],sun={};
  for(var t=0;t<times.length;t++){var d=times[t].slice(0,10);if(days.indexOf(d)<0)days.push(d);}
  for(var w=0;w<wx.length;w++){
    if(wx[w]&&wx[w].daily&&wx[w].daily.sunrise){
      for(var k2=0;k2<days.length&&k2<wx[w].daily.sunrise.length;k2++){
        if(!sun[days[k2]])sun[days[k2]]=[
          parseInt(wx[w].daily.sunrise[k2].slice(11,13),10),
          parseInt(wx[w].daily.sunset[k2].slice(11,13),10)];
      }
      break;
    }
  }
  days.forEach(function(d){ if(!sun[d])sun[d]=[8,19]; });

  // coefficient de marée du jour : nombre unique, calculé sur le spot le plus
  // proche de Brest (référence officielle), et non plage par plage.
  var refI=0,refD=1e9;
  for(var s2=0;s2<spots.length;s2++){
    var dd2=Math.abs(spots[s2].lat-48.38)+Math.abs(spots[s2].lon+4.49);
    if(marine[s2]&&marine[s2].hourly&&dd2<refD){refD=dd2;refI=s2;}
  }
  var coefs={};
  if(marine[refI]&&marine[refI].hourly&&marine[refI].hourly.sea_level_height_msl){
    var lvR=marine[refI].hourly.sea_level_height_msl, mm={};
    days.forEach(function(d){mm[d]=[Infinity,-Infinity];});
    for(var t9=0;t9<times.length;t9++){
      var v9=lvR[t9]; if(v9==null)continue;
      var d9=times[t9].slice(0,10);
      if(v9<mm[d9][0])mm[d9][0]=v9;
      if(v9>mm[d9][1])mm[d9][1]=v9;
    }
    days.forEach(function(d){
      var r9=mm[d][1]-mm[d][0];
      coefs[d]=isFinite(r9)&&r9>0?tideCoef(r9):null;
    });
  }

  var grid=spots.map(function(spot,i){
    var m=marine[i],f=wx[i];
    if(!m||!m.hourly||!f||!f.hourly) return {missing:true,hours:[]};
    var mh=m.hourly,fh=f.hourly;
    // bornes de marée par jour, pour normaliser le niveau
    var bounds={};
    days.forEach(function(d){bounds[d]=[Infinity,-Infinity];});
    for(var t=0;t<times.length;t++){
      var v=mh.sea_level_height_msl?mh.sea_level_height_msl[t]:null;
      if(v==null)continue;
      var d=times[t].slice(0,10);
      if(v<bounds[d][0])bounds[d][0]=v;
      if(v>bounds[d][1])bounds[d][1]=v;
    }
    var hours=new Array(times.length),memo=null;
    for(var t2=0;t2<times.length;t2++){
      var d2=times[t2].slice(0,10),b=bounds[d2];
      var range=(b[1]-b[0]);
      if(!isFinite(range)||range<=0)range=1;
      var lv=mh.sea_level_height_msl?mh.sea_level_height_msl[t2]:null;
      var prev=mh.sea_level_height_msl?mh.sea_level_height_msl[Math.max(t2-1,0)]:null;
      var sample={
        H0:mh.swell_wave_height[t2], dir:mh.swell_wave_direction[t2], T:mh.swell_wave_period[t2],
        sec:{h:pick(mh,"secondary_swell_wave_height",t2),d:pick(mh,"secondary_swell_wave_direction",t2),p:pick(mh,"secondary_swell_wave_period",t2)},
        ter:{h:pick(mh,"tertiary_swell_wave_height",t2),d:pick(mh,"tertiary_swell_wave_direction",t2),p:pick(mh,"tertiary_swell_wave_period",t2)},
        wind:fh.wind_speed_10m[t2], wdir:fh.wind_direction_10m[t2], gust:pick(fh,"wind_gusts_10m",t2),
        level:lv==null?0.5:(lv-b[0])/range, rising:(lv!=null&&prev!=null)?lv>=prev:true, range:range,
        air:pick(fh,"temperature_2m",t2), rain:pick(fh,"precipitation",t2),
        sst:pick(mh,"sea_surface_temperature",t2),
        windMem:memo
      };
      var cell=scoreHour(spot,sample);
      if(cell&&coefs[d2]!=null)cell.coef=coefs[d2];   // coefficient national, pas local
      hours[t2]=cell;
      // mémoire de vent : moyenne glissante de la qualité de vent des heures précédentes
      if(sample.wdir!=null&&sample.wind!=null){
        var off2=(spot.orient+180)%360;
        var wqNow=windQuality(angDiff(sample.wdir,off2),sample.wind);
        memo = memo==null ? wqNow : (0.72*memo+0.28*wqNow);
      }
    }
    return {missing:false,hours:hours};
  });
  return {version:VERSION,times:times,days:days,sun:sun,coefs:coefs,grid:grid};
}
function pick(h,key,t){ return (h&&h[key]&&h[key][t]!=null)?h[key][t]:null; }

var API={VERSION:VERSION,angDiff:angDiff,inWin:inWin,clamp:clamp,ramp:ramp,plateau:plateau,
  shoal:shoal,nearshore:nearshore,faceHeight:faceHeight,tideCoef:tideCoef,
  TIDE_WINDOWS:TIDE_WINDOWS,tideQuality:tideQuality,windQuality:windQuality,gustFactor:gustFactor,
  crossFactor:crossFactor,scoreHour:scoreHour,starsFor:starsFor,buildGrid:buildGrid,WEIGHTS:WEIGHTS};

if(typeof module!=="undefined"&&module.exports) module.exports=API;
root.Scoring=API;
})(typeof self!=="undefined"?self:this);
