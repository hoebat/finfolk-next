import PublicDataCache from '../../../../lib/public-page-cache.jsx';
import {loadPublicPage} from '../../../../lib/public-page.js';
import Editor from './screen.jsx';
export const metadata={title:'Edit profile',robots:{index:false,follow:false}};
export default async function EditPage(){const {catalog}=await loadPublicPage('community-catalog');return <><PublicDataCache name="siteCatalog" data={catalog} values={{}}/><Editor sites={catalog.beaches||[]}/></>}
