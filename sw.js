const CACHE='meu-financeiro-v5-9-82-web-push';
const ASSETS=['./','./index.html','./manifest.webmanifest','./invoice-import.js','./push.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('push',event=>{
  let payload={};try{payload=event.data?.json()||{}}catch{}
  event.waitUntil(self.registration.showNotification(String(payload.title||'Meu Financeiro').slice(0,100),{
    body:String(payload.body||'Há um novo aviso no app.').slice(0,240),
    tag:String(payload.tag||'mf-notification').slice(0,100),
    data:{announcement:payload.announcement==='regularize'?'regularize':null}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const regularize=event.notification.data?.announcement==='regularize';
  const target=new URL('./'+(regularize?'?announcement=regularize':''),self.registration.scope);
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if(client.url.startsWith(self.registration.scope)){
      await client.focus();if(regularize)client.postMessage({type:'open-regularize'});return;
    }}
    await self.clients.openWindow(target.href);
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put('./index.html',response.clone())).catch(()=>{});
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
