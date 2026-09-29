/* sw.js — service worker : la page reste consultable sans réseau.
   Coquille en cache-first, données en network-first avec repli sur le cache. */
var VERSION="houle-v3.0.0";
var SHELL=["./","./index.html","./style.css","./app.js","./scoring.js","./worker.js","./spots.json","./coast.json"];

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){
    return Promise.allSettled(SHELL.map(function(u){return c.add(u);}));
  }).then(function(){return self.skipWaiting();}));
});

self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==VERSION;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});

self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  var url=new URL(req.url);
  var isForecast=/open-meteo\.com$/.test(url.hostname)||/\.open-meteo\.com$/.test(url.hostname);

  if(isForecast){
    // réseau d'abord ; si ça échoue, on ressert la dernière réponse connue
    e.respondWith(
      fetch(req).then(function(r){
        var copy=r.clone();
        caches.open(VERSION).then(function(c){c.put(req,copy);});
        return r;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit||new Response(JSON.stringify({error:"hors ligne"}),{status:503,headers:{"Content-Type":"application/json"}});
        });
      })
    );
    return;
  }

  if(url.origin!==location.origin)return;   // polices, etc. : laissées au navigateur

  e.respondWith(
    caches.match(req).then(function(hit){
      var net=fetch(req).then(function(r){
        if(r&&r.status===200){var copy=r.clone();caches.open(VERSION).then(function(c){c.put(req,copy);});}
        return r;
      }).catch(function(){return hit;});
      return hit||net;
    })
  );
});
