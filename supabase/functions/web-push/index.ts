import {createClient} from 'npm:@supabase/supabase-js@2.58.0';
import webpush from 'npm:web-push@3.6.7';
const origin='https://ickymarques.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default,{auth:{persistSession:false}});
const campaign='regularize-2026-10-04';
function validSubscription(s:any){
 try{const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&s.endpoint.length<2048&&(/^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)$/.test(u.hostname)||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com'))&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh)&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth)}catch{return false}
}
async function keys(){
 let {data,error}=await db.from('push_config').select('public_key,private_key').eq('id',true).maybeSingle();if(error)throw error;
 if(!data){const k=webpush.generateVAPIDKeys();const {error:e}=await db.from('push_config').upsert({id:true,public_key:k.publicKey,private_key:k.privateKey},{onConflict:'id',ignoreDuplicates:true});if(e)throw e;({data,error}=await db.from('push_config').select('public_key,private_key').eq('id',true).single());if(error)throw error;}
 return data!;
}
async function deliver(row:any,test=false){
 const {data:account,error:approvalError}=await db.from('app_users').select('access_status').eq('user_id',row.user_id).maybeSingle();
 if(approvalError)throw approvalError;if(account?.access_status!=='approved')return 'not_approved';
 const bucket=test?'test-'+Math.floor(Date.now()/60000):campaign;
 const {error}=await db.from('push_deliveries').insert({endpoint:row.endpoint,campaign:bucket});if(error){if(error.code==='23505')return 'already_sent';throw error}
 try{
 const k=await keys();
 const payload=JSON.stringify({title:test?'Meu Financeiro · teste':'📢 Conheça o Regularize',body:test?'As notificações estão funcionando neste aparelho. 💙':'Consulte débitos com a União e confira as opções de negociação.',tag:test?'mf-test':campaign,announcement:test?null:'regularize'});
 const details=webpush.generateRequestDetails(row.subscription,payload,{TTL:86400,vapidDetails:{subject:origin+'/minhas_financas/',publicKey:k.public_key,privateKey:k.private_key}});
 const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error'});
 if(response.status===404||response.status===410){await db.from('push_subscriptions').delete().eq('endpoint',row.endpoint);return 'expired'}
 if(!response.ok)throw new Error('Push delivery failed');
 return 'sent';
 }catch{await db.from('push_deliveries').delete().eq('endpoint',row.endpoint).eq('campaign',bucket);return 'failed'}
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply({error:'Origem não permitida'},403);
 try{
 if(Number(req.headers.get('content-length')||0)>10000)return reply({error:'Pedido muito grande'},413);
 const raw=await req.text();if(raw.length>10000)return reply({error:'Pedido muito grande'},413);
 const body=JSON.parse(raw);
 if(body.action==='config'){const k=await keys();return reply({publicKey:k.public_key})}
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');if(!token)return reply({error:'Entre com sua conta'},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return reply({error:'Sessão inválida'},401);
 const {data:account}=await db.from('app_users').select('access_status').eq('user_id',user.id).maybeSingle();
 if(account?.access_status!=='approved')return reply({error:'Acesso não autorizado'},403);
 if(body.action==='subscribe'){
 const s=body.subscription;if(!validSubscription(s))return reply({error:'Assinatura inválida'},400);
 const {data:existing}=await db.from('push_subscriptions').select('user_id').eq('endpoint',s.endpoint).maybeSingle();
 if(existing&&existing.user_id!==user.id)return reply({error:'Desative as notificações antes de trocar a conta neste aparelho'},409);
 const {error:e}=await db.from('push_subscriptions').upsert({endpoint:s.endpoint,user_id:user.id,subscription:{endpoint:s.endpoint,keys:s.keys},updated_at:new Date().toISOString()});if(e)throw e;
 return reply({ok:true});
 }
 if(body.action==='status'){const {data:row,error:e}=await db.from('push_subscriptions').select('user_id').eq('user_id',user.id).eq('endpoint',body.endpoint).maybeSingle();if(e)throw e;return reply({active:!!row})}
 if(body.action==='unsubscribe'){const {error:e}=await db.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',body.endpoint);if(e)throw e;return reply({ok:true})}
 if(body.action==='test'){
 const {data:row}=await db.from('push_subscriptions').select('endpoint,user_id,subscription').eq('user_id',user.id).eq('endpoint',body.endpoint).maybeSingle();
 if(!row)return reply({error:'Ative as notificações primeiro'},404);
 const result=await deliver(row,true);return reply({result},result==='failed'?502:200);
 }
 if(body.action==='send_regularize'){
 const {data:admin}=await db.from('app_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(!admin)return reply({error:'Somente administrador'},403);
 const {data:approved,error:a}=await db.from('app_users').select('user_id').eq('access_status','approved');if(a)throw a;
 const allowed=new Set(approved.map(x=>x.user_id));
 const {data:rows,error:b}=await db.from('push_subscriptions').select('endpoint,user_id,subscription');if(b)throw b;
 const results={sent:0,already_sent:0,expired:0,failed:0,not_approved:0};
 for(const row of rows.filter(x=>allowed.has(x.user_id)))results[await deliver(row)]++;
 return reply(results);
 }
 return reply({error:'Ação inválida'},400);
 }catch{return reply({error:'Não foi possível concluir. Tente novamente.'},500)}
});
