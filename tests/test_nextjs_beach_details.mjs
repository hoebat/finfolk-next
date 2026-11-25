import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3016';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/map?site=ga-vic-9565');
 await page.getByRole('region',{name:'Depth information'}).waitFor();
 assert.equal(await page.locator('.fm-chips').count(),0);
 assert.equal(await page.getByRole('link',{name:'Location details & depth',exact:false}).count(),0);
 assert.equal(await page.getByRole('link',{name:'Create a group or page',exact:true}).count(),0);
 assert.equal(await page.getByRole('region',{name:'Businesses at this beach'}).count(),0,'Unrelated preview school does not appear at a Victorian beach');
 assert.match(await page.getByRole('region',{name:'Depth information'}).innerText(),/No mapped|not published/);
 await page.getByRole('button',{name:'Layers',exact:true}).click();assert.equal(await page.getByRole('combobox',{name:'Map theme',exact:true}).count(),0);await page.keyboard.press('Escape');
 await page.goto(base+'/map?site=bondi');await page.getByRole('region',{name:'Businesses at this beach'}).getByRole('link',{name:'Ocean School',exact:true}).waitFor();
 const notes=page.getByRole('region',{name:'Community notes',exact:true}),text='Preview beach note '+width+' '+Date.now();
 await notes.getByRole('button',{name:'Add note',exact:true}).click();await notes.getByRole('textbox',{name:'Your note',exact:true}).fill(text);await notes.getByRole('button',{name:'Publish note',exact:true}).click();await notes.getByText(text,{exact:true}).waitFor();
 await page.reload();await page.getByText(text,{exact:true}).waitFor();
 await page.goto(base+'/map?site=portsea');await page.getByRole('button',{name:'Add note',exact:true}).waitFor();assert.equal(await page.getByText(text,{exact:true}).count(),0,'Notes stay with their beach');
 await page.goto(base+'/map?site=bondi');const note=page.locator('.fn-note').filter({hasText:text});await note.getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('button',{name:'Undo removal',exact:true}).waitFor();assert.equal(await page.getByText(text,{exact:true}).count(),0);
 assert.deepEqual(errors,[]);await page.close();
}console.log('BEACH_DETAILS_PASS: desktop/mobile, no categories or creation prompts, exact beach businesses, inline depth, no layer theme control, notes save/reload/isolation/removal.');}finally{await browser.close();}
