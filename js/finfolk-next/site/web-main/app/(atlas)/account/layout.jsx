import {Suspense} from 'react';
import AccountFrame from './frame.jsx';
export default function AccountLayout({children}){return <Suspense fallback={<section id="account-page" className="account-page ff-account-workspace" aria-label="Your FinFolk account"><p role="status">Restoring your sign-in…</p></section>}><AccountFrame>{children}</AccountFrame></Suspense>}
