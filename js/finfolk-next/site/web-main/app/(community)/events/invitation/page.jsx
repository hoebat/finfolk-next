import Invitation from './screen.jsx';
export const metadata={title:'Private event invitation',robots:{index:false,follow:false}};
export default async function Page({searchParams}){const p=await searchParams;return <Invitation token={typeof p.token==='string'?p.token:''}/>}
