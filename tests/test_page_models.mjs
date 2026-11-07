import {test} from 'node:test';
import assert from 'node:assert/strict';
import {definition,resolveModel,runAction,runModel,runPage,bind} from '../js/finfolk-next/packages/edge/page-models.js';
test('bindings are mandatory and cannot be overridden by a form',()=>{
 assert.throws(()=>resolveModel('listing','listing',{}),/Missing page binding: id/);
 assert.deepEqual(bind({bindings:{id:'id'}},{id:'route-id'},{id:'foreign',message:'hello'}),{id:'route-id',message:'hello'});
 assert.throws(()=>definition('missing'),/Unknown page/);
 assert.throws(()=>resolveModel('listing','claim',{id:'a'}),/Undeclared page model/);
});
test('private REST models preserve existing SDK cache keys, including POST reads',()=>{
 assert.deepEqual(resolveModel('pages','mine',{}).values,{__rest:true,path:'/v1/me/directory'});
 const access=resolveModel('page-owner','access',{id:'a'});
 assert.equal(access.spec.write,false);
 assert.deepEqual(access.values,{__rest:true,path:'/v1/me/directory/access',body:{id:'a'}});
});
test('declared actions use SDK requests and route identity',async()=>{
 const calls=[],client={request:async(...args)=>{calls.push(args);return 'saved';}};
 assert.equal(await runAction(client,'listing','report',{id:'a'},{id:'b',message:'correction'}),'saved');
 assert.deepEqual(calls,[['/v1/me/directory/report',{method:'POST',body:{id:'a',message:'correction'}}]]);
 await assert.rejects(()=>runAction(client,'listing','delete',{id:'a'},{}),/Undeclared page action/);
 assert.equal(calls.length,1);
});
test('public SSR loads declared reads without executing member operations',async()=>{
 const {loadPublicPage}=await import('../js/finfolk-next/site/web-main/lib/public-page.js');
 const previous=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(String(url));return {ok:true,status:200,json:async()=>({ok:true})};};
 try{
  assert.deepEqual(await loadPublicPage('listing',{id:'abc'}),{listing:{ok:true},events:{ok:true}});
  assert.equal(calls.length,2);assert.ok(calls.every(url=>!url.includes('/me/')));
 }finally{globalThis.fetch=previous;}
});

test('REST reads use the SDK request interface rather than account RPC',async()=>{
 const requests=[];
 const client={request:async(...args)=>{requests.push(args);return {admins:[]};},call:()=>{throw Error('Unexpected RPC');}};
 assert.deepEqual(await runModel(client,'page-owner','access',{id:'school'}),{admins:[]});
 assert.deepEqual(requests,[['/v1/me/directory/access',{method:'POST',body:{id:'school'}}]]);
});

test('dependent event roster reads respect server-granted access',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const requests=[];let manager=false;
 const client={request:async(path)=>{requests.push(path);return path.endsWith('/detail')?{id:'a',canManage:manager}:{attendees:[]};}};
 assert.deepEqual(await runPage(client,'event',{id:'a'}),{event:{id:'a',canManage:false},roster:null});
 assert.deepEqual(requests,['/v1/me/events/detail']);
 manager=true;requests.length=0;
 assert.deepEqual((await runPage(client,'event',{id:'a'})).roster,{attendees:[]});
 assert.deepEqual(requests,['/v1/me/events/detail','/v1/me/events/roster']);
});
test('editor skips event reads without eligible pages or a selected event',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 let listings=[];const requests=[];
 const client={request:async(path)=>{requests.push(path);return path.endsWith('/directory')?{listings}:{id:'event'};}};
 assert.deepEqual(await runPage(client,'event-editor',{id:'event'}),{eligible:[],event:null});
 listings=[{id:'page',status:'published',owner_id:'alice'}];
 assert.equal((await runPage(client,'event-editor',{id:null})).event,null);
 assert.equal(requests.length,2);
 assert.deepEqual((await runPage(client,'event-editor',{id:'event'})).event,{id:'event'});
});
test('directory review fails before issuing an admin read for an ordinary member',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const requests=[];const client={request:async(path)=>{requests.push(path);return {admin:false};}};
 await assert.rejects(()=>runPage(client,'directory-review',{}),/Administrator access required/);
 assert.deepEqual(requests,['/v1/me/directory']);
});
test('event actions retain bound route IDs and invitation tokens',async()=>{
 const calls=[],client={request:async(path,options)=>calls.push({path,...options})};
 await runAction(client,'event','rsvp',{id:'route-event'},{id:'other',state:'going'});
 await runAction(client,'event-invitation','accept',{token:'route-token'},{token:'other'});
 assert.deepEqual(calls.map(call=>call.body),[{id:'route-event',state:'going'},{token:'route-token'}]);
 await assert.rejects(()=>runAction(client,'event-editor','moderate',{},{}),/Undeclared page action/);
});

test('actor changes during a parent read stop dependent requests',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:{uid:'alice'},request:async path=>{calls.push(path);client.user={uid:'bob'};return {canManage:true};}};
 await assert.rejects(()=>runPage(client,'event',{id:'event'}),/Account changed/);
 assert.deepEqual(calls,['/v1/me/events/detail']);
});

test('restricted profiles stop before logs, posts, blocks and stats',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:{uid:'alice'},call:async(name)=>{calls.push(name);if(name==='me')return {profile:{}};if(name==='profile')return {restricted:true};if(name==='connections')return [];throw Error('Private read leaked');}};
 assert.deepEqual(await runPage(client,'profile',{target:'bob',sites:[]}),{member:{restricted:true}});
 assert.deepEqual(calls.sort(),['connections','me','profile']);
});
test('profile composition preserves featured order and tolerates missing logs without leaking foreign/private records',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const client={user:{uid:'alice'},call:async(name,input)=>{
  if(name==='me')return {profile:{featuredLogs:['extra','missing','private','foreign','listed'],beaches:['bondi']}};
  if(name==='connections'||name==='blocks')return [];
  if(name==='myPosts')return [{id:'yes',status:'approved',public_consent:true},{id:'no',status:'approved',public_consent:false}];
  if(name==='sessions')return {sessions:[{id:'listed',ownerId:'alice',visibility:'public'}]};
  if(name==='session'){if(input.id==='missing')throw Error('Gone');return {id:input.id,ownerId:input.id==='foreign'?'bob':'alice',visibility:input.id==='private'?'private':'public'};}
  throw Error(name);
 }};
 const profile=await runPage(client,'profile',{sites:[{id:'bondi'}],target:null,location:''});
 assert.deepEqual(profile.logs.map(x=>x.id),['extra','listed']);assert.deepEqual(profile.posts.map(x=>x.id),['yes']);assert.equal(profile.selected.id,'bondi');
 const editor=await runPage(client,'profile-editor',{});assert.deepEqual(editor.logs.map(x=>x.id),['listed','extra']);assert.deepEqual(editor.posts.map(x=>x.id),['yes']);
});
test('people discovery retains pagination/filter/seed inputs and visibility state',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const query={mode:'discover',seed:'stable',beachId:'bondi',availability:'weekends',experience:'new',cursor:'next'},calls=[];
 const client={user:{uid:'alice'},call:async(name,input)=>{calls.push([name,input]);return name==='me'?{profile:{open:false}}:{people:[{id:'bob'}],cursor:'after'};}};
 assert.deepEqual(await runPage(client,'people',{query}),{people:[{id:'bob'}],cursor:'after',open:false});assert.deepEqual(calls.find(([n])=>n==='community')[1],query);
});
test('Instagram connect preserves cancellation and caller idempotency keys',async()=>{
 const controller=new AbortController(),calls=[],client={request:async(...args)=>calls.push(args)};
 await runAction(client,'instagram-link','connect',{}, {code:'12345678'},{signal:controller.signal,idempotencyKey:'retry-key'});
 assert.equal(calls[0][1].signal,controller.signal);assert.equal(calls[0][1].idempotencyKey,'retry-key');assert.deepEqual(calls[0][1].body,{code:'12345678'});
});

test('an actor change during optional featured reads cannot be swallowed as a missing log',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const client={user:{uid:'alice'},call:async(name)=>{
  if(name==='me')return {profile:{featuredLogs:['extra']}};
  if(name==='sessions')return {sessions:[]};
  if(name==='myPosts')return [];
  if(name==='session'){client.user={uid:'bob'};return {id:'extra',ownerId:'alice',visibility:'public'};}
  throw Error(name);
 }};
 await assert.rejects(()=>runPage(client,'profile-editor',{}),/Account changed/);
});

test('account frame sequencing cannot load the next model after an identity change',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:{uid:'alice'},call:async name=>{calls.push(name);client.user=null;return {profile:{}};}};
 await assert.rejects(()=>runPage(client,'account',{}),/Account changed/);assert.deepEqual(calls,['me']);
});
test('site review only reads draft import details and never stages or publishes on attachment',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:{uid:'alice'},request:async(path,options)=>{calls.push([path,options.method]);return path==='/v1/admin/sites'?{drafts:[],imports:[{id:'one',status:'draft'},{id:'old',status:'published'}]}:{id:'one',drafts:[]};}};
 const result=await runPage(client,'site-review',{});assert.deepEqual(result.batches,[{id:'one',drafts:[]}]);assert.deepEqual(calls,[['/v1/admin/sites','GET'],['/v1/admin/sites/imports/one','GET']]);
});
test('site path identities are encoded without changing JSON request bodies',async()=>{
 const calls=[],client={request:async(...args)=>calls.push(args)};
 await runAction(client,'site-submissions','withdraw',{}, {id:'draft/one',version:3});
 assert.deepEqual(calls,[['/v1/me/site-submissions/draft%2Fone/withdraw',{method:'POST',body:{version:3}}]]);
 await assert.rejects(()=>runAction(client,'site-review','publish',{}, {version:3}),/Missing operation input: id/);
 assert.throws(()=>resolveModel('listing','listing',{id:null}),/Missing page binding/);
});
test('authentication adapters preserve SDK receivers, arguments and signup errors',async()=>{
 const {runAuthAction}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const client={marker:'sdk',email:async function(...args){assert.equal(this.marker,'sdk');return args;},auth:{signUp:{email:async()=>({error:{message:'Registration failed'}})}}};
 assert.deepEqual(await runAuthAction(client,'account','email',['email-fixture','password-fixture']),['email-fixture','password-fixture']);
 await assert.rejects(()=>runAuthAction(client,'account','sign-up',[{}]),/Registration failed/);
 await assert.rejects(()=>runAuthAction(client,'account','arbitrary-method',[]),/Undeclared authentication action/);
});

test('followed feed failures preserve usable member posts',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const client={user:{uid:'alice'},call:async name=>{if(name==='myPosts')return [{id:'own'}];throw Error('Feed unavailable');}};
 assert.deepEqual(await runPage(client,'post-manager',{}),{posts:[{id:'own'}],followedError:true});
});
test('messaging authorization failures stop dependent event reads while other errors remain visible',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:{uid:'alice'},request:async path=>{calls.push(path);throw Object.assign(Error('Denied'),{status:403});}};
 assert.deepEqual(await runPage(client,'messaging-settings',{}),{forbidden:true});assert.deepEqual(calls,['/v1/admin/messaging/instagram']);
 assert.deepEqual(await runPage({user:{uid:'alice'}},'messaging-settings',{}),{forbidden:true});
 client.request=async()=>{throw Object.assign(Error('Down'),{status:503});};
 await assert.rejects(()=>runPage(client,'messaging-settings',{}),/Down/);
});
test('messaging model query and retry options preserve the SDK wire shape',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={request:async(path,options)=>{calls.push([path,options]);return path.includes('?')?{events:[]}:{mode:'disabled'};}};
 assert.deepEqual(await runPage(client,'messaging-settings',{}),{state:{mode:'disabled'},events:[]});
 assert.equal(calls[1][0],'/v1/admin/messaging/events?limit=25');
 await runAction(client,'messaging-settings','retry',{}, {id:'event',},{idempotencyKey:'same-key'});
 assert.deepEqual(calls[2],['/v1/admin/messaging/events/event/retry',{method:'POST',body:{},idempotencyKey:'same-key'}]);
 assert.equal(resolveModel('post-review','reviewPosts',{url:'https://example.invalid/post'}).values.url,'https://example.invalid/post');
});
test('retired Instagram verification never reintroduces a transport operation',async()=>{
 const client={call:()=>{throw Error('Retired transport called');}};
 await assert.rejects(()=>runAction(client,'instagram-tools','instagramVerify',{},{}),error=>error.status===410&&error.code==='claim_retired'&&/Use \/connect/.test(error.message));
});

test('logbook refuses foreign private sessions before loading their profile',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:{uid:'alice'},get:async id=>{calls.push(id);return {id,ownerId:'bob',visibility:'private'};},profile:async()=>{throw Error('Profile must not load');}};
 await assert.rejects(()=>runPage(client,'logbook',{session:'private',config:{}}),/This session is private/);assert.deepEqual(calls,['private']);
});
test('logbook SDK adapters preserve list/save return values and argument shapes',async()=>{
 const calls=[],client={list:async values=>{calls.push(['list',values]);return {sessions:[]};},save:async(id,values)=>{calls.push(['save',id,values]);return 'saved-id';}};
 assert.deepEqual(await runModel(client,'logbook-list','sessions',{owner:'alice',publicOnly:false,cursor:null}),{sessions:[]});
 assert.equal(await runAction(client,'logbook-editor','save',{}, {id:null,values:{notes:'private'}}),'saved-id');
 assert.deepEqual(calls,[['list',{cursor:null,owner:'alice',publicOnly:false}],['save',null,{notes:'private'}]]);
});
test('photo adapters retain native file objects without transport or model storage',async()=>{
 const {runSdkAction}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const file=new Blob(['fixture']),calls=[],client={upload:async(...args)=>calls.push(args)};
 await runSdkAction(client,'logbook-editor','upload',['session','0',file]);assert.equal(calls[0][2],file);
 await assert.rejects(()=>runSdkAction(client,'logbook','undeclared',[]),/Undeclared SDK adapter/);
});
test('logbook extras use the public model service and tolerate unavailable public trips',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:{uid:'alice'},instagramPosts:async values=>{calls.push(['posts',values]);return [{id:'post'}];}};
 const services={publicClient:{call:async(name,values)=>{calls.push([name,values]);return {trips:[{id:'trip'}]};}}};
 assert.deepEqual(await runPage(client,'logbook-extras',{owner:'bob',config:{apiUrl:'fixture',instagram:{enabled:true}}},services),{posts:[{id:'post'}],trips:[{id:'trip'}]});
 assert.deepEqual(calls,[['posts',{owner:'bob'}],['publicTrips',{ownerId:'bob'}]]);
 services.publicClient.call=async()=>{throw Error('Unavailable');};
 assert.deepEqual((await runPage(client,'logbook-extras',{owner:'bob',config:{apiUrl:'fixture'}},services)).trips,[]);
});
test('public report validation prevents invalid fetches and retains API error messages',async()=>{
 const {tripResult}=await import('../js/finfolk-next/site/web-main/lib/public-trip.js');
 const old=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(String(url));return {ok:false,status:404,json:async()=>({error:'Report withdrawn.'})};};
 try{assert.deepEqual(await tripResult('invalid'),{report:null,error:'Choose a valid trip report.'});assert.equal(calls.length,0);
 assert.deepEqual(await tripResult('11111111-1111-4111-8111-111111111111'),{report:null,error:'Report withdrawn.'});assert.equal(calls.length,1);}finally{globalThis.fetch=old;}
});

test('logbook retains optional ensureProfile behavior for minimal SDK adapters',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 assert.deepEqual(await runPage({user:{uid:'alice'}},'logbook',{config:{enabled:true}}),{config:{enabled:true}});
});

test('Atlas adapter preserves one owner, snapshot identity, receiver binding and cleanup',async()=>{
 const {createPageAdapter}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const state={loaded:true},calls=[],owner={state,snapshot(){return this.state;},subscribe(fn){calls.push('subscribe');return ()=>calls.push('unsubscribe');},attach(host){calls.push(['attach',host]);},destroy(){calls.push('destroy');}};
 const adapter=createPageAdapter('atlas',owner);assert.equal(adapter.owner,owner);assert.equal(adapter.snapshot(),state);assert.equal(adapter.snapshot(),adapter.snapshot());
 const release=adapter.subscribe(()=>{});adapter.attach('canvas');release();adapter.destroy();adapter.destroy();assert.deepEqual(calls,['subscribe',['attach','canvas'],'unsubscribe','destroy']);
 assert.throws(()=>createPageAdapter('map',owner),/No page adapter/);
});
test('Atlas client facade rejects undeclared calls and mutation subscriptions',async()=>{
 const {bindPageClient}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],raw={call:(...args)=>calls.push(args),subscribe:()=>()=>{}},client=bindPageClient('atlas',raw);
 client.call('siteCatalog',{},{});assert.equal(calls.length,1);assert.throws(()=>client.call('me',{}),/Undeclared page operation/);
 const pub=bindPageClient('place-public',raw);assert.throws(()=>pub.subscribe('publicReferral',{},()=>{}),/Undeclared page operation/);
});
test('place feed selects member versus public models without changing input shapes',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const calls=[],client={user:null,call:async(name,values)=>calls.push([name,values])},services={publicClient:{call:async(name,values)=>calls.push([name,values])}};
 await runPage(client,'place-feed',{beachId:'bondi',cursor:'',postId:''},services);
 client.user={uid:'alice'};await runPage(client,'place-feed',{beachId:'bondi',cursor:'',postId:''},services);
 assert.deepEqual(calls,[['publicPosts',{beachId:'bondi'}],['posts',{beachId:'bondi',cursor:'',postId:''}]]);
});
test('place media failures stay independent and stale actors cannot return optional results',async()=>{
 const {runPage}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const client={user:{uid:'alice'},instagramPosts:async()=>[{url:'shared'}]},services={publicClient:{call:async name=>{if(name==='publicInstagram')throw Error('Feed unavailable');return {trips:[{id:'trip'}]};}}};
 assert.deepEqual(await runPage(client,'place-media',{beachId:'bondi'},services),{feed:{posts:[]},trips:[{id:'trip'}],shared:[{url:'shared'}]});
 client.instagramPosts=async()=>{client.user=null;throw Error('Old user');};await assert.rejects(()=>runPage(client,'place-media',{beachId:'bondi'},services),/Account changed/);
});
test('local resources and landing effects must be declared before execution',async()=>{
 const {runPageResource,runLocalEffect}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const old=globalThis.fetch,calls=[];globalThis.fetch=async(...args)=>{calls.push(args);return {ok:true,json:async()=>({country:'AU',state:'VIC'})};};
 try{assert.deepEqual(await runPageResource('discover','location'),{country:'AU',state:'VIC'});assert.deepEqual(calls,[['/api/location',{cache:'no-store'}]]);
 await assert.rejects(()=>runPageResource('discover','unknown'),/Undeclared page resource/);assert.equal(calls.length,1);}finally{globalThis.fetch=old;}
 const cleanup=()=>{};assert.equal(runLocalEffect('home','landing',()=>cleanup),cleanup);assert.throws(()=>runLocalEffect('map','landing',()=>{throw Error('Should not run');}),/Undeclared page effect/);
});

test('public post reporting stays an explicit action with path-only identity',async()=>{
 const calls=[],client={request:async(...args)=>calls.push(args)};
 await runAction(client,'place-public','report',{}, {id:'post-id',reason:'wrong_location'});
 assert.deepEqual(calls,[['/instagram/posts/post-id/report',{method:'POST',body:{reason:'wrong_location'}}]]);
 assert.throws(()=>resolveModel('place-public','report',{}),/Undeclared page model/);
});

test('generated public HTTP adapter removes path IDs from report bodies',async()=>{
 const {httpOperation}=await import('../js/finfolk-next/site/web-main/src/app-backbone.js');
 const old=globalThis.fetch,calls=[];globalThis.fetch=async(url,init)=>{calls.push({url:String(url),body:JSON.parse(init.body)});return {ok:true,json:async()=>({ok:true})};};
 try{await httpOperation({apiUrl:'https://fixture.invalid/'},'publicInstagramReport',{id:'post',reason:'wrong_location'});
 assert.deepEqual(calls,[{url:'https://fixture.invalid/instagram/posts/post/report',body:{reason:'wrong_location'}}]);}finally{globalThis.fetch=old;}
});

test('compatibility entrypoints invoke only their declared parser adapters',async()=>{
 const {runCompatibility}=await import('../js/finfolk-next/packages/edge/page-models.js');
 const {profileDestination,homeDestination}=await import('../js/finfolk-next/site/web-main/lib/legacy-redirects.js');
 assert.equal(runCompatibility('profiles-compatibility','profileDestination',profileDestination,['https://fixture.invalid/profiles',{screen:'edit'}]).pathname,'/profile/edit');
 const home=runCompatibility('home','homeDestination',homeDestination,['https://fixture.invalid/',{view:'discover'}]);assert.equal(home.pathname,'/app');assert.equal(home.searchParams.get('view'),'discover');
 assert.throws(()=>runCompatibility('home','unknown',()=>{throw Error('Must not execute');},[]),/Undeclared compatibility adapter/);
});

test('generic public models use the configured public client for guests',async()=>{
 const calls=[],member={user:null,request:()=>{throw Error('Member transport must not handle public directory');}};
 const data=await runPage(member,'directory',{query:{state:'NSW',locality:'Bondi'}},{publicClient:{call:async(name,values)=>{calls.push([name,values]);return {listings:[{id:'local-group'}],next:null};}}});
 assert.deepEqual(data.listings.listings,[{id:'local-group'}]);
 assert.deepEqual(calls,[['publicDirectory',{state:'NSW',locality:'Bondi'}]]);
});
