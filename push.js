/* Web Push: opt-in por aparelho; nenhuma informação financeira no payload. */
(()=>{
 const api=SUPABASE_URL+'/functions/v1/web-push';
 const supported=()=>window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&window.top===window;
 let busy=false;
 const status=document.getElementById('pushStatus');
 const enable=document.getElementById('pushEnable'),disable=document.getElementById('pushDisable'),test=document.getElementById('pushTest');
 async function call(action,extra={}){
  const {data:{session}}=await cloud.auth.getSession();
  const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_KEY,...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify({action,...extra})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível concluir.');return data;
 }
 async function registration(){return navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready)}
 function keyBytes(key){const s=atob(key.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))}
 async function subscription(){if(!supported())return null;return (await registration()).pushManager.getSubscription()}
 window.refreshPushSettings=async()=>{
  if(busy)return;
  enable.disabled=disable.disabled=test.disabled=true;
  if(!supported()){status.textContent='Este navegador não oferece notificações push. No iPhone, use o app na Tela de Início (iOS 16.4 ou superior).';return}
  if(!cloudUser||!accessApproved){status.textContent='Entre em uma conta aprovada para ativar os avisos.';return}
  try{let sub=await subscription();if(sub){const result=await call('status',{endpoint:sub.endpoint});if(!result.active){await sub.unsubscribe();sub=null}}enable.hidden=!!sub;disable.hidden=test.hidden=!sub;enable.disabled=Notification.permission==='denied';disable.disabled=test.disabled=false;
   status.textContent=sub?'Notificações ativadas neste aparelho.':'Notificações desativadas neste aparelho.';
   if(Notification.permission==='denied')status.textContent='Permissão bloqueada. Libere as notificações nos ajustes do navegador ou do aparelho.';
  }catch{status.textContent='Não foi possível consultar as notificações. Reabra o app e tente novamente.'}
 };
 async function run(action){if(busy)return;busy=true;enable.disabled=disable.disabled=test.disabled=true;try{await action()}catch(e){status.textContent=e.message}finally{busy=false;enable.disabled=disable.disabled=test.disabled=false}}
 enable.onclick=()=>{
  if(busy||!cloudUser||!accessApproved)return;
  // A permissão começa diretamente no clique, exigência do Safari/iOS.
  const permission=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
  run(async()=>{if(await permission!=='granted')throw new Error('A ativação depende da sua permissão para receber notificações.');
   status.textContent='Ativando notificações…';
   const {publicKey}=await call('config');const reg=await registration();let sub=await reg.pushManager.getSubscription();
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
   try{await call('subscribe',{subscription:sub.toJSON()})}catch(e){await sub.unsubscribe();throw e}
   enable.hidden=true;disable.hidden=test.hidden=false;status.textContent='Notificações ativadas! Use “Enviar teste” para conferir. 💙';
  });
 };
 window.disableDevicePush=async(silent=false)=>{
  const sub=await subscription();if(!sub)return;
  const endpoint=sub.endpoint;
  if(!await sub.unsubscribe())throw new Error('Não foi possível desativar as notificações neste aparelho.');
  try{await call('unsubscribe',{endpoint})}catch(e){if(!silent)throw e}
 };
 disable.onclick=()=>run(async()=>{await window.disableDevicePush();enable.hidden=false;disable.hidden=test.hidden=true;status.textContent='Notificações desativadas neste aparelho.'});
 test.onclick=()=>run(async()=>{const sub=await subscription();if(!sub)throw new Error('Ative as notificações primeiro.');const data=await call('test',{endpoint:sub.endpoint});
  if(data.result==='not_approved')throw new Error('Seu acesso não está aprovado.');
  if(data.result==='expired')throw new Error('Assinatura expirada. Desative e ative novamente.');
  status.textContent=data.result==='already_sent'?'Aguarde um minuto antes de enviar outro teste.':'Teste enviado! Confira as notificações do aparelho.';
 });
 const send=document.getElementById('pushSendRegularize');
 send.onclick=async()=>{if(send.disabled)return;send.disabled=true;const output=document.getElementById('pushAdminStatus');output.textContent='Enviando…';try{const r=await call('send_regularize');output.textContent=`Enviados: ${r.sent}. Já enviados: ${r.already_sent}. Assinaturas expiradas: ${r.expired}. Falhas: ${r.failed}. Apenas aparelhos com notificações ativadas recebem.`}catch(e){output.textContent=e.message}finally{send.disabled=false}};
 function openAnnouncement(){const dialog=document.getElementById('regularizeAnnouncement');if(dialog&&!dialog.open)dialog.showModal()}
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='open-regularize')openAnnouncement()});
 const params=new URLSearchParams(location.search);if(params.get('announcement')==='regularize'){params.delete('announcement');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);openAnnouncement()}
 document.addEventListener('click',e=>{if(e.target.closest('[data-view="settings"]'))window.refreshPushSettings()});
 window.addEventListener('focus',()=>window.refreshPushSettings());
 window.refreshPushSettings();
})();
