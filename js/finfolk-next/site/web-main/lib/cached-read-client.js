// Read-only page loaders can compose saved model snapshots while revalidating.
export function cachedReadClient(client,onUpdate){
 if(!client.subscribe)return client;
 return new Proxy(client,{get(target,key){if(key!=='call')return Reflect.get(target,key);return (name,values,options)=>new Promise((resolve,reject)=>{
  let snapshot,hasSnapshot=false,stop;
  const finish=()=>{Promise.resolve(stop).then(release=>release?.()).catch(()=>{})};
  try{stop=client.subscribe(name,values,state=>{if(!hasSnapshot&&state.data!==undefined&&!state.error&&state.status!=='closed'){hasSnapshot=true;snapshot=JSON.stringify(state.data);resolve(state.data)}})}catch{}
  Promise.resolve().then(()=>client.call(name,values,options)).then(value=>{if(hasSnapshot){if(snapshot!==JSON.stringify(value))onUpdate()}else resolve(value)},error=>{if(hasSnapshot)onUpdate();else reject(error)}).finally(finish);
 });}});
}
