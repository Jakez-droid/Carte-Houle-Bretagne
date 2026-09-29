/* sw.js — service worker : la page reste consultable sans réseau.
   Règle : le réseau d'abord quand il répond vite, le cache sinon.
   On ne sert jamais du code périmé alors que le réseau est disponible. */
var VERSION="houle-v3.0.2";
var SHELL=["./","./index.html","./style.css","./app.js","./scoring.js","./worker.js","./spots.json","./coast.json"];
var NET_TIMEOUT=2500;

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){
    return Promise.allSettled(SHELL.map(function(u){return c.add(new Request(u,{cache:"reload"}));}));
  }).then(function(){return self.skipWaiting();}));
});

self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==VERSION;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});

function netFirst(req,timeout){
  return new Promise(function(resolve){
    var settled=false;
    var timer=setTimeout(function(){
      if(settled)return;
      caches.match(req).then(function(hit){ if(!settled&&hit){settled=true;resolve(hit);} });
    },timeout);
    fetch(req).then(function(r){
      clearTimeout(timer);
      if(r&&(r.status===200||r.type==="opaque")){
        var copy=r.clone();
        caches.open(VERSION).then(function(c){c.put(req,copy);});
      }
      if(!settled){settled=true;resolve(r);}
    }).catch(function(){
      clearTimeout(timer);
      caches.match(req).then(function(hit){
        if(settled)return;
        settled=true;
        resolve(hit||new Response("hors ligne",{status:503}));
      });
    });
  });
}

self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  var url=new URL(req.url);
  var isForecast=/(^|\.)open-meteo\.com$/.test(url.hostname);
  if(isForecast){ e.respondWith(netFirst(req,6000)); return; }
  if(url.origin!==location.origin)return;     // polices : laissées au navigateur
  e.respondWith(netFirst(req,NET_TIMEOUT));   // code et données : jamais de version périmée en ligne
});
