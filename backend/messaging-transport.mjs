import {readLimited} from './messaging-http.mjs';

// Provider-independent HTTP boundary. messaging is already bound to a trusted
// application/account; neither URLs nor payloads may choose those scope values.
export function createMessagingWebhook({messaging,verify,normalize,wake=async()=>{},maximumBytes=262144}){
 if(typeof messaging?.receive!=='function'||typeof verify!=='function'||typeof normalize!=='function')
  throw Error('A configured messaging runtime and provider verifier/normalizer are required.');
 return async request=>{
  if(request.method!=='POST')return new Response('',{status:405,headers:{Allow:'POST'}});
  let raw;
  try{raw=await readLimited(request,maximumBytes);}catch(error){return new Response('',{status:error.status===413?413:400});}
  if(!await verify(request,raw))return new Response('',{status:403});
  let envelopes;
  try{
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   envelopes=await normalize(body);
   if(!Array.isArray(envelopes))throw Error('Expected normalized messages');
  }catch{return new Response('',{status:400});}
  const receipts=[];
  try{
   // Repeated provider batches are safe even if a later receipt temporarily fails:
   // retries replay the earlier items through database deduplication.
   for(const envelope of envelopes)receipts.push(await messaging.receive(envelope));
  }catch{return new Response('',{status:503});}
  if(receipts.some(receipt=>!receipt.duplicate)){
   try{await wake();}catch{/* Durable receipts remain recoverable by reconciliation. */}
  }
  return new Response('Accepted',{status:200});
 };
}
