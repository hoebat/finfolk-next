import {AUSTRALIAN_SCENES,landingSceneURL} from './australian-scenes.js';
const inkPaletteId=theme=>({yellow:'acid-light',cobalt:'acid-dark','navy-light':'muted-light',navy:'muted-dark'})[theme]||'acid-light';
export function installLandingScenes(){
 const doc=document,sections=[];let palette=inkPaletteId(doc.documentElement.dataset.theme||'yellow');
 const mobile=()=>doc.defaultView.innerWidth<=600;
 const load=entry=>{entry.loaded=true;entry.node.style.setProperty('--landing-scene',`url("${landingSceneURL(entry.scene,palette,mobile())}")`);};
 for(const scene of AUSTRALIAN_SCENES){const node=doc.querySelector(scene.section);if(!node)continue;node.classList.add('landing-scene');node.dataset.scene=scene.slug;node.style.setProperty('--scene-position',mobile()?scene.mobileFocus:scene.focus);const caption=doc.createElement('span');caption.className='landing-scene-caption';caption.textContent=scene.caption+' · illustrated';node.append(caption);sections.push({node,scene,loaded:false});}
 function refresh(){palette=inkPaletteId(doc.documentElement.dataset.theme||'yellow');for(const entry of sections){entry.node.dataset.palette=palette;entry.node.style.setProperty('--scene-position',mobile()?entry.scene.mobileFocus:entry.scene.focus);if(entry.loaded)load(entry);}}
 const Observer=doc.defaultView.IntersectionObserver;
 if(Observer){const observer=new Observer(entries=>{for(const e of entries)if(e.isIntersecting){load(sections.find(s=>s.node===e.target));observer.unobserve(e.target);}},{rootMargin:'300px'});for(const entry of sections)entry.scene.slug==='ningaloo'?load(entry):observer.observe(entry.node);}else sections.forEach(load);
 doc.addEventListener('finfolk:appearance',refresh);doc.defaultView.addEventListener('resize',refresh);refresh();
}
