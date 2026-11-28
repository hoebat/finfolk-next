// The provider normalizers use ISO milliseconds; native social RPCs use integer
// microseconds. Ordinary conversation never enters the command-bot store.
export function nativeCommandEnvelopes(events){
  return events.filter(event=>event.body.trim().startsWith('/')||event.body.trim().toLowerCase()==='help').map(event=>{
    const sentAt=Date.parse(event.sentAt)*1000,deadline=Date.parse(event.deadline)*1000;
    if(!Number.isSafeInteger(sentAt)||!Number.isSafeInteger(deadline))throw Error('Native timestamp outside safe range');
    return {channel:'message',messageId:event.messageId,conversationId:event.conversationId,
      senderId:event.senderId,body:event.body,sentAt,deadline};
  });
}
