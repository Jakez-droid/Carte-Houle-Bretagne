/* app.js — Houle Bretagne */
(function(){
"use strict";

var VERSION="3.1.0";
var S=null, ZONES=[], COAST=[], G=null;          // spots, zones, trait de côte, grille calculée
var fetchedAt=null, partial=0, offline=false;
var ti=0, sel=null, minStars=0, favOnly=false, tab="map", query="", sortBy="score";
var logOpen=false, logStars=0, logReasons=[];
var FAV={}, LOG=[];
var CK="houle-cache-v3", FK="houle-fav-v3", LK="houle-log-v3";
var REASONS=["plus petit qu'annoncé","plus gros qu'annoncé","trop mou","vent pire que prévu","marée décalée","bancs mauvais","meilleur que prévu"];
var WCAT=["offshore","cross-offshore","cross-onshore","onshore"];
var TIDE_LABEL={mi:"mi-marée",mihaute:"mi à haute",mibasse:"mi à basse",bassemi:"basse à mi",mimontante:"mi-marée montante",toutes:"toutes marées"};

try{FAV=JSON.parse(localStorage.getItem(FK)||"{}");}catch(e){FAV={};}
try{LOG=JSON.parse(localStorage.getItem(LK)||"[]");}catch(e){LOG=[];}
function saveFav(){try{localStorage.setItem(FK,JSON.stringify(FAV));}catch(e){}}
function saveLog(){try{localStorage.setItem(LK,JSON.stringify(LOG));}catch(e){}}

// ---------- petits utilitaires ----------
var $=function(id){return document.getElementById(id);};
function nf(x){return String(x).replace(".",",");}
function slug(s){return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function bearingWord(d){return ["nord","nord-est","est","sud-est","sud","sud-ouest","ouest","nord-ouest"][Math.round(d/45)%8];}
function toast(msg){var d=document.createElement("div");d.className="toast";d.textContent=msg;document.body.appendChild(d);setTimeout(function(){d.remove();},2800);}

var STARPATH="M10 1.4l2.6 5.3 5.9.85-4.25 4.15 1 5.85L10 14.8 4.75 17.55l1-5.85L1.5 7.55l5.9-.85z";
var _sid=0;
function starSVG(n,size,col){
  size=size||15;col=col||"currentColor";
  var o='<svg viewBox="0 0 89 20" width="'+(size*4.45)+'" height="'+size+'" aria-hidden="true" style="vertical-align:-2px;flex:0 0 auto">';
  for(var k=0;k<4;k++){
    var f=Math.max(0,Math.min(1,n-k)),ox=k*23;
    o+='<path d="'+STARPATH+'" fill="var(--star-off)" transform="translate('+ox+',0)"/>';
    if(f>0){var id="s"+(++_sid);
      o+='<clipPath id="'+id+'"><rect width="'+(20*f)+'" height="20"/></clipPath>';
      o+='<path d="'+STARPATH+'" fill="'+col+'" clip-path="url(#'+id+')" transform="translate('+ox+',0)"/>';}
  }
  return o+"</svg>";
}
function oneStar(f,size){
  f=Math.max(0,Math.min(1,f));
  var o='<svg viewBox="0 0 20 20" width="'+size+'" height="'+size+'" aria-hidden="true"><path d="'+STARPATH+'" fill="var(--star-off)"/>';
  if(f>0){var id="o"+(++_sid);
    o+='<clipPath id="'+id+'"><rect width="'+(20*f)+'" height="20"/></clipPath><path d="'+STARPATH+'" fill="currentColor" clip-path="url(#'+id+')"/>';}
  return o+"</svg>";
}
function colStars(st){return st>=3.5?"var(--s-top)":st>=3?"var(--s-good)":st>=2?"var(--s-mid)":st>0?"var(--s-low)":"var(--s-none)";}
function colCell(c){
  if(!c)return "var(--s-none)";
  if(c.fail==="vent"||c.fail==="gros")return "var(--s-bad)";
  if(c.fail)return "var(--s-none)";
  return colStars(c.stars);
}
function tagFor(st){return st>=3.5?"À ne pas rater":st>=3?"Vaut le déplacement":st>=2?"Correct":"Surfable, sans plus";}
function wetsuit(sst){
  if(sst==null)return null;
  if(sst>=19)return "3/2 mm, shorty possible";
  if(sst>=16)return "3/2 mm intégrale";
  if(sst>=13)return "4/3 mm, chaussons utiles";
  if(sst>=10)return "4/3 mm, chaussons obligatoires";
  return "5/4 mm, chaussons, gants et cagoule";
}
function tideWord(t,rising){
  if(t<=0.18)return "marée basse";
  if(t<=0.42)return rising?"mi-marée montante":"mi-marée descendante";
  if(t<=0.60)return "mi-marée";
  if(t<=0.82)return rising?"mi à haute, montante":"mi à haute, descendante";
  return "marée haute";
}
function arrowGlyph(deg,col,size){
  size=size||13;
  return '<svg viewBox="0 0 20 20" width="'+size+'" height="'+size+'" aria-hidden="true" style="vertical-align:-2px"><g transform="rotate('+((deg+180)%360)+' 10 10)"><path d="M10 3 L10 17 M10 17 L6.5 12.5 M10 17 L13.5 12.5" fill="none" stroke="'+(col||"currentColor")+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
}


// ---------- aide : bulles sur les métriques, page « comment ça marche » ----------
function tipBtn(key){
  var T=(root_HELP()||{}).TIPS||{};
  if(!T[key])return "";
  return '<button class="tipbtn" type="button" data-tip="'+key+'" aria-label="Explication : '+T[key].t+'">?</button>';
}
function root_HELP(){return window.HELP;}
function openTip(key){
  var T=(root_HELP()||{}).TIPS||{},x=T[key];
  if(!x)return;
  showModal('<h3>'+x.t+'</h3><p>'+x.d+'</p>');
}
function openGuide(){
  var G=(root_HELP()||{}).GUIDE||[];
  var h='<h3>Comment ça marche</h3>';
  G.forEach(function(sec){
    h+='<h4>'+sec.h+'</h4>';
    sec.p.forEach(function(par){h+='<p>'+par+'</p>';});
  });
  h+='<h4>Toutes les métriques</h4>';
  var T=(root_HELP()||{}).TIPS||{};
  Object.keys(T).forEach(function(k){h+='<p><b>'+T[k].t+'</b> — '+T[k].d+'</p>';});
  showModal(h);
}
function showModal(html){
  var back=document.createElement("div");
  back.className="modalback";
  back.innerHTML='<div class="modal" role="dialog" aria-modal="true"><button class="modalx" type="button" aria-label="Fermer">×</button><div class="modalbody">'+html+'</div></div>';
  function close(){back.remove();document.removeEventListener("keydown",esc);}
  function esc(e){if(e.key==="Escape")close();}
  back.addEventListener("click",function(e){if(e.target===back)close();});
  back.querySelector(".modalx").addEventListener("click",close);
  document.addEventListener("keydown",esc);
  document.body.appendChild(back);
  back.querySelector(".modalx").focus();
}
document.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest(".tipbtn");
  if(b){e.preventDefault();e.stopPropagation();openTip(b.dataset.tip);}
});

// ---------- accès à la grille ----------
function cellAt(i,t){var g=G.grid[i];return (g&&!g.missing)?g.hours[t]:null;}
function dayOf(t){return G.times[t].slice(0,10);}
function hourOf(t){return +G.times[t].slice(11,13);}
function isDay(t){var s=G.sun[dayOf(t)],h=hourOf(t);return h>=s[0]&&h<=s[1];}
function todayIdx(){
  var n=new Date();
  var d=n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");
  var k=G.days.indexOf(d);return k<0?0:k;
}
function confOf(t){var k=G.days.indexOf(dayOf(t))-todayIdx();return k<=3?1:k<=6?0.62:0.34;}
function dayRange(day){
  var a=-1,b=-1;
  for(var t=0;t<G.times.length;t++){if(dayOf(t)===G.days[day]){if(a<0)a=t;b=t;}}
  return [a,b];
}
function bestHourOf(i,day){
  var r=dayRange(day),best=null;
  for(var t=r[0];t<=r[1];t++){
    if(!isDay(t))continue;
    var c=cellAt(i,t);
    if(!c||c.fail||c.stars<1)continue;
    if(!best||c.score>best.c.score)best={t:t,c:c};
  }
  return best;
}
function hourPeak(t){
  if(!isDay(t))return null;
  var best=null;
  for(var i=0;i<S.length;i++){var c=cellAt(i,t);if(c&&!c.fail&&(!best||c.score>best.c.score))best={i:i,c:c};}
  return best;
}
var _peakCache=null;
function peaks(){
  if(_peakCache)return _peakCache;
  _peakCache=G.times.map(function(_,t){return hourPeak(t);});
  return _peakCache;
}
function weekBest(){
  var p=peaks(),t0=dayRange(todayIdx())[0],best=null;
  for(var t=t0;t<p.length;t++){if(p[t]&&(!best||p[t].c.score>p[best].c.score))best=t;}
  return best==null?null:{t:best,i:p[best].i,c:p[best].c};
}

// ---------- état dans l'URL ----------
function writeURL(){
  var parts=["t="+G.times[ti].replace(":00","")];
  if(sel!=null)parts.push("s="+slug(S[sel].name));
  var h="#"+parts.join("&");
  if(location.hash!==h)history.replaceState(null,"",h);
}
function readURL(){
  var h=(location.hash||"").replace(/^#/,"");
  if(!h)return false;
  var got=false;
  h.split("&").forEach(function(kv){
    var p=kv.split("="),k=p[0],v=decodeURIComponent(p[1]||"");
    if(k==="t"){
      var idx=G.times.indexOf(v.length===13?v+":00":v);
      if(idx>=0){ti=idx;got=true;}
    }
    if(k==="s"){
      for(var i=0;i<S.length;i++)if(slug(S[i].name)===v){sel=i;got=true;}
    }
  });
  return got;
}

// ---------- chargement ----------
function apiUrls(){
  var out=[];
  for(var i=0;i<S.length;i+=20){
    var c=S.slice(i,i+20);
    var la=c.map(function(s){return s.lat;}).join(","), lo=c.map(function(s){return s.lon;}).join(",");
    out.push({
      from:i,count:c.length,
      marine:"https://marine-api.open-meteo.com/v1/marine?latitude="+la+"&longitude="+lo+
        "&hourly=swell_wave_height,swell_wave_direction,swell_wave_period,secondary_swell_wave_height,secondary_swell_wave_direction,secondary_swell_wave_period,tertiary_swell_wave_height,tertiary_swell_wave_direction,tertiary_swell_wave_period,sea_level_height_msl,sea_surface_temperature"+
        "&forecast_days=10&timezone=Europe%2FParis&cell_selection=sea",
      wx:"https://api.open-meteo.com/v1/forecast?latitude="+la+"&longitude="+lo+
        "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation"+
        "&daily=sunrise,sunset&forecast_days=10&timezone=Europe%2FParis&wind_speed_unit=kn"
    });
  }
  return out;
}
function spread(j,n){return Array.isArray(j)?j:[j];}

// cache aligné sur les runs du modèle (toutes les 6 h) plutôt qu'un simple délai
function cacheStale(at){
  var runMs=6*3600*1000;
  return Math.floor(Date.now()/runMs)!==Math.floor(at/runMs) || (Date.now()-at)>6*3600*1000;
}

function loadData(force){
  if(!force){
    try{
      var raw=localStorage.getItem(CK);
      if(raw){var c=JSON.parse(raw);if(!cacheStale(c.at))return Promise.resolve({marine:c.m,wx:c.w,at:c.at,partial:c.p||0});}
    }catch(e){}
  }
  var groups=apiUrls();
  var marine=new Array(S.length).fill(null), wx=new Array(S.length).fill(null), failed=0;
  var jobs=[];
  groups.forEach(function(g){
    jobs.push(fetch(g.marine).then(function(r){return r.ok?r.json():Promise.reject(r.status);})
      .then(function(j){spread(j).forEach(function(x,k){marine[g.from+k]=x;});})
      .catch(function(){failed++;}));
    jobs.push(fetch(g.wx).then(function(r){return r.ok?r.json():Promise.reject(r.status);})
      .then(function(j){spread(j).forEach(function(x,k){wx[g.from+k]=x;});})
      .catch(function(){failed++;}));
  });
  return Promise.all(jobs).then(function(){
    var got=marine.filter(Boolean).length;
    if(!got){
      // dernier recours : ce qu'on avait en cache, même périmé
      try{var raw2=localStorage.getItem(CK);if(raw2){var c2=JSON.parse(raw2);offline=true;return {marine:c2.m,wx:c2.w,at:c2.at,partial:c2.p||0};}}catch(e){}
      throw new Error("réseau indisponible");
    }
    var at=Date.now(), miss=S.length-Math.min(got,wx.filter(Boolean).length);
    try{localStorage.setItem(CK,JSON.stringify({at:at,m:marine,w:wx,p:miss}));}catch(e){}
    return {marine:marine,wx:wx,at:at,partial:miss};
  });
}

function computeGrid(payload){
  return new Promise(function(resolve,reject){
    var done=false;
    function fallback(){
      if(done)return; done=true;
      var r=window.Scoring.buildGrid(S,payload.marine,payload.wx);
      r?resolve(r):reject(new Error("calcul impossible"));
    }
    if(!window.Worker)return fallback();
    var w;
    try{w=new Worker("worker.js");}catch(e){return fallback();}
    var timer=setTimeout(function(){try{w.terminate();}catch(e){} fallback();},12000);
    w.onmessage=function(e){
      clearTimeout(timer);
      if(done)return; done=true;
      w.terminate();
      e.data&&e.data.ok?resolve(e.data):reject(new Error(e.data&&e.data.error||"calcul impossible"));
    };
    w.onerror=function(){clearTimeout(timer);try{w.terminate();}catch(e){} fallback();};
    w.postMessage({spots:S,marine:payload.marine,wx:payload.wx});
  });
}

// ---------- projection carte ----------
var LON0=-5.30,LON1=-2.85,LAT0=47.35,LAT1=48.90;
var KX=Math.cos((LAT0+LAT1)/2*Math.PI/180),MW=1000,MH=960,PAD=26;
var spanX=(LON1-LON0)*KX,spanY=LAT1-LAT0;
var msc=Math.min((MW-2*PAD)/spanX,(MH-2*PAD)/spanY);
var offX=(MW-spanX*msc)/2,offY=(MH-spanY*msc)/2;
function px(l){return offX+(l-LON0)*KX*msc;}
function py(l){return MH-offY-(l-LAT0)*msc;}
var NS="http://www.w3.org/2000/svg";
function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e;}
var view={x:0,y:0,w:MW,h:MH},mapSvg,markers;

function drawMapBase(){
  mapSvg=$("map");
  mapSvg.appendChild(el("rect",{x:-3000,y:-3000,width:9000,height:9000,fill:"var(--sea)"}));
  var g=el("g",{opacity:".45"});
  for(var k=1;k<=3;k++)g.appendChild(el("rect",{x:0,y:0,width:MW*(0.10+0.06*k),height:MH,fill:"var(--sea-deep)",opacity:".25"}));
  mapSvg.appendChild(g);
  COAST.forEach(function(seg){
    var pts=seg.split(",").map(function(p){var xy=p.trim().split(" ");return px(+xy[0])+","+py(+xy[1]);}).join(" ");
    mapSvg.appendChild(el("polyline",{points:pts,fill:"var(--land)",stroke:"var(--land-edge)","stroke-width":1.4,"stroke-linejoin":"round"}));
  });
  [[48.72,-4.15,"Léon"],[48.30,-4.30,"Crozon"],[48.12,-4.12,"Douarnenez"],[47.93,-4.18,"Audierne"],[47.80,-3.95,"Sud Finistère"],[47.56,-2.99,"Quiberon"]].forEach(function(z){
    var t=el("text",{x:px(z[1]),y:py(z[0]),class:"zlab","text-anchor":"middle"});t.textContent=z[2];mapSvg.appendChild(t);
  });
  markers=el("g",{});mapSvg.appendChild(markers);
  applyView();
}
function applyView(){mapSvg.setAttribute("viewBox",view.x+" "+view.y+" "+view.w+" "+view.h);}
function pxPerUnit(){var r=mapSvg.getBoundingClientRect();return r.width?r.width/view.w:1;}
function clampView(){
  var minW=MW*0.08;
  if(view.w<minW){view.w=minW;view.h=MH*(minW/MW);}
  if(view.w>MW){view.w=MW;view.h=MH;}
  view.x=Math.max(-MW*0.25,Math.min(view.x,MW-view.w+MW*0.25));
  view.y=Math.max(-MH*0.25,Math.min(view.y,MH-view.h+MH*0.25));
}
function zoomAt(f,cx,cy){
  view.x=cx-(cx-view.x)*f; view.y=cy-(cy-view.y)*f;
  view.w*=f; view.h*=f; clampView(); applyView(); renderMarkers();
}
function visible(i){
  if(favOnly&&!FAV[i])return false;
  if(query&&slug(S[i].name).indexOf(slug(query))<0)return false;
  if(minStars>0){
    var day=G.days.indexOf(dayOf(ti)), b=bestHourOf(i,day);
    if(!b||b.c.stars<minStars)return false;
  }
  return true;
}
function renderMarkers(){
  while(markers.firstChild)markers.removeChild(markers.firstChild);
  var scale=pxPerUnit(), rr=Math.max(0.45,1/scale);
  var list=[];
  for(var i=0;i<S.length;i++)if(visible(i))list.push(i);
  list.sort(function(a,b){
    var ca=cellAt(a,ti),cb=cellAt(b,ti);
    return ((ca&&!ca.fail)?ca.score:0)-((cb&&!cb.fail)?cb.score:0);
  });
  list.forEach(function(i){
    var c=cellAt(i,ti),x=px(S[i].lon),y=py(S[i].lat);
    var node=el("g",{class:"dot","data-sel":sel===i?"1":"0",tabindex:"0",role:"button"});
    node.appendChild(el("circle",{class:"halo",cx:x,cy:y,r:12*rr}));
    var st=(c&&!c.fail)?c.stars:0;
    var hard=c&&(c.fail==="vent"||c.fail==="gros");
    if(st<=0){
      // forme distincte : rien à surfer = cercle vide ; inexploitable = cercle barré
      node.appendChild(el("circle",{cx:x,cy:y,r:5*rr,fill:"none",stroke:colCell(c),"stroke-width":1.8*rr}));
      if(hard)node.appendChild(el("line",{x1:x-3.6*rr,y1:y+3.6*rr,x2:x+3.6*rr,y2:y-3.6*rr,stroke:colCell(c),"stroke-width":1.8*rr}));
    }else{
      var r0=(5.5+st*0.9)*rr;
      node.appendChild(el("circle",{cx:x,cy:y,r:r0,fill:colCell(c),stroke:"var(--chrome)","stroke-width":1.4*rr}));
      // encodage redondant, lisible sans distinguer rouge et vert
      if(st>=3)node.appendChild(el("circle",{cx:x,cy:y,r:r0*0.55,fill:"none",stroke:"var(--chrome)","stroke-width":1.3*rr}));
      if(st>=4)node.appendChild(el("circle",{cx:x,cy:y,r:r0*0.18,fill:"var(--chrome)"}));
    }
    if(FAV[i])node.appendChild(el("circle",{cx:x,cy:y,r:12*rr,fill:"none",stroke:"var(--s-mid)","stroke-width":1.5*rr,"stroke-dasharray":(2.5*rr)+" "+(2*rr)}));
    // cible tactile d'au moins 44 px
    node.appendChild(el("circle",{cx:x,cy:y,r:22/scale,fill:"transparent"}));
    var ti2=el("title");ti2.textContent=S[i].name;node.appendChild(ti2);
    node.addEventListener("click",function(){sel=i;render();});
    node.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();sel=i;render();}});
    markers.appendChild(node);
  });
}
function mapGestures(){
  var pts={},last=null,d0=0,v0=null,moved=false;
  mapSvg.addEventListener("pointerdown",function(e){
    mapSvg.setPointerCapture(e.pointerId);pts[e.pointerId]={x:e.clientX,y:e.clientY};moved=false;
    var n=Object.keys(pts).length;
    if(n===1){last={x:e.clientX,y:e.clientY};mapSvg.classList.add("drag");}
    else if(n===2){var k=Object.keys(pts),a=pts[k[0]],b=pts[k[1]];d0=Math.hypot(a.x-b.x,a.y-b.y);v0={x:view.x,y:view.y,w:view.w,h:view.h};}
  });
  mapSvg.addEventListener("pointermove",function(e){
    if(!pts[e.pointerId])return;
    pts[e.pointerId]={x:e.clientX,y:e.clientY};
    var keys=Object.keys(pts);
    if(keys.length===1&&last){
      var s=pxPerUnit();
      if(Math.abs(e.clientX-last.x)+Math.abs(e.clientY-last.y)>2)moved=true;
      view.x-=(e.clientX-last.x)/s;view.y-=(e.clientY-last.y)/s;
      last={x:e.clientX,y:e.clientY};clampView();applyView();
    }else if(keys.length===2&&v0&&d0>0){
      var a=pts[keys[0]],b=pts[keys[1]],d=Math.hypot(a.x-b.x,a.y-b.y),f=d0/d;
      moved=true;
      var r=mapSvg.getBoundingClientRect();
      var mx=((a.x+b.x)/2-r.left)/r.width*v0.w+v0.x, my=((a.y+b.y)/2-r.top)/r.height*v0.h+v0.y;
      view.w=v0.w*f;view.h=v0.h*f;view.x=mx-(mx-v0.x)*f;view.y=my-(my-v0.y)*f;
      clampView();applyView();
    }
  });
  function up(e){delete pts[e.pointerId];if(!Object.keys(pts).length){last=null;v0=null;mapSvg.classList.remove("drag");if(moved)renderMarkers();}}
  mapSvg.addEventListener("pointerup",up);mapSvg.addEventListener("pointercancel",up);
  mapSvg.addEventListener("wheel",function(e){
    e.preventDefault();
    var r=mapSvg.getBoundingClientRect();
    zoomAt(e.deltaY>0?1.15:0.87,(e.clientX-r.left)/r.width*view.w+view.x,(e.clientY-r.top)/r.height*view.h+view.y);
  },{passive:false});
}

var DAYNAMES=["dim","lun","mar","mer","jeu","ven","sam"];
function dayPeakStars(day){
  var r=dayRange(day),best=0;
  for(var t=r[0];t<=r[1];t++){var p=peaks()[t];if(p&&p.c.stars>best)best=p.c.stars;}
  return best;
}
function renderDays(){
  var box=$("days");box.innerHTML="";
  var cur=G.days.indexOf(dayOf(ti));
  G.days.forEach(function(D,d){
    var dt=new Date(D+"T12:00:00"),k=d-todayIdx();
    var b=document.createElement("button");
    b.className="day "+(k<=3?"conf-high":k<=6?"conf-mid":"conf-low");
    b.type="button";
    b.setAttribute("aria-pressed",d===cur?"true":"false");
    var st=dayPeakStars(d);
    b.innerHTML='<span class="dn">'+(d===todayIdx()?"auj.":DAYNAMES[dt.getDay()])+'</span>'+
      '<span class="dd">'+dt.getDate()+'/'+(dt.getMonth()+1)+'</span>'+
      '<span class="dstars">'+(st>0?starSVG(st,11,colStars(st)):'<span class="flat">plat</span>')+'</span>';
    b.addEventListener("click",function(){
      // on garde l'heure si elle existe ce jour-là, sinon on va au meilleur créneau
      var r=dayRange(d),want=-1,bestT=-1,bestS=-1;
      for(var t=r[0];t<=r[1];t++){
        if(!isDay(t))continue;
        if(hourOf(t)===hourOf(ti))want=t;
        var p=peaks()[t];
        if(p&&p.c.score>bestS){bestS=p.c.score;bestT=t;}
      }
      ti = want>=0?want : (bestT>=0?bestT:nearestDay(r[0]));
      render();scrollStripTo(ti);
    });
    box.appendChild(b);
  });
}
// ---------- frise : houle au large + qualité ----------
var CW=11, SH={swell:[8,60], bars:[66,104], lab:[108,124]};
function refSwell(t){
  var h=0,p=0,n=0;
  for(var i=0;i<S.length;i++){
    if(S[i].shelter<0.85)continue;
    var c=cellAt(i,t); if(!c||c.H0==null)continue;
    h+=c.H0;p+=c.T;n++;
  }
  return n?{h:h/n,p:p/n}:null;
}
// la frise ne montre que le jour choisi, plus une marge avant et apres
function stripRange(){
  var r=dayRange(G.days.indexOf(dayOf(ti)));
  return [Math.max(0,r[0]-3), Math.min(G.times.length-1,r[1]+3)];
}
function renderStrip(){
  var svg=$("strip"),rg=stripRange(),a=rg[0],b=rg[1],N=b-a+1,W=N*CW;
  svg.setAttribute("width",W);svg.setAttribute("viewBox","0 0 "+W+" 128");
  while(svg.firstChild)svg.removeChild(svg.firstChild);
  var maxH=0.8,maxP=8,ref=[];
  for(var t=a;t<=b;t++){var r=refSwell(t);ref.push(r);if(r){maxH=Math.max(maxH,r.h);maxP=Math.max(maxP,r.p);}}
  for(var t2=a;t2<=b;t2++){
    if(!isDay(t2))svg.appendChild(el("rect",{x:(t2-a)*CW,y:SH.swell[0],width:CW,height:SH.bars[1]-SH.swell[0],fill:"var(--ink)",opacity:".06"}));
  }
  var top=[],bot=[];
  for(var t3=a;t3<=b;t3++){
    var r3=ref[t3-a],y=r3?SH.swell[1]-(r3.h/maxH)*(SH.swell[1]-SH.swell[0]):SH.swell[1];
    top.push(((t3-a)*CW+CW/2)+","+y.toFixed(1));bot.push(((t3-a)*CW+CW/2)+","+SH.swell[1]);
  }
  svg.appendChild(el("polygon",{points:top.join(" ")+" "+bot.reverse().join(" "),fill:"var(--accent)",opacity:".28"}));
  svg.appendChild(el("polyline",{points:top.join(" "),fill:"none",stroke:"var(--accent)","stroke-width":1.6}));
  var per=[];
  for(var t4=a;t4<=b;t4++){var r4=ref[t4-a];if(r4)per.push(((t4-a)*CW+CW/2)+","+(SH.swell[1]-(r4.p/maxP)*(SH.swell[1]-SH.swell[0])).toFixed(1));}
  svg.appendChild(el("polyline",{points:per.join(" "),fill:"none",stroke:"var(--ink-soft)","stroke-width":1.2,"stroke-dasharray":"3 2.5",opacity:".85"}));
  var pk=peaks();
  for(var t5=a;t5<=b;t5++){
    var p5=pk[t5];if(!p5)continue;
    var st=p5.c.stars,hgt=(st/4)*(SH.bars[1]-SH.bars[0]);
    if(hgt<=0)continue;
    svg.appendChild(el("rect",{x:(t5-a)*CW+1,y:SH.bars[1]-hgt,width:CW-2,height:hgt,fill:colStars(st),rx:1.5}));
  }
  for(var t6=a;t6<=b;t6++){
    var hh=hourOf(t6);
    if(hh%2)continue;
    var tx=el("text",{x:(t6-a)*CW+CW/2,y:SH.lab[1],"text-anchor":"middle","font-size":"9","font-family":"var(--mono)",fill:"var(--ink-soft)",opacity:(t6===ti?1:.7)});
    tx.textContent=hh;svg.appendChild(tx);
  }
  svg.appendChild(el("rect",{x:(ti-a)*CW-1,y:SH.swell[0],width:CW+2,height:SH.bars[1]-SH.swell[0],fill:"none",stroke:"var(--ink)","stroke-width":1.8,rx:2}));
  var hit=el("rect",{x:0,y:0,width:W,height:128,fill:"transparent",style:"cursor:pointer"});
  hit.addEventListener("click",function(e){
    var r=svg.getBoundingClientRect();
    var t=a+Math.floor((e.clientX-r.left)/r.width*N);
    ti=nearestDay(Math.max(a,Math.min(b,t)));render();
  });
  svg.appendChild(hit);
}
function nearestDay(t){
  if(isDay(t))return t;
  for(var d=1;d<14;d++){
    if(t+d<G.times.length&&isDay(t+d))return t+d;
    if(t-d>=0&&isDay(t-d))return t-d;
  }
  return t;
}
function scrollStripTo(t){
  var sc=$("scroller"),rg=stripRange();
  sc.scrollLeft=Math.max(0,(t-rg[0])*CW-sc.clientWidth/2+CW/2);
}
// ---------- verdict ----------
function renderVerdict(){
  var b=$("verdict"),wb=weekBest();
  if(!wb){
    b.disabled=true;
    b.innerHTML='<div class="vlab">Les dix prochains jours</div><div class="vmain"><span class="vspot">Rien de surfable</span></div><div class="vtoday">Aucun des '+S.length+' spots n\'atteint son seuil sur toute la fenêtre.</div>';
    return;
  }
  b.disabled=false;
  var dt=new Date(dayOf(wb.t)+"T12:00:00"), isToday=G.days.indexOf(dayOf(wb.t))===todayIdx();
  var when=(isToday?"aujourd'hui":dt.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"short"}))+" · "+hourOf(wb.t)+"h";
  var r=dayRange(todayIdx()),tb=null;
  for(var t=r[0];t<=r[1];t++){var p=peaks()[t];if(p&&(!tb||p.c.score>tb.p.c.score))tb={t:t,p:p};}
  b.innerHTML='<div class="vlab">Meilleur des dix prochains jours</div>'+
    '<div class="vmain"><span class="vspot">'+S[wb.i].name+'</span>'+starSVG(wb.c.stars,15,colStars(wb.c.stars))+'<span class="vwhen">'+when+'</span></div>'+
    '<div class="vtoday">Aujourd\'hui : '+(tb?('<b>'+S[tb.p.i].name+'</b>'+starSVG(tb.p.c.stars,11,colStars(tb.p.c.stars))+' vers '+hourOf(tb.t)+'h'):'rien de surfable')+'</div>';
  b.onclick=function(){ti=wb.t;sel=wb.i;render();scrollStripTo(ti);window.scrollTo({top:0,behavior:"smooth"});};
}

// ---------- classement ----------
function renderRank(){
  var ol=$("rank");ol.innerHTML="";
  $("rankh").textContent="Classement à "+hourOf(ti)+"h";
  var list=[];
  for(var i=0;i<S.length;i++){
    if(!visible(i))continue;
    var c=cellAt(i,ti);
    if(c&&!c.fail&&c.stars>=1)list.push({i:i,c:c});
  }
  if(sortBy==="name")list.sort(function(a,b){return S[a.i].name.localeCompare(S[b.i].name);});
  else if(sortBy==="zone")list.sort(function(a,b){return S[a.i].zone-S[b.i].zone||b.c.score-a.c.score;});
  else list.sort(function(a,b){return b.c.score-a.c.score;});
  if(!list.length){
    var li=document.createElement("li");li.style.cursor="default";
    li.innerHTML='<span></span><span class="nm">Rien de surfable à cette heure avec ces filtres.</span><span></span><span></span>';
    ol.appendChild(li);return;
  }
  var day=G.days.indexOf(dayOf(ti));
  list.slice(0,14).forEach(function(r){
    var bh=bestHourOf(r.i,day),li=document.createElement("li");
    li.innerHTML=starSVG(r.c.stars,12,colStars(r.c.stars))+
      '<span class="nm">'+(FAV[r.i]?"★ ":"")+S[r.i].name+
      '<small>'+nf(r.c.face.toFixed(1))+' m · '+Math.round(r.c.wind)+' kn '+WCAT[r.c.wcat]+'</small></span>'+
      '<span class="hh">'+(bh?"idéal "+hourOf(bh.t)+"h":"")+'</span><span></span>';
    li.addEventListener("click",function(){sel=r.i;render();});
    ol.appendChild(li);
  });
}

// ---------- boussole et courbes ----------
function bxy(cx,cy,r,deg){var a=deg*Math.PI/180;return [cx+r*Math.sin(a),cy-r*Math.cos(a)];}
function compass(sp,c){
  var cx=59,cy=59,r=42,o='<svg class="compass" viewBox="0 0 118 118" aria-label="Orientation du spot, de la houle et du vent">';
  var a0=sp.win[0],a1=sp.win[1];if(a1<a0)a1+=360;
  var p0=bxy(cx,cy,r,a0),p1=bxy(cx,cy,r,a1),lg=(a1-a0)>180?1:0;
  o+='<path d="M'+cx+' '+cy+' L'+p0[0].toFixed(1)+' '+p0[1].toFixed(1)+' A'+r+' '+r+' 0 '+lg+' 1 '+p1[0].toFixed(1)+' '+p1[1].toFixed(1)+' Z" fill="var(--accent)" opacity=".13"/>';
  o+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="var(--rule)"/>';
  ["N","E","S","O"].forEach(function(l,k){var t=bxy(cx,cy,r+9,k*90);
    o+='<text x="'+t[0].toFixed(1)+'" y="'+(t[1]+3.5).toFixed(1)+'" text-anchor="middle" font-size="9.5" fill="var(--ink-soft)">'+l+'</text>';});
  for(var d=0;d<360;d+=30){var q0=bxy(cx,cy,r,d),q1=bxy(cx,cy,r-4,d);
    o+='<line x1="'+q0[0].toFixed(1)+'" y1="'+q0[1].toFixed(1)+'" x2="'+q1[0].toFixed(1)+'" y2="'+q1[1].toFixed(1)+'" stroke="var(--rule)"/>';}
  var s1=bxy(cx,cy,25,(sp.orient+90)%360),s2=bxy(cx,cy,25,(sp.orient+270)%360);
  o+='<line x1="'+s1[0].toFixed(1)+'" y1="'+s1[1].toFixed(1)+'" x2="'+s2[0].toFixed(1)+'" y2="'+s2[1].toFixed(1)+'" stroke="var(--land-edge)" stroke-width="4" stroke-linecap="round"/>';
  var f1=bxy(cx,cy,29,sp.orient);
  o+='<line x1="'+cx+'" y1="'+cy+'" x2="'+f1[0].toFixed(1)+'" y2="'+f1[1].toFixed(1)+'" stroke="var(--land-edge)" stroke-width="1.6" stroke-dasharray="3 3"/>';
  if(c&&c.dir!=null){
    var h0=bxy(cx,cy,r-3,c.dir),h1=bxy(cx,cy,12,c.dir);
    o+='<line x1="'+h0[0].toFixed(1)+'" y1="'+h0[1].toFixed(1)+'" x2="'+h1[0].toFixed(1)+'" y2="'+h1[1].toFixed(1)+'" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>';
    var hh=bxy(cx,cy,10,c.dir),ha=bxy(cx,cy,19,(c.dir+9)%360),hb=bxy(cx,cy,19,(c.dir+351)%360);
    o+='<path d="M'+hh[0].toFixed(1)+' '+hh[1].toFixed(1)+' L'+ha[0].toFixed(1)+' '+ha[1].toFixed(1)+' L'+hb[0].toFixed(1)+' '+hb[1].toFixed(1)+' Z" fill="var(--accent)"/>';
    var wc=c.wcat===0?"var(--s-top)":c.wcat===3?"var(--s-bad)":"var(--s-mid)";
    var v0=bxy(cx,cy,r-3,c.wdir),v1=bxy(cx,cy,22,c.wdir);
    o+='<line x1="'+v0[0].toFixed(1)+'" y1="'+v0[1].toFixed(1)+'" x2="'+v1[0].toFixed(1)+'" y2="'+v1[1].toFixed(1)+'" stroke="'+wc+'" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 2.5"/>';
    var vh=bxy(cx,cy,20,c.wdir),va=bxy(cx,cy,28,(c.wdir+8)%360),vb=bxy(cx,cy,28,(c.wdir+352)%360);
    o+='<path d="M'+vh[0].toFixed(1)+' '+vh[1].toFixed(1)+' L'+va[0].toFixed(1)+' '+va[1].toFixed(1)+' L'+vb[0].toFixed(1)+' '+vb[1].toFixed(1)+' Z" fill="'+wc+'"/>';
  }
  return o+"</svg>";
}
function hourCurve(i){
  var day=G.days.indexOf(dayOf(ti)),r=dayRange(day);
  var a=r[0],b=r[1],n=b-a+1,w=300/n;
  var o='<svg class="hcurve" viewBox="0 0 300 46" preserveAspectRatio="none" aria-hidden="true">';
  for(var t=a;t<=b;t++){
    var c=cellAt(i,t),st=(c&&!c.fail&&isDay(t))?c.stars:0,h=(st/4)*34;
    o+='<rect x="'+((t-a)*w+0.7)+'" y="'+(38-h)+'" width="'+(w-1.4)+'" height="'+Math.max(h,1.2)+'" fill="'+(st>0?colStars(st):"var(--s-none)")+'" opacity="'+(t===ti?1:(isDay(t)?.45:.15))+'" rx="1"/>';
    if(hourOf(t)%4===0)o+='<text x="'+((t-a)*w+w/2)+'" y="45" text-anchor="middle" font-size="7.5" fill="var(--ink-soft)" font-family="var(--mono)">'+hourOf(t)+'</text>';
  }
  return o+"</svg>";
}
function tideCurve(i){
  var day=G.days.indexOf(dayOf(ti)),r=dayRange(day),a=r[0],b=r[1],n=b-a+1;
  var sp=S[i],w=window.Scoring.TIDE_WINDOWS[sp.tide]||[0,1];
  var o='<svg class="tidecurve" viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">',prev=null;
  for(var t=a;t<=b;t++){
    var c=cellAt(i,t);if(!c||c.tideLevel==null)continue;
    var x=(t-a)/(n-1)*300,y=44-c.tideLevel*34;
    if(prev){
      var ok=sp.tide==="toutes"||(c.tideLevel>=w[0]&&c.tideLevel<=w[1]&&!(sp.tide==="mimontante"&&!c.rising));
      o+='<line x1="'+prev[0].toFixed(1)+'" y1="'+prev[1].toFixed(1)+'" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="'+(ok?"var(--accent)":"var(--rule)")+'" stroke-width="'+(ok?2.6:1.6)+'" stroke-linecap="round"/>';
    }
    if(t===ti)o+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3.4" fill="var(--accent)"/>';
    prev=[x,y];
  }
  o+='<text x="150" y="54" font-size="8" fill="var(--ink-soft)" text-anchor="middle">fenêtre '+TIDE_LABEL[sp.tide]+'</text>';
  return o+"</svg>";
}

// ---------- analyse ----------
function analysis(i){
  var sp=S[i],c=cellAt(i,ti);
  if(!c)return "Pas de donnée à cette heure pour ce spot.";
  if(c.fail==="fenetre")return "La houle vient du "+bearingWord(c.dir)+" et ce spot regarde au "+bearingWord(sp.orient)+" : elle passe devant sans rentrer. Fenêtre utile "+sp.win[0]+"–"+sp.win[1]+"°.";
  if(c.fail==="petit")return "Environ "+nf(c.face.toFixed(1))+" m de face, sous le seuil du spot. Rien à lever.";
  if(c.fail==="periode")return Math.round(c.T)+" s de période : c'est de la mer du vent, pas de la houle. Court, désordonné, sans puissance.";
  if(c.fail==="vent")return "Il y a de la vague, environ "+nf(c.face.toFixed(1))+" m de face, mais le vent de "+Math.round(c.wind)+" nœuds est dedans. La surface sera hachée.";
  if(c.fail==="gros")return "Trop gros : "+nf(c.face.toFixed(1))+" m de face, au-delà de ce que ce spot tient. Cherche un abri au fond d'une baie.";
  if(c.fail==="faible"){
    var weak=[["la taille",c.q.size],["la propreté",c.q.clean],["la marée",c.q.tide]].sort(function(a,b){return a[1]-b[1];})[0];
    return "Il y a des vagues — "+nf(c.face.toFixed(1))+" m de face à "+Math.round(c.T)+" s — mais pas de quoi se déplacer. Ce qui manque le plus : "+weak[0]+".";
  }
  var p=[];
  p.push("<strong>"+nf(c.face.toFixed(1))+" m de face</strong> (houle "+nf(c.Hs.toFixed(1))+" m à "+Math.round(c.T)+" s), vent de "+Math.round(c.wind)+" nœud"+(c.wind>=2?"s":"")+" "+WCAT[c.wcat]+", "+tideWord(c.tideLevel,c.rising)+", coefficient "+c.coef+".");
  if(c.wcat===0&&c.wind<=10)p.push("Vent offshore et faible : creux et bien tenu.");
  else if(c.wcat===0)p.push("Offshore mais soutenu : ça tiendra la lèvre, en plus musclé.");
  else if(c.wcat===3)p.push("Vent onshore : la surface restera brouillonne malgré la taille.");
  if(c.gust!=null&&c.gust-c.wind>=12)p.push("Rafales à "+Math.round(c.gust)+" nœuds : ça va travailler la surface par à-coups.");
  if(c.windMem!=null&&c.windMem<0.35)p.push("La mer garde la trace d'un vent contraire sur les heures précédentes : elle ne sera pas encore rangée.");
  if(c.cross)p.push("<strong>Mer croisée</strong> : un second train à "+Math.round(c.cross.p)+" s arrive du "+bearingWord(c.cross.d)+". Pics désordonnés et séries qui se contrarient.");
  if(c.T>=13)p.push("Période longue : les séries arriveront nettement au-dessus de cette moyenne.");
  if(sp.shore&&c.q.tide>0.9)p.push("La marée place le shore dans sa fenêtre — c'est le moment pour le bodyboard.");
  else if(c.q.tide<0.45)p.push("Marée hors fenêtre ("+TIDE_LABEL[sp.tide]+") : ça bridera la qualité.");
  if(c.coef>=95)p.push("Gros coefficient : courant marqué et fenêtre qui défile vite.");
  return p.join(" ");
}

// ---------- fiche ----------
function bar(label,v,col){
  return '<div class="bar"><span>'+label+'</span><span class="track"><span class="fill" style="width:'+Math.round(v*100)+'%;background:'+col+'"></span></span><span class="val">'+Math.round(v*100)+'%</span></div>';
}
function renderPanel(){
  var p=$("panel");
  if(sel===null){
    var pk=peaks()[ti];
    p.innerHTML='<h2 class="ph">'+(pk?"Choisis un spot":"Rien à cette heure")+'</h2>'+
      '<p class="pz">'+new Date(dayOf(ti)+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})+' · '+hourOf(ti)+'h</p>'+
      '<p class="hint">Touche une pastille sur la carte ou une ligne du classement. La frise au-dessus fait défiler les dix jours heure par heure.</p>';
    return;
  }
  var sp=S[sel],c=cellAt(sel,ti),day=G.days.indexOf(dayOf(ti)),bh=bestHourOf(sel,day);
  var good=c&&!c.fail&&c.stars>=1;
  var h='<div class="phrow"><div><h2 class="ph">'+sp.name+'</h2><p class="pz">'+ZONES[sp.zone]+'</p></div>'+
    '<button class="fav" id="favbtn" type="button" aria-pressed="'+(FAV[sel]?"true":"false")+'" aria-label="Ajouter aux favoris">'+
    '<svg viewBox="0 0 20 20" width="24" height="24"><path d="'+STARPATH+'" fill="currentColor"/></svg></button></div>';
  if(good)h+='<div class="vrow">'+starSVG(c.stars,19,colStars(c.stars))+'<span class="tag" style="background:'+colStars(c.stars)+'">'+tagFor(c.stars)+'</span>'+tipBtn("etoiles")+'</div>';
  else h+='<div class="vrow">'+starSVG(0,19)+'<span class="tag" style="background:'+colCell(c)+'">'+
    (!c?"Pas de donnée":c.fail==="vent"||c.fail==="gros"?"Vagues inexploitables":c.fail==="faible"?"Des vagues, mais rien à en tirer":"Pas de vague")+'</span></div>';
  if(c&&c.fail==="faible"){
    h+='<div class="bars">'+bar("Taille",c.q.size,"var(--s-none)")+bar("Propreté",c.q.clean,"var(--s-none)")+bar("Marée",c.q.tide,"var(--s-none)")+'</div>';
  }
  if(c&&!c.fail){
    h+='<div class="barshead">Composition de la note'+tipBtn("composantes")+'</div>';
    h+='<div class="bars">'+bar("Taille",c.q.size,colStars(c.stars))+bar("Propreté",c.q.clean,colStars(c.stars))+bar("Marée",c.q.tide,colStars(c.stars))+'</div>';
  }
  if(c&&c.face!=null){
    h+='<div class="headline"><span><b>'+nf(c.face.toFixed(1))+' m</b> de face</span><span>'+arrowGlyph(c.wdir,"currentColor",12)+' <b>'+Math.round(c.wind)+' kn</b> '+WCAT[c.wcat]+'</span><span>coef <b>'+c.coef+'</b></span></div>';
  }
  if(confOf(ti)<1)h+='<div class="warn">Prévision à J+'+(day-todayIdx())+' : '+(confOf(ti)>0.5?"une tendance, à reconfirmer 48 h avant.":"purement indicatif, n'engage rien dessus.")+'</div>';
  if(bh)h+='<div class="best">Meilleure heure : <b>'+hourOf(bh.t)+'h</b>'+starSVG(bh.c.stars,13,colStars(bh.c.stars))+(bh.t!==ti?'<button type="button" id="goBest">y aller</button>':'')+'</div>';
  h+='<p class="analysis">'+analysis(sel)+'</p>';

  if(c&&c.face!=null){
    // orientations d'abord : c'est ce qui explique tout le reste
    h+='<div class="sect">Orientations'+tipBtn("fenetre")+'</div><div class="comprow">'+compass(sp,c)+'<div class="complegend">'+
      '<div><i style="background:var(--land-edge);height:4px"></i>Le spot regarde au <b>'+bearingWord(sp.orient)+'</b> ('+sp.orient+'\u00b0). La zone claire est sa fen\u00eatre de houle.</div>'+
      '<div><i style="background:var(--accent)"></i>Houle du <b>'+bearingWord(c.dir)+'</b> ('+Math.round(c.dir)+'\u00b0)'+(window.Scoring.inWin(c.dir,sp.win[0],sp.win[1])?", dans la fen\u00eatre":", <b>hors fen\u00eatre</b>")+'.</div>'+
      '<div><i style="background:'+(c.wcat===0?"var(--s-top)":c.wcat===3?"var(--s-bad)":"var(--s-mid)")+'"></i>Vent du <b>'+bearingWord(c.wdir)+'</b> ('+Math.round(c.wdir)+'\u00b0), <b>'+WCAT[c.wcat]+'</b>.</div>'+
      '<div style="font-size:11.5px;opacity:.8">Les fl\u00e8ches montrent o\u00f9 va le flux.</div></div></div>';

    h+='<dl class="grid">'+
      '<div class="cell"><dt>Taille de face'+tipBtn("face")+'</dt><dd>'+nf(c.face.toFixed(1))+' m</dd></div>'+
      '<div class="cell"><dt>Houle au spot'+tipBtn("houle")+'</dt><dd>'+nf(c.Hs.toFixed(1))+' m <em>'+arrowGlyph(c.dir,"var(--accent)",11)+' '+Math.round(c.dir)+'\u00b0</em></dd></div>'+
      '<div class="cell"><dt>P\u00e9riode'+tipBtn("periode")+(c.cross?tipBtn("croisee"):"")+'</dt><dd>'+Math.round(c.T)+' s'+(c.cross?' <em>crois\u00e9e</em>':'')+'</dd></div>'+
      '<div class="cell"><dt>Vent'+tipBtn("vent")+'</dt><dd>'+Math.round(c.wind)+' kn <em>'+(c.gust!=null?("raf. "+Math.round(c.gust)):WCAT[c.wcat])+'</em></dd></div>'+
      '<div class="cell"><dt>Mar\u00e9e'+tipBtn("maree")+'</dt><dd>'+(c.coef!=null?("coef "+c.coef):"\u2014")+' <em>'+nf(c.range.toFixed(1))+' m</em></dd></div>'+
      '<div class="cell"><dt>Eau / air</dt><dd>'+(c.sst!=null?(Math.round(c.sst)+'\u00b0'):'\u2014')+' <em>'+Math.round(c.air)+'\u00b0 air</em></dd></div>'+
      '</dl>';

    h+='<div class="sect">Qualit\u00e9 heure par heure</div>'+hourCurve(sel);
    h+='<div class="sect">Mar\u00e9e \u2014 fen\u00eatre du spot en couleur'+tipBtn("maree")+'</div>'+tideCurve(sel);

    var ws=wetsuit(c.sst);
    h+='<p class="kit">'+(c.rain>0.2?('Pluie <b>'+nf(c.rain.toFixed(1))+' mm</b>. '):'Temps sec. ')+(ws?('Combinaison : <b>'+ws+'</b>'):'')+'</p>';
  }
  h+='<details id="det"><summary>R\u00e9glages du spot</summary>'+
    '<div class="meta"><span>Orientation <b>'+sp.orient+'\u00b0</b></span><span>Fen\u00eatre <b>'+sp.win[0]+'\u2013'+sp.win[1]+'\u00b0</b></span>'+
    '<span>Mar\u00e9e <b>'+TIDE_LABEL[sp.tide]+'</b></span><span>Taille utile <b>'+nf(sp.size[0])+'\u2013'+nf(sp.size[1])+' m</b></span>'+
    '<span>P\u00e9riode mini <b>'+sp.perMin+' s</b></span><span>Abri <b>'+sp.shelter+'</b></span>'+
    (sp.note?('<span style="flex-basis:100%">'+sp.note+'</span>'):'')+'</div></details>';

  if(day<=todayIdx()){
    h+='<div class="sect">Carnet'+tipBtn("carnet")+'</div>';
    if(!logOpen)h+='<button class="logbtn" id="opnlog" type="button">Noter cette session</button>';
    else{
      h+='<div class="logform"><p>Ce que tu as vraiment trouvé le '+new Date(dayOf(ti)+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"})+(bh?' (annoncé '+nf(bh.c.stars)+'★)':'')+' :</p>'+
        '<div class="starpick" id="pick"></div><div class="reasons" id="rsn"></div>'+
        '<textarea id="lognote" placeholder="Ce qui ne collait pas, ou ce qui était mieux que prévu…"></textarea>'+
        '<div class="logacts"><button type="button" id="logcancel">Annuler</button><button type="button" class="primary" id="logsave">Enregistrer</button></div></div>';
    }
  }
  p.innerHTML=h;

  var fb=$("favbtn");if(fb)fb.addEventListener("click",function(){if(FAV[sel])delete FAV[sel];else FAV[sel]=1;saveFav();render();});
  var gb=$("goBest");if(gb)gb.addEventListener("click",function(){ti=bh.t;render();scrollStripTo(ti);});
  var ol=$("opnlog");if(ol)ol.addEventListener("click",function(){logOpen=true;logStars=bh?bh.c.stars:0;logReasons=[];renderPanel();});
  var lc=$("logcancel");if(lc)lc.addEventListener("click",function(){logOpen=false;renderPanel();});
  var pick=$("pick");
  if(pick){
    for(var k=1;k<=4;k++)(function(k){
      var b2=document.createElement("button");b2.type="button";
      b2.innerHTML=oneStar(Math.max(0,Math.min(1,logStars-(k-1))),26);
      b2.style.color=logStars>=k-0.5?"var(--s-mid)":"var(--star-off)";
      b2.setAttribute("aria-label",k+" étoiles");
      b2.addEventListener("click",function(e){
        var r=b2.getBoundingClientRect();
        logStars=(e.clientX-r.left)<r.width/2?k-0.5:k;
        var n=$("lognote")?$("lognote").value:"";renderPanel();if($("lognote"))$("lognote").value=n;
      });
      pick.appendChild(b2);
    })(k);
    var lab=document.createElement("span");
    lab.style.cssText="margin-left:8px;font-family:var(--mono);font-size:13px;color:var(--ink-soft)";
    lab.textContent=logStars?nf(logStars)+"★":"0★ — pas surfable";
    pick.appendChild(lab);
    REASONS.forEach(function(rr){
      var b3=document.createElement("button");b3.type="button";b3.className="chip";
      b3.setAttribute("aria-pressed",logReasons.indexOf(rr)>=0?"true":"false");b3.textContent=rr;
      b3.addEventListener("click",function(){
        var k2=logReasons.indexOf(rr);if(k2>=0)logReasons.splice(k2,1);else logReasons.push(rr);
        var n=$("lognote").value;renderPanel();if($("lognote"))$("lognote").value=n;
      });
      $("rsn").appendChild(b3);
    });
    $("logsave").addEventListener("click",function(){
      var c2=cellAt(sel,ti);
      LOG.unshift({spot:sp.name,slug:slug(sp.name),date:dayOf(ti),hour:hourOf(ti),
        predicted:bh?bh.c.stars:0,actual:logStars,reasons:logReasons.slice(),
        note:$("lognote").value.trim(),
        face:c2&&c2.face!=null?+c2.face.toFixed(1):null,per:c2&&c2.T!=null?Math.round(c2.T):null,
        wind:c2&&c2.wind!=null?Math.round(c2.wind):null,wcat:c2?c2.wcat:null,
        tide:c2&&c2.tideLevel!=null?+c2.tideLevel.toFixed(2):null,coef:c2?c2.coef:null,v:VERSION});
      saveLog();logOpen=false;render();toast("Session enregistrée");
    });
  }
}

// ---------- carnet ----------
function renderSessions(){
  var box=$("sessions");
  var head='<h2>Carnet de session'+(LOG.length?' <span style="font-weight:400;text-transform:none;letter-spacing:0">('+LOG.length+')</span>':'')+
    '<span class="acts"><button type="button" id="exp">Exporter</button><label for="imp">Importer</label>'+
    '<input id="imp" type="file" accept="application/json,.json" class="sr"></span></h2>';
  if(!LOG.length){
    box.innerHTML=head+'<p class="hint" style="font-size:13px">Vide pour l\'instant. Après chaque session, ouvre le spot et note ce que tu as vraiment trouvé : c\'est ce qui corrigera les réglages au fil de la saison.</p>';
  }else{
    var h=head+'<div class="slist">';
    LOG.slice(0,14).forEach(function(s,k){
      var d=Math.round((s.actual-s.predicted)*10)/10;
      var col=Math.abs(d)<0.5?"var(--s-good)":d<0?"var(--s-bad)":"var(--s-top)";
      h+='<div class="srow"><span class="sd">'+new Date(s.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"})+'</span>'+
        '<span class="sn">'+s.spot+'</span>'+starSVG(s.actual,12,colStars(s.actual))+
        '<span class="delta" style="background:'+col+'">'+(d>0?"+":"")+nf(d)+'</span>'+
        '<button class="del" data-k="'+k+'" aria-label="Supprimer">×</button>'+
        (((s.reasons&&s.reasons.length)||s.note)?'<span class="note">'+[(s.reasons||[]).join(" · "),s.note].filter(Boolean).join(" — ")+'</span>':'')+'</div>';
    });
    box.innerHTML=h+'</div>';
    box.querySelectorAll(".del").forEach(function(b){
      b.addEventListener("click",function(){LOG.splice(+b.dataset.k,1);saveLog();renderSessions();});
    });
  }
  $("exp").addEventListener("click",function(){
    var txt=JSON.stringify({app:"houle-bretagne",version:VERSION,exported:new Date().toISOString(),sessions:LOG},null,2);
    try{
      var a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([txt],{type:"application/json"}));
      a.download="carnet-surf.json";a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
      toast("Carnet téléchargé");
    }catch(e){
      if(navigator.clipboard)navigator.clipboard.writeText(txt).then(function(){toast("Carnet copié");},function(){toast("Export impossible");});
    }
  });
  $("imp").addEventListener("change",function(e){
    var f=e.target.files&&e.target.files[0];if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){
      try{
        var j=JSON.parse(rd.result);
        var arr=Array.isArray(j)?j:(j.sessions||[]);
        if(!Array.isArray(arr))throw new Error("format");
        var seen={};LOG.forEach(function(s){seen[s.date+"|"+s.spot+"|"+s.hour]=1;});
        var added=0;
        arr.forEach(function(s){
          if(!s||!s.date||!s.spot)return;
          var key=s.date+"|"+s.spot+"|"+s.hour;
          if(seen[key])return;seen[key]=1;LOG.push(s);added++;
        });
        LOG.sort(function(a,b){return (b.date||"").localeCompare(a.date||"");});
        saveLog();renderSessions();
        toast(added?(added+" session"+(added>1?"s":"")+" importée"+(added>1?"s":"")):"Rien de nouveau à importer");
      }catch(err){toast("Fichier illisible");}
    };
    rd.readAsText(f);e.target.value="";
  });
}

// ---------- chrome ----------
function renderChips(){
  [["f0",0],["f2",2],["f3",3]].forEach(function(x){$(x[0]).setAttribute("aria-pressed",minStars===x[1]?"true":"false");});
  $("ffav").setAttribute("aria-pressed",favOnly?"true":"false");
  $("segmap").setAttribute("aria-pressed",tab==="map"?"true":"false");
  $("seglist").setAttribute("aria-pressed",tab==="list"?"true":"false");
  var narrow=window.matchMedia("(max-width:860px)").matches;
  $("plate").hidden=narrow&&tab!=="map";
  document.querySelector(".rank").hidden=narrow&&tab!=="list";
}
function renderClock(){
  var d=new Date(dayOf(ti)+"T12:00:00");
  $("hnow").innerHTML=["dim","lun","mar","mer","jeu","ven","sam"][d.getDay()]+" "+d.getDate()+"/"+(d.getMonth()+1)+" · <b>"+hourOf(ti)+"h</b>";
  var co=G.coefs?G.coefs[dayOf(ti)]:null;
  $("coef").textContent=co?("coefficient "+co):"";
  $("prev").disabled=ti<=0;$("next").disabled=ti>=G.times.length-1;
}
function renderLegend(){
  $("legend").innerHTML=
    '<span>'+dotIcon(0,false)+'rien à en tirer</span>'+
    '<span>'+dotIcon(0,true)+'vagues inexploitables</span>'+
    '<span>'+dotIcon(1.5)+'1–2★</span>'+
    '<span>'+dotIcon(3)+'3★ (anneau)</span>'+
    '<span>'+dotIcon(4)+'4★ (anneau + point)</span>';
}
function dotIcon(st,hard){
  var c=st>0?colStars(st):(hard?"var(--s-bad)":"var(--s-none)");
  var o='<svg viewBox="0 0 22 22" width="16" height="16" aria-hidden="true">';
  if(st<=0){o+='<circle cx="11" cy="11" r="5.5" fill="none" stroke="'+c+'" stroke-width="2"/>';
    if(hard)o+='<line x1="7" y1="15" x2="15" y2="7" stroke="'+c+'" stroke-width="2"/>';}
  else{var r=5.5+st*0.9;
    o+='<circle cx="11" cy="11" r="'+r+'" fill="'+c+'"/>';
    if(st>=3)o+='<circle cx="11" cy="11" r="'+(r*0.55)+'" fill="none" stroke="var(--panel)" stroke-width="1.4"/>';
    if(st>=4)o+='<circle cx="11" cy="11" r="'+(r*0.2)+'" fill="var(--panel)"/>';}
  return o+"</svg>";
}
function stamp(){
  var d=new Date(fetchedAt),txt="";
  if(offline)txt+='<span class="offline">hors ligne</span><br>';
  else if(partial)txt+='<span class="offline">'+partial+' spots manquants</span><br>';
  txt+="relevé "+d.toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
  txt+='<br><button type="button" id="refresh">rafraîchir</button>';
  $("stamp").innerHTML=txt;
  $("refresh").addEventListener("click",function(){
    $("stamp").textContent="mise à jour…";
    loadData(true).then(function(p){offline=false;partial=p.partial;fetchedAt=p.at;return computeGrid(p);})
      .then(function(g){G=g;_peakCache=null;stamp();render();})
      .catch(function(){stamp();toast("Mise à jour impossible");});
  });
}
function render(){
  renderVerdict();renderDays();renderStrip();renderClock();renderChips();renderMarkers();renderRank();renderPanel();renderSessions();writeURL();
}

// ---------- démarrage ----------
function boot(){
  $("ver").textContent="v"+VERSION+" · moteur "+(window.Scoring?window.Scoring.VERSION:"?");
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").then(function(reg){
      // une nouvelle version déployée s'installe et prend la main sans attendre
      reg.addEventListener("updatefound",function(){
        var sw=reg.installing;
        if(!sw)return;
        sw.addEventListener("statechange",function(){
          if(sw.state==="installed"&&navigator.serviceWorker.controller)toast("Nouvelle version disponible — recharge la page");
        });
      });
      reg.update();
    }).catch(function(){});
  }
  Promise.all([
    fetch("spots.json").then(function(r){return r.json();}),
    fetch("coast.json").then(function(r){return r.json();})
  ]).then(function(res){
    S=res[0].spots;ZONES=res[0].zones;COAST=res[1].segments;
    if(/[?&]test=1/.test(location.search)){
      var s=document.createElement("script");s.src="tests.js";
      s.onload=function(){var r=window.SurfTests.run();toast(r.failed?("Tests : "+r.failed+" échec(s)"):("Tests : "+r.total+" cas OK"));if(r.failed)console.warn(r.fails);};
      document.body.appendChild(s);
    }
    return loadData(false);
  }).then(function(p){
    fetchedAt=p.at;partial=p.partial||0;
    return computeGrid(p);
  }).then(function(g){
    G=g;_peakCache=null;
    var now=new Date(),want=null;
    for(var t=0;t<G.times.length;t++){if(new Date(G.times[t]).getTime()>=now.getTime()){want=t;break;}}
    ti=nearestDay(want==null?0:want);
    readURL();
    drawMapBase();mapGestures();wireUI();
    $("boot").hidden=true;$("app").hidden=false;
    stamp();render();scrollStripTo(ti);
    try{
      if(!localStorage.getItem("houle-vu")){
        localStorage.setItem("houle-vu","1");
        setTimeout(openGuide,700);
      }
    }catch(e){}
  }).catch(function(err){
    $("boot").innerHTML='<h2>Pas de données</h2><p>'+(err&&err.message==="réseau indisponible"
      ?"Impossible de joindre Open-Meteo et aucune sauvegarde locale. Reviens quand tu auras du réseau."
      :"Le chargement a échoué : "+(err&&err.message||err)+"")+'</p>'+
      '<p style="font-size:12px">Si tu as ouvert le fichier directement depuis le disque, sers-le par une vraie URL — <code>python3 -m http.server</code> ou GitHub Pages.</p>';
  });
}
function step(n){
  var t=ti+n;
  while(t>=0&&t<G.times.length&&!isDay(t))t+=n>0?1:-1;
  if(t<0||t>=G.times.length)return;
  ti=t;render();scrollStripTo(ti);
}
function wireUI(){
  $("btnGuide").addEventListener("click",openGuide);
  $("prev").addEventListener("click",function(){step(-1);});
  $("next").addEventListener("click",function(){step(1);});
  $("btnNow").addEventListener("click",function(){
    var now=new Date(),want=null;
    for(var t=0;t<G.times.length;t++){if(new Date(G.times[t]).getTime()>=now.getTime()){want=t;break;}}
    ti=nearestDay(want==null?0:want);render();scrollStripTo(ti);
  });
  $("btnPeak").addEventListener("click",function(){var w=weekBest();if(w){ti=w.t;sel=w.i;render();scrollStripTo(ti);}});
  $("zin").addEventListener("click",function(){zoomAt(0.72,view.x+view.w/2,view.y+view.h/2);});
  $("zout").addEventListener("click",function(){zoomAt(1.38,view.x+view.w/2,view.y+view.h/2);});
  $("zfit").addEventListener("click",function(){view={x:0,y:0,w:MW,h:MH};applyView();renderMarkers();});
  [["f0",0],["f2",2],["f3",3]].forEach(function(x){$(x[0]).addEventListener("click",function(){minStars=x[1];render();});});
  $("ffav").addEventListener("click",function(){favOnly=!favOnly;render();});
  $("segmap").addEventListener("click",function(){tab="map";renderChips();renderMarkers();});
  $("seglist").addEventListener("click",function(){tab="list";renderChips();});
  $("sort").addEventListener("change",function(e){sortBy=e.target.value;renderRank();});
  var qt=null;
  $("q").addEventListener("input",function(e){
    clearTimeout(qt);var v=e.target.value;
    qt=setTimeout(function(){query=v;renderMarkers();renderRank();},160);
  });
  window.addEventListener("resize",function(){renderChips();renderMarkers();});
  window.addEventListener("hashchange",function(){if(readURL()){render();scrollStripTo(ti);}});
  document.addEventListener("keydown",function(e){
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    if(e.key==="ArrowLeft"){e.preventDefault();step(-1);}
    if(e.key==="ArrowRight"){e.preventDefault();step(1);}
  });
  renderLegend();
}
boot();
})();
