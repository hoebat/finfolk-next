import {legacyRedirects} from './lib/legacy-redirects.js';
import {readdir} from 'node:fs/promises';
const packed=async()=>{try{return (await readdir(new URL('./public/__compressed/',import.meta.url),{recursive:true})).filter(x=>x.endsWith('.gz'));}catch{return [];}};
const api=process.env.FINFOLK_API_ORIGIN||'https://api.finfolk.com.au';
export default {
 devIndicators:false,
 allowedDevOrigins:['127.0.0.1'],
 distDir:process.env.FINFOLK_NEXT_DIST_DIR||'.next',
 async redirects(){return legacyRedirects;},
 async rewrites(){return {beforeFiles:[
  ...(process.env.NODE_ENV==='development'&&process.env.FINFOLK_MOCK_PREVIEW==='1'?[{source:'/api/preview/:action',destination:api+'/__preview/:action'}]:[]),
  ...['/v1/:path*','/api','/health','/privacy','/data-deletion','/instagram/webhook','/trips/:path*','/community/posts','/community/referral','/instagram/posts/:path*','/shop/checkout','/shop/items'].map(source=>({source,destination:api+source})),
 ],afterFiles:[],fallback:process.env.NETLIFY==='true'?[]:(await packed()).map(path=>({source:"/"+path.slice(0,-3),destination:"/__compressed/"+path}))};},
 async headers(){return [ {source:'/offline/:path*',headers:[{key:'X-Robots-Tag',value:'noindex'},{key:'Cache-Control',value:'no-store'}]},...(await packed()).map(path=>({source:'/__compressed/'+path,headers:[{key:'Content-Type',value:path.endsWith('.geojson.gz')?'application/geo+json':'application/octet-stream'}]})),...['/workers/:path*','/account-config.json','/sw.js'].map(source=>({source,headers:[{key:'Cache-Control',value:'no-cache'}]})),{source:'/__compressed/:path*',headers:[{key:'Content-Encoding',value:'gzip'},{key:'X-Robots-Tag',value:'noindex'}]}];},
};
