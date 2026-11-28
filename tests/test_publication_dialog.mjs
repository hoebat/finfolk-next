import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {Window} from 'happy-dom';
import React,{act,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {publicSessionMedia} from '../js/finfolk-next/site/web-main/src/logbook-model.js';
const window=new Window();
for(const key of ['window','document','HTMLElement'])globalThis[key]=key==='window'?window:window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
let published=0;
const source=await readFile(new URL('../js/finfolk-next/site/web-main/app/(atlas)/logbook/screen.jsx',import.meta.url),'utf8');
const dialog=source.slice(source.indexOf('function PublishDialog('));
const compiled=await transform(dialog+'\nreturn PublishDialog;',{loader:'jsx',format:'cjs'});
const Component=new Function('React','useEffect','useRef','useLogbookAction','Button','LinkedMedia','Photos','pageActions','publicSessionMedia',compiled.code)(React,useEffect,useRef,()=>({busy:false,run:async(fn,done)=>{await fn();done();}}),props=>React.createElement('button',props),props=>React.createElement('div',null,JSON.stringify(props.items)),()=>React.createElement('p',null,'PRIVATE_PHOTO'),()=>({visibility:async()=>{published++;}}),publicSessionMedia);
const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
try{
 for(const media of [{photos:['PRIVATE_PHOTO']},{linkedMedia:[{id:'post',platform:'instagram',url:'https://www.instagram.com/p/abc/',notes:'PRIVATE_NOTE'}]},{}]){
  await act(()=>root.render(React.createElement(Component,{session:{client:{}},entry:{date:'2026-11-28',locationName:'Port Melbourne Beach',...media},close(){},done(){}})));
  const button=[...container.querySelectorAll('button')].find(b=>b.textContent==='Publish for everyone');
  assert.equal(button.disabled,false);
  assert.ok(container.textContent.includes('uploaded photos stay private'));
  assert.ok(!container.textContent.includes('PRIVATE_'));
  const before=published;await act(async()=>{button.click();});assert.equal(published,before+1);
 }
 console.log('PUBLICATION_DIALOG_PASS: sessions publish with links or legacy photos; consent explains what stays private.');
}finally{await act(()=>root.unmount());await window.happyDOM.close();}
