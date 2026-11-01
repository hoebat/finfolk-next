import {spawn} from 'node:child_process';
import {connect,migrate} from './harness.mjs';
const db=await connect();
try{
 await migrate(db);await db.query(`INSERT INTO neon_auth."user" VALUES('alice','Alice',true,false),('bob','Bob',false,false),('banned','Banned',true,true);
 INSERT INTO finfolk.members(user_id,profile) VALUES('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}'),('banned','{}');
 INSERT INTO finfolk.beaches(id,name,timezone) VALUES('bondi','Bondi','Australia/Sydney');`);
 await new Promise((resolve,reject)=>{const child=spawn('lein',['test',':with','finfolkdb'],{stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Clojure database facts failed')));});
}finally{await db.end();}
