import {accountModule,mockAccount} from './nextjs-account.mjs';
import {aggregateDives} from '../../js/finfolk-next/site/web-main/src/trip-model.js';
export const tripId='11111111-1111-4111-8111-111111111111';
export const publishedReport={title:'Reef week',authorName:'Alice',beachId:'bondi',beachName:'Bondi Beach',timezone:'Australia/Sydney',start:'2026-10-30',end:'2026-10-31',story:'Two days at the coast.',links:[],discrepancies:[],summary:aggregateDives([{day:'2026-10-30',depthMetres:12,durationSeconds:75},{day:'2026-10-31',depthMetres:8,durationSeconds:60}],'2026-10-30','2026-10-31',{'2026-10-30':45})};
const setup=`
import {aggregateDives} from '/trip-model.js';
const tripId=${JSON.stringify(tripId)},snapshot=${JSON.stringify(publishedReport)};
let posts=[{id:'post-one',beach_id:'bondi',beach_name:'Bondi Beach',status:'pending',public_consent:false,creator_handle:'alice.dives',platform:'instagram',url:'https://www.instagram.com/p/first/'},{id:'post-rejected',beach_id:'portsea',beach_name:'Portsea Beach',status:'rejected',public_consent:true,rejection_reason:'Please correct the location.',creator_handle:'alice.dives',platform:'tiktok',url:'https://www.tiktok.com/@alice.dives/video/1234567890123456789'}];
const approved={...posts[0],id:'followed',status:'approved',public_consent:true};
let trip={id:tripId,revision:1,draft:{title:snapshot.title,authorName:snapshot.authorName,beachId:'bondi',start:snapshot.start,end:snapshot.end,story:snapshot.story,links:[],waterDays:{},claimedTotals:{},waterTotalMinutes:null},preview:structuredClone(snapshot),published:null,pending:null,activeImport:null};let staged=new Map(),dives=[],sharing=false,discovered=[{id:'discovered',state:'pending',url:'https://www.instagram.com/p/discovered/',posted_at:'2026-10-30T00:00:00Z',beach_id:'bondi'}];
const updatePreview=()=>{trip.preview={...trip.preview,...trip.draft,beachName:'Bondi Beach',timezone:'Australia/Sydney',summary:aggregateDives(dives,trip.draft.start,trip.draft.end,trip.draft.waterDays),discrepancies:[]};};
`;
const actions=`
 if(action==='instagramMyPosts')return {connection:{share_posts:sharing,media_owner_id:'verified'},posts:structuredClone(discovered)};
 if(action==='instagramSharing'){sharing=value.enabled;return {};}
 if(action==='instagramChoosePostBeach'){discovered=discovered.map(p=>p.id===value.id?{...p,state:'published',beach_id:value.beachId}:p);return {};}
 if(action==='instagramHidePost'){discovered=discovered.map(p=>p.id===value.id?{...p,state:'hidden'}:p);return {};}
 if(action==='instagramRemoveAllPosts'){discovered=[];return {};}
 if(action==='instagramDiscoveryStatus')return {collection:false,publication:false,hashtags:false,pending:0,sources:[]};
 if(action==='myPosts')return structuredClone(posts);
 if(action==='followedPosts')return {posts:[structuredClone(approved)]};
 if(action==='post'){if(window.failPost)throw Error('Post connection failed');posts.unshift({...approved,id:'post-new',status:'pending',url:value.url,creator_handle:value.creatorHandle});return {};}
 if(action==='removePost'){posts=posts.map(post=>post.id===value.id?{...post,status:'removed'}:post);return {};}
 if(action==='tripList')return [structuredClone(trip)];
 if(action==='tripGet')return structuredClone(trip);
 if(action==='tripSave'){if(!value.draft.title||!value.draft.beachId)throw Error('Choose a title and beach.');trip={...trip,draft:structuredClone(value.draft),revision:trip.revision+1};updatePreview();return {id:tripId};}
 if(action==='tripPreview'){updatePreview();return {revision:trip.revision,snapshot:structuredClone(trip.preview)};}
 if(action==='tripImportBegin'){staged=new Map();return {id:'import-one'};}
 if(action==='tripImportBatch'){if(window.delayTripBatch){window.delayTripBatch=false;await new Promise(resolve=>window.releaseTripBatch=resolve);}if(window.failTripBatch===value.index)throw Error('Batch connection failed');staged.set(value.index,structuredClone(value.rows));return {};}
 if(action==='tripImportConfirm'){dives=[...staged].sort((a,b)=>a[0]-b[0]).flatMap(x=>x[1]);trip.activeImport='import-one';trip.revision++;updatePreview();return {};}
 if(action==='tripDives')return {rows:dives.slice(value.offset||0,(value.offset||0)+100).map((data,i)=>({ordinal:(value.offset||0)+i+1,data}))};
 if(action==='tripPublish'){if(!value.publicConsent||!value.ownPosts)throw Error('Confirm publication permissions first.');trip.published=structuredClone(trip.preview);return {status:'published'};}
 if(action==='tripUnpublish'){trip.published=null;trip.pending=null;return {};}
 if(action==='tripReport')return {};
`;
export const postsModule=setup+accountModule.replace("return {admin:false,enabled:false};", "return {admin:false,enabled:!sessionStorage.getItem('fixture:posts-paused'),pilotBeaches:['bondi','portsea']};").replace("['instagramActions','myPosts','tripList']", "['instagramActions']").replace(" throw Error('Unexpected account fixture '+action);",actions+" throw Error('Unexpected account fixture '+action);");
export async function mockPosts(page,base){await mockAccount(page,base);await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:postsModule}));await page.route(/\/trips\//,r=>r.fulfill({json:publishedReport}));}
