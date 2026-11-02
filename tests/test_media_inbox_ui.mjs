import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {mediaInbox} from '../js/finfolk-next/site/web-main/src/media-inbox.js';
const w=new Window({url:'https://finfolk.test/?view=logbook'});for(const k of ['document','location'])globalThis[k]=w[k];globalThis.confirm=()=>true;
let saved,assigned,created,opened,failSave=false;
const item={id:crypto.randomUUID(),platform:'instagram',url:'https://www.instagram.com/reel/fixture/',day:'2026-11-01',locationName:'Bondi Beach',beachId:'bondi',notes:'',candidates:[]};
const api={user:{uid:'alice'},call:async(action,values)=>{if(action==='mediaInbox')return {items:[item],instagram:{connected:true,ownerVerified:true,collecting:true},limit:100};if(action==='tiktokStatus')return {ready:false,connected:false};if(action==='updateImportedMedia'){if(failSave)throw Error('Connection failed. Try again.');saved=values;return {ok:true};}if(action==='assignImportedMedia'){assigned=values;return {id:'session-1'};}throw Error(action);},list:async()=>({sessions:[{id:'session-1',locationName:'Bondi Beach',date:'2026-11-01',visibility:'public'}],more:false})};
const ui=mediaInbox({api,getBeaches:()=>[{id:'bondi',name:'Bondi Beach',state:'NSW'}],createSession:i=>{created=i;},openSession:id=>{opened=id;},openAccount(){}});document.body.append(ui.root);
const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error(document.body.textContent);};
const click=text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,text);b.click();};
try{
 await wait(()=>document.querySelector('.import-card'));assert.match(document.body.textContent,/Not in a session yet/);assert.match(document.body.textContent,/awaiting app approval/);assert.equal(document.querySelectorAll('iframe,img,video').length,0,'No third-party media loads before the owner chooses to open it');
 const form=document.querySelector('.import-card form'),notes=form.querySelector('textarea');notes.value='New import detail';failSave=true;form.dispatchEvent(new w.Event('submit',{cancelable:true}));await wait(()=>document.body.textContent.includes('Connection failed'));assert.equal(notes.value,'New import detail','Failed saves preserve the draft');failSave=false;
 click('Add to a session');await wait(()=>document.querySelector('select'));
 const select=document.querySelector('select');select.value='session-1';select.dispatchEvent(new w.Event('change'));click('Add selected post');await wait(()=>document.body.textContent.includes('Confirm the post link'));assert.equal(assigned,undefined);
 document.querySelector('input[type=checkbox]').checked=true;click('Add selected post');await wait(()=>opened==='session-1');assert.equal(assigned.publicConsent,true);assert.equal(saved.values.notes,'New import detail');
 click('Create private session');await wait(()=>created);assert.equal(created.notes,'New import detail');assert.equal(created.day,'2026-11-01');
 assert.equal(document.querySelector('a').target,'_blank');assert.match(document.querySelector('a').rel,/noopener/);
 console.log('MEDIA_INBOX_UI_PASS: review fields, provider readiness, private draft retry, existing-session choice, explicit publication consent, and new private session handoff.');
}finally{ui.dispose();await w.happyDOM.close();}
