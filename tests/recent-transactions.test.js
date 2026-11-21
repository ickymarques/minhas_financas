const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function installmentPurchaseDate(');
const end=html.indexOf('function renderDashboard(',start);
assert.ok(start>=0&&end>start,'O resumo deve manter uma única regra para as compras recentes');
const context=vm.createContext({Date,Map,String,Number});
vm.runInContext(html.slice(start,end)+';globalThis.recentTransactionPurchases=recentTransactionPurchases',context);
const recent=context.recentTransactionPurchases;

test('parcelas antigas não ocupam as posições das compras mais recentes',()=>{
 const rows=[
  {id:'fogao16',description:'Fogão 4 bocas',account:'Itaú',date:'2026-07-10',installmentLabel:'16/18'},
  {id:'fogao17',description:'Fogão 4 bocas',account:'Itaú',date:'2026-08-10',installmentLabel:'17/18'},
  {id:'fogao18',description:'Fogão 4 bocas',account:'Itaú',date:'2026-09-10',installmentLabel:'18/18'},
  {id:'salario',description:'Salário',date:'2026-09-05'},
  {id:'posto',description:'Combustível',date:'2026-09-19'},
  {id:'mercado',description:'Mercado',date:'2026-09-22'}
 ];
 assert.deepEqual(Array.from(recent(rows,'2026-09-24'),t=>t.id),['mercado','posto','salario']);
 assert.equal(recent(rows.filter(t=>t.description==='Fogão 4 bocas'),'2026-09-24').length,1);
});

test('compra parcelada nova aparece uma vez pela data da compra',()=>{
 const rows=[
  {id:'p2',description:'Celular',installmentGroup:'celular',installmentLabel:'Parcela 2/3',date:'2026-10-21'},
  {id:'p1',description:'Celular',installmentGroup:'celular',installmentLabel:'Parcela 1/3',date:'2026-09-21'},
  {id:'p3',description:'Celular',installmentGroup:'celular',installmentLabel:'Parcela 3/3',date:'2026-11-21'},
  {id:'later',description:'Compra futura',date:'2026-10-01'},
  {id:'deferred',description:'Pagamento futuro',date:'2026-10-05',purchaseDate:'2026-09-20'}
 ];
 const output=recent(rows,'2026-09-24');
 assert.deepEqual(Array.from(output,t=>[t.id,t.date]),[['p1','2026-09-21'],['deferred','2026-09-20']]);
 assert.equal(output[0].installmentLabel,'Compra parcelada · 3x');
});

test('faturas que repetem a data original da compra também são agrupadas',()=>{
 const rows=[16,17,18].map(n=>({id:`fogao${n}`,description:'Fogão 4 bocas',account:'Itaú',amount:76.76,date:'2025-04-10',installmentLabel:`${n}/18`}));
 const output=recent(rows,'2026-09-24');
 assert.equal(output.length,1);
 assert.equal(output[0].date,'2025-04-10');
});
