export const event={id:'public-event',page_id:'school',document:{title:'Ocean training',description:'A safe buddy training session.',location:'Bondi Beach',category:'Training'},organiser:'Ocean School',starts_at:'2030-12-10T00:00:00Z',ends_at:'2030-12-10T02:00:00Z',timezone:'Australia/Sydney',state:'published',visibility:'public',going:2,capacity:8,revision:1};
export const listing={id:'school',status:'published',owner_id:'alice',revision:1,document:{name:'Ocean School',category:'School',state:'NSW',country:'Australia',locality:'Bondi',description:'Buddy training by the sea.',website:'https://example.invalid',socials:['instagram:ocean.school'],sources:['https://example.invalid/about']}};
export const publicListing={id:listing.id,...listing.document,socials:['https://www.instagram.com/ocean.school/'],managed:false};
export const administrationModule=`
let user={uid:'alice',emailVerified:true},listeners=new Set();window.adminCalls=[];
const event=${JSON.stringify(event)},listing=${JSON.stringify(listing)};let attendance=null,revoked=false,directoryRace=false;const restListeners=new Map();
const directoryData=path=>path==='/v1/admin/directory'?{listings:[listing],claims:[{id:'claim',listing_id:'school',user_id:'bob',state:'pending',challenge:'VERIFY-123'}],runs:[],reports:[{id:'report',listing_id:'school',message:'Please update our address.'}],audit:[]}:{admin:!sessionStorage.getItem('fixture:ordinary'),listings:[listing],claims:[]};
window.updateDirectoryFixture=()=>{listing.revision++;listing.document.name='Live Ocean School';for(const {fn,path} of restListeners.values())fn({status:'ready',data:structuredClone(directoryData(path))});};
window.signOutAdminFixture=()=>{user=null;listeners.forEach(fn=>fn(null));};
export const api={subscribe(name,values,fn){window.adminSubscriptions=(window.adminSubscriptions||0)+1;restListeners.set(fn,{fn,path:values.path});queueMicrotask(()=>fn({status:'ready',data:structuredClone(directoryData(values.path))}));return ()=>restListeners.delete(fn)},get user(){return user},observe(fn){listeners.add(fn);fn(user);return()=>listeners.delete(fn)},async call(action){if(action==='me')return {id:'alice',profile:{beaches:['bondi']}};if(action==='instagramClaimStatus')return {state:'ready',capabilities:{connect:false}};throw Error('Unexpected operation '+action)},async request(path,options={}){
 const body=options.body||{};window.adminCalls.push({path,method:options.method||'GET',body});
 if(path==='/v1/me/directory'){const snapshot=structuredClone({admin:!sessionStorage.getItem('fixture:ordinary'),listings:[listing],claims:[]});if(sessionStorage.getItem('fixture:directory-race')&&!directoryRace){directoryRace=true;await new Promise(resolve=>window.releaseOldDirectoryRead=resolve);}return snapshot;}
 if(path==='/v1/me/directory/access')return {role:'owner',admins:[{id:'bob',name:'Bob'}],invites:[{id:'page-invite',expiresAt:'2030-12-01T00:00:00Z'}]};
 if(path==='/v1/admin/directory')return structuredClone(directoryData(path));
 if(path==='/v1/me/events/detail'){if(window.delayEvent)await new Promise(resolve=>window.releaseEvent=resolve);return {...event,id:body.id,visibility:body.id==='private-event'?'private':'public',document:{...event.document,title:body.id==='private-event'?'PRIVATE EVENT DETAILS':event.document.title},canManage:true,canModerate:true,myRsvp:attendance};}
 if(path==='/v1/me/events/roster')return {attendees:[{id:'bob',name:'PRIVATE ATTENDEE'}],invitations:[{id:'invite',email:'invited@example.invalid',expires:'2030-12-01T00:00:00Z',revoked}]};
 if(path==='/v1/me/events/mine')return {events:[event]};
 if(path==='/v1/me/events/rsvp'){attendance=body.state;return {};}
 if(path==='/v1/me/events/revoke'){revoked=true;return {};}
 if(path.endsWith('/invite'))return {token:'single-use-token'};
 if(path.endsWith('/accept'))return {id:'private-event'};
 if(path.endsWith('/save')){sessionStorage.setItem('fixture:saved',JSON.stringify(body));return {...body,id:body.id||'public-event'};}
 if(path.endsWith('/claim'))return {challenge:'VERIFY-123',expires_at:'2030-12-01T00:00:00Z'};
 if(path.endsWith('/discover'))return {count:2};
 if(['/cancel','/moderate','/invite-redeem','/invite-revoke','/admin-remove','/claim-review','/report-resolve','/report','/merge'].some(s=>path.endsWith(s)))return {};
 throw Error('Unexpected REST fixture '+path);
},async refresh(){listeners.forEach(fn=>fn(user))}};
export async function createLogbookClient(){return api;}
`;
export async function mockAdministration(page,base){
 await page.route('**/v1/sites/catalog',r=>r.fulfill({json:{beaches:[{id:'bondi',name:'Bondi Beach',state:'NSW',state_id:'NSW'}]}}));
 await page.route('**/neon-config.json*',r=>r.fulfill({json:{enabled:true,backbone:true,apiUrl:base+'/',authUrl:'https://auth.invalid'}}));
 await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:administrationModule}));
 await page.route(/\/v1\/directory(?:\/|\?|$)/,r=>r.fulfill({json:publicListing}));
 await page.route(/\/v1\/events(?:\/|\?|$)/,r=>r.fulfill({json:r.request().url().includes('/events/')?event:{events:[event]}}));
}
