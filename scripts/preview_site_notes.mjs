// Local preview storage only. Production notes use the native notes service.
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const recordVersion=note=>(note.versions??=[]).push({revision:note.revision,topic:note.topic,text:note.text,observedOn:note.observedOn,withdrawn:!!note.withdrawn,hidden:!!note.hidden,savedAt:new Date().toISOString()});
const topics=['access','facilities','wildlife','conditions'];
export function previewSiteNotes(state,path,options={},actor='alice'){
 const url=new URL(path,'http://preview'),match=url.pathname.match(/^\/v1\/(?:me\/|admin\/)?sites\/([^/]+)\/notes(?:\/(save|vote|withdraw|report|moderate))?$/);
 if(!match)return undefined;
 const site=decodeURIComponent(match[1]),action=match[2],rows=state.siteNotes||=[],member=url.pathname.includes('/me/'),profile=state.profiles[actor];
 if(!action){const topic=url.searchParams.get('topic')||'all',offset=Number(url.searchParams.get('offset')||0),sort=url.searchParams.get('sort')||'helpful';let notes=rows.filter(n=>n.site===site&&!n.withdrawn&&!n.hidden&&(topic==='all'||n.topic===topic)).map(n=>({id:n.id,site:n.site,topic:n.topic,text:n.text,observedOn:n.observedOn,createdAt:n.createdAt,author:state.profiles[n.owner]?.displayName||'Diver',revision:n.revision,score:n.votes.length-(n.downvotes?.length||0),own:member&&n.owner===actor,upvoted:member&&n.votes.includes(actor),downvoted:member&&!!n.downvotes?.includes(actor)}));notes.sort(sort==='newest'?(a,b)=>b.createdAt.localeCompare(a.createdAt):(a,b)=>b.score-a.score||b.createdAt.localeCompare(a.createdAt));const own=member?rows.find(n=>n.site===site&&n.owner===actor):null;return {enabled:true,ownNote:own?{id:own.id,topic:own.topic,text:own.text,observedOn:own.observedOn,revision:own.revision,withdrawn:!!own.withdrawn,hidden:!!own.hidden}:null,notes:notes.slice(offset,offset+20),next:offset+20<notes.length?offset+20:null};}
 if(options.method!=='POST'||!profile)fail('Sign in to contribute notes.');
 const value=options.body||{};
 if(action==='save'){
  const text=String(value.text||'').trim(),observedOn=value.observedOn||null;
  if(text.length<10||text.length>1000||!topics.includes(value.topic))fail('Write 10–1,000 characters and choose a topic.');
  if(value.topic==='conditions'&&!observedOn)fail('Add the observation date for a conditions note.');
  if(observedOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)||!Number.isFinite(Date.parse(observedOn))||new Date(observedOn+'T12:00:00Z').toISOString().slice(0,10)!==observedOn))fail('Use a valid observation date.');
  const existing=rows.find(n=>n.id===value.id);if(existing){
   if(existing.site!==site||existing.owner!==actor)fail('That note is unavailable.',404);
   const same=existing.text===text&&existing.topic===value.topic&&existing.observedOn===observedOn;
   if(same&&!existing.withdrawn&&(value.revision===undefined||value.revision===existing.revision||value.revision+1===existing.revision))return {id:existing.id,revision:existing.revision};
   if(!Number.isInteger(value.revision)||value.revision!==existing.revision)fail('This note changed. Reload it before trying again.',409);
   if(!existing.versions)recordVersion(existing);
   Object.assign(existing,{text,topic:value.topic,observedOn,withdrawn:false,revision:existing.revision+1});recordVersion(existing);return {id:existing.id,revision:existing.revision};
  }
  if(rows.some(n=>n.site===site&&n.owner===actor))fail('You already have a note for this site. Reload it before editing.',409);
  if(value.revision!==undefined)fail('This note changed. Reload it before trying again.',409);
  const note={id:value.id,site,owner:actor,topic:value.topic,text,observedOn,createdAt:new Date().toISOString(),revision:1,votes:[],withdrawn:false};recordVersion(note);(state.siteNotes??=[]).push(note);return {id:note.id,revision:1};
 }
 const note=rows.find(n=>n.id===value.id&&n.site===site);if(!note)fail('That note is unavailable.');
 if(action==='vote'){const vote=value.vote===undefined?(typeof value.upvoted==='boolean'?(value.upvoted?1:0):null):value.vote;if(!Number.isInteger(vote)||![-1,0,1].includes(vote))fail('Choose a valid note vote.');note.votes=note.votes.filter(id=>id!==actor);note.downvotes=(note.downvotes||[]).filter(id=>id!==actor);if(vote===1)note.votes.push(actor);if(vote===-1)note.downvotes.push(actor);return {id:note.id,score:note.votes.length-note.downvotes.length,upvoted:vote===1,downvoted:vote===-1};}
 if(action==='withdraw'){if(note.owner!==actor)fail('Only the author can remove this note.');if(note.withdrawn===!!value.withdrawn)return {id:note.id,revision:note.revision,withdrawn:note.withdrawn};if(note.revision!==value.revision)fail('This note changed. Reload it before trying again.',409);if(!note.versions)recordVersion(note);note.withdrawn=!!value.withdrawn;note.revision++;recordVersion(note);return {id:note.id,revision:note.revision,withdrawn:note.withdrawn};}
 if(action==='report'){if(!String(value.reason||'').trim())fail('Provide a report reason.');(state.siteNoteReports??=[]).push({site,note:note.id,actor,reason:value.reason});return {reported:true};}
 if(actor!=='admin')fail('Administrator access required.');if(note.hidden!==!!value.hidden){if(!note.versions)recordVersion(note);note.hidden=!!value.hidden;note.revision++;recordVersion(note);}return {id:note.id,hidden:note.hidden};
}
