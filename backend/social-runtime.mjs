// Typed orchestration only: PostgreSQL owns commands, policy, linking and all work state.
import {createNativeRPC} from './native-rpc.mjs';
import {openSocialReply, prepareSocialMaterial} from './social-crypto.mjs';

export async function createSocialRuntime({db, application, inbox, provider, cryptoKey}) {
  const call = createNativeRPC((...args) => db.query(...args));
  const scope = await call('ret_social_adapter_scope', [application, inbox]);
  if (scope.provider !== provider) throw Error('Adapter does not match the configured inbox provider');
  async function invoke(name, args = [], actor = null) {
    const operation = await call('new_social_operation', [actor]);
    return call(name, [application, inbox, ...args, operation]);
  }
  const completeAction = (work, outcome, result) => invoke('complete_social_action',
    [work.id, work.lease, outcome, {...result, binding: work.binding}]);
  const completeDelivery = (work, result) => invoke('complete_social_delivery',
    [work.id, work.lease, result.status, result.messageId ?? null, result.retryAfter ?? null]);
  return {
    scope,
    memberStatus: member=>call('ret_social_member_connection',[application,inbox,member]),
    receive: envelope => invoke('receive_social_event', [envelope]),
    processNext: () => invoke('process_social_event'),
    reconcile: () => invoke('reconcile_social_work'),
    async cleanup() {
      return {content:await invoke('scrub_social_content'),diagnostics:await invoke('purge_social_diagnostics')};
    },
    redeem: (member, code) => invoke('redeem_social_connection', [member, code], member),
    async redeemVerified(member,code,ipHash,adapter) {
      const snapshot=await invoke('prepare_social_redemption',[member,code,ipHash],member);
      if(!snapshot||snapshot.error||snapshot.replayed)return snapshot;
      const evidence=await adapter.verifyAccount({provider:snapshot.provider,namespace:snapshot.namespace,externalId:snapshot.externalId,
        conversationId:snapshot.conversationId},{includeHandle:true});
      return invoke('complete_social_redemption',[member,code,snapshot,evidence],member);
    },
    async claimPageVerified(member,id,code,ipHash,adapter) {
      const snapshot=await invoke('prepare_social_page_claim',[member,id,code,ipHash],member);
      if(!snapshot||snapshot.error)return snapshot;
      const evidence=await adapter.verifyAccount({provider:snapshot.provider,namespace:snapshot.namespace,externalId:snapshot.externalId,
        conversationId:snapshot.conversationId},{includeHandle:true});
      return invoke('complete_social_page_claim',[member,id,code,snapshot,evidence],member);
    },
    disconnect: (member, connection, version) => invoke('disconnect_social_connection',
      [member, connection, version, null], member),
    async performNextAction(adapter) {
      const work = await invoke('claim_social_action');
      if (!work) return null;
      let result;
      try {
        switch (work.kind) {
          case 'verify-account': result = await adapter.verifyAccount(work.request); break;
          case 'prepare-link': result = await prepareSocialMaterial(work.request, work.binding, cryptoKey); break;
          default: throw Error('Unsupported external effect');
        }
      } catch {
        return completeAction(work, 'retry', {});
      }
      // A failed completion never reruns an effect or writes an alternate result.
      return completeAction(work, 'success', result);
    },
    async deliverNext(adapter) {
      const work = await invoke('claim_social_delivery');
      if (!work) return null;
      let body = work.payload.body;
      try {
        if (work.payload.ciphertext !== null)
          body = await openSocialReply(work.payload.ciphertext, work.payload.cipherContext, cryptoKey);
      } catch {
        return completeDelivery(work, {status: 'failed'});
      }
      let evidence={};
      if(work.verification){
        try {evidence=await adapter.verifyAccount(work.verification);}
        catch {return completeDelivery(work,{status:'retry',retryAfter:30});}
      }
      // This is a separate committed RPC, after the external lookup. It checks
      // the lease, rollout, identity and proof again. No send occurs on denial.
      if(!await call('confirm_social_delivery',[application,inbox,work.id,work.lease,evidence]))
        return completeDelivery(work,{status:'failed'});
      let result;
      try {
        result = await adapter.send({idempotencyKey: work.id, provider: work.provider,
          accountId: work.accountId, destination: work.destination, body, deadline: work.deadline,generation:work.generation});
        if (!result || !['accepted', 'retry', 'failed', 'uncertain'].includes(result.status) ||
            result.status === 'accepted' && (typeof result.messageId !== 'string' || !result.messageId))
          result = {status: 'uncertain'};
      } catch {
        result = {status: 'uncertain'};
      }
      // Persistence failures propagate; they must never trigger a second send.
      return completeDelivery(work, result);
    },
  };
}
