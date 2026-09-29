/* worker.js — calcule la grille complète hors du fil principal.
   L'interface ne recalcule plus rien quand on change d'heure ou de jour. */
importScripts("scoring.js");

self.onmessage=function(e){
  var d=e.data;
  try{
    var t0=Date.now();
    var res=self.Scoring.buildGrid(d.spots,d.marine,d.wx);
    if(!res){ self.postMessage({ok:false,error:"aucune donnée de houle exploitable"}); return; }
    res.ok=true;
    res.ms=Date.now()-t0;
    self.postMessage(res);
  }catch(err){
    self.postMessage({ok:false,error:String(err&&err.message||err)});
  }
};
