import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3258';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:900});await page.goto(base+'/community?previewActor=guest');await page.getByRole('combobox',{name:'Preview role'}).waitFor();
 const labels=await page.getByRole('navigation',{name:'Main navigation',exact:true}).locator('a').allTextContents();assert.ok(labels.includes('Explore')&&labels.includes('Community'));assert.ok(!labels.includes('Sessions')&&!labels.includes('Check in')&&!labels.includes('You'));
 const signIn=page.locator('.ff-signin');await signIn.waitFor();assert.equal(await page.locator('#local-menu-panel').count(),0);const box=await signIn.boundingBox();assert.equal(box.width,width>900?172:44);assert.equal(box.height,width>900?64:44);
 await page.goto(base+'/map?site=bondi');const notes=page.getByRole('region',{name:'Community notes',exact:true});await notes.getByRole('link',{name:'Sign in to contribute',exact:true}).waitFor();assert.equal(await notes.getByRole('button',{name:'Add note',exact:true}).count(),0);assert.equal(await notes.locator('.fn-note-upvote,.fn-note-downvote').count(),0);
 assert.equal(await page.locator('.fm-detail-copy').count(),0);assert.equal(await page.locator('.fm-detail-links a').filter({hasText:/^Check in$|^Log a session$/}).count(),0);assert.equal(await page.locator('.ff-signin').isVisible(),true);
 await notes.getByRole('button',{name:'Sort and filter notes'}).click();await notes.getByRole('combobox',{name:'Sort community notes'}).selectOption('newest');
 await notes.getByRole('link',{name:'Sign in to contribute',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.ok(new URL(page.url()).searchParams.get('returnTo').includes('#notes-bondi'));
 await page.getByLabel('Email',{exact:true}).fill('demo@example.test');await page.getByLabel('Password',{exact:true}).fill('preview-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname==='/map'&&url.hash==='#notes-bondi',{timeout:20000});await notes.getByRole('button',{name:'Add note',exact:true}).waitFor();await page.locator('#local-menu-toggle').waitFor({state:'attached'});await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Sessions',exact:true}).waitFor();
 }
 assert.deepEqual(errors,[]);console.log('GUEST_EXPERIENCE_PASS: public navigation, fixed sign-in control, read-only notes, guest place actions and return to selected notes after sign-in.');
}finally{await browser.close();}
