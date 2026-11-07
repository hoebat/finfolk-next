export const logbookModule=`
let user=sessionStorage.getItem('fixture:guest')?null:{uid:'alice',emailVerified:!sessionStorage.getItem('fixture:unverified')},listeners=new Set();window.logbookCalls=[];
let entry={id:'one',ownerId:'alice',date:'2026-10-30',locationName:'Bondi',beachId:'bondi',durationMinutes:60,maxDepthMetres:10,notes:'Private reef notes',photos:sessionStorage.getItem('fixture:photos')?['0']:[],linkedMedia:[{id:'linked',platform:'instagram',url:'https://www.instagram.com/p/linked/'}],visibility:sessionStorage.getItem('fixture:published')?'public':'private',deleting:false};
const imported={id:'import-one',platform:'instagram',url:'https://www.instagram.com/p/imported/',day:'2026-10-30',locationName:'Bondi',beachId:'bondi',notes:'Private import notes'};
window.signOutLogbookFixture=()=>{user=null;listeners.forEach(fn=>fn(null));};
const remember=(action,value)=>{window.logbookCalls.push({action,value});};
export const api={get user(){return user},observe(fn){listeners.add(fn);queueMicrotask(()=>fn(user));return ()=>listeners.delete(fn)},async ensureProfile(){},async list(values){remember('list',values);if(window.delayLogbookList)await new Promise(resolve=>window.releaseLogbookList=resolve);return {sessions:entry&&(!values.publicOnly||entry.visibility==='public')?[structuredClone(entry)]:[],more:false,cursor:null};},async get(id){remember('get',id);if(window.delayLogbookGet){window.delayLogbookGet=false;await new Promise(resolve=>window.releaseLogbookGet=resolve);}return {...structuredClone(entry),...(id==='restricted'?{ownerId:'bob'}:{})};},async profile(id){return {displayName:'Alice',bio:'Freediving and training.',instagram:'alice'};},async save(id,values){remember('save',{id,values});if(window.failLogbookSave)throw Error('Connection lost');entry={...entry,...values,id:id||'one',visibility:'private'};sessionStorage.setItem('fixture:saved-logbook',JSON.stringify({id,values}));return entry.id;},async visibility(id,value){remember('visibility',{id,value});entry.visibility=value;},async deleteSession(id){remember('delete',id);entry=null;},async signOut(){window.signOutLogbookFixture();},async photo(){if(!sessionStorage.getItem('fixture:photos'))throw Error('Photo offline');const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII='),c=>c.charCodeAt(0));return new Blob([bytes],{type:'image/png'});},async removePhoto(id,slot){remember('removePhoto',{id,slot});},async upload(id,slot,file){remember('upload',{id,slot,type:file.type});},async instagramPosts(){return [];},async verify(){remember('verify',{})},async refresh(){listeners.forEach(fn=>fn(user))},async google(){remember('google',{})},async email(email,password,creating){remember('email',{email,password,creating});user={uid:'alice',emailVerified:true};listeners.forEach(fn=>fn(user));},async reset(email){remember('reset',{email})},async call(action,value={}){remember(action,value);
 if(action==='mediaInbox')return {instagram:{connected:true,collecting:true,ownerVerified:true},items:[structuredClone(imported)],limit:100};
 if(action==='tiktokStatus')return {ready:false,connected:false};
 if(action==='assignImportedMedia')return {id:value.sessionId||'one'};
 if(['updateImportedMedia','hideImportedMedia','tiktokSync','tiktokDisconnect'].includes(action))return {};
 throw Error('Unexpected logbook operation '+action);
}};
export async function createLogbookClient(){return api;}
`;
export async function mockLogbook(page,base){
 await page.route('**/neon-config.json*',r=>r.fulfill({json:{enabled:true,apiUrl:base+'/',authUrl:'https://auth.invalid',instagramHandle:'finfolk.com.au',instagram:{enabled:true}}}));
 await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:logbookModule}));
 await page.route(/\/trips(?:\?|$)/,r=>r.fulfill({json:{trips:[{id:'trip-one',title:'Reef week',beachName:'Bondi',start:'2026-10-20',end:'2026-10-25',authorName:'Alice',total:{dives:12}}]}}));
}
