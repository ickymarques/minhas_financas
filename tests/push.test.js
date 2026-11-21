const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function worker(clients){
 const handlers={},shown=[];
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{URL,Promise,self:{addEventListener:(k,h)=>handlers[k]=h,registration:{scope:'https://ickymarques.github.io/minhas_financas/',showNotification:async(t,o)=>shown.push({title:t,...o})},clients}});
 return {handlers,shown};
}
test('push exibe aviso mesmo se o payload estiver inválido',async()=>{
 const {handlers,shown}=worker({});let done;
 handlers.push({data:{json(){throw new Error('invalid')}},waitUntil:p=>done=p});await done;
 assert.equal(shown[0].title,'Meu Financeiro');assert.equal(shown[0].data.announcement,null);
});
test('clique abre somente o comunicado interno e ignora URL externa',async()=>{
 const opened=[];const {handlers}=worker({matchAll:async()=>[],openWindow:async u=>opened.push(u)});let done;
 handlers.notificationclick({notification:{close(){},data:{announcement:'regularize',url:'https://evil.example'}},waitUntil:p=>done=p});await done;
 assert.equal(opened[0],'https://ickymarques.github.io/minhas_financas/?announcement=regularize');
});
test('clique reutiliza janela existente sem abrir outro app',async()=>{
 let focused=0,message;const {handlers}=worker({matchAll:async()=>[{url:'https://ickymarques.github.io/minhas_financas/',focus:async()=>focused++,postMessage:m=>message=m}],openWindow:()=>assert.fail('janela duplicada')});let done;
 handlers.notificationclick({notification:{close(){},data:{announcement:'regularize'}},waitUntil:p=>done=p});await done;
 assert.equal(focused,1);assert.equal(message.type,'open-regularize');
});
