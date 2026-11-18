import assert from 'node:assert/strict';
export async function nativeSiteReviewBrowser({page,origin}){
 await page.goto(origin+'/account/sites');
 const form=page.locator('form.site-editor:visible');await form.getByLabel('Site name',{exact:true}).fill('Browser native site');
 await form.getByLabel('Waterbody',{exact:true}).selectOption('lake');await form.getByLabel('Access method',{exact:true}).selectOption('shore');await form.getByLabel('State / territory',{exact:true}).selectOption('VIC');
 await form.getByLabel('Region',{exact:true}).fill('Example Area');await form.getByLabel('Dive latitude',{exact:true}).fill('-38');await form.getByLabel('Dive longitude',{exact:true}).fill('145');await form.getByLabel('Site source URL',{exact:true}).fill('https://example.test/browser-site');
 await form.getByRole('button',{name:'Submit for review',exact:true}).click();
 const submission=page.locator('article:visible').filter({has:page.getByText('Browser native site',{exact:true})});await submission.getByText('submitted',{exact:true}).waitFor();
 await page.reload();await submission.getByText('submitted',{exact:true}).waitFor();
 await page.goto(origin+'/account/review');
 let row=page.locator('.site-review-row:visible').filter({has:page.getByText('Browser native site',{exact:true})});
 await row.getByRole('button',{name:'Preview record',exact:true}).click();await row.getByLabel('I have reviewed the sources and preview',{exact:true}).check();
 const publication=page.waitForResponse(response=>response.url().endsWith('/v1/native/account')&&response.request().postDataJSON()?.operation==='siteDraftPublish');
 await row.getByRole('button',{name:'Publish',exact:true}).click();const saved=await(await publication).json();assert.ok(saved.site);
 await row.getByText(/published ·/).waitFor();await row.getByRole('button',{name:'Use as new draft',exact:true}).click();
 const editor=page.locator('.site-manager form.site-editor:visible');await editor.getByLabel('Site name',{exact:true}).fill('Browser revised site');await editor.getByRole('button',{name:'Save draft',exact:true}).click();
 row=page.locator('.site-review-row:visible').filter({has:page.getByText('Browser revised site',{exact:true})});await row.getByText(/draft ·/).waitFor();await row.getByLabel('I have reviewed the sources and preview',{exact:true}).check();await row.getByRole('button',{name:'Publish',exact:true}).click();await row.getByText(/published ·/).waitFor();
 const response=await page.request.post(origin+'/v1/native/account',{data:{operation:'siteDetail',values:{id:saved.site}}});assert.equal(response.status(),200);assert.equal((await response.json()).name,'Browser revised site');
 await row.getByRole('button',{name:'Use as new draft',exact:true}).click();await editor.getByLabel('Archive this site when published',{exact:true}).check();await editor.getByRole('button',{name:'Save draft',exact:true}).click();
 const pending=page.locator('.site-review-row:visible').filter({has:page.getByText('Browser revised site',{exact:true})}).filter({has:page.getByRole('button',{name:'Publish',exact:true})});await pending.getByLabel('I have reviewed the sources and preview',{exact:true}).check();await pending.getByRole('button',{name:'Publish',exact:true}).click();await pending.waitFor({state:'detached'});
 assert.equal((await page.request.post(origin+'/v1/native/account',{data:{operation:'siteDetail',values:{id:saved.site}}})).status(),404,'Archiving removes the native public site');
}
