const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8');
const sync=source.slice(source.indexOf('async function pushCloud('),source.indexOf('async function enterSession('));

function device(db,initialVersion,initialState){
 const values=new Map(initialVersion?[['meuFinanceiroCloudUpdatedAt:user',initialVersion]]:[]);
 const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const state={...initialState};let status='';
 const result=payload=>({select:()=>({maybeSingle:async()=>{
   if(payload.expected!==undefined&&db.version!==payload.expected)return {data:null,error:null};
   if(payload.expected===undefined&&db.version)return {data:null,error:{code:'23505'}};
   db.data=payload.data;db.version=String(+(db.version||0)+1);
   return {data:{updated_at:db.version},error:null};
 }})});
 const query=payload=>({eq(key,value){if(key==='updated_at')payload.expected=value;return this},select:()=>result(payload).select()});
 const context={localStorage,state,cloudUser:{id:'user'},localOnly:false,cloudConflict:false,cloudBusy:false,cloudPushPending:false,sessionEpoch:0,cloudSaveTimer:null,
   cloud:{from(){return {update:query,insert:query}}},
   setCloudStatus:(_mode,message)=>{status=message},renderAll(){},clearTimeout(){},setTimeout(){},console,JSON,
   dirtyKey:id=>'meuFinanceiroPending:'+id,markPending(){localStorage.setItem('meuFinanceiroPending:user','1')},
   currentSession:(id,epoch)=>id==='user'&&epoch===0,readLocalState:()=>null,userCacheKey:id=>'meuFinanceiroData:user:'+id,
   applyState:data=>{Object.assign(state,data);return false},cacheState(){},renderOnboardingSummary(){}};
 vm.createContext(context);
 vm.runInContext(sync,context);
 return {context,state,values,status:()=>status};
}

test('segunda cópia preserva dados locais quando outra gravou primeiro',async()=>{
 const db={version:'1',data:{transactions:['original']}};
 const a=device(db,'1',{transactions:['A']}),b=device(db,'1',{transactions:['B']});
 a.context.markPending();b.context.markPending();
 await a.context.pushCloud();await b.context.pushCloud();
 assert.deepEqual(db.data.transactions,['A']);
 assert.deepEqual(b.state.transactions,['B']);
 assert.equal(b.context.cloudConflict,true);
 assert.match(b.status(),/Conflito/);
 assert.equal(b.values.get('meuFinanceiroPending:user'),'1');
});
