// Registry entries and command implementations are trusted application code.
// Incoming text chooses only explicitly registered commands, never executable SQL.
export function createFinFolkMessagingHandler({commands={},authorizePersonal=async()=>null,helpText}={}){
 for(const [name,handler]of Object.entries(commands)){
  if(!/^[a-z][a-z0-9_-]*$/.test(name)||['help','ping'].includes(name)||typeof handler!=='function')throw Error('Invalid FinFolk command registration.');
 }
 const help=helpText||'Welcome to FinFolk. Use /ping to check the connection or /help for guidance.';
 return async context=>{
  const match=context.message.body.trim().match(/^\/([a-z][a-z0-9_-]*)(?:\s+([\s\S]*))?$/i);
  const name=match?.[1].toLowerCase(),args=match?.[2]||'';
  if(name==='ping')return {result:{command:'ping'},reply:'Pong.'};
  if(name==='help')return {result:{command:'help'},reply:help};
  if(!name||!Object.hasOwn(commands,name))return {result:{command:'unknown'},reply:'Use /help to see how to message FinFolk.'};
  const identity=await authorizePersonal(context);
  if(!identity||typeof identity.userId!=='string'||!identity.userId||identity.verified!==true||identity.active!==true||identity.eligible!==true)
   return {result:{command:name,authorized:false},reply:'Connect and verify your account before using this command.'};
  return commands[name]({args,userId:identity.userId,context});
 };
}

// FinFolk-specific identity rules remain outside the generic messaging protocol.
// The social-provider callback must enforce the channel's current eligibility
// policy (including Instagram follow requirements), using trusted credentials.
export function createFinFolkMessagingIdentityPolicy({db,verifyProviderEligibility=async()=>false}){
 return async context=>{
  const external=context.provider!=='app';
  let userId=context.senderId;
  if(external){
   const value=await db.query(`SELECT user_id FROM finfolk."MessagingIdentity" WHERE account_id=$1 AND external_id=$2`,[context.account,context.senderId]);
   userId=(Array.isArray(value)?value:value.rows)[0]?.user_id;
  }
  if(!userId)return null;
  const output=await db.query(`SELECT u.id FROM finfolk."User" u JOIN neon_auth."user" a ON a.id::text=u.id
   WHERE u.id=$1 AND NOT u.deleted AND coalesce(a.banned,false)=false AND a."emailVerified"=true`,[userId]);
  if(!(Array.isArray(output)?output:output.rows).length)return null;
  const eligible=external?await verifyProviderEligibility({...context,userId})===true:true;
  return {userId,active:true,verified:true,eligible};
 };
}
