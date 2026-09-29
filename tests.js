/* tests.js — cas figés pour vérifier que la notation ne dérive pas.
   Lancement : node tests.js, ou la page avec ?test=1 */
(function(root){
"use strict";
var S = (typeof require!=="undefined") ? require("./scoring.js") : root.Scoring;

var laTorche={name:"La Torche",orient:255,win:[200,330],shelter:1.00,perMin:8,tide:"mimontante",size:[0.6,3.5],shore:true};
var leDossen={name:"Le Dossen",orient:340,win:[290,40],shelter:0.90,perMin:9,tide:"mi",size:[0.8,3.0],shore:true};
var porsmilin={name:"Porsmilin",orient:230,win:[240,290],shelter:0.35,perMin:11,tide:"toutes",size:[1.5,4.0],shore:false};

function base(o){
  return Object.assign({H0:1.5,dir:260,T:12,sec:{h:null,d:null,p:null},ter:{h:null,d:null,p:null},
    wind:8,wdir:75,gust:12,level:0.55,rising:true,range:5.5,air:14,rain:0,sst:16,windMem:null},o||{});
}
var cases=[];
function t(name,fn){cases.push([name,fn]);}
function near(a,b,tol){return Math.abs(a-b)<=tol;}

t("houle hors fenêtre = plat", function(){
  var r=S.scoreHour(leDossen, base({dir:250}));       // ouest sur un spot orienté nord
  return r.fail==="fenetre" ? null : "attendu fenetre, obtenu "+r.fail;
});
t("mer du vent courte = période", function(){
  var r=S.scoreHour(laTorche, base({H0:1.2,T:5.5}));
  return r.fail==="periode" ? null : "attendu periode, obtenu "+r.fail;
});
t("trop petit", function(){
  var r=S.scoreHour(laTorche, base({H0:0.25,T:11}));
  return r.fail==="petit" ? null : "attendu petit, obtenu "+r.fail;
});
t("onshore fort = vent", function(){
  var r=S.scoreHour(laTorche, base({wind:28,wdir:255,gust:36}));
  return r.fail==="vent" ? null : "attendu vent, obtenu "+r.fail;
});
t("offshore faible et houle longue = 4 étoiles", function(){
  var r=S.scoreHour(laTorche, base({H0:1.6,T:13,wind:6,wdir:75,level:0.55,rising:true}));
  return r.stars>=3.5 ? null : "attendu >=3.5, obtenu "+r.stars+" (score "+r.score+")";
});
t("mêmes vagues, vent de travers = moins bon", function(){
  var a=S.scoreHour(laTorche, base({wind:14,wdir:75}));
  var b=S.scoreHour(laTorche, base({wind:14,wdir:165}));
  return b.score<a.score ? null : "le travers devrait faire baisser ("+a.score+" vs "+b.score+")";
});
t("rafales fortes malgré un vent moyen correct", function(){
  var a=S.scoreHour(laTorche, base({wind:12,gust:14}));
  var b=S.scoreHour(laTorche, base({wind:12,gust:38}));
  return b.score<a.score-0.5 ? null : "les rafales devraient peser ("+a.score+" vs "+b.score+")";
});
t("mémoire de vent : une nuit onshore pénalise", function(){
  var a=S.scoreHour(laTorche, base({windMem:0.95}));
  var b=S.scoreHour(laTorche, base({windMem:0.10}));
  return b.score<a.score-0.8 ? null : "la mémoire devrait peser ("+a.score+" vs "+b.score+")";
});
t("mer croisée pénalisée", function(){
  var a=S.scoreHour(laTorche, base({}));
  var b=S.scoreHour(laTorche, base({sec:{h:1.0,d:190,p:7}}));
  return (b.score<a.score && b.cross) ? null : "la mer croisée devrait peser ("+a.score+" vs "+b.score+")";
});
t("marée hors fenêtre dégrade sans éliminer", function(){
  var a=S.scoreHour(leDossen, base({dir:330,level:0.50,rising:true}));
  var b=S.scoreHour(leDossen, base({dir:330,level:0.02,rising:false}));
  return (b.score<a.score && b.score>0) ? null : "attendu une baisse continue ("+a.score+" vs "+b.score+")";
});
t("seuils lissés : pas de bascule brutale", function(){
  var prev=null,maxJump=0;
  for(var h=0.30;h<=1.20;h+=0.02){
    var r=S.scoreHour(laTorche, base({H0:h,T:11}));
    // "faible" garde un score : c'est une étiquette, pas une falaise
    var sc=(r.fail&&r.fail!=="faible")?0:(r.score||0);
    if(prev!==null)maxJump=Math.max(maxJump,Math.abs(sc-prev));
    prev=sc;
  }
  return maxJump<=3.2 ? null : "saut trop brutal : "+maxJump.toFixed(1)+" points pour 2 cm";
});
t("sous une étoile = faible, avec les chiffres conservés", function(){
  var r=S.scoreHour(laTorche, base({H0:0.50,T:11}));
  if(r.fail!=="faible")return "attendu faible, obtenu "+r.fail;
  return (r.score>0&&r.face>0&&r.q.size>0) ? null : "les mesures devraient rester disponibles";
});
t("abri : Porsmilin reste petit sur houle moyenne", function(){
  var a=S.scoreHour(laTorche, base({H0:2.0,T:12}));
  var b=S.scoreHour(porsmilin, base({H0:2.0,T:12,dir:265}));
  return (b.fail==="petit"||b.score<a.score) ? null : "l'abri devrait filtrer ("+a.score+" vs "+(b.score||b.fail)+")";
});
t("incidence oblique réduit la taille", function(){
  var a=S.scoreHour(laTorche, base({dir:255}));
  var b=S.scoreHour(laTorche, base({dir:320}));
  return b.Hs<a.Hs ? null : "l'incidence devrait réduire ("+a.Hs.toFixed(2)+" vs "+b.Hs.toFixed(2)+")";
});
t("hauteur de face croît avec la période", function(){
  var a=S.faceHeight(1.0,7), b=S.faceHeight(1.0,15);
  return b>a*1.35 ? null : "la période devrait lever davantage ("+a.toFixed(2)+" vs "+b.toFixed(2)+")";
});
t("coefficient de marée plausible", function(){
  var c1=S.tideCoef(6.1), c2=S.tideCoef(2.5), c3=S.tideCoef(9.0);
  return (near(c1,100,3)&&c2<60&&c3>100) ? null : "coefficients inattendus : "+c1+", "+c2+", "+c3;
});
t("échelle d'étoiles monotone", function(){
  var last=-1;
  for(var s=0;s<=20;s+=0.5){ var v=S.starsFor(s); if(v<last)return "non monotone à "+s; last=v; }
  return S.starsFor(20)===4 ? null : "le maximum devrait valoir 4";
});

function run(){
  var fails=[];
  cases.forEach(function(c){
    var err;
    try{ err=c[1](); }catch(e){ err="exception : "+e.message; }
    if(err)fails.push(c[0]+" — "+err);
  });
  return {total:cases.length,failed:fails.length,fails:fails};
}
if(typeof module!=="undefined"&&module.exports){
  module.exports={run:run};
  if(require.main===module){
    var r=run();
    console.log(r.failed?("ÉCHECS "+r.failed+"/"+r.total+"\n"+r.fails.join("\n")):("OK — "+r.total+" cas passent"));
    process.exit(r.failed?1:0);
  }
} else root.SurfTests={run:run};
})(typeof self!=="undefined"?self:this);
