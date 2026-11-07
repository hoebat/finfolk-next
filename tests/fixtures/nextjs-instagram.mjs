import {postsModule,mockPosts} from './nextjs-posts.mjs';
const setup=`
let instagramActions=[{id:'stats-action',kind:'stats',state:'review',data:{text:'Share my statistics.',reply:'Alice recorded 4 visits.',sourceUrl:'https://www.instagram.com/p/stats/'}},{id:'dive-action',kind:'dive',state:'clarify',data:{text:'Log Bondi Beach depth 8m duration 30min',duration:30,depth:8,sourceUrl:'https://www.instagram.com/p/dive/'}},{id:'waiting-action',kind:'stats',state:'review',data:{text:'Please prepare my statistics.'}},{id:'done-action',kind:'points',state:'done',data:{text:'Participation recorded.',sourceUrl:'javascript:alert(1)'}}];
let commandRows=[{id:'visit-command',command:'checkin',state:'confirmation',send_state:'review',result:'Choose the beach and visit date.'},{id:'done-command',command:'status',state:'done',send_state:'sent',result:'Post is published.'}];
let adminActions=[{id:'admin-reply',kind:'reply',state:'review',member_confirmed:false,data:{text:'A reviewed reply.',reply:'Thanks for sharing.',sourceUrl:'https://www.instagram.com/p/reply/'}},{id:'admin-uncertain',kind:'reply',state:'uncertain',data:{text:'Provider response was uncertain.'}},{id:'admin-sending',kind:'stats',state:'sending',data:{text:'Send is awaiting reconciliation.'}},{id:'admin-points',kind:'points',state:'done',data:{text:'One participation point.'}}];
let pendingConnections=[{user_id:'bob',handle:'bob.dives',message_sender_id:null},{user_id:'eve',handle:'eve.dives',message_sender_id:'provider-eve'}],publicPoints=false;
const instagramAdmin=()=>!sessionStorage.getItem('fixture:instagram-ordinary');
`;
const actions=`
 if(action==='instagramStatus'){if(window.failInstagramStatus)throw Error('Instagram tools unavailable.');return {enabled:!sessionStorage.getItem('fixture:instagram-paused'),admin:instagramAdmin(),total:7,connection:{public_points:publicPoints}};}
 if(action==='instagramActions'){if(window.failInstagramActions)throw Error('Actions unavailable.');return sessionStorage.getItem('fixture:instagram-empty')?[]:structuredClone(instagramActions);}
 if(action==='instagramPointsConsent'){if(window.failPointsConsent)throw Error('Points update failed.');publicPoints=value.public;return {};}
 if(action==='invitationStatus'){if(window.delayInvitations)await new Promise(resolve=>window.releaseInvitations=resolve);if(window.failInvitations)throw Error('Invitations unavailable.');return {url:'https://finfolk.com.au/?invite=abcdefghijklmnopqrstuvwx',joined:3,verified:2,points:2};}
 if(action==='invitationClaim'){if(value.code!=='abcdefghijklmnopqrstuvwx')throw Error('Invitation is invalid.');return {};}
 if(action==='instagramConfirm'){if(window.delayInstagramConfirm)await new Promise(resolve=>window.releaseInstagramConfirm=resolve);if(window.failInstagramConfirm)throw Error('Confirmation failed.');if(value.id==='stats-action'&&value.reply!=='Alice recorded 4 visits.')throw Error('Reply changed.');if(value.id==='dive-action'&&(!value.ownDive||!value.beachId||!value.values.date))throw Error('Choose the beach, date and ownership.');instagramActions=instagramActions.map(row=>row.id===value.id?{...row,state:'confirmed'}:row);return {};}
 if(action==='instagramCancel'){instagramActions=instagramActions.map(row=>row.id===value.id?{...row,state:'cancelled'}:row);return {};}
 if(action==='instagramCommandStatus'){if(window.failCommandStatus)throw Error('Comment commands unavailable.');return {enabled:!sessionStorage.getItem('fixture:instagram-paused'),checkins:true,commands:sessionStorage.getItem('fixture:instagram-empty')?[]:structuredClone(commandRows)};}
 if(action==='instagramCommandVerify')return {command:'/verify LOCAL-EXAMPLE @finfolk.com.au'};
 if(action==='instagramCommandConfirm'){if(!value.beachId||!value.day)throw Error('Choose a beach and date.');return {};}
 if(['instagramAdminInbox','instagramVerify','instagramReview','instagramReconcile','instagramReversePoints','instagramRetryEvent','instagramCommandReview','instagramCommandResolve'].includes(action)){
 if(!instagramAdmin())throw Object.assign(Error('Access denied'),{status:403});
 if(action==='instagramAdminInbox'){if(window.delayInstagramInbox)await new Promise(resolve=>window.releaseInstagramInbox=resolve);if(window.failInstagramInbox)throw Error('Inbox unavailable.');return {connections:structuredClone(pendingConnections),actions:structuredClone(adminActions),events:[{id:'event-one',status:'error',error:'Provider not ready.'},{id:'event-two',status:'queued'}]};}
 if(action==='instagramVerify'){if(!value.confirmed||!value.senderId||value.userId==='bob'&&!value.code)throw Error('Check the received code and sender first.');pendingConnections=pendingConnections.filter(c=>c.user_id!==value.userId);return {};}
 if(action==='instagramReview'){adminActions=adminActions.map(row=>row.id===value.id?{...row,state:value.mode==='edit'?row.state:value.mode==='approve'?'done':value.mode,data:{...row.data,...(value.mode==='edit'?{reply:value.reply}:{})}}:row);return {};}
 if(action==='instagramReconcile'){if(!value.checked)throw Error('Check the actual Instagram thread first.');adminActions=adminActions.map(row=>row.id===value.id?{...row,state:value.outcome==='sent'?'done':'review'}:row);return {};}
 if(action==='instagramCommandReview')return [{id:'command-uncertain',command:'help',state:'done',send_state:'uncertain'},{id:'command-sent',command:'status',state:'done',send_state:'sent'}];
 if(action==='instagramCommandResolve'){if(value.decision==='sent'&&!value.replyId)throw Error('Enter the actual reply ID first.');return {};}
 return {};
 }
`;
export const instagramModule=setup+postsModule.replace(" if(action==='instagramStatus')return {enabled:false,admin:false,total:0,connection:null};",'').replace(" if(action==='instagramCommandStatus')return {enabled:false,admin:false,commands:[]};",'').replace("if(['instagramActions'].includes(action))return [];",'').replace(" throw Error('Unexpected account fixture '+action);",actions+" throw Error('Unexpected account fixture '+action);");
export async function mockInstagram(page,base){await mockPosts(page,base);await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:instagramModule}));}
