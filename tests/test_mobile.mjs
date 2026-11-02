import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {installNavigation} from '../js/finfolk-next/site/web-main/src/navigation.js';
import {installAppShell,routeFromURL} from '../js/finfolk-next/site/web-main/src/mobile-shell.js';
for(const [query,view,section] of [['?view=logbook&session=one','logbook','suggested'],['','maps','suggested'],['?site=edithvale','maps','suggested'],['?view=areas','discover','index'],['?view=guides','discover','suggested'],['?view=discover&site=edithvale&section=index','discover','index']])assert.deepEqual(routeFromURL('https://example.test/'+query),{view,section,site:query.includes('site=')?'edithvale':''});
const window=new Window({width:390,height:844,url:'https://example.test/?view=areas',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}}),doc=window.document;
doc.write(await readFile(new URL('../js/finfolk-next/site/web-main/src/index.html',import.meta.url),'utf8'));
for(const key of ['document','location','history'])globalThis[key]=window[key];globalThis.addEventListener=window.addEventListener.bind(window);globalThis.innerHeight=844;
for(const name of ['mobile.css']){const style=doc.createElement('style');style.textContent=await readFile(new URL('../js/finfolk-next/site/web-main/src/'+name,import.meta.url),'utf8');doc.head.append(style);}
const $=id=>doc.getElementById(id),canvas=$('map'),parent=canvas.parentElement;let active;
try{
 const backbone=process.env.SUBSTRATE_TEST?(await import('../js/finfolk-next/site/web-main/src/next-backbone.js')).createApplicationBackbone({apiUrl:'https://mobile.substrate.test/'}):null;const shell=installAppShell({backbone,onMapActivity:value=>active=value});assert.equal(shell.route.view,'discover');assert.equal(shell.route.section,'index');assert.equal(new URL(location.href).searchParams.get('view'),'discover');assert.equal(active,false);assert.equal($('data-panel').hidden,true);
 assert.equal(window.getComputedStyle(doc.querySelector('.primary-nav')).position,'fixed');assert.equal(window.getComputedStyle($('system-panel')).position,'fixed');assert.equal(window.getComputedStyle($('data-panel')).position,'absolute');
 for(const style of doc.querySelectorAll('style'))style.remove();
 shell.navigate('maps');assert.equal(active,true);assert.equal($('explorer').hidden,false);$('layers-callout').click();assert.equal(shell.panelOpen,true);assert.equal(shell.panelSection,'layers');assert.equal(doc.activeElement,$('data-layers-tab'));assert.equal($('data-layers-panel').hidden,false);assert.equal($('data-panel').hasAttribute('aria-modal'),false);assert.equal(canvas.inert,false);
 $('data-place-tab').click();assert.equal(shell.panelSection,'place');assert.equal($('data-place-panel').hidden,false);doc.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(shell.panelOpen,false);assert.equal(doc.activeElement,$('layers-callout'));
 shell.openPanel('place');canvas.dispatchEvent(new window.MouseEvent('pointerdown',{bubbles:true}));assert.equal(shell.panelOpen,false);shell.openPanel('layers');doc.querySelector('[data-view=discover]').click();assert.equal(shell.panelOpen,false);assert.equal($('discover-page').hidden,false);
 $('index-tab').click();assert.equal(shell.route.section,'index');assert.equal(new URL(location.href).searchParams.get('section'),'index');
 history.replaceState(null,'','?view=maps&site=edithvale');window.dispatchEvent(new window.PopStateEvent('popstate'));assert.equal(shell.route.view,'maps');assert.equal(shell.route.site,'edithvale');assert.equal(shell.panelOpen,false);
 window.innerWidth=1440;window.dispatchEvent(new window.Event('resize'));assert.equal(canvas.parentElement,parent);assert.equal(doc.querySelectorAll('#map').length,1);assert.equal(doc.querySelectorAll('#beach-search').length,1);const desktopCSS=await readFile(new URL('../js/finfolk-next/site/web-main/src/mobile.css',import.meta.url),'utf8');assert.ok(desktopCSS.includes('@media (max-width:900px)'));
 shell.navigate('logbook',{params:{session:'one'}});assert.equal($('logbook-page').hidden,false);assert.equal($('explorer').hidden,true);assert.equal(active,false);doc.querySelector('.primary-nav [data-view=logbook]').click();assert.equal(new URL(location.href).searchParams.has('session'),false);shell.navigate('maps');assert.equal(new URL(location.href).searchParams.has('session'),false);assert.equal($('logbook-page').hidden,true);
 const navigation=installNavigation({doc,nav:doc.querySelector('.primary-nav'),rail:doc.querySelector('.app-rail')});
 const visibleKeys=()=>[...doc.querySelectorAll('.primary-nav>.ff-nav-item')].filter(n=>!n.hidden).map(n=>n.dataset.localNav);
 assert.deepEqual(visibleKeys(),['discover','map']);assert.equal($('local-menu-toggle').hidden,true);
 navigation.setUser({uid:'member'});assert.deepEqual(visibleKeys(),['discover','map','people','logbook','me']);assert.equal($('local-menu-toggle').hidden,false);
 $('local-menu-toggle').click();assert.equal($('local-menu-panel').hidden,false);navigation.setUser(null);assert.deepEqual(visibleKeys(),['discover','map']);assert.equal($('local-menu-panel').hidden,true);assert.equal($('local-menu-toggle').hidden,true);
 navigation.destroy();
 console.log('Shell checks passed: routes/history, bottom navigation, desktop rail, non-modal tabs, focus/Escape, outside dismissal and stable canvas.');
}finally{await window.happyDOM.close();}
