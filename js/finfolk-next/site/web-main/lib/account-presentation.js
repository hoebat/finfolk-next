// Presentation only: this snapshot never grants authenticated access.
const KEY='finfolk:account-presentation:1',MAX_AGE=7*86400000;
export function createAccountPresentation({storage=()=>globalThis.localStorage,now=Date.now}={}){
 let snapshot=null,loaded=false;const listeners=new Set();
 const valid=value=>value&&typeof value.actor==='string'&&value.actor.length<129&&typeof value.displayName==='string'&&[...value.displayName].length<=80&&typeof value.portrait==='string'&&value.portrait.length<=65558&&Number.isFinite(value.at)&&now()-value.at<MAX_AGE&&value.at<=now()+60000;
 function read(){if(!loaded){loaded=true;try{const value=JSON.parse(storage()?.getItem(KEY)||'null');if(valid(value))snapshot=value;}catch{}}return snapshot;}
 function notify(){for(const listener of listeners)listener();}
 return {getSnapshot:read,getServerSnapshot:()=>null,
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  save(actor,profile){if(!actor||!profile)return;const value={actor,displayName:[...String(profile.displayName||'')].slice(0,80).join(''),portrait:typeof profile.portrait==='string'?profile.portrait:'',at:now()};if(!valid(value))return;const previous=read();if(previous?.actor===actor&&previous.displayName===value.displayName&&previous.portrait===value.portrait)return;snapshot=value;loaded=true;try{storage()?.setItem(KEY,JSON.stringify(value))}catch{}notify()},
  clear(actor){if(actor&&read()?.actor!==actor)return;snapshot=null;loaded=true;try{storage()?.removeItem(KEY)}catch{}notify()},
  reload(){loaded=false;snapshot=null;read();notify()}
 };
}
export const accountPresentation=createAccountPresentation();
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null)accountPresentation.reload()});

export function requestedPresentationActor(){try{return new URL(location.href).searchParams.get('previewActor')||sessionStorage.getItem('finfolk:preview:actor')}catch{return null}}
