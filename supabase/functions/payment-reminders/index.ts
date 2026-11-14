import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';
import './core.js';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default,{auth:{persistSession:false}});
const origin='https://ickymarques.github.io';
function validSubscription(s:any){
 try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&s.endpoint.length<2048&&(/^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)$/.test(u.hostname)||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com'))&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth)}catch{return false}
}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const token=req.headers.get('x-reminder-key')||'';if(token.length!==64)return new Response('Unauthorized',{status:401});
 const {data:auth,error:authError}=await db.from('push_scheduler_auth').select('id').eq('id',true).eq('token',token).maybeSingle();if(authError||!auth)return new Response('Unauthorized',{status:401});
 try{
 const now=new Date(),today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),hour=+new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hour12:false}).format(now);
 if(hour<9||hour>=22)return Response.json({outsideWindow:true});
 const {data:key,error:ke}=await db.from('push_config').select('public_key,private_key').eq('id',true).maybeSingle();if(ke)throw ke;if(!key)return Response.json({sent:0});
 const {data:approved,error:ae}=await db.from('app_users').select('user_id').eq('access_status','approved');if(ae)throw ae;
 const allowed=new Set(approved.map(x=>x.user_id));let offset=0,sent=0,failed=0;
 while(true){const {data:rows,error:se}=await db.from('push_subscriptions').select('endpoint,user_id,subscription').order('endpoint').range(offset,offset+99);if(se)throw se;if(!rows.length)break;offset+=rows.length;
 for(const row of rows){if(!allowed.has(row.user_id)||!validSubscription(row.subscription))continue;
 const {data:finance,error:fe}=await db.from('finance_state').select('data').eq('user_id',row.user_id).maybeSingle();if(fe)throw fe;
 const items=(globalThis as any).MFReminders.items(finance?.data||{},today).filter((x:any)=>x.date===today);if(!items.length)continue;
 const campaign='due:'+today;
 const {error:claim}=await db.from('push_deliveries').insert({endpoint:row.endpoint,campaign});if(claim){if(claim.code==='23505')continue;throw claim;}
 try{const payload=JSON.stringify({title:'Meu Financeiro · lembrete 🔔',body:'Você tem pagamentos ou recebimentos previstos para hoje. Abra o app para conferir e confirmar.',tag:'mf-due-'+today,reminders:true});const details=webpush.generateRequestDetails(row.subscription,payload,{TTL:3600,vapidDetails:{subject:origin+'/minhas_financas/',publicKey:key.public_key,privateKey:key.private_key}});const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error'});if(response.status===404||response.status===410){await db.from('push_subscriptions').delete().eq('endpoint',row.endpoint);continue;}if(!response.ok)throw Error('delivery');sent++;}catch{await db.from('push_deliveries').delete().eq('endpoint',row.endpoint).eq('campaign',campaign);failed++;}
 }if(rows.length<100)break;
 }
 return Response.json({sent,failed});
 }catch{return new Response('Reminder job failed',{status:500});}
});
