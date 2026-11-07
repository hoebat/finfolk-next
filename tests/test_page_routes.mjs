import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyPageRoutes} from '../scripts/verify_page_routes.mjs';
import {pageRoutes} from '../js/finfolk-next/site/web-main/lib/page-routes.generated.js';
test('all real Next pages and handlers have generated coverage and documented exclusions',async()=>{
 const count=await verifyPageRoutes();assert.equal(count,Object.keys(pageRoutes.routes).length);
 assert.equal(pageRoutes.routes['/profiles'].kind,'compatibility');assert.equal(pageRoutes.routes['/offline-app/[screen]'].kind,'internal');assert.equal(pageRoutes.routes['/api/location'].kind,'resource');
 assert.equal(pageRoutes.offlineTemplates['/account/privacy'],'account');assert.equal(pageRoutes.offlineDynamicTemplates['/reports/:id'],'report');
});
test('a new source route cannot silently bypass the generation/build coverage gate',async()=>{
 const root=await mkdtemp(join(tmpdir(),'finfolk-route-test-'));
 try{
  await mkdir(join(root,'(group)','one'),{recursive:true});await writeFile(join(root,'(group)','one','page.jsx'),'export default function Page(){}');
  const manifest={routes:{'/one':{source:'(group)/one/page.jsx',type:'page',kind:'screen'}},offlineTemplates:{},offlineStaticRoutes:['/one'],offlineDynamicTemplates:{},legacyRedirects:[]};
  assert.equal(await verifyPageRoutes(root,manifest),1);
  await mkdir(join(root,'two'));await writeFile(join(root,'two','page.jsx'),'export default function Page(){}');
  await assert.rejects(()=>verifyPageRoutes(root,manifest),/inventory differs/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('generated coverage rejects absent offline policies and unresolved aliases',async()=>{
 const copy=structuredClone(pageRoutes);delete copy.offlineTemplates['/directory'];
 await assert.rejects(()=>verifyPageRoutes(undefined,copy),/no offline policy/);
 const aliases=structuredClone(pageRoutes);aliases.legacyRedirects.push({destination:'/missing'});
 await assert.rejects(()=>verifyPageRoutes(undefined,aliases),/Alias destination/);
});
