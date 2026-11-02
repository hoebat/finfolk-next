import {renderEvents} from './events.js';
import {directoryRoute} from './directory-route.js';
import {renderDirectory} from './directory.js';
import {installNavigation,navigationURL} from './navigation.js';
import {createWordmark} from './identity.js';
import {applySavedTheme,setTheme} from './theme.js';
import {AVAILABILITY,EXPERIENCES,SHARING,profileURL,socialURL,publishedLogs,portraitDataURL} from './profile-model.js';

export async function installProfiles({doc=document,api:providedAPI,directory:providedDirectory,loadClient=async config=>(await import('./neon-client.js')).createLogbookClient(config)}={}){
 const win=doc.defaultView,main=doc.getElementById('profile-main'),status=doc.getElementById('profile-status');
 const node=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn,cls='profile-action')=>{const n=node('button',text,cls);n.type='button';n.onclick=fn;return n;};
 const link=(text,href,cls='profile-action')=>{const n=node('a',text,cls);n.href=href;return n;};
 const message=text=>{status.textContent=text;};
 const option=(text,value)=>{const n=node('option',text);n.value=value;return n;};
 const current=()=>{const url=new URL(win.location.href);return directoryRoute(url)||url.searchParams;};
 let directoryStops=[];
 let epoch=0,me=null,api=providedAPI,directory=providedDirectory,disposed=false,config;
 applySavedTheme();
 if(current().get('presentation')==='landing')doc.body.classList.add('profile-landing-preview');
 if(!api){
  const response=await fetch(new URL('./neon-config.json',import.meta.url),{cache:'no-store'});config=await response.json();
  if(!config.enabled){if(!['directory','listing','events'].includes(current().get('screen')))throw Error('Accounts are unavailable.');api={user:null};}else api=await loadClient(config);
 }
 if(!directory){
  const paths=[...(config?.apiUrl?[new URL('/v1/sites/catalog',config.apiUrl).href]:[]),'./sites-snapshot.json','./beaches.json'];
  for(const path of paths){
   try{const response=await fetch(new URL(path,import.meta.url),{signal:AbortSignal.timeout(5000)});if(!response.ok)continue;const data=await response.json();if(Array.isArray(data.beaches)){directory=data;break;}}catch{}
  }
 }
 directory ||= {beaches:[]};
 const sites=directory.beaches,siteById=id=>sites.find(site=>site.id===id);
 const selectedLocation=()=>siteById(current().get('location'))||siteById(current().get('site'))||siteById(me?.profile?.beaches?.[0])||siteById('bondi')||sites[0];
 const navigation=installNavigation({doc,nav:doc.querySelector('.profile-nav'),rail:doc.querySelector('.profile-rail'),context:()=>selectedLocation()?.id||''});
 const themeControl=doc.getElementById('profile-theme');
 function syncTheme(){themeControl.value=doc.documentElement.dataset.theme;}
 themeControl.onchange=()=>{const result=setTheme(themeControl.value);if(!result.persisted)message('Theme applied for this visit. Storage is unavailable.');};
 doc.addEventListener('finfolk:appearance',syncTheme);syncTheme();
 async function navigate(screen,values={},replace=false){
  const location=selectedLocation()?.id,url=profileURL(screen,{location,...values});
  if(new URL(url,win.location.href).href===win.location.href)return;
  win.history[replace?'replaceState':'pushState'](null,'',url);await render();main.focus({preventScroll:true});
 }
 function profileLink(text,screen,values={},cls='profile-action'){return link(text,profileURL(screen,{location:selectedLocation()?.id,...values}),cls);}
 const onLink=event=>{
  const anchor=event.target.closest?.('a');if(!anchor||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button)return;
  const url=new URL(anchor.href,win.location.href);if(url.origin!==win.location.origin||!/^\/profiles(?:\.html)?$/.test(url.pathname))return;
  event.preventDefault();navigation.close();if(url.href===win.location.href)return;
  win.history.pushState(null,'',url);render().then(()=>main.focus({preventScroll:true}));
 };
 doc.addEventListener('click',onLink);
 function portrait(member){
  const wrap=node('div',undefined,'person-portrait');
  const placeholder=()=>{const mark=node('span',undefined,'brand-f');mark.setAttribute('role','img');mark.setAttribute('aria-label','No portrait selected');return mark;};
  if(typeof member.portrait==='string'&&/^data:image\/(?:webp|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(member.portrait)&&member.portrait.length<=65_558){const image=node('img');image.src=member.portrait;image.alt='Profile portrait for '+member.displayName;image.loading='lazy';image.onerror=()=>wrap.replaceChildren(placeholder());wrap.append(image);}
  else wrap.append(placeholder());
  return wrap;
 }
 function socials(member){
  const row=node('div',undefined,'profile-socials');for(const platform of ['instagram','tiktok']){
   const url=socialURL(member[platform],platform);if(!url)continue;
   const a=link((platform==='instagram'?'Instagram':'TikTok')+' ↗',url,'');a.target='_blank';a.rel='noopener noreferrer';row.append(a);
  }return row;
 }
 function heading(eyebrow,title,copy){const box=node('div',undefined,'profile-heading-row'),intro=node('div');intro.append(node('p',eyebrow,'profile-eyebrow'),node('h1',title),node('p',copy,'profile-lede'));box.append(intro);main.append(box);return box;}
 function empty(title,copy,action){const box=node('section',undefined,'profile-empty');box.append(node('h2',title),node('p',copy));if(action)box.append(action);return box;}
 function guest(screen){
  const box=node('section',undefined,'profile-guest');box.append(createWordmark({width:280}),node('h2',screen==='people'?'Meet the divers at your spot.':'Your FinFolk profile.'),node('p',screen==='people'?'Sign in to find divers, view shared profiles and connect with the Regulars.':'Sign in to edit your profile, share published logs and manage your connections.'),link('Sign in or create an account ↗','./?view=account&tab=profile'));main.append(box);
 }
 async function mutate(control,action,values,done){
  const generation=epoch;control.disabled=true;
  try{await api.call(action,values);if(generation!==epoch||disposed)return;message('Saved.');if(done)await done();}
  catch(error){if(generation===epoch)message(error.message||'Changes could not be saved.');}
  finally{if(control.isConnected&&!control.dataset.persistDisabled)control.disabled=false;}
 }
 function connect(member,connection){
  const control=button(connection==='accepted'?'Connected':connection==='pending'?'Request pending':'Connect',()=>mutate(control,'connection',{target:member.id,mode:'request'},()=>{control.textContent='Request sent';control.disabled=true;control.dataset.persistDisabled='true';}),'profile-action'+(!connection?' primary':''));
  control.dataset.connect=member.id;control.disabled=!!connection;return control;
 }
 function personCard(member){
  const article=node('article',undefined,'person-card');article.dataset.person=member.id;
  const photo=profileLink('', 'member',{id:member.id},'person-portrait-link');photo.setAttribute('aria-label','View '+member.displayName+'’s profile');photo.append(portrait(member));
  const title=node('div',undefined,'person-card-title'),name=node('h2');name.append(profileLink(member.displayName,'member',{id:member.id},''));title.append(name,node('span',member.regular?'Regular':member.recent===false?'Follows this location':'Recent diver','person-relationship'));
  const actions=node('div',undefined,'profile-action-row');actions.append(profileLink('View profile ↗','member',{id:member.id}),connect(member,member.connection));
  article.append(photo,title,node('p',member.bio||'','person-card-bio'),socials(member),actions);return article;
 }
 async function people(generation){
  const site=selectedLocation();heading('PEOPLE'+(site?' / '+site.name.toUpperCase():''),'Discover your FinFolk.','Browse freedivers by location. View their profiles, published logs and social links.');
  const filters=node('form',undefined,'profile-filters');filters.setAttribute('aria-label','Filter people');filters.onsubmit=event=>event.preventDefault();
  const label=node('label','Location'),search=node('input'),list=node('datalist');search.id='people-location';search.type='search';search.value=site?.name||'';search.autocomplete='off';search.setAttribute('list','people-locations');list.id='people-locations';
  for(const beach of sites)list.append(option(beach.state_id||beach.state||'',beach.name));label.append(search,list);filters.append(label);
  search.oninput=()=>search.setCustomValidity('');search.onchange=()=>{const selected=sites.find(beach=>[beach.id,beach.name].some(value=>value?.toLowerCase()===search.value.trim().toLowerCase()));if(!selected){search.setCustomValidity('Choose a location from the list.');search.reportValidity();return;}navigate('people',{location:selected.id,availability:current().get('availability'),experience:current().get('experience')},true);};
  for(const [key,title,values]of [['availability','Availability',AVAILABILITY.map(value=>[value,value])],['experience','Experience',Object.entries(EXPERIENCES)]]){
   const field=node('label',title),select=node('select');select.name=key;select.append(option('Any '+title.toLowerCase(),''));for(const [value,text]of values)select.append(option(text,value));select.value=current().get(key)||'';
   select.onchange=()=>navigate('people',{availability:key==='availability'?select.value:current().get('availability'),experience:key==='experience'?select.value:current().get('experience')},true);field.append(select);filters.append(field);
  }
  filters.append(button('Clear filters',()=>navigate('people',{},true)));main.append(filters);
  if(!api.user){guest('people');return;}if(!site){main.append(empty('Choose a location','No locations are available yet.'));return;}
  if(!me.profile.open){const note=node('div',undefined,'profile-visibility-note');note.append(node('span','Your profile is Closed and does not appear in People.'),profileLink('Edit visibility ↗','edit',{},''));main.append(note);}
  const grid=node('div',undefined,'people-grid'),progress=node('p','Loading divers…','profile-small'),more=button('Load more divers',()=>load(cursor));let cursor=null;
  main.append(progress,grid);more.hidden=true;main.append(more);
  async function load(after){
   more.disabled=true;
   try{
    const data=await api.call('community',{beachId:site.id,availability:current().get('availability')||'',experience:current().get('experience')||'',...(after?{cursor:after}:{})});
    if(generation!==epoch||disposed)return;
    for(const person of data.people||[])grid.append(personCard(person));cursor=data.cursor;more.hidden=!cursor;progress.textContent=grid.children.length+(grid.children.length===1?' diver':' divers');
    if(!grid.children.length)main.append(empty('No divers here yet.','Try another location, clear the filters or check in to start the community here.',link('Check in ↗',navigationURL('checkin',site.id))));
   }catch(error){if(generation===epoch){progress.textContent=error.message||'Divers could not load.';more.textContent='Try again';more.hidden=false;}}
   finally{more.disabled=false;}
  }await load();
 }
 function publishedLogCard(log){
  const article=node('article',undefined,'profile-log');article.dataset.publicLog=log.id;const site=siteById(log.beachId),metrics=node('div',undefined,'profile-log-metrics');
  article.append(node('small','PUBLISHED'+(site?' / '+site.name.toUpperCase():'')),node('h3',log.title||site?.name||'Freediving session'));
  if(Number.isFinite(log.durationMinutes))metrics.append(node('span',log.durationMinutes+' min'));if(Number.isFinite(log.maxDepthMetres))metrics.append(node('span',log.maxDepthMetres+' m'));
  article.append(metrics,node('p',log.notes||''),link('View log ↗','./?view=logbook&session='+encodeURIComponent(log.id)));return article;
 }
 async function memberProfile(generation,own){
  if(!api.user){heading('MY PROFILE','Your FinFolk.','Your profile, published logs and connections in one place.');guest('me');return;}
  const id=own?api.user.uid:current().get('id');if(!id)throw Error('Choose a diver.');
  const [member,connections]=await Promise.all([own?Promise.resolve({...me.profile,id}):api.call('profile',{target:id}),api.call('connections')]);
  if(generation!==epoch||disposed)return;
  if(member.restricted){main.append(empty('Profile unavailable','This diver is not sharing their profile with you.',profileLink('Back to People','people')));return;}
  main.append(profileLink('← People at '+(selectedLocation()?.name||'your spot'),'people',{},'profile-back'));
  const hero=node('section',undefined,'member-hero'),content=node('div');content.append(node('p',own?'MY PROFILE':'DIVER PROFILE','profile-eyebrow'),node('h1',member.displayName),node('p',member.bio||'No bio added.','member-bio'));
  const tags=node('div',undefined,'profile-tags');if(EXPERIENCES[member.experience])tags.append(node('span',EXPERIENCES[member.experience]));for(const value of member.availability||[])tags.append(node('span',value));content.append(tags,socials(member));
  const actions=node('div',undefined,'profile-action-row');
  if(own)actions.append(profileLink('Edit profile','edit',{},'profile-action primary'),link('Check in ↗',navigationURL('checkin',selectedLocation()?.id)));
  else actions.append(connect(member,connections.find(row=>row.id===id)?.status));
  content.append(actions,node('p',own?(member.open?'Open · Your profile can appear in People.':'Closed · Hidden from People. Published logs can still be shared; accepted buddies keep access to permitted statistics.'):'Experience and log details are self-reported.','profile-small'));hero.append(portrait(member),content);main.append(hero);
  const places=node('section',undefined,'profile-section'),locations=node('div',undefined,'profile-tags');places.append(node('h2','Locations'));
  for(const siteId of member.beaches||[]){const site=siteById(siteId);if(site)locations.append(profileLink(site.name+' · '+(site.state_id||site.state||''),'people',{location:site.id},''));}places.append(locations);if(!locations.children.length)places.append(node('p','No locations selected.','profile-small'));main.append(places);
  const posts=node('section',undefined,'profile-section');posts.append(node('h2','Selected social posts'));main.append(posts);
  const postRows=own?(await api.call('myPosts')).filter(post=>post.status==='approved'&&post.public_consent):(member.posts||[]);
  if(generation!==epoch||disposed)return;
  const chosen=Array.isArray(member.featuredPosts)?member.featuredPosts.map(postId=>postRows.find(post=>post.id===postId)).filter(Boolean):postRows.slice(0,6),postGrid=node('div',undefined,'profile-post-grid');
  for(const post of chosen){const url=socialPostURL(post);if(!url)continue;const tile=link('',url,'profile-post-link');tile.target='_blank';tile.rel='noopener noreferrer';tile.append(node('strong',post.platform==='tiktok'?'TikTok ↗':'Instagram ↗'),node('small',post.beach_name||siteById(post.beach_id)?.name||'Shared post'),node('span','Open original post'));postGrid.append(tile);}posts.append(postGrid);
  if(!postGrid.children.length)posts.append(node('p','No published social posts selected.','profile-small'));if(own)posts.append(link('Manage your posts ↗','./?view=account&tab=posts'));
  const logs=node('section',undefined,'profile-section');logs.append(node('h2','Published logs'));main.append(logs);
  const listed=await api.call('sessions',{owner:id,publicOnly:true});
  const missing=(member.featuredLogs||[]).filter(logId=>!(listed.sessions||[]).some(log=>log.id===logId));
  const extra=await Promise.allSettled(missing.map(logId=>api.call('session',{id:logId})));
  const logRows=[...(listed.sessions||[]),...extra.filter(result=>result.status==='fulfilled'&&result.value?.ownerId===id).map(result=>result.value)];
  if(generation!==epoch||disposed)return;
  const logGrid=node('div',undefined,'profile-log-grid');for(const log of publishedLogs(logRows,member.featuredLogs,id))logGrid.append(publishedLogCard(log));logs.append(logGrid);if(!logGrid.children.length)logs.append(node('p','No published logs selected.','profile-small'));
  if(own){logs.append(link('Open your logbook ↗','./?view=logbook'));await ownConnections(connections,generation);}
  else if(selectedLocation()){
   const stats=await api.call('stats',{target:id,beachId:selectedLocation().id});if(generation!==epoch||disposed)return;
   const section=node('section',undefined,'profile-section'),grid=node('dl',undefined,'profile-stats-grid');section.append(node('h2','Shared statistics'));
   for(const [key,label]of Object.entries({visits:'Visit days',months:'Active months',dives:'Dives',minutes:'Minutes',typicalDepth:'Typical depth (m)'}))if(stats.stats?.[key]!=null){const cell=node('div');cell.append(node('dt',label),node('dd',String(stats.stats[key])));grid.append(cell);}section.append(grid);
   if(!grid.children.length)section.append(node('p','No statistics are shared with you at this location yet.','profile-small'));main.append(section);
   const block=button('Block diver',()=>mutate(block,'block',{target:id},()=>navigate('people')));main.append(block);
  }
 }
 function socialPostURL(post){try{const url=new URL(post.url);return url.protocol==='https:'&&['www.instagram.com','www.tiktok.com','instagram.com','tiktok.com'].includes(url.hostname)&&!url.username&&!url.password?url.href:null;}catch{return null;}}
 async function ownConnections(connections,generation){
  const section=node('section',undefined,'profile-section');section.append(node('h2','Your buddies'));if(!connections.length)section.append(node('p','Connect with divers at your locations to find your people.','profile-small'));
  for(const row of connections){const line=node('div',undefined,'profile-connection-row');line.append(profileLink(row.name||'Diver','member',{id:row.id},''),node('span',row.status==='accepted'?'Connected':row.requested_by===api.user.uid?'Request sent':'Connection request','profile-small'));
   for(const [mode,label]of row.status==='pending'&&row.requested_by!==api.user.uid?[['accept','Accept'],['decline','Decline']]:[['remove',row.status==='accepted'?'Remove connection':'Cancel request']]){const control=button(label,()=>mutate(control,'connection',{target:row.id,mode},()=>render()));line.append(control);}section.append(line);
  }main.append(section);
  const blocked=await api.call('blocks');if(generation!==epoch||disposed)return;
  if(blocked.length){const group=node('details',undefined,'profile-section');group.append(node('summary','Blocked profiles'));for(const row of blocked){const control=button('Unblock '+(row.name||'diver'),()=>mutate(control,'unblock',{target:row.id},()=>render()));group.append(control);}main.append(group);}
 }
 async function editProfile(generation){
  heading('MY PROFILE','Edit profile','Choose how you appear to other divers and what you share.');if(!api.user){guest('edit');return;}
  const [listed,posts]=await Promise.all([api.call('sessions',{}),api.call('myPosts')]);if(generation!==epoch||disposed)return;
  const extra=await Promise.allSettled((me.profile.featuredLogs||[]).filter(id=>!(listed.sessions||[]).some(log=>log.id===id)).map(id=>api.call('session',{id})));
  if(generation!==epoch||disposed)return;
  const editableLogs=[...(listed.sessions||[]),...extra.filter(result=>result.status==='fulfilled').map(result=>result.value)].filter(log=>log?.ownerId===api.user.uid&&log.visibility==='public');
  const profile=me.profile,layout=node('div',undefined,'profile-editor-layout'),form=node('form',undefined,'profile-editor'),preview=node('aside',undefined,'profile-editor-preview'),error=node('p','','profile-form-error');error.setAttribute('role','status');
  const fields={},checks={},selectedSites=new Set(profile.beaches||[]);let portraitValue=profile.portrait||'',uploadPending=false;
  function group(title){const box=node('fieldset');box.append(node('legend',title));form.append(box);return box;}
  function field(host,name,title,type='text',value=''){const label=node('label',title),input=node(type==='textarea'?'textarea':'input');input.name=name;if(type!=='textarea')input.type=type;input.value=value;label.append(input);host.append(label);fields[name]=input;return input;}
  function check(host,name,title,checked){const label=node('label',undefined,'profile-check'),input=node('input');input.type='checkbox';input.name=name;input.checked=checked;label.append(input,node('span',title));host.append(label);return input;}
  function draft(){return {...profile,displayName:fields.displayName.value.trim(),bio:fields.bio.value.trim(),portrait:portraitValue};}
  function updatePreview(){preview.replaceChildren(node('p','PROFILE PREVIEW','profile-eyebrow'),portrait(draft()),node('h2',draft().displayName||'Your name'),node('p',draft().bio||'Add a little about yourself.'));}
  const identity=group('Profile'),name=field(identity,'displayName','Display name','text',profile.displayName||''),bio=field(identity,'bio','About you','textarea',profile.bio||'');name.required=true;name.maxLength=80;bio.maxLength=500;name.oninput=bio.oninput=updatePreview;
  const picture=group('Portrait'),upload=field(picture,'portrait','JPEG, PNG or WebP · up to 2 MiB','file');upload.accept='image/jpeg,image/png,image/webp';upload.onchange=async()=>{if(!upload.files[0])return;uploadPending=true;save.disabled=true;try{portraitValue=await portraitDataURL(upload.files[0],win);if(generation!==epoch)return;error.textContent='Portrait ready. Save profile to keep it.';updatePreview();}catch(e){error.textContent=e.message;}finally{uploadPending=false;save.disabled=false;upload.value='';}};
  picture.append(button('Remove portrait',()=>{portraitValue='';upload.value='';updatePreview();}));
  const places=group('Locations & availability'),search=field(places,'locationSearch','Find a location','search'),placeList=node('div',undefined,'profile-directory-list');places.append(placeList);
  function showSites(){placeList.replaceChildren();const query=search.value.trim().toLowerCase();for(const site of sites.filter(site=>site.name.toLowerCase().includes(query)||selectedSites.has(site.id))){const input=check(placeList,'beaches',site.name+' · '+(site.state_id||site.state||''),selectedSites.has(site.id));input.value=site.id;input.onchange=()=>{if(input.checked&&selectedSites.size>=20){input.checked=false;error.textContent='Choose up to 20 locations.';return;}input.checked?selectedSites.add(site.id):selectedSites.delete(site.id);};}}
  search.oninput=showSites;showSites();
  const availability=[];for(const value of AVAILABILITY){const input=check(places,'availability',value,(profile.availability||[]).includes(value));input.value=value;availability.push(input);}
  const experienceLabel=node('label','Experience'),experience=node('select');experience.name='experience';experience.append(option('Choose an experience level',''));for(const [value,label]of Object.entries(EXPERIENCES))experience.append(option(label,value));experience.value=profile.experience||'';experienceLabel.append(experience);places.append(experienceLabel);
  const social=group('Linked profiles');social.append(link('Manage Instagram ↗','./?view=account&tab=instagram'));field(social,'tiktok','TikTok profile URL','url',profile.tiktok||'').placeholder='https://www.tiktok.com/@yourname/';social.append(node('p','Links open the original platform. Saving a link does not verify ownership.','profile-small'));
  function featurePicker(title,key,items,initial){
   const box=group(title),order=Array.isArray(initial)?initial.filter(id=>items.some(item=>item.id===id)):items.slice(0,6).map(item=>item.id),list=node('div');box.append(list);
   function draw(){list.replaceChildren();for(const item of [...order.map(id=>items.find(row=>row.id===id)),...items.filter(row=>!order.includes(row.id))]){
    const row=node('div',undefined,'profile-feature-row'),input=check(row,key,item.title||item.beach_name||siteById(item.beachId||item.beach_id)?.name||'Published item',order.includes(item.id));input.value=item.id;
    input.onchange=()=>{if(input.checked&&order.length>=12){input.checked=false;error.textContent='Select up to 12 featured items.';return;}input.checked?order.push(item.id):order.splice(order.indexOf(item.id),1);draw();};
    const moves=node('div',undefined,'profile-order');for(const [offset,text]of [[-1,'↑'],[1,'↓']]){const index=order.indexOf(item.id),move=button(text,()=>{const from=order.indexOf(item.id),to=from+offset;[order[from],order[to]]=[order[to],order[from]];draw();});move.setAttribute('aria-label',(offset<0?'Move up: ':'Move down: ')+(item.title||item.beach_name||'Published item'));move.disabled=index<0||index+offset<0||index+offset>=order.length;moves.append(move);}row.append(moves);list.append(row);
   }}draw();if(!items.length)box.append(node('p','No published items to feature yet.','profile-small'));return order;
  }
  const featuredPosts=featurePicker('Featured social posts','featuredPosts',posts.filter(post=>post.status==='approved'&&post.public_consent),profile.featuredPosts),featuredLogs=featurePicker('Featured published logs','featuredLogs',editableLogs,profile.featuredLogs);
  const privacy=group('Visibility & statistics'),open=check(privacy,'open','Open — appear in People at your locations',profile.open===true);privacy.append(node('p','Closed hides you from People. Published logs can still be shared. Accepted buddies keep access to statistics you permit.','profile-small'));
  for(const [key,title]of Object.entries(SHARING))checks[key]=check(privacy,key,title,profile.sharing?.[key]===true);
  privacy.append(node('p','Both Open divers need 3 visit days in the last 30 days for activity statistics and 5 for dive summaries. Accepted buddies bypass these visit gates.','profile-small'));
  const actions=node('div',undefined,'profile-editor-actions'),save=node('button','Save profile','profile-action primary');save.type='submit';actions.append(save,profileLink('Cancel','me'));form.append(error,actions);layout.append(form,preview);main.append(layout);updatePreview();
  form.onsubmit=async event=>{
   event.preventDefault();if(uploadPending)return;save.disabled=true;error.textContent='Saving profile…';
   try{
    const values={...draft(),tiktok:fields.tiktok.value,beaches:[...selectedSites],availability:availability.filter(input=>input.checked).map(input=>input.value),experience:experience.value,open:open.checked,sharing:Object.fromEntries(Object.entries(checks).map(([key,input])=>[key,input.checked])),featuredPosts:[...featuredPosts],featuredLogs:[...featuredLogs]};
    if(!values.displayName)throw Error('Enter a display name.');
    const result=await api.call('preferences',{profile:values});if(generation!==epoch||disposed)return;me={...me,profile:result.profile};message('Profile saved.');await navigate('me');
   }catch(e){if(generation===epoch)error.textContent=e.message||'Your profile could not be saved. Try again.';}finally{if(save.isConnected)save.disabled=false;}
  };
 }
 async function render(){
  for(const stop of directoryStops.splice(0))stop();
  const generation=++epoch;main.replaceChildren(node('p','Loading profiles…'));main.setAttribute('aria-busy','true');
  try{
   if(api.user&&!['directory','listing','events'].includes(current().get('screen')))me=await api.call('me');else me=null;if(generation!==epoch||disposed)return;
   main.replaceChildren();const screen=current().get('screen')||'people';
   doc.querySelector('link[rel=canonical]')?.remove();const robots=doc.querySelector('meta[name=robots]');if(robots)robots.content=['directory','listing','events'].includes(screen)?'index,follow':'noindex,follow';
   if(screen==='events')await renderEvents({main,api,params:current(),refresh:render,doc});else if(['directory','listing','superadmin','my-listings','page-invite'].includes(screen))await renderDirectory({main,api,config,screen,params:current(),doc,refresh:render,dispose:stop=>{if(generation===epoch&&!disposed)directoryStops.push(stop);else stop();}});else if(screen==='people')await people(generation);else if(screen==='edit')await editProfile(generation);else await memberProfile(generation,screen!=='member');
   if(generation===epoch){navigation.update();doc.title=(screen==='people'?'People':screen==='edit'?'Edit profile':main.querySelector('h1')?.textContent||'My profile')+' · FinFolk';}
  }catch(error){if(generation===epoch&&!disposed){main.replaceChildren(empty('Profiles could not load',error.message||'Reconnect and try again.',button('Try again',()=>render())));}}
  finally{if(generation===epoch)main.removeAttribute('aria-busy');}
 }
 const popstate=()=>render();win.addEventListener('popstate',popstate);
 let actor=api.user?.uid;const stop=api.observe?.(user=>{if(actor===user?.uid)return;actor=user?.uid;me=null;message('');render();});
 await render();
 if('serviceWorker' in win.navigator)win.navigator.serviceWorker.register('./sw.js').catch(()=>{});
 return {render,navigate,destroy(){for(const stop of directoryStops.splice(0))stop();disposed=true;epoch++;stop?.();navigation.destroy();win.removeEventListener('popstate',popstate);doc.removeEventListener('click',onLink);doc.removeEventListener('finfolk:appearance',syncTheme);}};
}
