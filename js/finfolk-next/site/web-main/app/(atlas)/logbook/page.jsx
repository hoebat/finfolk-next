import Logbook from './screen.jsx';
export const metadata={title:'Sessions',robots:{index:false,follow:false}};
export default async function Page({searchParams}){const query=await searchParams;return <Logbook values={{create:typeof query.new==='string'?query.new:'',session:typeof query.session==='string'?query.session:'',profile:typeof query.profile==='string'?query.profile:''}}/>;}
