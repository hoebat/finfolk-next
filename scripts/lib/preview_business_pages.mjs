// Source-backed content for the local workbench. No hosted writes or provider calls.
import batch from '../../config/directory-businesses-australia.json' with {type:'json'};
export const australianBusinessPages=batch.records;
const identity=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function host(value){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'')}catch{return null}}
export function seedAustralianBusinessPages(state,records=australianBusinessPages){
 let added=0,skipped=0;
 for(const record of records){
  if(record.publication!=='workbench-only'||record.ownership!=='unclaimed')throw Error('Expected a workbench-only, unclaimed business draft');
  const domain=host(record.document.website),name=identity(record.document.name);
  if(state.pages.some(page=>page.id===record.id||page.research?.key===record.key||identity(page.document?.name)===name||domain&&host(page.document?.website)===domain)){skipped++;continue;}
  state.pages.push({id:record.id,status:'published',owner_id:null,role:null,revision:1,document:structuredClone(record.document),reviewedAt:Date.parse(record.researchedAt+'T00:00:00+11:00'),research:{...record.research,key:record.key,researchedAt:record.researchedAt,publication:'workbench-only'},notes:'Workbench content draft. Official source checked '+record.researchedAt+'. '+record.research.notes,outreach:'Not contacted'});added++;
 }
 return {added,skipped};
}
