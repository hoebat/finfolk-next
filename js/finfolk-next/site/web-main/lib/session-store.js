// One SDK observer for the application. Route mounts reuse the resolved session
// instead of returning to a component-local loading state.
export function createSessionStore(loadClient){
 const initial={status:'loading',client:null,user:null,error:null},listeners=new Set();let state=initial,started=false,generation=0,stop;
 const publish=value=>{state=value;listeners.forEach(listener=>listener());};
 function start(){started=true;const current=++generation;stop?.();stop=null;publish(initial);
  Promise.resolve().then(loadClient).then(client=>{if(current!==generation)return;const release=client.observe(user=>{if(current===generation)publish({status:'ready',client,user,error:null});});if(current===generation)stop=release;else release?.();}).catch(error=>{if(current===generation)publish({status:'error',client:null,user:null,error});});
 }
 return {subscribe(listener){listeners.add(listener);if(!started)start();return()=>listeners.delete(listener)},getSnapshot:()=>state,getServerSnapshot:()=>initial,retry:start};
}
