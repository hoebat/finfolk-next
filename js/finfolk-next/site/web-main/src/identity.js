export function createWordmark({width=280,print=false}={}) {
  const mark=document.createElement('span');mark.className='brand-wordmark';
  mark.style.setProperty('--wordmark-width',width+'px');mark.setAttribute('role','img');mark.setAttribute('aria-label','FinFolk');
  if(print)mark.dataset.brandPrint='fine';
  const fill=document.createElement('span');fill.className='brand-wordmark__fill';mark.append(fill);return mark;
}
