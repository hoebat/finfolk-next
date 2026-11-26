import {beachWebCollections,socialBeachIdentities} from './beach-web-sources.js';
import {socialPostURL} from '../../../src/social-url.js';
export function publicWebURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
const stateCodes={'victoria':'vic','western australia':'wa','queensland':'qld','new south wales':'nsw','tasmania':'tas','south australia':'sa','northern territory':'nt'};
const normal=value=>String(value||'').normalize('NFKC').trim().toLowerCase();
export function matchesWebLocation(location,site){
 const state=normal(site.state_id||site.state);
 if((stateCodes[state]||state)!==normal(location.state))return false;
 if(location.site_ids?.includes(site.id))return true;
 const [lng,lat]=site.point||[],[west,south,east,north]=location.bounds;
 return location.names.some(name=>normal(name)===normal(site.name))&&Number.isFinite(lng)&&Number.isFinite(lat)&&lng>=west&&lng<=east&&lat>=south&&lat<=north;
}
export function beachWebContent(site,social={}){
 const collection=beachWebCollections.find(row=>matchesWebLocation(row,site));
 const sources=(collection?.sources||[]).filter(row=>publicWebURL(row.url));
 const seen=new Set(sources.map(row=>publicWebURL(row.url)));
 const source=publicWebURL(site.source_url);
 if(source&&!seen.has(source))sources.push({id:'catalog-source',kind:'Location source',title:'Published location reference',publisher:new URL(source).hostname.replace(/^www\./,''),url:source,summary:site.reference_label||'The source used for this beach’s catalog location.',association:'catalog'});
 const identities=socialBeachIdentities.filter(row=>matchesWebLocation(row,site)).flatMap(row=>[row.id,...row.site_ids]);
 const knownIDs=new Set(socialBeachIdentities.flatMap(row=>[row.id,...row.site_ids]));
 const posts=(social.posts||[]).filter(post=>socialPostURL(post.url)&&(post.beach_ids?.some(id=>identities.includes(id)||(id===site.id&&!knownIDs.has(id)))||post.area_ids?.includes(site.area_id))).map(post=>({...post,nearby:post.association==='nearby'||!post.beach_ids?.length||post.id==='bondi-icebergs-wanderlust'}));
 const query=collection?.query||[site.name,site.area_name,site.state_id||site.state,'Australia'].filter(Boolean).join(' ');
 const searches=[['Web','https://www.google.com/search','q'],['Instagram','https://www.instagram.com/explore/search/keyword/','q'],['YouTube','https://www.youtube.com/results','search_query']].map(([label,base,param])=>{const url=new URL(base);url.searchParams.set(param,query);return {label,url:url.href};});
 const videos=(collection?.videos||[]).filter(video=>/^[a-zA-Z0-9_-]{11}$/.test(video.id));
 return {sources,posts,videos,searches,reviewed:!!collection||posts.length>0};
}
