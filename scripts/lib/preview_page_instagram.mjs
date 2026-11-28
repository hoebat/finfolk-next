import {randomUUID} from 'node:crypto';
// Local workbench examples only. This module never contacts Instagram or handles credentials.
const pageId='instagram-preview',handle='finfolk_preview_example',sourceId='30000000-0000-4000-8000-000000000001';
const operations=new Set(['publicPageInstagram','pageInstagramManage','pageInstagramSave','pageInstagramRefresh','pageInstagramReview']);
const error=(message,status=400)=>Object.assign(Error(message),{status});
export function seedPageInstagramPreview(state){
 if(!state.pages.some(page=>page.id===pageId))state.pages.push({id:pageId,status:'published',owner_id:'owner',revision:1,document:{name:'Instagram page · workbench example',category:'School',state:'VIC',country:'Australia',locality:'Local preview',description:'A local example for reviewing Instagram collection and publication controls. These captions are fixtures; no Instagram account has been collected.',socials:['https://www.instagram.com/'+handle+'/'],sources:[]}});
 if(!state.pageInstagram){const time=Date.now();state.pageInstagram={accounts:[{id:sourceId,pageId,handle,enabled:false,publicEnabled:true,status:'preview_only',revision:1,lastChecked:null,lastSuccess:null,lastError:'Local example only. No Instagram requests are made.'}],items:[
 {id:'30000000-0000-4000-8000-000000000002',pageId,sourceId,handle,caption:'Workbench example — published post. Review the page layout and attribution here. This is fixture content, not a collected Instagram post.',permalink:'',mediaType:'IMAGE',publishedAt:time-86400000,capturedAt:time,state:'published'},
 {id:'30000000-0000-4000-8000-000000000003',pageId,sourceId,handle,caption:'Workbench example — awaiting review. Publish or hide this example to try the page manager controls. No live Instagram content is involved.',permalink:'',mediaType:'VIDEO',publishedAt:time,capturedAt:time,state:'pending'}]};}
 return state;
}
export function pageInstagramRequest(path,body={}){
 const url=new URL(path,'http://preview'),p=url.pathname;let match;
 if((match=p.match(/^\/v1\/directory\/([^/]+)\/instagram$/)))return ['publicPageInstagram',{...Object.fromEntries(url.searchParams),id:decodeURIComponent(match[1])}];
 if((match=p.match(/^\/v1\/me\/directory\/([^/]+)\/instagram$/)))return ['pageInstagramManage',{...Object.fromEntries(url.searchParams),id:decodeURIComponent(match[1])}];
 const name={'/v1/me/directory/instagram/save':'pageInstagramSave','/v1/me/directory/instagram/refresh':'pageInstagramRefresh','/v1/me/directory/instagram/review':'pageInstagramReview'}[p];return name?[name,body]:null;
}
export function previewPageInstagram(state,name,input={},actor='guest'){
 if(!operations.has(name))return undefined;
 seedPageInstagramPreview(state);
 const v=input.__rest?pageInstagramRequest(input.path,input.body)?.[1]||{}:input,page=state.pages.find(page=>page.id===v.id),publicRead=name==='publicPageInstagram';
 if(!page||publicRead&&page.status!=='published')throw error('Page unavailable',404);
 if(!publicRead&&(actor==='guest'||actor!=='admin'&&page.owner_id!==actor))throw error('Page manager required',actor==='guest'?401:403);
 const handles=(page.document.socials||[]).flatMap(value=>{if(/^instagram:[a-z0-9._]{1,30}$/i.test(value))return [value.slice(10).toLowerCase()];try{const u=new URL(value);return ['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/[a-z0-9._]{1,30}\/?$/i.test(u.pathname)?[u.pathname.split('/')[1].toLowerCase()]:[]}catch{return []}});
 const accounts=state.pageInstagram.accounts.filter(source=>source.pageId===page.id&&handles.includes(source.handle));
 if(name==='publicPageInstagram'||name==='pageInstagramManage'){
  let items=state.pageInstagram.items.filter(post=>post.pageId===page.id&&accounts.some(source=>source.id===post.sourceId&&(!publicRead||source.publicEnabled&&post.state==='published'))).sort((a,b)=>b.publishedAt-a.publishedAt||b.id.localeCompare(a.id));
  if(v.after){const index=items.findIndex(post=>post.id===v.after);if(index<0)throw error('Invalid cursor');items=items.slice(index+1)}
  const limit=Math.max(1,Math.min(50,Number(v.limit)||12)),next=items.length>limit?items[limit-1].id:null;
  const clean=({pageId,...value})=>structuredClone(value);
  return {accounts:accounts.filter(source=>!publicRead||source.publicEnabled).map(clean),handles:publicRead?[]:handles,items:items.slice(0,limit).map(clean),next};
 }
 if(name==='pageInstagramSave'){
  if(!handles.includes(v.handle)||typeof v.enabled!=='boolean'||typeof v.publicEnabled!=='boolean')throw error('Choose a reviewed Instagram link and collection settings');
  let source=accounts.find(source=>source.handle===v.handle);if(v.expected!==(source?.revision||0))throw error('Collection changed. Reload first',409);
  if(!source){source={id:randomUUID(),pageId:page.id,handle:v.handle,revision:0,lastChecked:null,lastSuccess:null};state.pageInstagram.accounts.push(source)}
  Object.assign(source,{enabled:v.enabled,publicEnabled:v.publicEnabled,revision:source.revision+1,status:'preview_only',lastError:'Local example only. No Instagram requests are made.'});return {id:source.id,revision:source.revision};
 }
 if(name==='pageInstagramRefresh')return {ok:true};
 const post=state.pageInstagram.items.find(post=>post.id===v.post&&post.pageId===page.id);if(!post)throw error('Post unavailable',404);if(!['published','pending','hidden'].includes(v.state))throw error('Invalid publication state');post.state=v.state;return {id:post.id};
}
