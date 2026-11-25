// Install only the publications emitted by app.manage's database-sql target.
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {citext} from '@electric-sql/pglite/contrib/citext';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {uuid_ossp} from '@electric-sql/pglite/contrib/uuid_ossp';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
export async function nativeSQLFixture(){
 const db=new PGlite({extensions:{citext,pgcrypto,uuid_ossp}});
 try{
  for(const name of ['entity-schema.sql','account-grants.sql'])await db.exec(await readFile(new URL('../../resources/finfolkdb/'+name,import.meta.url),'utf8'));
  const query=async(sql,values)=>(await db.query(sql,values)).rows;
  return {db,query,rpc:createNativeRPC(query)};
 }catch(error){await db.close();throw error;}
}
