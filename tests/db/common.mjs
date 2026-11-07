import {spawn} from 'node:child_process';
import {connect} from './harness.mjs';
import {installEntities} from './fixtures/entities.mjs';

// The common namespaces describe the fresh entity schema. Legacy migration
// fixtures use different table/function names and must run in their own suite.
const db=await connect();
try {
 await installEntities(db);
 await new Promise((resolve,reject)=>{
  const child=spawn('lein',['run','-m','finfolkdb.test','--common-contracts'],{stdio:'inherit',env:process.env});
  child.on('error',reject);
  child.on('exit',code=>code===0?resolve():reject(Error('Common namespace database facts failed ('+code+')')));
 });
} finally {await db.end();}
