import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

function bootstrap(expected,actual){
 const root=mkdtempSync(join(tmpdir(),'finfolk-bootstrap-pin-'));
 try{
  mkdirSync(join(root,'scripts'));mkdirSync(join(root,'bin'));mkdirSync(join(root,'ref','foundation'),{recursive:true});
  copyFileSync(new URL('../scripts/bootstrap.sh',import.meta.url),join(root,'scripts','bootstrap.sh'));
  writeFileSync(join(root,'project.version'),'FOUNDATION_VERSION=4.1.8\nFOUNDATION_COMMIT='+expected+'\n');
  writeFileSync(join(root,'bin','git'),'#!/usr/bin/env bash\nset -eu\ncase "$1" in\nsubmodule) exit 0 ;;\n-C) printf "%s\\n" "$ACTUAL_COMMIT" ;;\nlfs) touch "$PIN_CHECK_MARKER"; exit 77 ;;\n*) exit 99 ;;\nesac\n',{mode:0o755});
  const marker=join(root,'pin-passed');
  const r=spawnSync('bash',['scripts/bootstrap.sh'],{cwd:root,encoding:'utf8',env:{...process.env,PATH:join(root,'bin')+':'+process.env.PATH,ACTUAL_COMMIT:actual,PIN_CHECK_MARKER:marker}});
  return {status:r.status,stderr:r.stderr,reachedLfs:existsSync(marker)};
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('bootstrap accepts the declared Foundation commit without a hard-coded revision',()=>{
 const r=bootstrap('1'.repeat(40),'1'.repeat(40));assert.equal(r.status,77,r.stderr);assert(r.reachedLfs);
});
test('bootstrap rejects a mismatched Foundation checkout before downloading assets',()=>{
 const r=bootstrap('1'.repeat(40),'2'.repeat(40));assert.equal(r.status,1);assert(!r.reachedLfs);assert.match(r.stderr,/Foundation revision differs/);
});
test('bootstrap rejects a malformed or missing Foundation pin before downloading assets',()=>{
 for(const pin of ['', 'not-a-commit']){const r=bootstrap(pin,'1'.repeat(40));assert.equal(r.status,1);assert(!r.reachedLfs);}
});
