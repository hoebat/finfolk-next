// Public build templates only; these never contain a rendered account response.
import {pageRoutes} from './page-routes.generated.js';
export const {offlineTemplates,offlineStaticRoutes,offlineDynamicTemplates}=pageRoutes;
export function offlineDocumentPath(pathname,documents,patterns={}){
 if(Object.prototype.hasOwnProperty.call(documents,pathname))return documents[pathname];
 for(const [pattern,target]of Object.entries(patterns)){
  const prefix=pattern.slice(0,-3),id=pathname.slice(prefix.length);
  if(pattern.endsWith('/:id')&&pathname.startsWith(prefix)&&id&&!id.includes('/'))return target;
 }
 return null;
}
const known=Object.fromEntries([...offlineStaticRoutes,...Object.keys(offlineTemplates)].map(path=>[path,true]));
export const isOfflineRoute=pathname=>!!offlineDocumentPath(pathname,known,offlineDynamicTemplates);
