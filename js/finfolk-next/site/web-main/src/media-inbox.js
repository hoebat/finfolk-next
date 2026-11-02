const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const field=(form,label,type,value='')=>{const wrap=el('label',label),input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value||'';wrap.append(input);form.append(wrap);return input;};
const button=(text,fn)=>{const b=el('button',text,'secondary');b.type='button';b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{await fn();}catch(e){b.closest('section')?.querySelector('[role=status]')?.replaceChildren(document.createTextNode(e.message||'Please try again.'));}finally{b.disabled=false;}};return b;};
export function linkedMedia(items=[],onReturn){
 const box=el('div',undefined,'imported-links');
 for(const item of items){const row=el('div',undefined,'imported-link'),a=el('a',`Open ${item.platform==='tiktok'?'TikTok video':'Instagram post / Reel'} ↗`);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';row.append(a);if(onReturn)row.append(button('Return to inbox',()=>onReturn(item)));box.append(row);}
 return box;
}
export function mediaInbox({api,getBeaches=()=>[],createSession,openSession,openAccount,notify=()=>{}}){
 const root=el('section',undefined,'logbook-card media-inbox');let disposed=false;
 const status=el('p','','logbook-status');status.setAttribute('role','status');
 const run=async work=>{status.textContent='';try{await work();}catch(e){if(!disposed)status.textContent=e.message||'Imports could not be loaded. Try again.';}};
 async function render(){
  const [result,tiktok]=await Promise.all([api.call('mediaInbox'),api.call('tiktokStatus')]);if(disposed)return;
  root.replaceChildren(el('p','PHOTOS & VIDEOS','eyebrow'),el('h2','Tagged media'),el('p','Tag @finfolk.com.au on Instagram or TikTok. Connected accounts send matching posts here for you to review and sort into sessions.'),status);
  const connections=el('div',undefined,'import-connections');
  const ig=result.instagram;
  connections.append(el('p',ig.collecting&&ig.connected&&ig.ownerVerified?'Instagram · importing tagged posts':ig.connected&&!ig.ownerVerified?'Instagram · media ownership verification needed':!ig.collecting?'Instagram · automatic collection is paused':'Instagram · connect your account'),button('Instagram connection',openAccount));
  if(tiktok.connected){
   connections.append(el('p',`TikTok · ${tiktok.displayName||'Connected'}${tiktok.lastSuccess?' · Last checked '+new Date(tiktok.lastSuccess).toLocaleString():' · First import pending'}`),button('Check TikTok now',()=>run(async()=>{await api.call('tiktokSync');await render();})),button('Disconnect TikTok',()=>run(async()=>{if(!confirm('Disconnect TikTok and remove its imported links? Your sessions will remain.'))return;await api.call('tiktokDisconnect');await render();})));
  }else if(tiktok.ready){connections.append(button('Connect TikTok',()=>run(async()=>{const connection=await api.call('tiktokConnect');if(!disposed)location.assign(connection.url);})));}
  else connections.append(el('p','TikTok · automatic imports are awaiting app approval and configuration.'));
  root.append(connections,button('Refresh inbox',()=>run(render)));
  if(!result.items.length)root.append(el('p','No unsorted posts yet. New imports appear here before they become part of a session.'));
  for(const item of result.items)root.append(itemCard(item));
  if(result.items.length>=result.limit)root.append(el('p','Showing the latest 100 unsorted posts. Sort these into sessions to see older imports.'));
 }
 function itemCard(item){
  const article=el('article',undefined,'import-card');
  article.append(el('h3',item.platform==='tiktok'?'TikTok video':'Instagram photo / Reel'),linkedMedia([item]),el('small','Not in a session yet · Private'));
  const form=el('form');
  const day=field(form,'Day','date',item.day),place=field(form,'Location','text',item.locationName),notes=field(form,'Additional information','textarea',item.notes);
  place.maxLength=160;notes.maxLength=10000;notes.rows=3;
  const list=el('datalist');list.id='import-places-'+item.id;place.setAttribute('list',list.id);
  for(const b of getBeaches()){const option=el('option');option.value=`${b.name} · ${b.state||''}`;list.append(option);}form.append(list);
  if(!item.day)form.append(el('small','The provider did not supply a day. Add it here.'));
  if(!item.locationName)form.append(el('small',item.candidates?.length>1?'More than one location matched. Choose the right place.':'No location matched. Add the place yourself.'));
  form.append(el('small','The day comes from the post timestamp, using the matched beach’s time zone or UTC when unknown. Check it if you posted later.'));
  let saved={...item};
  async function save(){const selected=getBeaches().find(b=>`${b.name} · ${b.state||''}`===place.value);const values={day:day.value,beachId:selected?.id||(place.value===item.locationName?item.beachId:null),locationName:selected?.name||place.value,notes:notes.value};await api.call('updateImportedMedia',{id:item.id,values});saved={...item,...values};}
  const saveButton=el('button','Save details','secondary');saveButton.type='submit';form.append(saveButton);
  form.onsubmit=e=>{e.preventDefault();if(saveButton.disabled)return;saveButton.disabled=true;run(async()=>{await save();if(!disposed){status.textContent='Import details saved.';notify('Import details saved.');}}).finally(()=>{saveButton.disabled=false;});};
  const choices=el('div',undefined,'import-session-choices');choices.hidden=true;
  const actions=el('div',undefined,'logbook-actions');
  actions.append(button('Add to a session',()=>run(async()=>{
   await save();const sessions=await api.list({owner:api.user.uid});if(disposed)return;choices.replaceChildren(el('h4','Choose one of your sessions'));
   if(!sessions.sessions.length)choices.append(el('p','No sessions yet. Create a private session below.'));
   const select=el('select');select.setAttribute('aria-label','Session for imported media');const blank=el('option','Choose a session');blank.value='';select.append(blank);
   async function addPage(page){for(const s of page.sessions){const option=el('option',`${s.date} · ${s.locationName} · ${s.visibility==='public'?'Published':'Private'}`);option.value=s.id;option.dataset.public=String(s.visibility==='public');select.append(option);}more.hidden=!page.more;more.dataset.cursor=page.cursor||'';}
   const more=button('Load older sessions',()=>run(async()=>addPage(await api.list({owner:api.user.uid,cursor:more.dataset.cursor}))));await addPage(sessions);
   const consent=el('label','Allow this original post link to appear on the published session'),check=el('input');check.type='checkbox';consent.prepend(check);consent.hidden=true;
   select.onchange=()=>{consent.hidden=select.selectedOptions[0]?.dataset.public!=='true';check.checked=false;};
   const key=crypto.randomUUID();choices.append(select,more,consent,button('Add selected post',()=>run(async()=>{
    if(!select.value)throw Error('Choose a session first.');
    if(!consent.hidden&&!check.checked)throw Error('Confirm the post link can appear on the published session.');
    const result=await api.call('assignImportedMedia',{id:item.id,sessionId:select.value,key,publicConsent:check.checked});if(!disposed)openSession(result.id);
   })));choices.hidden=false;
  })),button('Create private session',()=>run(async()=>{await save();if(!disposed)createSession(saved);})),button('Remove from inbox',()=>run(async()=>{if(!confirm('Remove this import from your logbook? The original post will stay on its platform.'))return;await api.call('hideImportedMedia',{id:item.id});await render();})));
  article.append(form,actions,choices);return article;
 }
 run(render);
 return {root,dispose(){disposed=true;}};
}
