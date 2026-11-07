// Administrative Neon sessions over HTTPS/WebSockets, retaining transaction state.
// Application traffic continues to use its existing driver and bindings.
import pg from 'pg';
import {Client} from '@neondatabase/serverless';
export async function connectCloudDatabase(connectionString){
 const url=new URL(connectionString);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname.endsWith('.neon.tech'))throw Error('Expected an explicit Neon database endpoint');
 const transport=process.env.FINFOLK_CLOUD_TRANSPORT||'websocket';
 if(!['tcp','websocket'].includes(transport))throw Error('Use tcp or websocket for the cloud database transport');
 const db=transport==='tcp'?new pg.Client({connectionString,connectionTimeoutMillis:15000}):new Client({connectionString,connectionTimeoutMillis:15000});
 await db.connect();return db;
}
