'use client';
import {useRef} from 'react';
import {pageAuthActions} from '../../../lib/page-models.js';
import {useLogbookAction} from '../logbook/tools.jsx';
export default function PasswordRecovery({session}){
 const form=useRef(null),{run,busy,message}=useLogbookAction(session,{formatError:error=>error.message});
 return <section className="account-card"><h1>Reset your password</h1><form ref={form} onSubmit={event=>{
  event.preventDefault();const data=new FormData(event.currentTarget);
  if(data.get('password')!==data.get('confirmation')){form.current.elements.confirmation.setCustomValidity('Passwords must match.');form.current.elements.confirmation.reportValidity();return;}
  run(()=>pageAuthActions(session.client,'account')['reset-password'](null,data.get('password')));
 }}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} required/></label>
 <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required onInput={event=>event.target.setCustomValidity('')}/></label>
 <button type="submit" className="primary" disabled={busy}>Save new password</button><p role="status">{message}</p></form></section>;
}
