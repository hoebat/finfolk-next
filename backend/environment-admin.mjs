import {isInstagramAdmin} from './instagram-actions.mjs';
import {validateBundle,importBundle,assignEnvironmentLinks,coverageCandidates} from './environment-imports.mjs';
export function registerEnvironmentAdmin(app,{db}){
 const admin=c=>{const who=c.get('messagingIdentity');if(!who?.verified||!isInstagramAdmin(who.uid,c.env||{}))throw Object.assign(Error('Administrator access required.'),{status:403});return who.uid;};
 const body=async c=>{const raw=await c.req.text();if(raw.length>2*1024*1024)throw Object.assign(Error('Import too large.'),{status:413});try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}};
 app.post('/v1/admin/environment/imports/preview',async c=>{admin(c);try{const bundle=validateBundle(await body(c));const sites=bundle.datasets?.length?(await db.query("SELECT payload FROM finfolk.site_profiles WHERE status='published'")).map(r=>r.payload):[];return c.json({bundle,candidates:coverageCandidates(sites,bundle.datasets||[])});}catch(e){e.status=e.status||400;throw e;}});
 app.post('/v1/admin/environment/imports/publish',async c=>{admin(c);const b=await body(c);if(b.confirmed!==true)throw Object.assign(Error('Review and confirm the bundle.'),{status:400});return c.json(await importBundle(db,b.bundle));});
 app.post('/v1/admin/environment/site-links/:id',async c=>{const reviewer=admin(c),b=await body(c);await db.transaction(async q=>{const r=(await q('SELECT version FROM finfolk.site_revisions WHERE id=$1 FOR UPDATE',[c.req.param('id')]))[0];if(!r||String(r.version)!==String(b.version))throw Object.assign(Error('Site revision changed.'),{status:409});await assignEnvironmentLinks(q,c.req.param('id'),{...b,evidence:{...b.evidence,reviewer}});});return c.json({ok:true});});
}
