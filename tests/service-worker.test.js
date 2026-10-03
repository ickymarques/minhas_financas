const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('o app instalado armazena apenas arquivos presentes e preserva o HTML publicado',async()=>{
 const root=path.join(__dirname,'..'),handlers={},cached=[];
 const cache={addAll:async assets=>{for(const asset of assets){assert.ok(fs.existsSync(path.join(root,asset)),'Arquivo ausente no cache: '+asset);cached.push(asset)}},put:async()=>{}};
 const context={self:{addEventListener:(name,handler)=>{handlers[name]=handler},skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches:{open:async()=>cache,keys:async()=>[],match:async()=>null},fetch:async()=>({ok:true,clone(){return this}}),Promise};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
 let install;handlers.install({waitUntil:p=>{install=p}});await install;
 assert.ok(cached.includes('./index.html'));
 assert.ok(!cached.some(asset=>asset.includes('recent-purchase-date')));
 let navigation;handlers.fetch({request:{method:'GET',mode:'navigate'},respondWith:p=>{navigation=p}});const response=await navigation;
 assert.equal(response.ok,true);
});
