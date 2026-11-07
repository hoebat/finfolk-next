// Explicit operator command; preview does not open a database connection.
import {readFile} from 'node:fs/promises';
import {database} from '../backend/db.mjs';
import {validateBundle,importBundle} from '../backend/environment-imports.mjs';
const [mode,file]=process.argv.slice(2);if(!['preview','publish'].includes(mode)||!file)throw Error('Usage: environment_import.mjs preview|publish bundle.json');
const b=validateBundle(JSON.parse(await readFile(file,'utf8')));
if(mode==='preview')console.log(JSON.stringify(b,null,2));
else{if(!process.env.DATABASE_URL_UNPOOLED)throw Error('DATABASE_URL_UNPOOLED required');const db=database(process.env.DATABASE_URL_UNPOOLED);try{console.log(await importBundle(db,b));}finally{await db.pool.end();}}
