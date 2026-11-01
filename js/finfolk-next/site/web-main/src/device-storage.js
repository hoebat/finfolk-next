// One budget for disposable application reads and atlas files. Saved regions stay pinned.
import {applicationBackbone} from './app-backbone.js';
export function deviceStorage(store,application=applicationBackbone) {
  let app,working=Promise.resolve();
  async function runtime(){return app ||= await application();}
  async function stats(){
    try {return (await runtime())?.storage ? await app.storage.stats() : {mode:'memory',bytes:0,entries:[]};}
    catch {return {mode:'unavailable',bytes:0,entries:[],message:'Application storage unavailable for this visit.'};}
  }
  async function entries(){
    const saved=await store.meta('saved')||[],pinned=new Set(saved.flatMap(p=>[...p.keys,...(p.pendingKeys||[])]));
    return [...(await store.all()).filter(r=>!pinned.has(r.key)).map(r=>({id:r.key,bytes:r.bytes,used:r.used||0,kind:'atlas'})),
      ...(await stats()).entries.map(r=>({...r,kind:'application'}))].sort((a,b)=>a.used-b.used);
  }
  async function remove(rows){
    const atlas=rows.filter(r=>r.kind==='atlas').map(r=>r.id),sql=rows.filter(r=>r.kind==='application').map(r=>r.id);
    if(atlas.length)await store.remove(atlas);
    if(sql.length)await (await runtime()).storage.evict(sql);
  }
  function exclusive(work){
    const run=()=>globalThis.navigator?.locks ? navigator.locks.request('finfolk-cache-budget',work) : work();
    working=working.catch(()=>{}).then(run);return working;
  }
  async function enforce(){return exclusive(async()=>{
    const rows=await entries(),limit=await store.meta('limit')||store.limit;
    let total=rows.reduce((n,r)=>n+r.bytes,0),drop=[];
    for(const row of rows){if(total<=limit)break;drop.push(row);total-=row.bytes;}
    await remove(drop);
  });}
  return {stats,enforce,clearRecent:()=>exclusive(async()=>remove(await entries())),
    clearAccount:async()=>{await (await runtime())?.clearAccountCache?.();},
    keep:async()=>await globalThis.navigator?.storage?.persist?.()||false};
}
