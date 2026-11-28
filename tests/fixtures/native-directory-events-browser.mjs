import assert from 'node:assert/strict';
export async function nativeDirectoryEventsBrowser({browser,page,origin}){
 await page.goto(origin+'/pages/review');
 const search=page.locator('form').filter({has:page.getByRole('button',{name:'Find candidates',exact:true})});
 await search.getByLabel('Region or country',{exact:true}).fill('Sydney');
 await search.getByRole('button',{name:'Find candidates',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Saved 3 new candidates for review.'}).waitFor();
 await page.locator('summary').filter({hasText:'Demo harbour school · candidate'}).waitFor();
 await search.getByLabel('Optional seed name or handle',{exact:true}).fill('provider-failure');
 await search.getByRole('button',{name:'Find candidates',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Search failed; retry discovery.'}).waitFor();
 await page.goto(origin+'/directory?manage=1&create=1&state=NSW&locality=Sydney');
 await page.getByRole('heading',{name:'Groups & outlets',exact:true}).waitFor();
 await page.getByLabel('Name',{exact:true}).fill('Browser native group');
 await page.getByLabel('Website',{exact:true}).fill('https://example.test/native-group');
 await page.getByLabel('Source URLs (separated by commas)',{exact:true}).fill('https://example.test/source');
 await page.getByRole('button',{name:'Submit page for review',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Your page was submitted for review.'}).waitFor();
 await page.getByRole('heading',{name:'Browser native group',exact:true}).waitFor();
 await page.goto(origin+'/pages/review');
 const row=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Browser native group'})});
 await row.locator('summary').click();await row.getByLabel('Publication',{exact:true}).selectOption('published');
 await row.getByRole('button',{name:'Save page',exact:true}).click();
 await row.locator('summary').filter({hasText:'published'}).waitFor();
 await page.goto(origin+'/directory?manage=1');
 const publicLink=page.getByRole('link',{name:'View public page',exact:true});await publicLink.waitFor();
 await publicLink.click();await page.getByRole('heading',{name:'Browser native group',exact:true}).waitFor();
 await page.getByRole('link',{name:'Create event',exact:true}).click();
 await page.getByLabel('Title',{exact:true}).fill('Browser native event');
 await page.getByLabel('Venue / locality',{exact:true}).fill('Local pool');
 const [starts,ends]=await page.evaluate(()=>[48,49].map(hours=>{const date=new Date(Date.now()+hours*3600000);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}));
 await page.getByLabel('Starts (your local timezone)',{exact:true}).fill(starts);await page.getByLabel('Ends (your local timezone)',{exact:true}).fill(ends);
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.waitForURL(url=>/^\/events\/[0-9a-f-]{36}$/.test(url.pathname));
 await page.getByRole('heading',{name:'Browser native event',exact:true}).waitFor();
 await page.getByRole('link',{name:'Edit event',exact:true}).click();
 await page.getByRole('button',{name:'Publish event',exact:true}).click();await page.waitForURL(url=>/^\/events\/[0-9a-f-]{36}$/.test(url.pathname));
 await page.getByRole('heading',{name:'Browser native event',exact:true}).waitFor();
 const url=page.url(),guest=await browser.newPage({serviceWorkers:'block'});
 try{
  await guest.addInitScript(()=>localStorage.setItem('finfolk:welcome','1'));await guest.goto(url);
  await guest.getByRole('heading',{name:'Browser native event',exact:true}).waitFor();
  await guest.getByRole('link',{name:'Sign in to RSVP',exact:true}).waitFor();
  assert.equal(await guest.getByRole('link',{name:'Edit event',exact:true}).count(),0);
 }finally{await guest.close();}
 await page.getByRole('button',{name:'Cancel event',exact:true}).click();
 await page.getByText(/cancelled · public/).waitFor();
 await page.getByRole('link',{name:'Duplicate event',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('Browser delivery event');await page.getByLabel('Visibility',{exact:true}).selectOption('private');await page.getByLabel('Starts (your local timezone)',{exact:true}).fill(starts);await page.getByLabel('Ends (your local timezone)',{exact:true}).fill(ends);
 await page.getByRole('button',{name:'Publish event',exact:true}).click();await page.waitForURL(url=>/^\/events\/[0-9a-f-]{36}$/.test(url.pathname));await page.getByLabel('Invite email',{exact:true}).fill('retry-browser@example.test');await page.getByRole('button',{name:'Email private invitation',exact:true}).click();
 await page.getByText(/Email delivery: failed · 1 attempts/).waitFor();await page.getByRole('button',{name:'Retry email to retry-browser@example.test',exact:true}).click();await page.getByText(/Email delivery: sent · 2 attempts/).waitFor();await page.reload();await page.getByText(/Email delivery: sent · 2 attempts/).waitFor();

}
