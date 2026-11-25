import {ids,nativeTime} from './ids.mjs';
import {readFile} from 'node:fs/promises';
export async function installEntities(db){
 await db.query(await readFile('resources/finfolkdb/entity-schema.sql','utf8'));
}
export async function operation(db,tag,user=null){
 return (await db.query('SELECT finfolk.op_fn($1,$2,$3::jsonb) AS value',[tag,user,'{}'])).rows[0].value;
}
export async function user(db,id,profile={}){
 await db.query('SELECT finfolk_rpc.sync_account_identity($1,true)',[id]);
 if(Object.keys(profile).length)await db.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,true)',[id,JSON.stringify(profile)]);
 return (await db.query('SELECT finfolk_rpc.ret_account($1) AS value',[id])).rows[0].value;
}
export async function listing(db,document){
 return (await db.query('SELECT finfolk_rpc.insert_directory_listing($1::jsonb,$2::jsonb) AS value',[JSON.stringify(document),JSON.stringify(await operation(db,'create-listing'))])).rows[0].value;
}
export async function event(db,page,document={title:'Practice',capacity:2},visibility='public',starts='2026-11-10T01:00:00Z',ends='2026-11-10T02:00:00Z'){
 return (await db.query('SELECT finfolk_rpc.insert_event($1,$2::jsonb,$3,$4,$5,$6,$7::jsonb) AS value',[page,JSON.stringify(document),visibility,nativeTime(starts),nativeTime(ends),'Australia/Sydney',JSON.stringify(await operation(db,'create-event'))])).rows[0].value;
}
export async function diveSession(db,owner=ids.alice,beach=ids.bondi,data={date:'2026-11-04',visibility:'public',photos:['PRIVATE_PHOTO'],notes:'PRIVATE_SESSION_NOTE'}){
 return (await db.query('SELECT finfolk_rpc.insert_dive_session($1,$2,$3::jsonb,$4::jsonb) AS value',[owner,beach,JSON.stringify(data),JSON.stringify(await operation(db,'create-session',owner))])).rows[0].value;
}
export async function socialPost(db,owner=ids.alice,url='https://www.instagram.com/p/TEST',consent=false){
 return (await db.query('SELECT finfolk_rpc.insert_social_post($1,$2,$3,$4,$5,$6,$7::jsonb) AS value',[owner,ids.bondi,url,'instagram','ocean',consent,JSON.stringify(await operation(db,'create-post',owner))])).rows[0].value;
}
export async function trip(db,owner=ids.alice,draft={title:'Dive trip',authorName:'Alice',beachId:ids.bondi,start:'2026-11-01',end:'2026-11-10',story:'PRIVATE_TRIP_NOTE',links:[]}){
 return (await db.query('SELECT finfolk_rpc.insert_trip($1,$2::jsonb,$3::jsonb) AS value',[owner,JSON.stringify(draft),JSON.stringify(await operation(db,'create-trip',owner))])).rows[0].value;
}
export async function beginImport(db,id,count,owner=ids.alice){
 return (await db.query('SELECT finfolk_rpc.insert_trip_import($1,$2,$3,$4::jsonb) AS value',[id,owner,count,JSON.stringify(await operation(db,'begin-import',owner))])).rows[0].value;
}
export async function batch(db,tripId,importId,index,rows,owner=ids.alice){
 return (await db.query('SELECT finfolk_rpc.save_trip_import_batch($1,$2,$3,$4,$5::jsonb,$6::jsonb) AS value',[tripId,owner,importId,index,JSON.stringify(rows),JSON.stringify(await operation(db,'import-batch',owner))])).rows[0].value;
}
export async function completeImport(db,tripId,importId,revision,fingerprint='a'.repeat(64),replace=false,duplicates=false,owner=ids.alice){
 return (await db.query('SELECT finfolk_rpc.complete_trip_import($1,$2,$3,$4,$5,$6,$7,$8::jsonb) AS value',[tripId,owner,importId,revision,fingerprint,replace,duplicates,JSON.stringify(await operation(db,'complete-import',owner))])).rows[0].value;
}
export async function publishTrip(db,id,snapshot,revision,{owner=ids.alice,consent=true,ownPosts=true,approved=false}={}){
 return (await db.query('SELECT finfolk_rpc.set_trip_publication($1,$2,$3::jsonb,$4,$5,$6,$7,$8::jsonb) AS value',[id,owner,JSON.stringify(snapshot),revision,consent,ownPosts,approved,JSON.stringify(await operation(db,'publish-trip',owner))])).rows[0].value;
}
export async function reviewTrip(db,id,decision,token,ownership=true,beach=true){
 return (await db.query('SELECT finfolk_rpc.review_trip_publication($1,$2,$3,$4,$5,$6::jsonb) AS value',[id,decision,token,ownership,beach,JSON.stringify(await operation(db,'review-trip',ids.admin))])).rows[0].value;
}
export async function withdrawTrip(db,id,owner=ids.alice){
 return (await db.query('SELECT finfolk_rpc.withdraw_trip_publication($1,$2,$3::jsonb) AS value',[id,owner,JSON.stringify(await operation(db,'unpublish-trip',owner))])).rows[0].value;
}
