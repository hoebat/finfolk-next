import {installProfiles} from './profiles.js';
installProfiles().catch(()=>{
 const host=document.getElementById('profile-main');host.replaceChildren();
 const text=document.createElement('p');text.textContent='Profiles could not load. Reconnect and try again.';
 const retry=document.createElement('button');retry.textContent='Try again';retry.onclick=()=>location.reload();host.append(text,retry);
});
