const origin='https://finfolk.com.au';
const cards=Object.freeze({
  home:{title:'FinFolk - Discover Freediving',description:'Find freediving locations, record your sessions and connect with other freedivers.',path:'/',image:'og-home-acid-club-v1.png',alt:'The FinFolk landing page in Acid Club yellow and navy, with the FinFolk wordmark and a session planned at Portsea Beach.'},
  discover:{title:'Discover freediving locations · FinFolk',description:'Find your next spot and discover the freedivers who visit the same places.',path:'/?view=discover&section=suggested',image:'og-discover-acid-club-v1.png',alt:'The Pick your spot section of the FinFolk landing page, showing The Basin Beach in Western Australia.'},
  people:{title:'Discover your FinFolk',description:'Meet freedivers, find the Regulars at your spots and make new connections.',path:'/profiles?screen=people',image:'og-people-acid-club-v1.png',alt:'The Discover your FinFolk section of the landing page, with illustrated diver profiles at Gordon’s Bay.'},
  logbook:{title:'Your freediving logbook · FinFolk',description:'Record your freediving and training sessions. Keep them private or choose what to share.',path:'/?view=logbook',image:'og-logbook-acid-club-v1.png',alt:'The Post your logs section of the FinFolk landing page, showing a sample private session at Waubs Beach.'},
});

export function socialCard(url){
  const route=new URL(url,origin),view=route.searchParams.get('view');
  const key=/^\/profiles(?:\.html)?\/?$/.test(route.pathname)?'people':
    view==='logbook'?'logbook':['discover','maps','areas'].includes(view)?'discover':'home';
  const card=cards[key];
  // Only fixed public section URLs are exposed; never echo auth tokens,
  // private session IDs, search terms or other request parameters.
  return {...card,key,url:origin+card.path,imageURL:origin+'/'+card.image};
}

const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
export function renderSocialMetadata(url){
  const card=socialCard(url);
  const properties={
    'og:site_name':'FinFolk','og:type':'website','og:locale':'en_AU',
    'og:title':card.title,'og:description':card.description,'og:url':card.url,
    'og:image':card.imageURL,'og:image:secure_url':card.imageURL,
    'og:image:type':'image/png','og:image:width':'1200','og:image:height':'630','og:image:alt':card.alt,
  };
  const twitter={'twitter:card':'summary_large_image','twitter:title':card.title,'twitter:description':card.description,'twitter:image':card.imageURL,'twitter:image:alt':card.alt};
  return '<!--finfolk:social-->\n'+Object.entries(properties).map(([key,value])=>`<meta property="${key}" content="${escape(value)}">`).join('\n')+'\n'+Object.entries(twitter).map(([key,value])=>`<meta name="${key}" content="${escape(value)}">`).join('\n')+'\n<!--/finfolk:social-->';
}

export function addSocialMetadata(html,url){
  const metadata=renderSocialMetadata(url);
  return html.includes('<!--finfolk:social-->')?html.replace(/<!--finfolk:social-->[\s\S]*?<!--\/finfolk:social-->/,metadata):html.replace('</head>',metadata+'\n</head>');
}

export async function socialResponse(response,request){
  if(request.method!=='GET'||response.status!==200||!response.headers.get('Content-Type')?.includes('text/html'))return response;
  const headers=new Headers(response.headers);
  headers.delete('Content-Length');headers.delete('ETag');
  return new Response(addSocialMetadata(await response.text(),request.url),{status:response.status,headers});
}
