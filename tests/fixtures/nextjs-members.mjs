export const memberModule=`
let user={uid:'alice',emailVerified:true},listeners=new Set();window.memberCalls=[];
const profile={displayName:'Alice',bio:'Freediving and training.',open:false,instagram:'',tiktok:'',beaches:['bondi'],availability:['weekend mornings'],experience:'comfortable',sharing:{visits:true},featuredLogs:['pub','private'],featuredPosts:['post']};
const logs=[{id:'pub',ownerId:'alice',visibility:'public',title:'Published freedive',beachId:'bondi',durationMinutes:45,maxDepthMetres:12,notes:'Published notes'},{id:'private',ownerId:'alice',visibility:'private',title:'PRIVATE SESSION MUST NOT LEAK',notes:'PRIVATE CONTENT'}];
const posts=[{id:'post',status:'approved',public_consent:true,url:'https://www.instagram.com/p/public/',platform:'instagram',beach_id:'bondi'},{id:'draft',status:'draft',public_consent:false,url:'https://www.instagram.com/p/private/',platform:'instagram',beach_id:'bondi'}];
let connections=[{id:'bob',name:'Bob',status:'pending',requested_by:'bob'},{id:'eve',name:'Eve',status:'pending',requested_by:'alice'}];
window.signOutMemberFixture=()=>{user=null;listeners.forEach(fn=>fn(null));};
export const api={get user(){return user},observe(fn){listeners.add(fn);fn(user);return()=>listeners.delete(fn)},async call(action,value={}){window.memberCalls.push({action,value});
 if(action==='me'){if(window.delayMemberMe)await new Promise(resolve=>window.releaseMemberMe=resolve);return {id:'alice',profile};}
 if(action==='community')return {people:[{id:'maya',displayName:'Maya',bio:'A diver at Bondi.',regular:true,open:true,beaches:['bondi'],availability:['weekend mornings'],experience:'experienced',instagram:'https://www.instagram.com/maya.dives/'}],cursor:null};
 if(action==='profile')return value.target==='restricted'?{restricted:true}:{id:value.target,displayName:'Maya',bio:'A diver at Bondi.',open:true,beaches:['bondi'],availability:['weekend mornings'],experience:'experienced',posts:[]};
 if(action==='connections')return connections;
 if(action==='connection'){connections=connections.map(x=>x.id===value.target?{...x,status:value.mode==='accept'?'accepted':x.status}:x);return {};}
 if(action==='blocks')return [];
 if(action==='sessions')return {sessions:logs};
 if(action==='session')return logs.find(x=>x.id===value.id);
 if(action==='myPosts')return posts;
 if(action==='stats')return {stats:{visits:8,months:2}};
 if(action==='instagramClaimStatus')return {state:'ready',capabilities:{connect:false}};
 if(action==='preferences'){window.savedNativeProfile=value.profile;sessionStorage.setItem('fixture:saved-profile',JSON.stringify(value.profile));return {profile:value.profile};}
 if(['block','unblock','instagramDisconnect','instagramProfileLink'].includes(action))return {};
 throw Error('Unexpected member fixture operation '+action);
},async refresh(){listeners.forEach(fn=>fn(user));}};
export async function createLogbookClient(){return api;}
`;
export async function mockMembers(page,base){
 await page.route('**/v1/sites/catalog',r=>r.fulfill({json:{beaches:[{id:'bondi',name:'Bondi Beach',state_id:'NSW',state:'NSW'},{id:'portsea',name:'Portsea Beach',state_id:'VIC',state:'VIC'}]}}));
 await page.route('**/neon-config.json*',route=>route.fulfill({json:{enabled:true,backbone:true,apiUrl:base+'/',authUrl:'https://auth.invalid'}}));
 await page.route('**/neon-client.js',route=>route.fulfill({contentType:'text/javascript',body:memberModule}));
}
