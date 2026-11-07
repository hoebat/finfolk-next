import {randomUUID} from 'node:crypto';
import {isInstagramAdmin} from './instagram-actions.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status,code:'finnies_error'});};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const total=async(q,user)=>{const value=Number((await q('SELECT coalesce(sum(amount),0)::text AS balance FROM finfolk_shop.finnie_entries WHERE user_id=$1',[user]))[0].balance);if(!Number.isSafeInteger(value))fail(503,'Your Finnies balance needs review.');return value;};
async function account(q,user){
 await q('INSERT INTO finfolk_shop.finnie_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING',[user]);
 const row=(await q('SELECT * FROM finfolk_shop.finnie_accounts WHERE user_id=$1 FOR UPDATE',[user]))[0];
 const tables=(await q(`SELECT to_regclass('finfolk.points_ledger') IS NOT NULL AS legacy,to_regclass('finfolk."UserPointsEntry"') IS NOT NULL AS native`))[0];
 let earned=0;
 if(tables.legacy)earned=Number((await q(`SELECT ((SELECT coalesce(sum(points),0) FROM finfolk.points_ledger WHERE user_id=$1 AND NOT reversed)+(SELECT count(*) FROM finfolk.invitation_joins WHERE inviter_id=$1 AND rewarded_at IS NOT NULL))::text AS earned`,[user]))[0].earned);
 else if(tables.native)earned=Number((await q(`SELECT ((SELECT coalesce(sum(points),0) FROM finfolk."UserPointsEntry" WHERE user_id=$1 AND NOT reversed)+(SELECT count(*) FROM finfolk."UserInvitationJoin" WHERE inviter_id=$1 AND rewarded_at IS NOT NULL))::text AS earned`,[user]))[0].earned);
 if(!Number.isSafeInteger(earned))fail(503,'Your earned Finnies need review.');
 const delta=earned-Number(row.imported_points);
 if(delta){await q('INSERT INTO finfolk_shop.finnie_entries(user_id,amount,reference,reason) VALUES($1,$2,$3,$4)',[user,delta,'earned-sync:'+randomUUID(),'Participation and verified referrals']);await q('UPDATE finfolk_shop.finnie_accounts SET imported_points=$2 WHERE user_id=$1',[user,earned]);}
 return row;
}
export function finniesService(db){return {
 catalogue:()=>db.query('SELECT id,title,outlet,description,instructions,cost,stock,expires_at FROM finfolk_shop.finnie_items WHERE active AND (expires_at IS NULL OR expires_at>now()) ORDER BY updated_at DESC,id'),
 wallet:user=>db.transaction(async q=>{await account(q,user);return {balance:Math.max(0,await total(q,user)),redemptions:await q('SELECT id,code,cost,item_snapshot AS item,status,created_at,completed_at FROM finfolk_shop.finnie_redemptions WHERE user_id=$1 ORDER BY created_at DESC,id',[user])};}),
 redeem:(user,item,key,expectedCost)=>db.transaction(async q=>{
  if(!uuid(item)||!uuid(key)||!Number.isSafeInteger(expectedCost)||expectedCost<1)fail(400,'Choose an item and provide a valid redemption key.');
  item=item.toLowerCase();key=key.toLowerCase();
  await account(q,user);
  const old=(await q('SELECT * FROM finfolk_shop.finnie_redemptions WHERE user_id=$1 AND request_key=$2',[user,key]))[0];
  if(old){if(old.item_id!==item)fail(409,'This redemption key belongs to another item.');return old;}
  const offer=(await q('SELECT * FROM finfolk_shop.finnie_items WHERE id=$1 AND active AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE',[item]))[0];
  if(!offer)fail(409,'This item is no longer available.');
  if(offer.cost!==expectedCost)fail(409,'The Finnies price has changed. Refresh the shop before redeeming.');
  if(offer.stock===0)fail(409,'This item has sold out.');
  if(await total(q,user)<offer.cost)fail(409,'You do not have enough Finnies for this item.');
  const id=randomUUID(),snapshot={title:offer.title,outlet:offer.outlet,instructions:offer.instructions,description:offer.description};
  const redemption=(await q('INSERT INTO finfolk_shop.finnie_redemptions(id,user_id,item_id,request_key,cost,item_snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING *',[id,user,item,key,offer.cost,JSON.stringify(snapshot)]))[0];
  await q('INSERT INTO finfolk_shop.finnie_entries(user_id,amount,reference,reason) VALUES($1,$2,$3,$4)',[user,-offer.cost,'redemption:'+id,'Redeemed '+offer.title]);
  await q('UPDATE finfolk_shop.finnie_items SET stock=stock-1,revision=revision+1 WHERE id=$1 AND stock IS NOT NULL',[item]);
  return redemption;
 }),
 grant:(user,amount,key,reason)=>db.transaction(async q=>{
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000||!uuid(key)||!text(reason,500))fail(400,'Provide a positive Finnies amount, a reference and a reason.');
  key=key.toLowerCase();
  await account(q,user);
  const reference='grant:'+key,existing=(await q('SELECT amount,reason FROM finfolk_shop.finnie_entries WHERE user_id=$1 AND reference=$2',[user,reference]))[0];
  if(existing){if(Number(existing.amount)!==amount||existing.reason!==text(reason,500))fail(409,'This award reference has already been used.');}
  else await q('INSERT INTO finfolk_shop.finnie_entries(user_id,amount,reference,reason) VALUES($1,$2,$3,$4)',[user,amount,reference,text(reason,500)]);
  return {balance:await total(q,user)};
 }),
 save:async value=>{
  const id=value.id||randomUUID(),title=text(value.title,160),outlet=text(value.outlet,160),cost=value.cost,stock=value.stock??null;
  if(!uuid(id)||!title||!outlet||!Number.isSafeInteger(cost)||cost<1||cost>1000000||(stock!==null&&(!Number.isSafeInteger(stock)||stock<0||stock>2147483647)))fail(400,'Provide an item, outlet, positive Finnies price and valid stock.');
  if(value.active===true&&!text(value.instructions,4000))fail(400,'Add fulfilment instructions before publishing.');
  const expires=value.expiresAt||null;if(expires&&!Number.isFinite(Date.parse(expires)))fail(400,'Provide a valid expiry date.');
  const saved=(await db.query('INSERT INTO finfolk_shop.finnie_items(id,title,outlet,description,instructions,cost,stock,active,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET title=excluded.title,outlet=excluded.outlet,description=excluded.description,instructions=excluded.instructions,cost=excluded.cost,stock=excluded.stock,active=excluded.active,expires_at=excluded.expires_at,updated_at=now(),revision=finnie_items.revision+1 WHERE finnie_items.revision=$10 RETURNING *',[id,title,outlet,text(value.description,4000),text(value.instructions,4000),cost,stock,value.active===true,expires,value.revision||0]))[0];
  if(!saved)fail(409,'This reward has changed. Reload it before saving.');return saved;
 },
 complete:(code,refund=false)=>db.transaction(async q=>{
  if(!uuid(code))fail(400,'Enter a valid claim code.');
  const found=(await q('SELECT user_id FROM finfolk_shop.finnie_redemptions WHERE code=$1',[code]))[0];if(!found)fail(404,'Claim not found.');
  await account(q,found.user_id);
  const row=(await q('SELECT * FROM finfolk_shop.finnie_redemptions WHERE code=$1 FOR UPDATE',[code]))[0];
  const status=refund?'refunded':'fulfilled';
  if(row.status===status)return row;
  if(row.status!=='claimed')fail(409,'This claim has already been completed.');
  if(refund){
   await q('INSERT INTO finfolk_shop.finnie_entries(user_id,amount,reference,reason) VALUES($1,$2,$3,$4)',[row.user_id,row.cost,'refund:'+row.id,'Refunded '+row.item_snapshot.title]);
   await q('UPDATE finfolk_shop.finnie_items SET stock=stock+1,revision=revision+1 WHERE id=$1 AND stock IS NOT NULL',[row.item_id]);
  }
  return (await q('UPDATE finfolk_shop.finnie_redemptions SET status=$2,completed_at=now() WHERE id=$1 RETURNING *',[row.id,status]))[0];
 })
};}
export function registerFinniesPublic(app,{db}){const service=finniesService(db);app.get('/shop/items',async c=>{c.header('Cache-Control','no-store');return c.json({items:await service.catalogue()});});}
export function registerFinniesPrivate(app,{db}){
 const service=finniesService(db);
 const who=c=>{const user=c.get('messagingIdentity');if(!user?.verified)fail(403,'Verify your email to use Finnies.');return user.uid;};
 const admin=c=>{const uid=who(c);if(!isInstagramAdmin(uid,c.env||{}))fail(403,'Administrator access required.');return uid;};
 const body=async c=>{const raw=await c.req.text();if(raw.length>16000)fail(413,'Request too large.');try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Invalid request.');return value;}catch{fail(400,'Invalid request.');}};
 app.get('/v1/me/finnies',async c=>c.json({data:await service.wallet(who(c))}));
 app.post('/v1/me/finnies/redeem',async c=>{const uid=who(c),value=await body(c);return c.json({data:await service.redeem(uid,value.itemId,value.requestKey,value.expectedCost)});});
 app.get('/v1/admin/finnies',async c=>{admin(c);return c.json({data:{items:await db.query('SELECT * FROM finfolk_shop.finnie_items ORDER BY updated_at DESC')}});});
 app.post('/v1/admin/finnies/items',async c=>{admin(c);return c.json({data:await service.save(await body(c))});});
 app.post('/v1/admin/finnies/grant',async c=>{admin(c);const v=await body(c);if(typeof v.userId!=='string'||!v.userId.trim())fail(400,'Choose a member.');if(!(await db.query('SELECT id FROM neon_auth."user" WHERE id::text=$1 AND NOT coalesce(banned,false)',[v.userId]))[0])fail(404,'Member not found.');return c.json({data:await service.grant(v.userId,v.amount,v.requestKey,v.reason)});});
 app.post('/v1/admin/finnies/complete',async c=>{admin(c);const v=await body(c);return c.json({data:await service.complete(v.code,v.refund===true)});});
}

export async function eraseFinnies(q,user){
 if(!(await q("SELECT to_regclass('finfolk_shop.finnie_accounts') IS NOT NULL AS installed"))[0].installed)return;
 await q('SELECT user_id FROM finfolk_shop.finnie_accounts WHERE user_id=$1 FOR UPDATE',[user]);
 await q(`UPDATE finfolk_shop.finnie_items i SET stock=i.stock+r.quantity,revision=i.revision+1 FROM (SELECT item_id,count(*)::integer AS quantity FROM finfolk_shop.finnie_redemptions WHERE user_id=$1 AND status='claimed' GROUP BY item_id) r WHERE i.id=r.item_id AND i.stock IS NOT NULL`,[user]);
 for(const table of ['finnie_entries','finnie_redemptions','finnie_accounts'])await q('DELETE FROM finfolk_shop.'+table+' WHERE user_id=$1',[user]);
}
