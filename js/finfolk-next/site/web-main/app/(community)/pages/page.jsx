import {Suspense} from 'react';
import LegacyPagesRedirect from './legacy-redirect.jsx';
export const metadata={title:'Pages',alternates:{canonical:'https://finfolk.com.au/directory'},robots:{index:false,follow:false}};
export default function LegacyPages(){return <Suspense fallback={<p role="status">Opening Pages…</p>}><LegacyPagesRedirect/></Suspense>;}
