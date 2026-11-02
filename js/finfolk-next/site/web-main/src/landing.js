import {installLandingScenes} from './landing-scenes.js';
import {createConditionsPanel} from './coastal-conditions.js';
import {createWordmark} from './identity.js';
import {applySavedTheme} from './theme.js';

applySavedTheme();installLandingScenes();
document.getElementById('landing-signature').append(createWordmark({width:440}));
const coasts=[{id:'bondi',name:'Bondi Beach',point:[151.278267,-33.891157]},{id:'portsea',name:'Portsea Beach',point:[144.713816,-38.318983]},{id:'brighton',name:'Brighton Beach',point:[144.986083,-37.917297]}];
const coast=document.getElementById('landing-coast');
function renderCoast(){
 const beach=coasts.find(b=>b.id===coast.value)||coasts[0];
 document.getElementById('landing-conditions-panel').replaceChildren(createConditionsPanel(beach));
 document.getElementById('landing-coast-open').href='./?view=maps&site='+beach.id;
}
coast.addEventListener('change',renderCoast);renderCoast();

const dialog=document.getElementById('landing-demo'),frame=document.getElementById('landing-demo-frame');
const routes={discover:'?view=discover&section=index&q=beach',logbook:'?view=logbook',account:'?view=account',posts:'?view=account&tab=posts',people:'profiles?screen=people&location=bondi',regulars:'?view=account&tab=checkin'};
let opener;
for(const button of document.querySelectorAll('[data-open-demo]'))button.addEventListener('click',()=>{
 opener=button;frame.src='./'+(routes[button.dataset.demoRoute]||routes.discover);
 document.getElementById('landing-demo-open').href=frame.src;
 dialog.showModal();document.documentElement.style.overflow='hidden';document.getElementById('landing-demo-close').focus();
});
document.getElementById('landing-demo-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.documentElement.style.overflow='';frame.removeAttribute('src');opener?.focus();});

// Cache both public entry points; no account data or forecasts enter this cache.
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
