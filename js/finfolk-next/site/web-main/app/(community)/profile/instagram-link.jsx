'use client';
import {usePageRead} from '../../../lib/use-page-data.js';
export default function InstagramLink({session}) {
  const {record,refresh}=usePageRead(session,'instagram-linking','state');
  const state=record?.data;
  return <section className="instagram-claim" id="instagram-claim">
    <h2>Instagram</h2>
    <p role="status">{record?.error?.message||(!state?'Loading your Instagram connection…':'')}</p>
    {record?.error&&<button className="secondary" onClick={refresh}>Try again</button>}
    {state&&<p>{state.connected?'Your Instagram account is connected to FinFolk.':'Connect your own Instagram account with a code sent in a private DM.'}</p>}
    <a className="secondary" href="/account/instagram">Manage Instagram connection ↗</a>
    <p>Connecting leaves public sharing off. Send /help in Instagram for currently available commands.</p>
  </section>;
}
