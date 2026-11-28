'use client';
import {useRef,useState} from 'react';
import {pageAuthActions} from '../../../lib/page-models.js';
import {useLogbookAction} from '../logbook/tools.jsx';
import AuthShell from './auth-shell.jsx';
export default function PasswordRecovery({session,token=null}){
 const form=useRef(null),[saved,setSaved]=useState(false),{run,busy,message}=useLogbookAction(session,{formatError:error=>error.message||'Please try again.'});
 return <AuthShell><section className="account-card signin-card" aria-labelledby="recovery-title"><span className="signin-eyebrow">BACK TO THE WATER</span><h2 id="recovery-title">Reset your password</h2><p className="signin-description">Choose a new password of at least eight characters to get back to your FinFolk.</p>{saved?<><p role="status">Password updated. You can sign in.</p><a href="/account">Continue to your account →</a></>:<form className="signin-form" ref={form} onSubmit={event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);
  if(data.get('password')!==data.get('confirmation')){form.current.elements.confirmation.setCustomValidity('Passwords must match.');form.current.elements.confirmation.reportValidity();return;}
  run(()=>pageAuthActions(session.client,'account')['reset-password'](token,data.get('password')),()=>setSaved(true));
 }} onInput={()=>form.current?.elements.confirmation.setCustomValidity('')}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required/></label><label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required/></label><button type="submit" className="primary" disabled={busy}>{busy?'Saving…':'Save new password'}</button><p className="signin-status" role="status">{message}</p></form>}<button type="button" className="signin-back" disabled={busy} onClick={()=>run(async()=>{if(session.user?.recovery)await session.client.signOut();location.assign('/account');})}>Back to sign in</button></section></AuthShell>;
}
