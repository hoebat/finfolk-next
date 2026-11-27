// Called only after API readiness and the authorized database snapshot succeed.
export async function collectPlatformStatus(snapshot,{fetcher=fetch,expectedRelease=null,now=()=>Date.now()}={}){
 const probe=async(name,url,accept)=>{const start=now();try{const r=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(2000)});const body=await r.json();return {name,state:r.ok&&accept(body)?'healthy':'unavailable',latencyMs:Math.max(0,now()-start)};}catch{return {name,state:'unavailable',latencyMs:Math.max(0,now()-start)};}};
 const services=[await probe('Frontend','https://finfolk.com.au/api/account-config',b=>b.authProvider==='supabase'&&b.enabled===true&&b.supabaseUrl==='https://supabase.finfolk.com.au'),
  {name:'API / database readiness',state:'healthy',detail:'This request passed API readiness and retrieved the database snapshot.'}];
 services.push({name:'Authentication',state:'healthy',detail:'Identity verified for this request.'},{name:'Email provider',state:'unknown',detail:'Not monitored. Delivery outcomes appear below.'},{name:'Backups',state:'unknown',detail:'Not monitored. No backup telemetry is configured.'});
 return {...snapshot,expectedRelease,services,overall:(expectedRelease&&snapshot.release!==expectedRelease)||services.some(s=>s.state==='unavailable')?'unavailable':'healthy'};
}
