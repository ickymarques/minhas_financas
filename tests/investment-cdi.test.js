const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('let cdiAnnualRate='),html.indexOf('function renderInvestments(){'));
function context(options={}){
 const events={},stored=new Map(),requests=[];let renders=0;
 const today=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date());
 const ctx={URL,Date,Number,Math,String,JSON,Intl,Promise,AbortController,console,SUPABASE_URL:'https://example.supabase.co',SUPABASE_KEY:'public',navigator:{onLine:options.online!==false},document:{addEventListener(){},visibilityState:'visible'},window:{addEventListener:(n,h)=>events[n]=h},setTimeout,clearTimeout,
 localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>{if(options.storageError)throw Error('quota');stored.set(k,v)}},renderInvestments:()=>renders++,fetch:async url=>{requests.push(url);if(url.endsWith('cdi-reference.json'))return {ok:true,json:async()=>({rate:13.65,date:today,source:'BrasilAPI',cached:true})};if(options.failServer&&url.includes('/functions/'))throw Error('network');if(url.includes('bcb.gov.br'))throw Error('BCB unavailable');return {ok:true,json:async()=>url.includes('brasilapi')?({nome:'CDI',valor:13.65}):({rate:13.65,date:today,source:'BrasilAPI'})}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,events,requests,stored,today,renders:()=>renders};
}
test('CDI pelo servidor permite calcular sem depender do BCB no navegador',async()=>{
 const {ctx,requests}=context();await ctx.refreshCdiRate(true);
 const rate=ctx.investmentMonthlyRate({rateType:'cdi',rate:100});
 assert.ok(Math.abs(rate-((1.1365)**(1/12)-1))<1e-12);
 assert.ok(requests.some(u=>u.includes('/functions/v1/cdi-reference')));
 assert.ok(!requests.some(u=>u.includes('bcb.gov.br')));
 const points=ctx.investmentForecast([{balance:6850,asOf:new Date().toISOString().slice(0,10),rateType:'cdi',rate:100,taxType:'taxable',contribution:0}],12);
 assert.ok(points[12].gross>6850);assert.ok(points[12].value<points[12].gross);assert.ok(points[12].value>6850);
});
test('falha de armazenamento não elimina a taxa recebida',async()=>{
 const {ctx}=context({storageError:true});await ctx.refreshCdiRate(true);
 assert.ok(ctx.investmentMonthlyRate({rateType:'cdi',rate:121})>0);
});
test('falha do servidor e do BCB usa fonte alternativa e reconexão consulta novamente',async()=>{
 const {ctx,requests,events}=context({failServer:true});await ctx.refreshCdiRate(true);
 assert.ok(requests.some(u=>u.includes('brasilapi.com.br')));
 const count=requests.length;await events.online();assert.ok(requests.length>count);
});
test('sem internet usa referência pública salva e não inventa taxa para datas antigas',async()=>{
 const {ctx,today,requests}=context({online:false});await ctx.refreshCdiRate(true);
 assert.ok(ctx.investmentMonthlyRate({rateType:'cdi',rate:100})>0);
 assert.equal(requests.length,1);
 assert.equal(ctx.acceptCdiReference({rate:13.65,date:'01/01/2000'}),false);
 assert.equal(ctx.acceptCdiReference({rate:13.65,date:'31/02/2026'}),false);
 assert.equal(ctx.validCdiReference({rate:13.65,date:today}),true);
});
test('percentual do CDI incide sobre taxa diária e investimento não modifica entradas ou saídas',async()=>{
 const {ctx}=context();await ctx.refreshCdiRate(true);
 const actual=ctx.investmentMonthlyRate({rateType:'cdi',rate:121});
 const expected=(1+((1.1365)**(1/252)-1)*1.21)**21-1;
 assert.ok(Math.abs(actual-expected)<1e-12);
 const item={balance:6850,rateType:'cdi',rate:121,asOf:'2026-10-01',contribution:100,taxType:'taxable'},before=JSON.stringify(item);
 ctx.investmentForecast([item],24);assert.equal(JSON.stringify(item),before);
 assert.equal(ctx.investmentMonthlyRate({rateType:'monthly',rate:1}),0.01);
});

test('resumo exibe rendimento e gráfico responde ao seletor sem alterar investimentos',async()=>{
 const {ctx}=context();await ctx.refreshCdiRate(true);
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:id==='#investmentHorizon'?'12':'',attrs:{},setAttribute(k,v){this.attrs[k]=v},querySelectorAll(){return []},getBoundingClientRect(){return {left:0,width:600}}});return nodes.get(id)};
 ctx.$=node;ctx.state={investments:[{id:'sample',name:'Reserva',balance:6850,asOf:new Date().toISOString().slice(0,10),rateType:'cdi',rate:100,contribution:100,taxType:'taxable'}]};
 ctx.fmt=v=>'R$ '+v.toFixed(2);ctx.esc=v=>String(v);const before=JSON.stringify(ctx.state);
 vm.runInContext(html.slice(html.indexOf('function renderInvestments(){'),html.indexOf('function updateInvestmentRateFields()')),ctx);
 ctx.renderInvestments();
 assert.match(node('#investmentSummary').innerHTML,/Quanto rende em 1 mês/);
 assert.match(node('#investmentSummary').innerHTML,/Líquido estimado/);
 assert.match(node('#investmentProjection').innerHTML,/investmentInteractiveChart/);
 node('#investmentChartMonth').oninput({target:{value:'3'}});
 assert.match(node('#investmentChartDetails').innerHTML,/Em 3 meses/);
 assert.match(node('#investmentChartDetails').innerHTML,/Tributos estimados/);
 assert.match(node('#investmentChartDetails').innerHTML,/Ganho líquido/);
 assert.equal(node('#investmentChartCursor').attrs.x1,189);
 node('#investmentInteractiveChart').onclick({clientX:576});
 assert.match(node('#investmentChartDetails').innerHTML,/Em 12 meses/);
 assert.equal(JSON.stringify(ctx.state),before);
});
