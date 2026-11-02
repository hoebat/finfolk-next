import './appearance.js';
export const THEMES=globalThis.FinFolkAppearance.themes;
export const resolveTheme=id=>globalThis.FinFolkAppearance.resolve(id);
function announce(theme){document.dispatchEvent(new document.defaultView.CustomEvent('finfolk:appearance',{detail:theme}));return theme;}
export const applySavedTheme=()=>announce(globalThis.FinFolkAppearance.saved());
export function setTheme(id) {
  const theme=globalThis.FinFolkAppearance.apply(id);let persisted=true;
  try{localStorage.setItem('finfolk-theme',theme.id);}catch{persisted=false;}
  announce(theme);
  return {theme,persisted};
}
globalThis.addEventListener?.('storage',event=>{if(event.key==='finfolk-theme'||event.key===null)applySavedTheme();});
export function themeSettings() {
  const section=document.createElement('section');section.className='account-card theme-settings';
  const heading=document.createElement('h2');heading.textContent='Make FinFolk feel like you';
  const description=document.createElement('p');description.textContent='Four moods. The same curious nature. Your theme is saved on this device.';
  const choices=document.createElement('fieldset');choices.className='theme-choices';
  const legend=document.createElement('legend');legend.textContent='App theme';choices.append(legend);
  const status=document.createElement('p');status.setAttribute('role','status');
  for(const theme of THEMES) {
    const label=document.createElement('label');label.className='theme-choice';
    const input=document.createElement('input');input.type='radio';input.name='theme';input.value=theme.id;input.checked=document.documentElement.dataset.theme===theme.id;
    const swatch=document.createElement('span');swatch.className='theme-swatch';swatch.style.background=`linear-gradient(145deg, ${theme.bg} 55%, ${theme.accent} 55%)`;swatch.setAttribute('aria-hidden','true');
    const title=document.createElement('strong');title.textContent=theme.name;
    const copy=document.createElement('small');copy.textContent=theme.detail;
    label.append(input,swatch,title,copy);
    input.onchange=()=>{if(!input.checked)return;const {persisted}=setTheme(theme.id);status.textContent=persisted?`${theme.name} theme saved.`:`${theme.name} theme applied for this visit. Storage is unavailable.`;};
    choices.append(label);
  }
  const note=document.createElement('small');note.textContent='Map and depth colours stay consistent across themes.';
  section.append(heading,description,choices,status,note);return section;
}
