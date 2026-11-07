import Invitation from './screen.jsx';
export const metadata={title:'Page admin invitation',robots:{index:false,follow:false}};
export default async function InvitationPage({searchParams}){const p=await searchParams;return <Invitation token={typeof p.token==='string'?p.token:''}/>}
