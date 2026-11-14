// Public market data only. No user, financial or privileged database access.
// API-key validation allows the published frontend to request fixed BCB sources.
const PUBLIC_KEY='sb_publishable_mv2g3vGhw9VSs5w3Ws-AyQ_cvQapvL1';
const headers={'Access-Control-Allow-Origin':'https://ickymarques.github.io','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
let cached:any=null,loadedAt=0;
const valid=(x:any)=>Number.isFinite(x.rate)&&x.rate>0&&x.rate<100&&/^\d{2}\/\d{2}\/\d{4}$/.test(x.date);
async function readRate(){
 for(const series of [12,4389]){
  try{
   const r=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.'+series+'/dados/ultimos/1?formato=json',{signal:AbortSignal.timeout(6500)});
   if(!r.ok)throw new Error('BCB unavailable');
   const data=await r.json(),v=Number(String(data?.[0]?.valor).replace(',','.'));
   const next={rate:series===12?(Math.pow(1+v/100,252)-1)*100:v,date:data?.[0]?.data,source:'BCB SGS '+series};
   if(!valid(next)||(series===12&&(v<=0||v>1)))throw new Error('Invalid reference');
   const [d,m,y]=next.date.split('/').map(Number),age=Date.now()-Date.UTC(y,m-1,d);
   if(age< -86400000||age>7*86400000)throw new Error('Outdated reference');
   cached=next;loadedAt=Date.now();return {...next,cached:false};
  }catch{}
 }
 try{
  const r=await fetch('https://brasilapi.com.br/api/taxas/v1/CDI',{signal:AbortSignal.timeout(6500)});
  if(!r.ok)throw new Error('Alternative unavailable');
  const data=await r.json(),rate=Number(data.valor);
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date());
  if(data.nome!=='CDI'||!valid({rate,date}))throw new Error('Invalid alternative');
  cached={rate,date,source:'BrasilAPI',dateKind:'consulted'};loadedAt=Date.now();return {...cached,cached:false};
 }catch{}
 if(cached&&Date.now()-loadedAt<7*86400000)return {...cached,cached:true};
 throw new Error('CDI unavailable');
}
let pending:Promise<any>|null=null;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='GET')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers});
 if(req.headers.get('apikey')!==PUBLIC_KEY)return new Response(JSON.stringify({error:'Invalid API key'}),{status:401,headers});
 const origin=req.headers.get('origin');if(origin&&origin!=='https://ickymarques.github.io')return new Response(null,{status:403,headers});
 try{
  if(cached&&Date.now()-loadedAt<3600000)return new Response(JSON.stringify({...cached,cached:false}),{headers});
  if(!pending)pending=readRate().finally(()=>pending=null);
  return new Response(JSON.stringify(await pending),{headers});
 }catch{return new Response(JSON.stringify({error:'CDI temporariamente indisponível'}),{status:503,headers})}
});
