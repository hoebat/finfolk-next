import {postsModule,mockPosts,publishedReport,tripId} from './nextjs-posts.mjs';
export const exampleSite={id:'example-quarry',name:'Example Quarry',waterbody:'quarry',access_mode:'shore',state_id:'VIC',area_name:'Example Region',area_id:'vic-example',timezone:'Australia/Melbourne',point:[145,-38],source_url:'https://example.invalid/site',reviewed_at:'2026-10-30',requirements:'Book before visiting.',booking_url:'https://example.invalid/book',aliases:['Old Quarry'],features:['training'],activity_status:'documented',access_points:[{mode:'shore',name:'Water entry',point:[145,-38],source_url:'https://example.invalid/entry',booking_url:'',notes:'Marked entry.',verified:true}],depth_evidence:[{kind:'reported',depth_m:12,reference:'Below water surface',source_url:'https://example.invalid/depth'}],facts:[{label:'Access',text:'Use the marked entry.',source_url:'https://example.invalid/entry'}],restrictions:[{activity:'spearfishing',text:'Not permitted.',source_url:'https://example.invalid/rules',status:'restricted'}],archived:false};
const setup=`
const exampleSite=${JSON.stringify(exampleSite)};
let submissions=[{id:'submission-one',version:'2',status:'submitted',payload:structuredClone(exampleSite)}];
let siteDrafts=[{id:'draft-one',version:'3',status:'draft',payload:structuredClone(exampleSite),updated_at:'2026-10-30T00:00:00Z'}],siteImports=[{id:'batch-one',status:'draft'}];
let batch={id:'batch-one',drafts:[{id:'import-draft',version:'4',status:'draft',import_id:'batch-one',payload:{...exampleSite,id:'imported-quarry',name:'Imported Quarry'}}],preview:{candidates:[{id:'imported-quarry',possibleDuplicate:'example-quarry'}],updates:['example-quarry']}};
let reviewPosts=[{id:'review-one',beach_name:'Bondi Beach',status:'pending',platform:'instagram',url:'https://www.instagram.com/p/review/',creator_handle:'alice.dives'}],reviewReports=[{id:'report-one',post_id:'reported',status:'approved',reason:'Wrong location.',url:'https://www.instagram.com/p/reported/',creator_handle:'alice.dives'}];
let tripReviews=[{id:${JSON.stringify(tripId)},review_token:'review-token-1',pending:${JSON.stringify(publishedReport)}}],tripReports=[{id:'reported-trip',review_token:'report-token-1',reason:'Trip location issue.',published:${JSON.stringify(publishedReport)}}];
`;
const requests=`
 if(path.startsWith('/v1/admin/sites')&&sessionStorage.getItem('fixture:ordinary'))throw Object.assign(Error('Access denied'),{status:403});
 if(path==='/v1/me/site-submissions'&&options.method==='POST'){if(window.failSubmission)throw Error('Submission connection failed');sessionStorage.setItem('fixture:saved-site',JSON.stringify(options.body));submissions=[...submissions,{id:'submission-new',version:'1',status:'submitted',payload:options.body.site}];return {};}
 if(path==='/v1/me/site-submissions')return {submissions:structuredClone(submissions)};
 if(path.includes('/site-submissions/')&&path.endsWith('/withdraw')){submissions=submissions.filter(d=>!path.includes(d.id));return {};}
 if(path==='/v1/admin/sites')return {drafts:structuredClone(siteDrafts),imports:structuredClone(siteImports)};
 if(path==='/v1/admin/sites/drafts'){sessionStorage.setItem('fixture:saved-site',JSON.stringify(options.body));return {};}
 if(path==='/v1/admin/sites/imports'&&options.method==='POST'){if(window.failSiteImport)throw Object.assign(Error('Import validation failed'),{details:[{row:2,message:'Latitude is invalid.'}]});return {drafts:structuredClone(batch.drafts),updates:['example-quarry'],candidates:[{id:'imported-quarry',name:'Imported Quarry',possibleDuplicate:'example-quarry'}]};}
 if(path==='/v1/admin/sites/imports/batch-one')return structuredClone(batch);
 if(path.endsWith('/draft-one/publish')){siteDrafts=siteDrafts.map(d=>({...d,status:'published',version:'4'}));return {};}
 if(path.endsWith('/draft-one/reject')){siteDrafts=siteDrafts.map(d=>({...d,status:'rejected',reason:options.body.reason}));return {};}
 if(path.endsWith('/batch-one/publish')){siteImports=[];return {};}
`;
const actions=`
 if(['reviewPosts','reviewPost','resolvePostReport','communityMetrics','tripReviewInbox','tripReview'].includes(action)&&sessionStorage.getItem('fixture:ordinary'))throw Object.assign(Error('Access denied'),{status:403});
 if(action==='reviewPosts')return {posts:structuredClone(reviewPosts.filter(p=>!value.url||p.url===value.url)),reports:structuredClone(reviewReports)};
 if(action==='reviewPost'){if(value.decision==='approved'&&(!value.ownershipChecked||!value.tagChecked||!value.beachChecked))throw Error('Complete the creator, tag and beach checks.');reviewPosts=reviewPosts.map(p=>p.id===value.id?{...p,status:value.decision}:p);return {};}
 if(action==='resolvePostReport'){reviewReports=reviewReports.filter(r=>r.id!==value.id);return {};}
 if(action==='communityMetrics')return {membership:{members:12,joined:2},repeatParticipants:3,weeks:[{week:'2026-10-26',checkins:8,participants:4}],referrals:[{day:'2026-10-30',platform:'instagram',clicks:5}]};
 if(action==='tripReviewInbox'){if(window.delayTripReviews){window.delayTripReviews=false;await new Promise(resolve=>window.releaseTripReviews=resolve);}return {trips:structuredClone(tripReviews),reports:structuredClone(tripReports)};}
 if(action==='tripReview'){if(value.decision==='approve'&&(!value.ownershipChecked||!value.beachChecked))throw Error('Check ownership and beach first.');tripReviews=tripReviews.filter(t=>t.id!==value.id);tripReports=tripReports.filter(t=>t.id!==value.id);return {};}
`;
export const sitesModule=setup+postsModule.replace("admin:false,enabled:!sessionStorage", "admin:!sessionStorage.getItem('fixture:ordinary'),enabled:!sessionStorage").replace("if(path==='/v1/me/site-submissions')return {submissions:[]};",requests).replace(" throw Error('Unexpected account fixture '+action);",actions+" throw Error('Unexpected account fixture '+action);");
export async function mockSites(page,base){await mockPosts(page,base);await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:sitesModule}));}
