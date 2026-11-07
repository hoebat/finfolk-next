import {loadPublicPage} from '../../../lib/public-page.js';
import Logbook from './screen.jsx';
export const metadata={title:'Logbook',robots:{index:false,follow:false}};
export default async function Page({searchParams}){const query=await searchParams,{catalog}=await loadPublicPage('community-catalog');return <Logbook sites={catalog.beaches||[]} values={{create:typeof query.new==='string'?query.new:'',session:typeof query.session==='string'?query.session:'',profile:typeof query.profile==='string'?query.profile:''}}/>;}
