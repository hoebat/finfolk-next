// The marketing markup is React-owned. Existing canvas/demo engines own only their empty hosts.
export function mountLanding(){
 let disposed=false,cleanup=[];
 const load=path=>import(/* webpackIgnore: true */ path);
 Promise.all(['/theme.js','/landing-scenes.js','/identity.js','/feature-demos.js','/coastal-conditions.js'].map(load)).then(([theme,scenes,identity,demos,conditions])=>{
  if(disposed)return;
  theme.applySavedTheme();const accents=scenes.installLandingAccents(),demo=demos.installFeatureDemos();cleanup.push(()=>{accents.destroy();document.querySelectorAll('.landing-hero .landing-illustration').forEach(node=>node.remove());},()=>demo.destroy());
  const signature=document.getElementById('landing-signature');signature.replaceChildren(identity.createWordmark({width:440}));cleanup.push(()=>signature.replaceChildren());
  const picker=document.getElementById('landing-theme');const sync=()=>{picker.value=document.documentElement.dataset.theme;};
  const change=()=>{const result=theme.setTheme(picker.value);document.getElementById('landing-theme-status').textContent=result.theme.name+' theme applied'+(result.persisted?'.':' for this visit.');};
  picker.addEventListener('change',change);document.addEventListener('finfolk:appearance',sync);sync();cleanup.push(()=>{picker.removeEventListener('change',change);document.removeEventListener('finfolk:appearance',sync);});
  const coast=document.getElementById('landing-coast'),panel=document.getElementById('landing-conditions-panel');
  const coasts=[{id:'bondi',name:'Bondi Beach',point:[151.278267,-33.891157]},{id:'portsea',name:'Portsea Beach',point:[144.713816,-38.318983]},{id:'brighton',name:'Brighton Beach',point:[144.986083,-37.917297]}];
  const render=()=>{const beach=coasts.find(x=>x.id===coast.value)||coasts[0];panel.replaceChildren(conditions.createConditionsPanel(beach));document.getElementById('landing-coast-open').href='/app?view=maps&site='+beach.id;};coast.addEventListener('change',render);render();cleanup.push(()=>{coast.removeEventListener('change',render);panel.replaceChildren();});
 }).catch(()=>{if(!disposed){const status=document.getElementById('landing-theme-status');if(status)status.textContent='Interactive previews unavailable. You can still explore FinFolk.';}});
 return ()=>{disposed=true;cleanup.reverse().forEach(fn=>fn());};
}
