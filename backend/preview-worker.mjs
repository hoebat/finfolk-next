// Large public survey files are stored compressed to fit the static asset limit.
// Browsers transparently decompress these responses, preserving atlas checksums.
import {directoryRoute} from '../js/finfolk-next/site/web-main/src/directory-route.js';
import {isBrowserAPIPath} from './browser-routes.mjs';
export default {
  async fetch(request, env) {
    const route=new URL(request.url);
    if(route.hostname==='www.finfolk.com.au' || (route.hostname==='finfolk.com.au' && route.protocol==='http:')){
      route.hostname='finfolk.com.au';route.protocol='https:';route.port='';
      return new Response(null,{status:308,headers:{Location:route.href}});
    }
    if(route.pathname==='/_next/health'){
      route.pathname='/health';return env.NEXT_API.fetch(new Request(route,request));
    }
    if(isBrowserAPIPath(route.pathname))return env.NEXT_API.fetch(request);
    if(route.pathname==='/' && [...route.searchParams.keys()].some(key=>!/^utm_/i.test(key)&&!['fbclid','gclid','msclkid'].includes(key))){
      const app=new URL(request.url);app.pathname='/app';
      return env.ASSETS.fetch(new Request(app,request));
    }
    if(directoryRoute(route)&&['GET','HEAD'].includes(request.method)){const page=new URL(request.url);page.pathname=route.pathname.startsWith('/events')?'/events':'/directory';return env.ASSETS.fetch(new Request(page,request));}
    const original = await env.ASSETS.fetch(request);
    if(original.status !== 404 || !['GET','HEAD'].includes(request.method)) return original;
    const url = new URL(request.url);
    if(!url.pathname.startsWith('/data/')) return original;
    url.pathname = '/__compressed' + url.pathname + '.gz';
    const compressed = await env.ASSETS.fetch(new Request(url, {method:request.method}));
    if(!compressed.ok) return original;
    const headers = new Headers(compressed.headers);
    headers.set('Content-Encoding','gzip');
    headers.set('Content-Type',new URL(request.url).pathname.endsWith('.geojson') ? 'application/geo+json' : 'application/octet-stream');
    headers.set('X-Robots-Tag','noindex, nofollow');
    headers.set('Vary','Accept-Encoding');
    return new Response(compressed.body,{status:compressed.status,headers,encodeBody:'manual'});
  }
};
