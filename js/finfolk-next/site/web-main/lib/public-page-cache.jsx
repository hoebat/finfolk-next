import PublicDataCache from './public-data-cache.jsx';
import {publicSeed} from './public-page.js';
// Server-only provenance prevents accidentally serializing member results into
// the public cache hydrator. The worker independently enforces public scope.
export default function PublicPageCache({name,values,data}){
 if(data==null)return null;
 const seed=publicSeed(name,values,data);
 return <PublicDataCache name={name} values={values} data={data} fetchedAt={seed.at}/>;
}
