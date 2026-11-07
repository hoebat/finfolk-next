// Run against the local production Next.js server. Auth is mocked; no provider writes occur.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mockAccount} from './fixtures/nextjs-account.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3199';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local Next.js server required');
const htmlResponse=await fetch(base);assert.equal(htmlResponse.status,200);const html=await htmlResponse.text();assert.match(html,/Pick your spot/);assert.match(html,/Post your logs/);assert.match(html,/Discover your FinFolk/);assert.doesNotMatch(html,/NEXT_REDIRECT/);
const redirect=await fetch(base+'/?view=maps&site=bondi',{redirect:'manual'});assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'/app?view=maps&site=bondi');
const accountRedirect=await fetch(base+'/?view=account',{redirect:'manual'});assert.equal(accountRedirect.headers.get('location'),'/account');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('.feature-demo-phone').length===8);
 await page.getByLabel('Theme',{exact:true}).selectOption('cobalt');await page.waitForFunction(()=>document.documentElement.dataset.theme==='cobalt');
 await page.getByRole('button',{name:'Pause animations',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Play animations',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByLabel('Choose a location').selectOption('portsea');assert.match(await page.locator('#landing-coast-open').getAttribute('href'),/site=portsea/);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/finfolk-nextjs-native-landing-mobile.png',fullPage:true});
 await mockAccount(page,base);await page.addInitScript(()=>{sessionStorage.setItem('fixture:guest','yes');localStorage.setItem('finfolk:member-tour:3:alice','done');});
 await page.goto(base+'/account',{waitUntil:'domcontentloaded'});await page.getByLabel('Email',{exact:true}).fill('fixture@example.com');await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('status').filter({hasText:'Invalid credentials'}).waitFor();
 await page.getByLabel('Password',{exact:true}).fill('valid-test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Where did you get in today?',exact:true}).waitFor();await page.getByRole('tab',{name:'Profile & buddies',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:/Continue with Google/}).waitFor();
 await page.getByLabel('Email',{exact:true}).fill('fixture@example.com');await page.getByRole('button',{name:'Forgot password?',exact:true}).click();await page.getByRole('status').filter({hasText:'Check your email for password reset instructions.'}).waitFor();
 await page.goto(base+'/account?token=fixture-reset');await page.getByLabel('New password',{exact:true}).fill('replacement-password');await page.getByRole('button',{name:'Save new password',exact:true}).click();await page.getByRole('status').filter({hasText:'Password updated. You can sign in.'}).waitFor();assert.ok(await page.evaluate(()=>window.accountCalls.some(x=>x.action==='resetPassword'&&x.token==='fixture-reset'&&x.password==='replacement-password')));
 assert.deepEqual(errors,[]);console.log('NEXTJS_PAGES_PASS: SSR landing, legacy links, native theme/motion/location controls, mobile, mocked sign-in errors/success/sign-out/reset.');
}finally{await browser.close();}
