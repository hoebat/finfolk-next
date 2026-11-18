// Browser smoke check against a running local Next server; no fixture writes.
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function discoverRoutes(app=resolve(root,'js/finfolk-next/site/web-main/app')){
 const routes=[],skipped=[];
 for(const file of await readdir(app,{recursive:true})){
  if(!/(^|\/)page\.(jsx?|tsx?)$/.test(file))continue;
  const parts=dirname(file).split(sep).filter(p=>p!=='.'&&!/^\(.*\)$/.test(p));
  const route='/'+parts.join('/');
  if(parts.some(p=>p.startsWith('['))){skipped.push(route);continue;}
  if(parts.some(p=>p.startsWith('_')||p.startsWith('@')))continue;
  routes.push(route);
 }
 return {routes:[...new Set(routes)].sort(),skipped:skipped.sort()};
}
export async function inspectPage(browser,url,{settleMs=1500,timeout=20000,storageState}={}){
 const context=await browser.newContext({serviceWorkers:'block',storageState});
 const page=await context.newPage(),issues=[];
 const flag=(kind,message)=>issues.push({kind,message});
 page.on('pageerror',error=>flag('exception',error.message));
 page.on('console',message=>{if(message.type()==='error')flag('console',message.text());});
 page.on('response',response=>{if(new URL(response.url()).origin===new URL(url).origin&&response.status()>=400)flag('http',response.status()+' '+response.url());});
 page.on('requestfailed',request=>{const reason=request.failure()?.errorText||'Request failed';if(!reason.includes('ERR_ABORTED'))flag('request',request.url()+' '+reason);});
 try{
  await page.goto(url,{waitUntil:'load',timeout});
  await page.waitForTimeout(settleMs);
  const body=await page.locator('body').innerText({timeout:3000});
  if(!body.trim())flag('render','Empty page');
  if(await page.getByRole('heading',{name:/^(Could not load this page|Application error|Internal Server Error|This page could not be found)/i}).count())flag('render','Error screen displayed');
  if(await page.locator('nextjs-portal').evaluateAll(nodes=>nodes.some(n=>n.shadowRoot?.querySelector('[data-nextjs-dialog]'))))flag('render','Next.js error overlay displayed');
 }catch(error){flag('navigation',error.message);}
 return {page,context,result:{url,finalURL:page.url(),issues:[...new Map(issues.map(issue=>[JSON.stringify(issue),issue])).values()]}};
}
export async function main(paths=process.argv.slice(2),options={}){
 const base=options.base||process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3010';
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw Error('A local NEXTJS_TEST_URL is required');
 const discovered=await discoverRoutes(),routes=paths.length?paths:discovered.routes;
 const directory=resolve(root,'.cache/page-health');await mkdir(directory,{recursive:true});
 const browser=await chromium.launch(),results=[];
 try{
  for(const [index,route]of routes.entries()){
   const url=new URL(route,base);if(url.origin!==new URL(base).origin)throw Error('Routes must stay on the local server');
   const {page,context,result}=await inspectPage(browser,url.href,{storageState:process.env.PAGE_HEALTH_STORAGE_STATE});
   if(result.issues.length){
    const screenshot=resolve(directory,`failure-${index}.png`);
    try{await page.screenshot({path:screenshot,fullPage:true,timeout:5000});result.screenshot=relative(root,screenshot);}catch{}
   }
   results.push(result);console.log(`${result.issues.length?'FAIL':'PASS'} ${route}`);
   for(const issue of result.issues)console.log(`  ${issue.kind}: ${issue.message.replace(/\s+/g,' ').slice(0,350)}`);
   await context.close();
  }
 }finally{await browser.close();}
 const report={checkedAt:new Date().toISOString(),base,mode:process.env.PAGE_HEALTH_STORAGE_STATE?'saved-session':'guest',skippedDynamicRoutes:paths.length?[]:discovered.skipped,results};
 await writeFile(resolve(directory,'latest.json'),JSON.stringify(report,null,2)+'\n');
 const failed=results.filter(result=>result.issues.length).length;
 console.log(`${results.length-failed}/${results.length} pages passed. Report: .cache/page-health/latest.json`);
 if(report.skippedDynamicRoutes.length)console.log('Supply concrete URLs for dynamic routes: '+report.skippedDynamicRoutes.join(', '));
 if(failed)process.exitCode=1;
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),options={};
 if(args[0]==='--base'){
  args.shift();options.base=args.shift();
  if(!options.base)throw Error('--base requires a local server URL');
 }
 await main(args,options);
}
