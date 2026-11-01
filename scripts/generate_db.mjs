// Compatibility command: the root Clojure project now owns all publication.
import {execFileSync} from 'node:child_process';
if(process.argv.includes('--check'))execFileSync(process.execPath,['scripts/check_generated.mjs'],{stdio:'inherit'});
else {execFileSync('lein',['generate'],{stdio:'inherit'});execFileSync(process.execPath,['scripts/bundle_backbone.mjs'],{stdio:'inherit'});}
