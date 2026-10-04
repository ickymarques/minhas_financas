/* Original vector portraits for Meu Financeiro. No external image requests. */
(()=>{
 const options=[
  ['aurora','Aurora','#f7dfcc','#dcb18b','#3c2832','#bc6984','long',false],
  ['leo','Léo','#d9e7f3','#bd805b','#342b29','#5684b8','short',false],
  ['maya','Maya','#e6dff3','#8c573e','#27252c','#9672b4','curly',false],
  ['caio','Caio','#ddece6','#e6b38d','#53352c','#568f7c','wave',true],
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
  const back=style==='long'||style==='bob'?`<path d="M49 105C42 61 62 38 100 38s57 23 51 67l7 54H43Z" fill="${hair}"/>`:style==='scarf'?`<path d="M45 105C45 60 64 35 100 35s55 25 55 70l12 60H33Z" fill="${hair}"/>`:'';
  const top=style==='curly'?`<g fill="${hair}">${[[60,69],[72,52],[91,46],[112,47],[130,55],[141,73],[59,88],[141,88]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="15"/>`).join('')}</g>`:style==='scarf'?`<path d="M52 84C56 45 70 43 100 43s46 9 48 41c-16-5-27-19-36-28-16 19-34 25-60 28Z" fill="${hair}"/>`:style==='wave'?`<path d="M53 88C43 65 52 48 76 47c16-20 56-10 69 10 7 9 8 25 1 35l-11-24c-35 6-38-17-57 2L60 94Z" fill="${hair}"/>`:style==='long'||style==='bob'?`<path d="M53 87C48 53 70 42 100 42s52 12 48 46l-12-14c-12-3-24-17-29-26-11 23-30 23-44 29L60 104Z" fill="${hair}"/>`:`<path d="M52 87C46 49 67 40 100 40s53 12 48 49l-14-21c-25 10-54 8-68 2L60 98Z" fill="${hair}"/>`;
  const specs=glasses?'<g fill="none" stroke="#374557" stroke-width="3"><rect x="65" y="87" width="28" height="20" rx="8"/><rect x="107" y="87" width="28" height="20" rx="8"/><path d="M93 94q7-5 14 0M59 91h6m70 0h6"/></g>':'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="bg"><stop stop-color="#fff"/><stop offset="1" stop-color="${bg}"/></radialGradient><linearGradient id="face" x2=".8" y2="1"><stop stop-color="${skin}"/><stop offset="1" stop-color="${skin}" stop-opacity=".8"/></linearGradient><linearGradient id="shirt" x2="1" y2="1"><stop stop-color="${shirt}"/><stop offset="1" stop-color="${shirt}" stop-opacity=".65"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#bg)"/><ellipse cx="100" cy="189" rx="64" ry="8" fill="#243b53" opacity=".1"/>${back}<path d="M31 200v-18c0-26 28-40 69-40s69 14 69 40v18Z" fill="url(#shirt)"/><path d="M83 130h34v21c-5 14-28 14-34 0Z" fill="${skin}"/><path d="M83 135q17 15 34 0v9q-17 15-34 0" fill="#633824" opacity=".12"/><ellipse cx="58" cy="100" rx="9" ry="14" fill="${skin}"/><ellipse cx="142" cy="100" rx="9" ry="14" fill="${skin}"/><path d="M59 82c0-28 18-39 41-39s41 11 41 39v28c0 29-18 43-41 43s-41-14-41-43Z" fill="url(#face)"/>${top}<g fill="#302c34"><ellipse cx="79" cy="97" rx="3.7" ry="5"/><ellipse cx="121" cy="97" rx="3.7" ry="5"/></g><g fill="none" stroke="${hair}" stroke-width="3" stroke-linecap="round"><path d="M72 85q7-4 14 0M114 85q7-4 14 0"/></g><path d="m100 99-4 15h8" fill="none" stroke="#79442e" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/><ellipse cx="74" cy="115" rx="9" ry="5" fill="#df7d7c" opacity=".25"/><ellipse cx="126" cy="115" rx="9" ry="5" fill="#df7d7c" opacity=".25"/><path d="M88 124q12 12 24 0" fill="#fff" stroke="#965b4f" stroke-width="2" stroke-linejoin="round"/>${specs}<path d="M64 179v21m72-21v21" stroke="#fff" stroke-opacity=".12" stroke-width="2"/></svg>`;
 }
 const avatars=options.map(o=>({id:o[0],name:o[1],data:'data:image/svg+xml;base64,'+btoa(portrait(o))}));
 const dialog=document.getElementById('profileAvatarDialog'),grid=document.getElementById('profileAvatarGrid');
 function open(){
  const current=readProfile().avatar;
  grid.innerHTML='';
  avatars.forEach(a=>{const button=document.createElement('button');button.type='button';button.className='profile-avatar-option';button.setAttribute('aria-label','Usar avatar '+a.name);button.setAttribute('aria-pressed',String(current===a.data));const img=document.createElement('img');img.src=a.data;img.alt='';img.width=88;img.height=88;const label=document.createElement('span');label.textContent=a.name;button.append(img,label);button.onclick=()=>{const profile=readProfile();profile.avatar=a.data;writeProfile(profile);displayUser();queuePreferenceChange({avatar:a.data});dialog.close()};grid.append(button)});
  dialog.showModal();
 }
 document.getElementById('choosePresetAvatar').onclick=open;
 document.getElementById('profileAvatarPreview').onclick=open;
 document.getElementById('closeProfileAvatarDialog').onclick=()=>dialog.close();
 document.getElementById('avatarDialogUpload').onclick=()=>{dialog.close();document.getElementById('profileAvatarFile').click()};
})();
