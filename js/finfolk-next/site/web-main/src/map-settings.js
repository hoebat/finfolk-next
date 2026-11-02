export function installMapSettings(){
 const doc=document,dialog=doc.createElement('dialog');dialog.className='map-settings';dialog.setAttribute('aria-label','Settings');
 const heading=doc.createElement('h2');heading.textContent='Settings';const close=doc.createElement('button');close.textContent='Close settings';close.onclick=()=>dialog.close();
 dialog.append(heading,close,doc.getElementById('data-layers-panel'),doc.getElementById('system-toggle'));doc.body.append(dialog);
 const button=doc.createElement('button');button.className='settings-entry';button.textContent='⚙';button.setAttribute('aria-label','Settings');button.title='Settings';button.onclick=()=>{if(!dialog.open)dialog.showModal();};doc.body.append(button);
 doc.getElementById('layers-callout').hidden=true;doc.querySelector('.data-tabs').hidden=true;
 doc.addEventListener('finfolk:map-settings',()=>button.click());
 const place=doc.getElementById('data-place-panel'),more=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent='Map measurements';more.append(summary,doc.getElementById('measure-panel'),doc.getElementById('profile-panel'));place.append(more);
 return {open:()=>button.click()};
}
