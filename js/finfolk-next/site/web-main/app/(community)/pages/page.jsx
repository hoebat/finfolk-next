import Pages from './screen.jsx';
import {Suspense} from 'react';
export const metadata={title:'My pages',robots:{index:false,follow:false}};
export default function MyPages(){return <Suspense fallback={<p role="status">Loading pages…</p>}><Pages/></Suspense>}
