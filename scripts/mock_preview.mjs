import {seedProfileHandles,validatePreviewHandle,publicPreviewHandle} from './lib/preview_profile_handles.mjs';
import {previewBuddyOperation} from './lib/preview_buddies.mjs';
// Development-only mock service. The UI still runs generated Substrate models.
import {localPreviewFeatureFlags} from './lib/environment_feature_flags.mjs';
import {featureForOperation} from '../js/finfolk-next/site/web-main/lib/feature-flags.js';
import {flagForPath} from '../backend/feature-flags.mjs';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
import {operations} from '../js/finfolk-next/packages/edge/operations.js';
import {randomUUID} from 'node:crypto';
import {previewSiteNotes} from './preview_site_notes.mjs';
const directory=resolve(process.env.FINFOLK_PREVIEW_STATE_DIR||'.cache/mock-preview');await mkdir(directory,{recursive:true});
const beach={id:'bondi',name:'Bondi Beach',state:'NSW',state_id:'NSW',point:[151.2767,-33.8915],timezone:'Australia/Sydney'};
const listing={id:'school',name:'Ocean School',category:'School',state:'NSW',country:'Australia',locality:'Bondi',description:'Buddy training by the sea.',managed:true};
const event={id:'public-event',page_id:'school',document:{title:'Ocean training',description:'Buddy training by the sea.',location:'Bondi Beach',category:'Training'},organiser:'Ocean School',starts_at:'2030-12-10T00:00:00Z',ends_at:'2030-12-10T02:00:00Z',timezone:'Australia/Sydney',state:'published',visibility:'public',going:2,capacity:8,revision:1};
const previewFlags=localPreviewFeatureFlags();
async function assertPreviewFlag(flag){if(flag&&(await previewFlags()).flags[flag]!==true)throw Object.assign(Error('Feature unavailable.'),{status:403,code:'feature_disabled'});}
const seed=()=>({version:3,pages:[{id:"school",status:"published",owner_id:"owner",revision:1,document:listing}],events:[event],rsvps:[],submissions:[],rewards:[{id:"reward-one",title:"Pool practice pass",outlet:"Ocean School",cost:40,stock:8,active:true,description:"Sample community reward",instructions:"Show your demo claim code."}],redemptions:[],balances:{alice:120,bob:80,owner:120,admin:120},profiles:Object.fromEntries(['alice','bob','admin','owner'].map(id=>[id,{displayName:id[0].toUpperCase()+id.slice(1),bio:'Shore dives and regular training.',open:true,beaches:['bondi'],experience:'comfortable',availability:['weekend mornings'],sharing:{visits:true},featuredLogs:id==='alice'?['session-one']:[],featuredPosts:[]}])),sessions:[{id:'session-one',ownerId:'alice',date:'2026-11-19',locationName:'Bondi Beach',beachId:'bondi',durationMinutes:45,maxDepthMetres:12,visibility:'public',notes:'A calm shore session with my buddy.',photos:[],linkedMedia:[]}],visits:[],connections:[],blocks:[]});
let state;try{state=JSON.parse(await readFile(directory+'/state.json'));if(state.version!==3)state=seed();}catch{state=seed();}
let writes=Promise.resolve();const persist=()=>writes=writes.then(async()=>{await writeFile(directory+'/state.tmp',JSON.stringify(state));await rename(directory+'/state.tmp',directory+'/state.json');});
function requirePreviewMember(actor){if(actor==='guest')throw Object.assign(Error('Sign in to continue.'),{status:401});}
function guardPreviewPath(path,actor){if(/^\/(?:v1\/(?:me|admin)|me|admin)(?:\/|$)/.test(new URL(path,'http://preview').pathname))requirePreviewMember(actor);}
seedProfileHandles(state);
async function operation(name,v={},actor='alice'){if(operations[name]?.auth)requirePreviewMember(actor);await assertPreviewFlag(featureForOperation(name));if(name==='buddyRead'||name==='buddyAction')return previewBuddyOperation(state,actor,name,v);
 if(v.__rest){const spec=operations[name];return request(v.path,{method:spec.method,body:v.body},actor);}
 const profile=state.profiles[actor];if(!profile&&actor!=='guest')throw Error('Unknown preview actor');
 switch(name){
 case 'siteCatalog':return {revision:1,beaches:[beach],states:[{id:'NSW',name:'New South Wales'}],areas:[],sources:[]};
 case 'me':return {id:actor,profile};
 case 'publicProfileByHandle':return publicPreviewHandle(state,v.handle);
 case 'profile':case 'publicProfile':{const id=v.target||actor,p=state.profiles[id];if(!p||id!==actor&&!p.open)return {restricted:true};return {id,...p};}
 case 'preferences':{const patch={...v.profile};if('handle'in patch)patch.handle=validatePreviewHandle(state,actor,patch.handle);Object.assign(profile,patch);await persist();return {profile};}
 case 'community':return {people:Object.entries(state.profiles).filter(([id])=>id!==actor).map(([id,p])=>({id,...p,regular:true})),cursor:null};
 case 'sessionPlans':return {sessions:state.sessions.filter(s=>s.plan&&(s.ownerId===actor||s.plan.members[actor])),connections:await operation('connections',{},actor)};
 case 'sessionCheckin':case 'sessionPlanning':{
  let s=state.sessions.find(s=>s.id===v.id);
  if(v.mode==='save'){
   if(s&&s.ownerId!==actor)throw Error('Organiser access required');
   if(!s){s={id:v.id,ownerId:actor,photos:[],linkedMedia:[],visibility:'private',notes:'',date:v.startsAt.slice(0,10),beachId:v.beachId,locationName:beach.name,plan:{members:{}}};state.sessions.push(s);}
   const connections=await operation('connections',{},actor);
   const members={...s.plan.members};for(const id of v.invitees||[]){const c=connections.find(c=>c.id===id&&c.status==='accepted');if(!c)throw Error('Invite an accepted connection');members[id]||={name:c.name,state:'invited'};}
   s.plan={...s.plan,title:v.title,startsAt:v.startsAt,timezone:v.timezone,meetingPoint:v.meetingPoint,state:s.plan.state||v.state,members};
  }else{
   if(!s||!s.plan||!['upcoming','current'].includes(s.plan.state))throw Error('Session unavailable');
   if(v.mode==='invite'){if(s.ownerId!==actor)throw Error('Organiser access required');const people=await operation('connections',{},actor);for(const id of v.invitees||[]){const c=people.find(p=>p.id===id&&p.status==='accepted');if(!c)throw Error('Accepted buddy required');s.plan.members[id]||={name:c.name,state:'invited'};}}else if(v.mode==='respond'){if(!s.plan.members[actor])throw Error('Invitation unavailable');s.plan.members[actor].state=v.state;}
   else {if(s.ownerId!==actor)throw Error('Organiser access required');if(v.mode==='start'&&s.plan.state!=='upcoming'||v.mode==='finish'&&s.plan.state!=='current')throw Error('Invalid transition');s.plan.state={start:'current',finish:'completed',cancel:'cancelled'}[v.mode];}
  }if(name==='sessionCheckin'){const day=new Date().toISOString().slice(0,10);if(!state.visits.some(v=>v.actor===actor&&v.beach_id===s.beachId&&v.day===day))state.visits.push({actor,beach_id:s.beachId,name:s.locationName,day});}await persist();return {id:s.id};
 }
 case 'sessions':case 'publicSessions':return {sessions:state.sessions.filter(s=>(!s.plan||s.plan.state==='completed')&&s.ownerId===(v.owner||actor)&&(name==='sessions'&&s.ownerId===actor||s.visibility==='public')&&(!v.publicOnly||s.visibility==='public')),more:false,cursor:null};
 case 'session':case 'publicSession':{const s=state.sessions.find(s=>s.id===v.id);if(!s||(name==='publicSession'||s.ownerId!==actor)&&s.visibility!=='public')throw Error('Session unavailable');return s;}
 case 'saveSession':{let s=state.sessions.find(s=>s.id===v.id);if(s&&s.ownerId!==actor)throw Error('Not your session');if(!s){s={id:randomUUID(),ownerId:actor,photos:[],linkedMedia:[],visibility:'private'};state.sessions.push(s);}Object.assign(s,v.values);await persist();return {id:s.id};}
 case 'visibility':case 'deleteSession':{const s=state.sessions.find(s=>s.id===v.id&&s.ownerId===actor);if(!s)throw Error('Not your session');if(name==='visibility')s.visibility=v.visibility;else state.sessions=state.sessions.filter(x=>x!==s);await persist();return {};}
 case 'connections':return state.connections.filter(x=>x.actor===actor||x.target===actor).map(x=>({...x,id:x.actor===actor?x.target:x.actor,name:state.profiles[x.actor===actor?x.target:x.actor]?.displayName,requested_by:x.actor}));
 case 'connection':{let row=state.connections.find(x=>x.actor===actor&&x.target===v.target||x.target===actor&&x.actor===v.target);if(v.mode==='accept'){if(!row||row.target!==actor)throw Error('Connection request unavailable');row.status='accepted';}else if(['decline','remove'].includes(v.mode))state.connections=state.connections.filter(x=>x!==row);else if(!row)state.connections.push({actor,target:v.target,status:'pending'});await persist();return {};}
 case 'block':state.blocks.push({actor,id:v.target,name:state.profiles[v.target]?.displayName});state.connections=state.connections.filter(x=>!(x.actor===actor&&x.target===v.target||x.actor===v.target&&x.target===actor));await persist();return {};
 case 'unblock':state.blocks=state.blocks.filter(x=>!(x.actor===actor&&x.id===v.target));await persist();return {};
 case 'instagramProfileLink':profile.instagram=v.handle||v.username||'';await persist();return {};
 case 'removeCheckin':state.visits=state.visits.filter(x=>!(x.actor===actor&&x.beach_id===v.beachId&&x.day===v.day));await persist();return {};
 case 'blocks':return state.blocks.filter(x=>x.actor===actor);
 case 'myCheckins':return state.visits.filter(x=>x.actor===actor);
 case 'checkin':state.visits.push({actor,beach_id:v.beachId,name:beach.name,day:new Date().toISOString().slice(0,10)});await persist();return {};
 case 'discoverPopular':return {places:[beach]};
 case 'publicTrips':return {trips:[]};
 case 'invitationStatus':return {url:'http://127.0.0.1:3010/?invite=demo',joined:3,verified:2,points:2};
 case 'instagramAdminInbox':return {connections:[],actions:[],events:[]};
 case 'reviewPosts':if(actor!=='admin')throw Object.assign(Error('Administrator access required'),{status:403});return {posts:[],reports:[]};
 case 'communityMetrics':if(actor!=='admin')throw Object.assign(Error('Administrator access required'),{status:403});return {membership:{members:Object.keys(state.profiles).length,joined:0},repeatParticipants:0,weeks:[],referrals:[]};
 case 'stats':return {stats:{visits:8,months:2}};
 case 'instagramDiscoveryStatus':return {collection:false,publication:false,hashtags:false,pending:0,sources:[]};
 case 'instagramMyPosts':return {connection:{share_posts:false,media_owner_id:'demo'},posts:[],next:null};
 case 'followedPosts':case 'myPosts':case 'tripList':case 'instagramActions':return [];
 case 'postStatus':return {admin:actor==='admin',enabled:false};
 case 'instagramClaimStatus':return {state:'ready',capabilities:{connect:false}};
 case 'mediaInbox':return {instagram:{connected:false,collecting:false},items:[],limit:100};
 case 'tiktokStatus':return {ready:false,connected:false};
 case 'instagramStatus':case 'instagramCommandStatus':return {enabled:false,admin:actor==='admin',commands:[],total:0,connection:null};
 default:{const spec=operations[name];if(spec?.transport==='rest'&&!spec.write)return rest(spec.path.replace(/:([a-z]+)/g,(_,key)=>encodeURIComponent(v[key]||'')));throw Error('Mock operation not implemented: '+name);}
 }
}
function rest(path,options={},actor="alice"){guardPreviewPath(path,actor);const notes=previewSiteNotes(state,path,options,actor);if(notes!==undefined)return notes;const p=new URL(path,'http://preview').pathname;if(p==='/v1/features')return previewFlags();if(p==='/v1/sites/catalog')return {revision:1,beaches:[beach],states:[{id:'NSW',name:'New South Wales'}],areas:[],sources:[]};if(p==='/v1/directory')return {listings:[listing],next:null};if(p.startsWith('/v1/directory/')){const row=state.pages.find(x=>x.id===decodeURIComponent(p.slice('/v1/directory/'.length)));if(!row)throw Error('Page unavailable');return {id:row.id,...row.document,managed:true};}if(p==='/v1/events')return {events:state.events};if(p.startsWith('/v1/events/')){const row=state.events.find(x=>x.id===decodeURIComponent(p.slice('/v1/events/'.length)));if(!row)throw Error('Event unavailable');return row;}if(p==='/v1/me/directory'||p==='/v1/admin/directory')return {admin:true,listings:state.pages,claims:[],runs:[],reports:[],audit:[]};if(p==='/v1/me/site-submissions')return {submissions:state.submissions.filter(x=>x.actor===actor)};if(p==='/v1/admin/sites')return {sites:[],drafts:[],submissions:[],imports:[],reports:[],audit:[]};if(p==='/v1/me/directory/access')return {role:'owner',admins:[],invites:[]};if(p==='/v1/me/events')return {events:state.events};if(p==='/v1/me/events/detail')return {...(state.events.find(x=>x.id===options.body?.id)||state.events[0]),canManage:actor==='owner'||actor==='admin',canModerate:actor==='admin',myRsvp:state.rsvps.find(x=>x.actor===actor&&x.id===(options.body?.id||event.id))?.state||null};if(p==='/v1/me/events/roster')return {attendees:[],invitations:[]};if(p==='/v1/me/events/mine')return {events:state.events};if(p==='/v1/admin/messaging/instagram')return {mode:'disabled',username:'finfolk.com.au',enabledCommands:[],pilotSenderIds:[],health:{status:'ready',issues:[],pendingReplies:0,uncertainReplies:0,failedReplies:0},blockers:[],checks:{},lastWebhookAt:null};if(p==='/v1/admin/messaging/instagram/events'||p==='/v1/admin/messaging/events')return {events:[]};if(p==='/shop/items')return {items:state.rewards.filter(x=>x.active)};if(p==='/v1/admin/finnies')return {items:state.rewards,claims:state.redemptions};if(p==='/v1/me/finnies')return {balance:state.balances[actor],redemptions:state.redemptions.filter(x=>x.actor===actor),ledger:[]};throw Error('Mock route not implemented: '+p);}
async function request(path,options,actor){guardPreviewPath(path,actor);await assertPreviewFlag(flagForPath(new URL(path,'http://preview').pathname));
 const notes=previewSiteNotes(state,path,options,actor);if(notes!==undefined){if(options.method==='POST')await persist();return notes;}
 const body=options.body||{},p=new URL(path,'http://preview').pathname;
 if(!options.method||options.method==='GET')return rest(path,options,actor);
 if(p==='/v1/me/directory/save'||p==='/v1/me/directory/create'||p==='/v1/admin/directory/save'){let row=state.pages.find(x=>x.id===body.id);if(row&&row.owner_id!==actor&&actor!=='admin')throw Error('Page owner role required');if(!row){row={id:randomUUID(),owner_id:actor,status:'candidate',revision:0,document:{}};state.pages.push(row);}Object.assign(row.document,body.document||{});if(actor==='admin'&&body.status)row.status=body.status;row.revision++;await persist();return row;}
 if(p==='/v1/me/events/save'){let row=state.events.find(x=>x.id===body.id);if(!row){row={...event,id:randomUUID(),going:0};state.events.push(row);}Object.assign(row,body);await persist();return row;}
 if(p==='/v1/me/events/rsvp'){state.rsvps=state.rsvps.filter(x=>!(x.actor===actor&&x.id===body.id));state.rsvps.push({actor,id:body.id,state:body.state});await persist();return {};}
 if(p==='/v1/me/events/cancel'){const row=state.events.find(x=>x.id===body.id);if(!row)throw Error('Event unavailable');row.state='cancelled';await persist();return {};}
 if(p==='/v1/me/site-submissions'){state.submissions.push({id:randomUUID(),actor,version:'1',status:'submitted',payload:body.site});await persist();return {};}
 if(p==='/v1/admin/finnies/items'){if(actor!=='admin')throw Error('Administrator role required');const item={...body,id:body.id||randomUUID()};state.rewards=state.rewards.filter(x=>x.id!==item.id).concat(item);await persist();return item;}
 if(p==='/v1/me/finnies/redeem'){const item=state.rewards.find(x=>x.id===body.itemId);if(!item||item.stock===0||state.balances[actor]<item.cost)throw Error('Reward unavailable');state.balances[actor]-=item.cost;if(item.stock!==null)item.stock--;const claim={id:randomUUID(),actor,item:structuredClone(item),cost:item.cost,code:randomUUID().slice(0,8),status:'claimed',created_at:new Date().toISOString()};state.redemptions.push(claim);await persist();return claim;}
 if(p==='/v1/admin/finnies/complete'){if(actor!=='admin')throw Error('Administrator role required');const claim=state.redemptions.find(x=>x.code===body.code&&x.status==='claimed');if(!claim)throw Error('Claim unavailable');claim.status=body.refund?'refunded':'fulfilled';if(body.refund){state.balances[claim.actor]+=claim.cost;const item=state.rewards.find(x=>x.id===claim.item.id);if(item&&item.stock!==null)item.stock++;}await persist();return {};}
 if(p==='/v1/admin/finnies/grant'){if(actor!=='admin'||!state.profiles[body.userId])throw Error('Choose a sample member');state.balances[body.userId]+=body.amount;await persist();return {};}
 if(['/v1/me/events/detail','/v1/me/events/roster','/v1/me/events/mine','/v1/me/directory/access'].includes(p))return rest(path,options,actor);
 throw Error('Mock write not implemented: '+p);
}
const server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');try{let body='';for await(const chunk of req)body+=chunk;const input=body?JSON.parse(body):{},url=new URL(req.url,'http://preview');await assertPreviewFlag(flagForPath(url.pathname));let data;if(url.pathname==='/v1/features')data=await previewFlags();else if(url.pathname==='/__preview/operation')data=await operation(input.operation,input.values,input.actor);else if(url.pathname==='/__preview/reset'){state=seed();seedProfileHandles(state);await persist();data={ok:true};}else if(url.pathname==='/__preview/request')data=await request(url.searchParams.get('path'),input.options||{},input.actor);else data=rest(req.url);res.end(JSON.stringify(data));}catch(error){res.statusCode=error.status||501;res.end(JSON.stringify({error:error.message}));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const portArgument=process.argv.indexOf('--port');
const port=(portArgument>=0?process.argv[portArgument+1]:process.env.PREVIEW_PORT)||'3010';
if(!/^\d+$/.test(port)||Number(port)<1024||Number(port)>65535){server.close();throw Error('Preview port must be between 1024 and 65535.');}
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',port],{cwd:'js/finfolk-next/site/web-main',env:{...process.env,FINFOLK_MOCK_PREVIEW:'1',FINFOLK_AUTH_PROVIDER:'preview',FINFOLK_API_ORIGIN:'http://127.0.0.1:'+server.address().port,FINFOLK_NEXT_DIST_DIR:'.cache/mock-preview-'+port},stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill('SIGTERM'));
child.on('exit',()=>server.close());
