/* Original vector portraits for Meu Financeiro. No external image requests. */
(()=>{
 const options=[
  ['aurora','Aurora','#f7dfcc','#dcb18b','#3c2832','#bc6984','long',false],
  ['leo','Léo','#d9e7f3','#bd805b','#342b29','#5684b8','short',false],
  ['maya','Maya','#e6dff3','#8c573e','#27252c','#9672b4','curly',false],
  ['iqui','Iqui','#dfeaf0','#dab096','#27252a','#386b79','wave',false],
  ['nina','Nina','#f2dfdf','#f2c6a9','#8c5036','#c98074','bob',true],
  ['rui','Rui','#e2e6f2','#765039','#242531','#777db3','short',true],
  ['luna','Luna','#e4e0ed','#bd805b','#2d2935','#78638f','long',false],
  ['davi','Davi','#e9e7dc','#d8a578','#654332','#a59260','wave',false],
  ['iris','Íris','#dee9ed','#9b6546','#25252c','#538a9d','curly',true],
  ['noah','Noah','#e7e5e1','#ecc5ac','#b28863','#8b8882','short',false],
  ['sara','Sara','#e0e9ee','#d09b75','#596c85','#688ba1','scarf',false],
  ['alex','Alex','#ebe0ed','#aa7053','#493035','#a470a7','bob',false]
 ];
 function portrait(o){
  const [id,name,bg,skin,hair,shirt,style,glasses]=o;
  const back=style==='long'?`<path d="M52 84c0-32 18-48 48-48s48 16 48 48v75H52Z" fill="${hair}"/>`:style==='bob'?`<path d="M51 84c0-32 20-48 49-48s49 16 49 48v52q-15 20-49 20t-49-20Z" fill="${hair}"/>`:style==='scarf'?`<path d="M48 92c0-41 21-57 52-57s52 16 52 57l12 72H36Z" fill="${hair}"/>`:'';
  let top='';
  if(style==='curly')top=`<path d="M56 91c-12-32 5-57 44-57s56 25 44 57l-10-21q-34 14-68 0Z" fill="${hair}"/><g fill="${hair}">${[[65,61,12],[80,48,13],[99,45,13],[118,49,13],[135,63,12]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  else if(style==='wave')top=`<path d="M55 91C45 65 50 47 70 44c9-13 26-17 42-12 25-1 43 23 32 58l-8-18c-29 3-43-15-57-4-8 4-12 12-16 25Z" fill="${hair}"/><path d="M73 51q27-20 48-4" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="6" stroke-linecap="round"/>`;
  else if(style==='scarf')top=`<path d="M53 89C53 56 69 39 100 39s47 17 47 50l-12-15q-23-9-35-27c-12 18-26 24-36 27Z" fill="${hair}"/>`;
  else if(style==='long'||style==='bob')top=`<path d="M54 89C49 53 73 37 100 37s51 16 46 52l-11-16q-24-8-32-26c-10 19-23 25-37 26l-5 20Z" fill="${hair}"/>`;
  else top=`<path d="M54 88c-7-37 15-51 46-51s53 14 46 51l-11-17q-35 9-69 0l-5 20Z" fill="${hair}"/>`;
  const specs=glasses?'<g fill="none" stroke="#354354" stroke-width="2.5"><rect x="66" y="89" width="27" height="19" rx="7"/><rect x="107" y="89" width="27" height="19" rx="7"/><path d="M93 96q7-4 14 0M60 94h6m68 0h6"/></g>':'';
  const beard=id==='iqui'?`<path d="M61 108c4 11 10 17 17 20q10-7 22-5 12-2 22 5c7-3 13-9 17-20v9c-4 24-20 32-39 32s-35-8-39-32Z" fill="${hair}" fill-opacity=".72"/><path d="M86 120q7-6 14-3 7-3 14 3" fill="none" stroke="${hair}" stroke-width="3" stroke-linecap="round"/><circle cx="147" cy="113" r="2.4" fill="#64717a"/><circle cx="146.3" cy="112.3" r=".7" fill="#fff"/>`:'';
  const mouth=id==='iqui'?'<path d="M90 130q10 4 20-1" fill="none" stroke="#915e54" stroke-width="2.4" stroke-linecap="round"/>':'<path d="M90 126q10 9 20 0" fill="none" stroke="#9d685c" stroke-width="2.4" stroke-linecap="round"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><metadata>mf-avatar-v2:${id}</metadata><defs><radialGradient id="bg" cx=".35" cy=".25" r=".9"><stop stop-color="#fff"/><stop offset="1" stop-color="${bg}"/></radialGradient><linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${skin}"/><stop offset="1" stop-color="${skin}"/></linearGradient><clipPath id="crop"><circle cx="100" cy="100" r="100"/></clipPath></defs><g clip-path="url(#crop)"><rect width="200" height="200" fill="url(#bg)"/>${back}<path d="M23 203v-22c0-24 27-38 77-38s77 14 77 38v22Z" fill="${shirt}"/><path d="M84 133h32v24q-16 15-32 0Z" fill="${skin}"/><path d="M84 137q16 12 32 0v8q-16 10-32 0" fill="#744731" opacity=".12"/><path d="M77 154q23 25 46 0" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2"/><ellipse cx="59" cy="104" rx="7.5" ry="11" fill="${skin}"/><ellipse cx="141" cy="104" rx="7.5" ry="11" fill="${skin}"/><path d="M61 81c0-26 16-41 39-41s39 15 39 41v29c0 22-16 38-39 38s-39-16-39-38Z" fill="url(#skin)"/><path d="M66 114q3 23 34 30" fill="none" stroke="#79472e" stroke-opacity=".06" stroke-width="3"/>${top}<g fill="none" stroke="${hair}" stroke-width="3.2" stroke-linecap="round"><path d="M73 87q7-4 14 0M113 87q7-4 14 0"/></g><g fill="#36313a"><ellipse cx="80" cy="99" rx="3" ry="4"/><ellipse cx="120" cy="99" rx="3" ry="4"/></g><path d="M100 102v12q-2 3-5 1" fill="none" stroke="#95664c" stroke-opacity=".45" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="76" cy="115" rx="6" ry="3.5" fill="#d58078" opacity=".16"/><ellipse cx="124" cy="115" rx="6" ry="3.5" fill="#d58078" opacity=".16"/>${beard}${mouth}${specs}</g></svg>`;
 }
 const avatars=options.map(o=>({id:o[0],name:o[1],data:'data:image/svg+xml;base64,'+btoa(portrait(o))}));
 const legacyShirts={'#bc6984':'aurora','#5684b8':'leo','#9672b4':'maya','#568f7c':'iqui','#c98074':'nina','#777db3':'rui','#78638f':'luna','#a59260':'davi','#538a9d':'iris','#8b8882':'noah','#688ba1':'sara','#a470a7':'alex'};
 function presetFor(data){
  if(typeof data!=='string'||!data.startsWith('data:image/svg+xml;base64,'))return null;
  try{
   const svg=atob(data.split(',')[1]);
   const id=svg.match(/<metadata>mf-avatar-v2:([a-z]+)<\/metadata>/)?.[1];
   if(id)return avatars.find(a=>a.id===id)||null;
   // Recognize only the exact geometry of our old gallery; uploaded photos are untouched.
   if(!svg.includes('M83 130h34v21c-5 14-28 14-34 0Z')||!svg.includes('M59 82c0-28 18-39 41-39'))return null;
   const shirt=svg.match(/<linearGradient id="shirt"[^>]*><stop stop-color="(#[a-f0-9]{6})"/i)?.[1];
   return avatars.find(a=>a.id===legacyShirts[shirt])||null;
  }catch{return null}
 }
 const previousDisplayUser=displayUser;
 displayUser=function(){
  const p=readProfile(),preset=presetFor(p.avatar);
  if(preset&&preset.data!==p.avatar){p.avatar=preset.data;writeProfile(p);queuePreferenceChange({avatar:p.avatar})}
  previousDisplayUser();
 };
 const dialog=document.getElementById('profileAvatarDialog'),grid=document.getElementById('profileAvatarGrid');
 function open(){
  displayUser();
  const current=readProfile().avatar;
  grid.innerHTML='';
  avatars.forEach(a=>{const button=document.createElement('button');button.type='button';button.className='profile-avatar-option';button.setAttribute('aria-label','Usar avatar '+a.name);button.setAttribute('aria-pressed',String(current===a.data));const img=document.createElement('img');img.src=a.data;img.alt='';img.width=88;img.height=88;const label=document.createElement('span');label.textContent=a.name;button.append(img,label);button.onclick=()=>{const profile=readProfile();profile.avatar=a.data;writeProfile(profile);displayUser();queuePreferenceChange({avatar:a.data});dialog.close()};grid.append(button)});
  dialog.showModal();
 }
 displayUser();
 document.getElementById('choosePresetAvatar').onclick=open;
 document.getElementById('profileAvatarPreview').onclick=open;
 document.getElementById('closeProfileAvatarDialog').onclick=()=>dialog.close();
 document.getElementById('avatarDialogUpload').onclick=()=>{dialog.close();document.getElementById('profileAvatarFile').click()};
})();
