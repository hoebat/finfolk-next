// Isolated read-only API for Next.js member-page tests. No network forwarding or credentials.
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {event,publicListing} from './nextjs-administration.mjs';
import {directoryResponse} from './nextjs-directory.mjs';
import {tripId,publishedReport} from './nextjs-posts.mjs';
const catalog={beaches:[{id:'bondi',name:'Bondi Beach',state_id:'NSW',state:'NSW'},{id:'portsea',name:'Portsea Beach',state_id:'VIC',state:'VIC'}]};
export const createNextAPIFixture=()=>createServer((request,response)=>{
 response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');
 if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end(JSON.stringify({error:'Fixture is read-only'}));return;}
 const url=new URL(request.url,'http://fixture'),path=url.pathname;
 const value=path==='/v1/directory'?directoryResponse(url.searchParams):path==='/v1/sites/catalog'?catalog:path==='/health'?{ready:true,fixture:true}:path==='/v1/events'?{events:[event]}:path==='/v1/events/public-event'?event:path==='/v1/directory/school'?publicListing:path==='/trips/'+tripId?publishedReport:null;
 response.writeHead(value?200:404);response.end(JSON.stringify(value||{error:'Fixture route not found'}));
});
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const server=createNextAPIFixture();server.listen(Number(process.env.FINFOLK_FIXTURE_PORT||3210),'127.0.0.1',()=>console.log('Read-only Next.js member fixture ready.'));}
