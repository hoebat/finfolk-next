// Shared navigation for the atlas and member profiles.
const installed=new WeakMap();
export const NAV_ITEMS=[['discover','Discover'],['map','Map'],['people','People'],['logbook','Logbook'],['me','Profile']];
const paths={discover:['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z','m16 8-2.5 5.5L8 16l2.5-5.5Z'],map:['m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z','M9 3v16M15 5v16'],people:['M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z','M4 21v-2a8 8 0 0 1 16 0v2M19 4a3 3 0 0 1 0 6M3 4a3 3 0 0 0 0 6'],logbook:['M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15','M6 8h3m-3 4h3m6-4h3m-3 4h3'],me:['M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z','M4 22v-2a8 8 0 0 1 16 0v2'],more:['M4 6h16M4 12h16M4 18h16']};
function icon(doc,key){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');for(const d of paths[key]||paths.more){const p=doc.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);svg.append(p);}return svg;}
export function navigationURL(key,location=''){
 const site=location?encodeURIComponent(location):'',context=site?'&site='+site:'';
 if(key==='people')return '/profiles?screen=people';
 if(['me','edit'].includes(key))return '/profiles?screen='+key+(site?'&location='+site:'');
 if(key==='discover')return '/app?view=discover&section=suggested'+context;
 if(key==='events')return '/events';
 if(key==='my-events')return '/events/my';
 if(key==='directory')return '/directory';
 if(key==='my-listings')return '/profiles?screen=my-listings';
 if(key==='map')return '/app?view=maps'+context;
 if(key==='logbook')return '/app?view=logbook'+context;
 if(key==='checkin')return '/app?view=account&tab=checkin'+context;
 if(key==='settings')return '/app?view=account&tab=settings'+context;
 return './';
}
export function installNavigation({doc=document,nav,rail,context=()=>''}={}){
 if(!nav||!rail)return null;if(installed.has(nav))return installed.get(nav);
 const win=doc.defaultView,listeners=[];let expanded=false,signedIn=false;
 if(nav.classList.contains('primary-nav')){
  for(const [key,label]of [['people','People'],['me','Profile']]){
   const a=doc.createElement('a');a.dataset.nav=key;a.textContent=label;
   key==='people'?nav.insertBefore(a,nav.querySelector('[data-view=logbook]')):nav.append(a);
  }
 }
 const listen=(target,event,fn,capture=false)=>{target.addEventListener(event,fn,capture);listeners.push(()=>target.removeEventListener(event,fn,capture));};
 doc.body.classList.add('finfolk-navigation-enabled');if(nav.classList.contains('primary-nav'))doc.body.classList.add('finfolk-app-navigation');nav.classList.add('ff-primary-nav');
 const home=rail.querySelector('.brand,.profile-home');if(home){home.href='./';home.target='_top';}

 function decorate(item,key,label){item.classList.add('ff-nav-item');item.dataset.localNav=key;const text=doc.createElement('span');text.textContent=label;item.replaceChildren(icon(doc,key),text);}
 for(const [key,label]of NAV_ITEMS){const item=nav.querySelector(`[data-nav="${key}"]`)||nav.querySelector(`[data-view="${key==='map'?'maps':key}"]`)||nav.querySelector(`[data-profile-preview-link="${key}"]`);if(item)decorate(item,key,label);}
 const nativeLogbook=nav.querySelector('button[data-view=logbook]');let fallback;
 if(nativeLogbook){fallback=doc.createElement('a');fallback.dataset.localLogbookFallback='true';fallback.href=navigationURL('logbook',context());decorate(fallback,'logbook','Logbook');nav.insertBefore(fallback,nativeLogbook.nextSibling);}
 const host=doc.createElement('div');host.className='ff-utility-menu';const toggle=doc.createElement('button');toggle.type='button';toggle.className='ff-menu-toggle';toggle.id='local-menu-toggle';toggle.setAttribute('aria-controls','local-menu-panel');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu');const toggleLabel=doc.createElement('span');toggleLabel.textContent='More';toggle.append(icon(doc,'more'),toggleLabel);
 const panel=doc.createElement('nav');panel.id='local-menu-panel';panel.className='ff-menu-panel';panel.setAttribute('aria-label','Account and settings');panel.hidden=true;
 for(const [key,label]of [['edit','Edit profile'],['checkin','Check in'],['settings','Settings'],['directory','Businesses & groups'],['my-listings','My pages'],['events','Events'],['my-events','My events']]){const a=doc.createElement('a');a.textContent=label;a.dataset.localUtility=key;if(key==='edit')a.dataset.profileScreen='edit';panel.append(a);}const signin=doc.createElement('a');signin.className='ff-menu-toggle';signin.textContent='Sign in';signin.href='/app?view=account';signin.setAttribute('aria-label','Sign in');host.append(toggle,panel,signin);rail.append(host);
 function close({focus=false}={}){expanded=false;panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Open menu');if(focus)toggle.focus();}
 function update(){doc.body.classList.toggle('finfolk-guest-navigation',!signedIn);for(const item of nav.querySelectorAll('.ff-nav-item')){if(item===nativeLogbook)continue;const key=item.dataset.localNav,hidden=!signedIn&&!['discover','map'].includes(key);if(item.hidden!==hidden)item.hidden=hidden;}toggle.hidden=!signedIn;signin.hidden=signedIn;if(!signedIn)close();const selected=context();for(const item of nav.querySelectorAll('a.ff-nav-item'))item.href=navigationURL(item.dataset.localNav,selected);for(const a of panel.querySelectorAll('a'))a.href=navigationURL(a.dataset.localUtility,selected);if(fallback){const hidden=!signedIn||!nativeLogbook.hidden;if(fallback.hidden!==hidden)fallback.hidden=hidden;const current=nativeLogbook.getAttribute('aria-current');if(current==='page'){if(fallback.getAttribute('aria-current')!=='page')fallback.setAttribute('aria-current','page');}else if(fallback.hasAttribute('aria-current'))fallback.removeAttribute('aria-current');}const p=new URL(win.location.href).searchParams;for(const a of doc.body.classList.contains('profile-demo')?nav.querySelectorAll('a[data-nav]'):[]){if(a.dataset.nav===((/^\/directory(?:\/|$)/.test(win.location.pathname)||['directory','listing'].includes(p.get('screen'))?'discover':p.get('screen')==='people'?'people':'me'))){if(a.getAttribute('aria-current')!=='page')a.setAttribute('aria-current','page');}else if(a.hasAttribute('aria-current'))a.removeAttribute('aria-current');}for(const a of panel.querySelectorAll('[data-local-utility]')){const key=a.dataset.localUtility,active=key==='settings'&&p.get('view')==='account'&&p.get('tab')==='settings'||key==='checkin'&&p.get('view')==='account'&&(!p.get('tab')||p.get('tab')==='checkin')||key==='edit'&&p.get('screen')==='edit';if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}toggle.dataset.sectionActive=String(p.get('view')==='account'&&p.get('tab')==='settings'||p.get('view')==='account');}
 listen(toggle,'click',()=>{if(!signedIn)return;update();expanded=!expanded;panel.hidden=!expanded;toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',expanded?'Close menu':'Open menu');if(expanded)panel.querySelector('a')?.focus();});
 listen(doc,'keydown',event=>{if(!expanded)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close({focus:true});}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){const links=[...panel.querySelectorAll('a')],index=links.indexOf(doc.activeElement);if(index>=0){event.preventDefault();links[(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length].focus();}}},true);
 listen(doc,'pointerdown',event=>{if(expanded&&!host.contains(event.target))close();});listen(doc,'focusin',event=>{if(expanded&&!host.contains(event.target))close();});
 listen(panel,'click',event=>{const a=event.target.closest('a');if(a){a.href=navigationURL(a.dataset.localUtility,context());close();}});
 listen(nav,'click',event=>{const a=event.target.closest('a.ff-nav-item');if(a)a.href=navigationURL(a.dataset.localNav,context());close();});listen(win,'popstate',()=>{close();update();});
 const observer=new win.MutationObserver(update);observer.observe(nav,{attributes:true,attributeFilter:['hidden','aria-current'],subtree:true});update();
 const api={update,close,setUser(user){signedIn=!!user;update();},destroy(){close();observer.disconnect();for(const remove of listeners)remove();host.remove();fallback?.remove();nav.classList.remove('ff-primary-nav');installed.delete(nav);}};installed.set(nav,api);return api;
}
