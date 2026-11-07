// Trusted server bridge to the Clojure-authored messaging database protocol.
// application/account come from authorized server configuration, never message text.
const calls={
 receive:'receive_message',claim:'claim_message',complete:'complete_message',
 retry:'retry_message',delivery:'claim_delivery',result:'record_delivery_result',
 history:'ret_messaging_history',reconcile:'reconcile_messaging_work',
};
class StaleMessagingClaim extends Error {}
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const delay=attempt=>Math.min(3600,30*2**Math.min(Math.max(attempt-1,0),7));

export function createMessagingDatabase({db,application,account}){
 if(!db?.query||!db?.transaction||typeof application!=='string'||!application||typeof account!=='string'||!account)
  throw Error('Messaging requires a transactional database and trusted application/account configuration.');
 async function call(operation,args=[],query=(sql,values)=>db.query(sql,values)){
  const values=[application,account,...args];
  const output=await query(`SELECT finfolk_rpc.${calls[operation]}(${values.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,values);
  return (Array.isArray(output)?output:output.rows)[0].value;
 }
 async function retry(receipt){
  return call('retry',[receipt.id,receipt.lease,delay(receipt.attempts)]);
 }
 return {
  receive:envelope=>call('receive',[JSON.stringify(envelope)]),
  history:conversation=>call('history',[conversation]),
  reconcile:()=>call('reconcile'),
  async processNext(handler){
   if(typeof handler!=='function')throw Error('A trusted application handler is required.');
   const work=await call('claim');if(!work)return {status:'idle'};
   try{
    // Model/provider requests run here, outside the completion transaction.
    const answer=await handler({message:work.message,provider:work.provider,senderId:work.senderId,userId:work.userId,
     generation:work.receipt.generation,
     history:()=>call('history',[work.message.conversation_id])});
    if(!object(answer)||!object(answer.result??{})||!(answer.reply==null||typeof answer.reply==='string')||
       !(answer.apply==null||typeof answer.apply==='function'))throw Error('Invalid messaging handler result.');
    const completed=await db.transaction(async query=>{
     // apply is a closure supplied by trusted application code, never executable
     // content from a provider/model. Its writes roll back if completion is stale.
     const applied=answer.apply?await answer.apply(query):undefined;
     if(applied!=null&&!object(applied))throw Error('Application mutations must return a result object.');
     const value=await call('complete',[work.receipt.id,work.receipt.lease,
      JSON.stringify(applied??answer.result??{}),answer.reply??null],query);
     if(!value)throw new StaleMessagingClaim();
     return value;
    });
    return {status:'completed',receipt:completed};
   }catch(error){
    if(error instanceof StaleMessagingClaim)return {status:'stale'};
    const receipt=await retry(work.receipt);
    return {status:receipt?(receipt.attempts>=5?'failed':'retry'):'stale'};
   }
  },
  async deliverNext(adapter){
   if(typeof adapter?.send!=='function')throw Error('A trusted provider adapter is required.');
   const work=await call('delivery');if(!work)return {status:'idle'};
   let outcome;
   try{
    outcome=await adapter.send({provider:work.provider,accountId:work.accountId,
     recipientId:work.recipientId,conversationId:work.conversationId,
     body:work.delivery.body,generation:work.delivery.generation,deadline:work.delivery.deadline,idempotencyKey:work.delivery.id});
   }catch{
    // A thrown timeout/network error cannot establish whether delivery occurred.
    outcome={status:'uncertain'};
   }
   const valid=object(outcome)&&['accepted','retry','failed','uncertain'].includes(outcome.status)&&
    (outcome.status!=='accepted'||typeof outcome.messageId==='string'&&outcome.messageId.length>0);
   if(!valid)outcome={status:'uncertain'};
   const retryAfter=outcome.status==='retry'&&Number.isInteger(outcome.retryAfter)&&outcome.retryAfter>=1&&outcome.retryAfter<=3600
    ?outcome.retryAfter:delay(work.delivery.attempts);
   // Persist outside the send catch. A DB failure must never cause a second send.
   const delivery=await call('result',[work.delivery.id,work.delivery.lease,outcome.status,
    outcome.status==='accepted'?outcome.messageId:null,retryAfter]);
   return delivery?{status:delivery.state,delivery}:{status:'stale'};
  },
 };
}
