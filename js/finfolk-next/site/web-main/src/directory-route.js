export function directoryRoute(url){
 const event=url.pathname.match(/^\/events(?:\/([a-zA-Z0-9_-]+))?\/?$/);if(event){const p=new URLSearchParams(url.search);p.set('screen','events');p.set('eventMode',event[1]==='new'?'edit':event[1]==='my'?'mine':event[1]==='invitation'?'invitation':event[1]?'detail':'list');if(event[1]&&!['new','my','invitation'].includes(event[1]))p.set('id',event[1]);return p;}
 const match=url.pathname.match(/^\/directory(?:\/([a-zA-Z0-9_-]+))?\/?$/);
 if(!match)return null;
 const params=new URLSearchParams(url.search);params.set('screen',match[1]?'listing':'directory');if(match[1])params.set('id',match[1]);return params;
}
export const directoryURL=id=>'/directory'+(id?'/'+encodeURIComponent(id):'');
