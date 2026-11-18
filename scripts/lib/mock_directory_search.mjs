// Explicit local fixture provider. Never selected by hosted environment or browser input.
import {createDirectorySearch} from '../../backend/directory-discovery.mjs';
export const mockDirectorySearch=createDirectorySearch({key:'owned-local-fixture',fetcher:async input=>{
 const query=new URL(input).searchParams.get('q');
 if(query.includes('provider-failure'))return Response.json({error:'Synthetic unavailable provider'},{status:503});
 const social=query.includes('site:instagram.com')?'instagram':query.includes('site:tiktok.com')?'tiktok':null;
 const item=social?{title:'Demo harbour group',url:social==='instagram'?'https://www.instagram.com/demo_harbour/':'https://www.tiktok.com/@demo_harbour',description:'Synthetic local discovery candidate.'}:{title:'Demo harbour school',url:'https://example.test/demo-school/',description:'Synthetic local discovery candidate.'};
 return Response.json({web:{results:[item]}});
}});
