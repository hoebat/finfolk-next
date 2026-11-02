import {installLandingAccents} from './landing-scenes.js';
import {createConditionsPanel} from './coastal-conditions.js';
import {createWordmark} from './identity.js';
import {applySavedTheme,setTheme} from './theme.js';
import {installFeatureDemos} from './feature-demos.js';
applySavedTheme();installLandingAccents();
document.getElementById('landing-signature').append(createWordmark({width:440}));
const coasts=[{id:'bondi',name:'Bondi Beach',point:[151.278267,-33.891157]},{id:'portsea',name:'Portsea Beach',point:[144.713816,-38.318983]},{id:'brighton',name:'Brighton Beach',point:[144.986083,-37.917297]}];
const coast=document.getElementById('landing-coast');
function renderCoast(){const beach=coasts.find(beach=>beach.id===coast.value)||coasts[0];document.getElementById('landing-conditions-panel').replaceChildren(createConditionsPanel(beach));document.getElementById('landing-coast-open').href='./?view=maps&site='+beach.id;}
coast.addEventListener('change',renderCoast);renderCoast();
const picker=document.getElementById('landing-theme');
function syncTheme(){picker.value=document.documentElement.dataset.theme;}
syncTheme();document.addEventListener('finfolk:appearance',syncTheme);
picker.addEventListener('change',()=>{const {theme,persisted}=setTheme(picker.value);document.getElementById('landing-theme-status').textContent=theme.name+' theme applied'+(persisted?'.':' for this visit.');});
export const landingDemos=installFeatureDemos();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
