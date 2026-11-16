// Retired legacy release entrypoint. Keep its target guard, and refuse SQL snapshot replay.
import {readFile} from 'node:fs/promises';
const environment=JSON.parse(await readFile(new URL('../next.environment.json',import.meta.url),'utf8'));
const connectionString=process.env.DATABASE_URL_UNPOOLED;
if(!connectionString)throw Error('DATABASE_URL_UNPOOLED is required for the Next release.');
const target=new URL(connectionString),auth=new URL(environment.authUrl);
const endpoint=auth.hostname.split('.')[0];
if(environment.environment!=='next' || environment.database!=='finfolk_next' || target.pathname!=='/finfolk_next' || target.hostname!==endpoint+'.ap-southeast-2.aws.neon.tech' || endpoint.includes('crimson-queen'))throw Error('Refusing a database outside the isolated Next environment.');
throw Error('Legacy backbone SQL releases are retired. Generate the current finfolkdb schema and use the native cutover/rebuild workflow.');
