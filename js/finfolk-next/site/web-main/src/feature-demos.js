import {PROFILE_AVATARS} from './profile-avatars.js';
import {beachThumbnail} from './beach-thumbnail.js';
import {DEMO_LOCATIONS} from './demo-locations.js';
const PORTRAITS=Object.fromEntries(PROFILE_AVATARS.map(avatar=>[avatar.id,avatar.url]));
const portrait=name=>`<img src="${PORTRAITS[name.toLowerCase()]}" alt="" loading="lazy" width="900" height="1125">`;
const pill=text=>`<span class="demo-pill">${text}</span>`;
const field=(label,value,cls='')=>`<div class="demo-field ${cls}"><small>${label}</small><span>${value}</span></div>`;
const action=(text,cls='')=>`<div class="demo-action ${cls}">${text}</div>`;
const check='<span class="demo-check">✓</span>';
const page=(phase,content)=>`<div class="demo-page" data-phase="${phase}">${content}</div>`;
const ownProfile=()=>'<div class="demo-profile-mini">'+portrait('Alex')+'<div><h4>Alex</h4><p>Freediving &amp; pool training</p></div></div>'+pill('Closed profile');
function locationPages(){const spot=DEMO_LOCATIONS['locations'];return [
 page(0,'<p class="demo-overline">PROFILE</p>'+ownProfile()+'<p class="demo-bio">Weekend shore dives and regular training.</p><div class="demo-socials">'+pill('Instagram ↗')+pill('TikTok ↗')+'</div><p class="demo-overline">YOUR SPOTS</p><div class="demo-empty-spots">Add the places you dive.</div>'+action('Add a spot','demo-tap-target')),
 page(1,'<p class="demo-overline">EDIT PROFILE / LOCATIONS</p><h4>Pick your spot.</h4><div class="demo-search"><span>⌕</span><span data-demo-query>'+spot.query+'</span><i></i></div>'+field('State / territory',spot.state+' ▾')+'<p class="demo-hint">Add a location to your profile.</p>'),
 page(2,'<p class="demo-overline">EDIT PROFILE / LOCATIONS</p><div class="demo-search"><span>⌕</span><span>'+spot.query+'</span></div><div class="demo-location-card"><div data-demo-map></div><h4>'+spot.name+'</h4><p>'+spot.region+' · '+spot.state_id+'</p></div>'+action('Add to my profile','demo-tap-target')),
 page(3,'<p class="demo-overline">PROFILE</p>'+ownProfile()+'<div class="demo-confirmation">'+check+' Profile saved</div><p class="demo-overline">YOUR SPOTS</p><div class="demo-profile-spot"><div data-demo-map></div><strong>'+spot.name+'</strong><span>'+spot.state+'</span></div><p class="demo-hint">Your profile is still Closed. You choose what to share.</p>')
].join('');}
function logPages(){const spot=DEMO_LOCATIONS['logs'];return [
 page(0,'<p class="demo-overline">NEW SESSION</p><h4>Log a session</h4>'+field('Location',''+spot.name+' ▾','demo-tap-target')+field('Activity','Freediving ▾')+field('Date','29 October 2026')+pill('Private by default')),
 page(1,'<p class="demo-overline">NEW SESSION</p><h4>Log a session</h4>'+field('Location',spot.name)+'<div class="demo-field-pair">'+field('Duration','<span data-demo-duration>45 min</span>','demo-filled')+field('Maximum depth','<span data-demo-depth>8 m</span>','demo-filled demo-tap-target')+'</div>'+field('Notes','<span data-demo-notes>Shore session with my buddy. Equalisation practice.</span>','demo-notes')+pill('Private by default')),
 page(2,'<p class="demo-overline">NEW SESSION</p><h4>Ready to save</h4><div class="demo-session-summary"><strong>'+spot.name+'</strong><span>Freediving · 29 October</span><div><b>45 <small>min</small></b><b>8 <small>m max</small></b></div></div><div class="demo-privacy"><strong>Visibility</strong>'+pill('◉ Private')+'<span>○ Published</span></div><p class="demo-hint">Only you can see a private session.</p>'+action('Save session','demo-tap-target')),
 page(3,'<p class="demo-overline">MY SESSIONS</p><h4>Your logbook</h4><div class="demo-confirmation">'+check+' Session saved</div><div class="demo-saved-session">'+pill('Private')+'<p>29 October 2026</p><h4>'+spot.name+'</h4><div class="demo-session-stats"><b>45 <small>min</small></b><b>8 <small>m max</small></b></div><p>Shore session with my buddy. Equalisation practice.</p></div>')
].join('');}
function peoplePages(){const spot=DEMO_LOCATIONS['people'];return [
 page(0,'<p class="demo-overline">PEOPLE / '+spot.name.toUpperCase()+'</p><h4>Your FinFolk.</h4><div class="demo-people-grid">'+['Maya','Kai'].map(name=>'<div class="demo-person '+(name==='Maya'?'demo-tap-target':'')+'">'+portrait(name)+'<strong>'+name+'</strong>'+pill('Regular')+'</div>').join('')+'</div><p class="demo-hint">Freedivers who visit your spot.</p>'),
 page(1,'<div class="demo-profile-portrait">'+portrait('Maya')+'<div><span>REGULAR / '+spot.name.toUpperCase()+'</span><h4>Maya</h4></div></div><p class="demo-bio">Shore dives, reef sessions and regular pool training.</p>'+action('Connect')+'<div class="demo-socials">'+pill('Instagram ↗')+pill('TikTok ↗')+'</div>'),
 page(2,'<div class="demo-profile-mini">'+portrait('Maya')+'<div><h4>Maya</h4><p>Regular at '+spot.name+'</p></div></div><div class="demo-socials">'+pill('Instagram ↗')+pill('TikTok ↗')+'</div><p class="demo-overline">PUBLISHED LOG</p><div class="demo-saved-session"><h4>Shore freediving</h4><p>'+spot.name+'</p><div class="demo-session-stats"><b>45 <small>min</small></b><b>8 <small>m max</small></b></div></div>'+action('Connect with Maya','demo-tap-target')),
 page(3,'<div class="demo-profile-portrait">'+portrait('Maya')+'<div><span>REGULAR / '+spot.name.toUpperCase()+'</span><h4>Maya</h4></div></div>'+action(check+' Request sent','is-success')+'<p class="demo-hint">Maya chooses whether to accept your request.</p><div class="demo-socials">'+pill('Instagram ↗')+pill('TikTok ↗')+'</div>')
].join('');}
const brandMark='<span class="brand-f" style="--brand-size:24px"></span>';
const platformIcon=platform=>platform==='FinFolk'?brandMark:'<span class="demo-platform-symbol" aria-hidden="true">'+(platform==='Instagram'?'◎':'♪')+'</span>';
const thread=content=>'<div class="demo-thread-title">'+brandMark+'<div><strong>finfolk.com.au</strong><small>Instagram</small></div></div>'+content;
const message=(text,sent=false)=>'<div class="demo-message '+(sent?'is-sent':'')+'">'+text+'</div>';
const typed=text=>'<span data-demo-type="'+text+'">'+text+'</span>';
const video=(spot,pose='gliding')=>'<div class="demo-post-media demo-session-art" data-pose="'+pose+'"><span class="demo-session-diver" aria-hidden="true"></span><span class="demo-session-play" aria-hidden="true">▶</span><small>'+spot.name+' · Freediving</small></div>';
function instagramConnectPages(){const spot=DEMO_LOCATIONS['instagram-connect'];return [
 page(0,'<p class="demo-overline">INSTAGRAM</p><div class="demo-instagram-profile">'+brandMark+'<h4>finfolk.com.au</h4><p>Freediving locations, logs and community.</p></div>'+action('Follow @finfolk.com.au','demo-tap-target')+'<p class="demo-hint">Follow FinFolk to connect and use member commands.</p>'),
 page(1,thread(message(typed('/connect'),true)+'<div class="demo-connect-reply">'+message('Your FinFolk code: <b>•••• ••••</b><br>Enter it on FinFolk within 10 minutes.')+'</div>')+'<div class="demo-compose">Message… <span>↑</span></div>'),
 page(2,'<p class="demo-overline">PROFILE / INSTAGRAM</p><h4>Connect Instagram</h4>'+field('Code from your Instagram DM','<span class="demo-code">'+typed('•••• ••••')+'</span>','demo-tap-target')+'<div class="demo-confirmation demo-connect-success">'+check+' Connected to @alex.dives</div><p class="demo-hint">Enter the code sent to your own Instagram account.</p>'),
 page(3,thread(message(typed('/checkin '+spot.name+''),true))+'<div class="demo-compose demo-tap-target">/checkin '+spot.name+' <span>↑</span></div>'),
 page(4,thread(message('/checkin '+spot.name,true)+message('Checked in at '+spot.name+' for today. Your profile and sharing preferences still apply.'))),
 page(5,'<p class="demo-overline">MY ACCOUNT / VISITS</p>'+ownProfile()+'<div class="demo-confirmation">'+check+' Visit recorded</div><div class="demo-visit"><strong>'+spot.name+'</strong><span>Today · Self-reported visit</span>'+pill('1 visit day')+'</div><p class="demo-hint">Become a Regular after visits on three separate days within 30 days. Your profile is still Closed.</p>')
].join('');}
function importPages(platform='Instagram'){const tiktok=platform==='TikTok';const spot=DEMO_LOCATIONS[platform==='Instagram'?'instagram-post':'tiktok-post'];return [
 page(0,'<p class="demo-overline">'+(tiktok?'TIKTOK / VIDEO':'INSTAGRAM / PHOTO OR REEL')+'</p><h4>Share your session</h4>'+video(spot,tiktok?'ascending':'gliding')+'<div class="demo-post-caption"><strong>@alex.dives</strong><p>Shore session at '+spot.name+'.<br><span class="demo-mention">'+typed('@finfolk.com.au')+'</span></p></div>'+action('Post','demo-tap-target')),
 page(1,'<p class="demo-overline">FINFOLK / TAGGED MEDIA</p><h4>New in your log</h4><div class="demo-confirmation">'+check+' '+(tiktok?'Tagged video imported':'Tagged photo or video imported')+'</div><div class="demo-review-card">'+video(spot,tiktok?'ascending':'gliding')+pill('Not in a session yet')+'<strong>'+spot.name+'</strong><span>29 October 2026 · '+platform+'</span></div><p class="demo-hint">The post’s day and matched location come with it.</p>'),
 page(2,'<p class="demo-overline">REVIEW IMPORT</p><h4>Day and location</h4>'+field('Day','29 October 2026')+field('Detected location',spot.name)+field('Additional information',typed('Shore session with my buddy.'),'demo-notes')+'<p class="demo-hint">Check the day and confirm or change the location.</p>'+action('Sort into a session','demo-tap-target')),
 page(3,'<p class="demo-overline">SORT INTO A SESSION</p><h4>Choose a session</h4><div class="demo-saved-session">'+pill('Private')+'<p>29 October 2026</p><h4>'+spot.name+'</h4><p>Shore session with my buddy.</p></div>'+action('Add to this session','demo-tap-target')+'<p class="demo-hint">Or create a new session. Add dive details when you’re ready.</p>'),
 page(4,'<p class="demo-overline">LOGBOOK / '+spot.name.toUpperCase()+'</p><h4>Your session</h4><div class="demo-confirmation">'+check+' Photo or video added</div><div class="demo-saved-session">'+pill('Private')+'<p>29 October 2026</p><h4>'+spot.name+'</h4><p>Shore session with my buddy.</p><div class="demo-imported-media">'+(tiktok?'TikTok video linked':'Instagram photo / video linked')+'</div></div><p class="demo-hint">Add more information or publish the session later. The original media stays on '+platform+'.</p>')
].join('');}
const standardDurations=[2400,2600,3000,3400];
function planningPages(){const spot=DEMO_LOCATIONS['planning'];return [
 page(0,'<p class="demo-overline">PLAN A SESSION</p><h4>Where shall we dive?</h4><div class="demo-search"><span>⌕</span><span>'+spot.name+'</span></div><div class="demo-location-card"><div data-demo-map></div><h4>'+spot.name+'</h4><p>'+spot.region+' · '+spot.state_id+'</p></div>'+action('Plan here','demo-tap-target')),
 page(1,'<p class="demo-overline">YOUR PLAN / '+spot.name.toUpperCase()+'</p><h4>Make a little time.</h4>'+field('Session','Saturday shore session')+'<div class="demo-field-pair">'+field('Day','Saturday')+field('Meet at','7:30 am','demo-tap-target')+'</div>'+field('Meeting point','To be confirmed')+pill('Invite only')+action('Choose your people')),
 page(2,'<p class="demo-overline">INVITE YOUR FINFOLK</p><h4>Who’s joining?</h4><div class="demo-plan-recap"><strong>'+spot.name+'</strong><span>Saturday · 7:30 am</span></div>'+['Maya','Kai'].map(name=>'<div class="demo-invite-person">'+portrait(name)+'<div><strong>'+name+'</strong><small>Your connection</small></div>'+check+'</div>').join('')+'<p class="demo-hint">Your invited connections can join the plan in FinFolk.</p>'+action('Send 2 invitations','demo-tap-target')),
 page(3,'<p class="demo-overline">YOUR UPCOMING SESSION</p><h4>See you at '+spot.query+'.</h4><div class="demo-profile-spot"><div data-demo-map></div><strong>'+spot.name+'</strong><span>Saturday · 7:30 am</span></div><div class="demo-confirmation">'+check+' Invitations sent</div><div class="demo-invite-person">'+portrait('Maya')+'<div><strong>Maya</strong><small>Joined your plan</small></div>'+pill('Joined')+'</div><div class="demo-invite-person">'+portrait('Kai')+'<div><strong>Kai</strong><small>Waiting for a reply</small></div>'+pill('Invited')+'</div><p class="demo-hint">Invite only · Meeting point to be confirmed.</p>')
].join('');}
function regularsPages(){const place=DEMO_LOCATIONS.regulars;
 const visits=count=>'<div class="demo-regular-days">'+['02 OCT','05 OCT','08 OCT'].map((date,index)=>'<div class="demo-regular-day '+(index<count?'is-recorded':'')+'"><span>'+date+'</span><b>'+(index<count?'✓':String(index+1).padStart(2,'0'))+'</b><small>'+(index<count?'Checked in':'Visit day')+'</small></div>').join('')+'</div><div class="demo-regular-meter"><span style="width:'+count/3*100+'%"></span></div><p class="demo-regular-count">'+count+' of 3 separate days · Last 30 days</p>';
 const spot='<div class="demo-plan-recap"><strong>'+place.name+'</strong><span>Same spot. Three separate days.</span></div>';
 return [
  page(0,'<p class="demo-overline">MY ACCOUNT / CHECK IN</p><h4>Make it your spot.</h4>'+field('Location',place.name+' ▾')+field('Visit day','2 October 2026')+pill('Self-reported visit')+action('Check in at '+place.query,'demo-tap-target')+'<p class="demo-hint">Start with a check-in at the place you dive.</p>'),
  page(1,'<p class="demo-overline">2 OCTOBER / FIRST VISIT</p><h4>One day down.</h4>'+spot+visits(1)+'<p class="demo-hint">Checking in again today still counts as one visit day.</p>'),
  page(2,'<p class="demo-overline">5 OCTOBER / SECOND VISIT</p><h4>One more day.</h4>'+spot+visits(2)+action('Return for my third visit','demo-tap-target')+'<p class="demo-hint">Two separate days recorded. Come back another day to become a Regular.</p>'),
  page(3,'<p class="demo-overline">8 OCTOBER / YOUR REGULARS</p><div class="demo-regular-award">'+check+'<span>REGULAR / '+place.name.toUpperCase()+'</span><h4>You’re a Regular.</h4></div>'+visits(3)+'<p class="demo-hint">Three separate days at '+place.query+' within the last 30 days. Keep checking in on future visits to stay a Regular.</p>'+pill('Your profile is still Closed')+'<p class="demo-hint">You choose who can see your profile.</p>')
 ].join('');
}
export const FEATURE_DEMOS=Object.freeze({
 regulars:{title:'Your visits',captions:['Choose your spot and check in','Your first separate visit day','Return on another day','3 days in 30. You’re a Regular.'],durations:[3200,3400,3400,5000],pages:regularsPages},
 planning:{title:'Plan a session',captions:['Choose where to meet','Set the day and time','Invite your connections','See who has joined'],durations:[2800,3000,3400,4000],pages:planningPages},
 locations:{title:'Profile',captions:['Start with your profile','Search for a spot','Add '+DEMO_LOCATIONS.locations.query,'Your spots, on your profile'],durations:standardDurations,pages:locationPages},
 logs:{title:'Logbook',captions:['Choose your location','Add your session details','Keep it private or publish','Your session is saved'],durations:standardDurations,pages:logPages},
 people:{title:'People',captions:['Find divers at your spot','Open a profile','See their logs and socials','Send a connection request'],durations:standardDurations,pages:peoplePages},
 'instagram-connect':{title:'Instagram',captions:['Follow @finfolk.com.au','Send /connect in Instagram','Enter your code on FinFolk','Send /checkin '+DEMO_LOCATIONS['instagram-connect'].name,'Receive your check-in confirmation','See the visit in your account'],durations:[2600,3600,3400,3200,3000,3600],platforms:['Instagram','Instagram','FinFolk','Instagram','Instagram','FinFolk'],pages:instagramConnectPages},
 'instagram-post':{title:'Logbook',captions:['Tag your photo or video','It arrives in your FinFolk log','Review the day and location','Sort into a session','Add details when you’re ready'],durations:[3400,3200,3400,3600,3800],platforms:['Instagram','FinFolk','FinFolk','FinFolk','FinFolk'],pages:()=>importPages('Instagram')},
 'tiktok-post':{title:'Logbook',captions:['Tag your TikTok video','It arrives in your FinFolk log','Review the day and location','Sort into a session','Add details when you’re ready'],durations:[3400,3200,3400,3600,3800],platforms:['TikTok','FinFolk','FinFolk','FinFolk','FinFolk'],pages:()=>importPages('TikTok')},
});
export function setDemoStep(figure,step,progress=1){
 const kind=figure.dataset.featureDemo,definition=FEATURE_DEMOS[kind];
 if(figure.dataset.step!==String(step)){
  figure.dataset.step=String(step);figure.querySelector('[data-demo-caption]').textContent=definition.captions[step];
  for(const page of figure.querySelectorAll('.demo-page'))page.classList.toggle('is-active',Number(page.dataset.phase)===step);
  for(const dot of figure.querySelectorAll('[data-demo-progress]'))dot.classList.toggle('is-active',Number(dot.dataset.demoProgress)===step);
  const platform=definition.platforms?.[step]||'FinFolk';figure.dataset.platform=platform.toLowerCase();
  const title=platform==='FinFolk'?(definition.platforms?(kind==='instagram-connect'?(step===2?'Connect Instagram':'Your visits'):'Logbook'):definition.title):platform;
  figure.querySelector('.demo-app-title').innerHTML=platformIcon(platform)+'<span>'+title+'</span>';
 }
 const update=(element,value)=>{if(element&&element.textContent!==value)element.textContent=value;};
 const query=figure.querySelector('[data-demo-query]');if(step===1)update(query,DEMO_LOCATIONS.locations.query.slice(0,Math.floor(progress*(DEMO_LOCATIONS.locations.query.length+2))));
 for(const element of figure.querySelectorAll('.demo-page.is-active [data-demo-type]'))update(element,element.dataset.demoType.slice(0,Math.floor(progress*element.dataset.demoType.length*1.8)));
 if(kind==='instagram-connect'){
  if(step===1)figure.querySelector('.demo-connect-reply').classList.toggle('is-complete',progress>.65);
  if(step===2)figure.querySelector('.demo-connect-success').classList.toggle('is-complete',progress>.7);
 }
 if(kind==='logs'&&step===1){
  const values={'duration':progress>.2?'45 min':progress>.05?'4':'','depth':progress>.35?'8 m':'','notes':'Shore session with my buddy. Equalisation practice.'.slice(0,Math.max(0,Math.floor((progress-.4)*115)))};
  for(const [key,value]of Object.entries(values))update(figure.querySelector('[data-demo-'+key+']'),value);
 }
}
export function installFeatureDemos({doc=document,requestFrame,cancelFrame}={}){
 const win=doc.defaultView,request=requestFrame||win.requestAnimationFrame.bind(win),cancel=cancelFrame||win.cancelAnimationFrame.bind(win),motion=win.matchMedia('(prefers-reduced-motion: reduce)');
 const records=[];let paused=motion.matches,handle,last;
 for(const figure of doc.querySelectorAll('[data-feature-demo]')){
  const definition=FEATURE_DEMOS[figure.dataset.featureDemo];if(!definition)continue;delete figure.dataset.step;
  figure.innerHTML='<div class="feature-demo-phone" aria-hidden="true" inert><div class="demo-device-bar"><span>9:41</span><span class="demo-device-speaker"></span><span>● ▰</span></div><div class="demo-app-title"></div><div class="demo-pages">'+definition.pages()+'</div><div class="demo-home-bar"></div></div><figcaption><span class="demo-progress" aria-hidden="true">'+definition.durations.map((_,i)=>'<i data-demo-progress="'+i+'"></i>').join('')+'</span><span data-demo-caption></span></figcaption>';
  for(const map of figure.querySelectorAll('[data-demo-map]'))map.append(beachThumbnail(DEMO_LOCATIONS[figure.dataset.featureDemo]||DEMO_LOCATIONS.people));
  records.push({figure,definition,total:definition.durations.reduce((a,b)=>a+b,0),elapsed:0,visible:!win.IntersectionObserver});setDemoStep(figure,paused?definition.captions.length-1:0,paused?1:0);
 }
 const control=doc.getElementById('landing-motion-toggle');
 function sync(){for(const {figure}of records)figure.dataset.motion=paused?'paused':'playing';if(control){control.textContent=paused?'Play animations':'Pause animations';control.setAttribute('aria-pressed',String(paused));}}
 function setPaused(value){paused=value;sync();}
 function changed(event){setPaused(event.matches);if(event.matches)for(const {figure,definition}of records)setDemoStep(figure,definition.captions.length-1);}
 function tick(time){const delta=last===undefined?0:Math.min(time-last,100);last=time;
  if(!paused&&!doc.hidden)for(const record of records)if(record.visible){record.elapsed=(record.elapsed+delta)%record.total;let at=record.elapsed,step=0;while(at>=record.definition.durations[step])at-=record.definition.durations[step++];setDemoStep(record.figure,step,at/record.definition.durations[step]);}
  handle=request(tick);
 }
 const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{for(const entry of entries){const record=records.find(r=>r.figure===entry.target);if(record){record.visible=entry.isIntersecting;record.figure.dataset.inView=String(entry.isIntersecting);}}},{threshold:.15}):null;
 for(const {figure}of records)observer?.observe(figure);
 const toggle=()=>setPaused(!paused);control?.addEventListener('click',toggle);motion.addEventListener('change',changed);sync();handle=request(tick);
 return {setPaused,destroy(){cancel(handle);observer?.disconnect();control?.removeEventListener('click',toggle);motion.removeEventListener('change',changed);}};
}
