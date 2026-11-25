let token,snapshot,busy=false;
const node=(tag,text,parent)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;parent?.append(el);return el;};
const status=document.querySelector('#status');
async function request(path,body){
 const r=await fetch(path,{cache:'no-store',headers:{'X-App-Manage-Token':token,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 const value=await r.json();if(!r.ok)throw Error(value.error||'Request failed');return value;
}
function render(){
 document.querySelector('#environment').textContent='Connected environment: '+snapshot.environment;
 const root=document.querySelector('#flags');root.replaceChildren();
 for(const definition of snapshot.definitions){
  const row=snapshot.flags.find(f=>f.id===definition.id);if(!row)continue;
  const form=node('article',undefined,root);node('h2',definition.label,form);node('p',definition.description,form);
  node('small',definition.id+' · revision '+row.revision+' · '+row.updated_by+' · '+row.updated_at,form);
  const label=node('label','Access mode ',form),select=node('select',undefined,label);
  for(const [value,text] of [['off','Off'],['testers','Testers'],['everyone','Everyone']]){const option=node('option',text,select);option.value=value;}
  select.value=row.mode;
  const testersLabel=node('label','Tester member IDs (one UUID per line)',form),testers=node('textarea',undefined,testersLabel);testers.value=row.testers.join('\n');testers.spellcheck=false;
  const save=node('button','Save',form);save.type='button';save.onclick=async()=>{
   if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Saving…';
   try{await request('api/actions/save',{id:row.id,mode:select.value,testers:testers.value.split(/[\s,]+/).filter(Boolean),revision:row.revision});await refresh();status.textContent='Saved.';}
   catch(error){status.textContent=error.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
 }
 const history=document.querySelector('#history');history.replaceChildren();
 for(const entry of snapshot.history){const item=node('article',undefined,history);node('strong',entry.flag_id+' · '+entry.previous.mode+' → '+entry.current.mode,item);node('small',entry.changed_at+' · '+entry.changed_by+' · revision '+entry.revision,item);node('p','Tester IDs: '+(entry.current.testers.join(', ')||'none'),item);}
}
async function refresh(){snapshot=await request('api/state');render();}
document.querySelector('#refresh').onclick=()=>refresh().then(()=>status.textContent='Refreshed.').catch(error=>status.textContent=error.message);
try{const session=await(await fetch('/api/session',{cache:'no-store'})).json();token=session.token;await refresh();}catch(error){status.textContent=error.message;document.querySelector('#environment').textContent='Not connected';}
