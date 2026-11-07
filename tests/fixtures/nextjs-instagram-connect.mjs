import {memberModule} from './nextjs-members.mjs';
export const connectModule=memberModule.replace("if(action==='instagramClaimStatus')return {state:'ready',capabilities:{connect:false}};", "if(action==='instagramClaimStatus')return {state:window.connectedInstagram?'claimed':'ready',handle:'alice.dives',capabilities:{connect:true}};").replace('async refresh(){',`async request(path,options={}){
 if(path!=='/v1/me/instagram/connect')throw Error('Unexpected connect fixture '+path);
 (window.connectRequests||=[]).push({path,code:options.body.code,key:options.idempotencyKey});
 if(window.delayConnect)await new Promise((resolve,reject)=>{window.releaseConnect=resolve;options.signal.addEventListener('abort',()=>{window.connectAborted=true;reject(Object.assign(Error('Aborted'),{name:'AbortError'}));},{once:true});});
 if(window.connectFailure)throw Object.assign(Error('Connection temporarily unavailable.'),{status:window.connectFailure==='network'?503:Number(window.connectFailure)});
 window.connectedInstagram=true;return {state:'claimed',handle:'alice.dives'};
 },async refresh(){`);
export async function mockConnect(page,base){
 await page.route('**/v1/sites/catalog',r=>r.fulfill({json:{beaches:[{id:'bondi',name:'Bondi Beach',state_id:'NSW',state:'NSW'},{id:'portsea',name:'Portsea Beach',state_id:'VIC',state:'VIC'}]}}));
 await page.route('**/neon-config.json*',r=>r.fulfill({json:{enabled:true,backbone:true,apiUrl:base+'/',authUrl:'https://auth.invalid'}}));
 await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:connectModule}));
}
