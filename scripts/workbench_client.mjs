import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export function workbenchClient(base=process.env.WORKBENCH_URL||'http://127.0.0.1:8131'){
 const origin=new URL(base);
 if(!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||!['http:','https:'].includes(origin.protocol))throw Error('Workbench must be a local HTTP URL');
 async function request(path,action){
  let token;
  if(action!==undefined)token=(await request('/api/session')).token;
  const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(15000),redirect:'error',...(action===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-App-Manage-Token':token},body:JSON.stringify(action)})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Workbench HTTP '+response.status);
  return data;
 }
 return {checks:()=>request('/api/v1/checks'),runs:()=>request('/api/v1/runs'),
  run:id=>request('/api/v1/runs/'+encodeURIComponent(id)),
  start:action=>request('/api/v1/runs',action),
  checkPages:()=>request('/api/v1/actions/page-health/runs',{}),
  report:()=>request('/api/v1/artifacts/page-health-report'),
  async wait(id,{timeoutMs=1200000,pollMs=500}={}){
   const deadline=Date.now()+timeoutMs;
   while(Date.now()<deadline){const run=await this.run(id);if(['ok','error'].includes(run.status))return run;await new Promise(resolve=>setTimeout(resolve,pollMs));}
   throw Error('Timed out waiting for run '+id+'; the server run may still be running');
  }};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [command='checks',id]=process.argv.slice(2),client=workbenchClient();let result;
  if(command==='checks')result=await client.checks();
  else if(command==='runs')result=await client.runs();
  else if(command==='run'&&id)result=await client.run(id);
  else if(command==='report')result=await client.report();
  else if(command==='check-pages'){const queued=await client.checkPages();console.error('Queued workbench run '+queued.id);result=await client.wait(queued.id);}
  else throw Error('Usage: workbench_client.mjs checks|runs|run ID|report|check-pages');
  console.log(JSON.stringify(result,null,2));if(result.status==='error')process.exitCode=1;
 }catch(error){console.error(error.message);process.exitCode=1;}
}
