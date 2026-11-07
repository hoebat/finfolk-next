import PublicDataCache from '../../../lib/public-page-cache.jsx';
import {loadPublicPage} from '../../../lib/public-page.js';
import People from './screen.jsx';
export const metadata={title:'People',robots:{index:false,follow:false}};
export default async function PeoplePage({searchParams}){const params=await searchParams;const {catalog}=await loadPublicPage('community-catalog');return <><PublicDataCache name="siteCatalog" data={catalog} values={{}}/><People sites={catalog.beaches||[]} filters={{location:typeof params.location==='string'?params.location:'',availability:typeof params.availability==='string'?params.availability:'',experience:typeof params.experience==='string'?params.experience:''}}/></>}
