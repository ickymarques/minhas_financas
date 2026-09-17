const CACHE='meu-financeiro-v5-9-26';
const ASSETS=['./','./index.html','./manifest.webmanifest','./invoice-import.js','./recent-purchase-date.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.mode==='navigate'||url.pathname.endsWith('/minhas_financas/')||url.pathname.endsWith('/minhas_financas/index.html')){
    e.respondWith(fetch(e.request).then(async r=>{
      const html=await r.text();
      const patched=html.includes('recent-purchase-date.js')?html:html.replace('</body>','<script src="./recent-purchase-date.js"></script></body>');
      return new Response(patched,{status:r.status,statusText:r.statusText,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}})
    }).catch(()=>caches.match('./index.html').then(async r=>{
      if(!r)return r;const html=await r.text();return new Response(html.replace('</body>','<script src="./recent-purchase-date.js"></script></body>'),{headers:{'content-type':'text/html; charset=utf-8'}})
    }));return;
  }
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
