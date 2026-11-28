import Logbook from './screen.jsx';
export const metadata={title:'Sessions',robots:{index:false,follow:false}};
export default async function Page({searchParams}){const query=await searchParams;return <Logbook values={{section:['plans','history','statistics'].includes(query.section)?query.section:'overview',site:typeof query.site==='string'?query.site:'',mode:['current','upcoming'].includes(query.mode)?query.mode:'',create:typeof query.new==='string'?query.new:'',session:typeof query.session==='string'?query.session:'',profile:typeof query.profile==='string'?query.profile:''}}/>;}
