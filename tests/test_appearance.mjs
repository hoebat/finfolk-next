import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Window} from 'happy-dom';
const base=new URL('../js/finfolk-next/site/web-main/src/',import.meta.url);
const boot=await readFile(new URL('appearance.js',base),'utf8');
const html=await readFile(new URL('index.html',base),'utf8');
assert.ok(html.indexOf('./appearance.js')<html.indexOf('rel="stylesheet"'),'Saved colours load before stylesheets');
assert.ok(!html.includes('./finfolk-logo.jpeg'),'Shell uses the approved identity');
for(const [saved,expected] of [[null,'yellow'],['unknown','yellow'],['coastal','navy-light'],['sand','navy-light'],['night','navy'],['cobalt','cobalt'],['navy-light','navy-light'],['navy','navy']]){
 const window=new Window();window.document.write('<meta name="theme-color" content="#fff">');
 if(saved)window.localStorage.setItem('finfolk-theme',saved);
 const context=vm.createContext({document:window.document,localStorage:window.localStorage});vm.runInContext(boot,context);
 assert.equal(window.document.documentElement.dataset.theme,expected);
 assert.equal(window.document.querySelector('meta').content,context.FinFolkAppearance.resolve(expected).bg);
 if(saved)assert.equal(window.localStorage.getItem('finfolk-theme'),expected,'Legacy preferences are migrated without clearing other storage');
 await window.happyDOM.close();
}
const window=new Window();window.document.write('<meta name="theme-color">');
const blocked=vm.createContext({document:window.document,get localStorage(){throw Error('Storage blocked');}});vm.runInContext(boot,blocked);
assert.equal(window.document.documentElement.dataset.theme,'yellow');
blocked.FinFolkAppearance.apply('navy');assert.equal(window.document.documentElement.dataset.theme,'navy','Colours still work without storage');
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const theme of blocked.FinFolkAppearance.themes){
 for(const [fg,bg] of [['ink','bg'],['ink','surface'],['muted','surface'],['accent','surface'],['onAccent','accent']])assert.ok(contrast(theme[fg],theme[bg])>=4.5,`${theme.name}: ${fg}/${bg} must meet normal text contrast`);
}
await window.happyDOM.close();
const ui=new Window();ui.document.write('<meta name="theme-color">');
for(const key of ['document','localStorage'])Object.defineProperty(globalThis,key,{value:ui[key],configurable:true});
const {themeSettings}=await import('../js/finfolk-next/site/web-main/src/theme.js');
const settings=themeSettings();ui.document.body.append(settings);
assert.deepEqual([...settings.querySelectorAll('input')].map(input=>input.value),['yellow','cobalt','navy-light','navy']);
const choose=id=>{const input=settings.querySelector(`input[value="${id}"]`);input.checked=true;input.dispatchEvent(new ui.Event('change'));};
choose('navy');assert.equal(ui.localStorage.getItem('finfolk-theme'),'navy');assert.equal(ui.document.documentElement.dataset.theme,'navy');
Object.defineProperty(globalThis,'localStorage',{get(){throw Error('Storage blocked');},configurable:true});
choose('cobalt');assert.equal(ui.document.documentElement.dataset.theme,'cobalt');assert.match(settings.querySelector('[role=status]').textContent,/this visit/);
await ui.happyDOM.close();
console.log('Appearance passed: pre-paint initialization, all four palettes, preference migration, blocked storage and text contrast.');
