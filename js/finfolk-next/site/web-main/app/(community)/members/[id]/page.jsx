import Profile from '../../profile/screen.jsx';
export const metadata={title:'Diver profile',robots:{index:false,follow:false}};
export default async function MemberPage({params,searchParams}){const {id}=await params,p=await searchParams;return <><Profile key={id} target={id}  location={typeof p.location==='string'?p.location:''}/></>}
