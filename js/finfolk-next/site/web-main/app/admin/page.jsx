import PlatformStatus from './screen.jsx';
export const metadata={title:'Platform status',robots:{index:false,follow:false}};
export default function Page(){return <><link rel="stylesheet" precedence="app" href="/appearance.css"/><link rel="stylesheet" precedence="app" href="/identity.css"/><PlatformStatus/></>;}
