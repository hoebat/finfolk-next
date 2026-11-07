import {NextResponse} from 'next/server';
import {legacyDestination} from './lib/legacy-redirects.js';
export function proxy(request){
 const url=new URL(request.url);
 // Historical location hints predate Next's reserved asset prefix.
 const target=url.pathname==='/_next/location'?(url.pathname='/api/location',url):legacyDestination(url);
 if(!target)return NextResponse.next();
 return new Response(null,{status:307,headers:{Location:target.href,'Cache-Control':'private, no-store'}});
}
export const config={matcher:['/_next/location','/app','/app.html','/profiles.html','/directory.html','/events.html','/landing.html','/index.html']};
