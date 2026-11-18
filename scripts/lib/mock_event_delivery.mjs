// Explicit local provider fixture. No mail is sent outside the process.
export function createMockEventDelivery(){
 const sent=new Map(),attempts=new Map();
 const provider=async message=>{
  const count=(attempts.get(message.idempotencyKey)||0)+1;attempts.set(message.idempotencyKey,count);
  if(message.to.includes('always-fail')||(message.to.includes('retry-')&&count===1))throw Error('Synthetic delivery failure');
  if(!sent.has(message.idempotencyKey))sent.set(message.idempotencyKey,{...message,id:'local-preview-'+message.idempotencyKey});
  return {id:sent.get(message.idempotencyKey).id};
 };
 return Object.assign(provider,{sent,attempts});
}
export const mockEventDelivery=createMockEventDelivery();
