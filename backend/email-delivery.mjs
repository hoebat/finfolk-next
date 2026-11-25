// Provider transport only; invitation authorization and delivery state live in PostgreSQL.
export function createEmailDelivery(env={},send=fetch){
 if(!env.MAIL_GATEWAY_URL||!env.MAIL_GATEWAY_TOKEN)return null;
 const endpoint=new URL(env.MAIL_GATEWAY_URL);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.hash||endpoint.search)throw Error('Invalid mail gateway URL.');
 return async ({to,title,url,idempotencyKey},{signal}={})=>{
  const response=await send(endpoint.href,{
   method:'POST',redirect:'error',signal,
   headers:{Authorization:'Bearer '+env.MAIL_GATEWAY_TOKEN,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
   body:JSON.stringify({to,title,url}),
  });
  if(!response.ok)throw Error('Email provider unavailable.');
  const result=await response.json();
  if(typeof result.id!=='string'||!result.id)throw Error('Email provider did not acknowledge delivery.');
  return {id:result.id};
 };
}
