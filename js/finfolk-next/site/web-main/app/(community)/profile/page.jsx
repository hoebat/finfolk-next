import Profile from './screen.jsx';
export const metadata={title:'My profile',robots:{index:false,follow:false}};
export default async function ProfilePage({searchParams}){const p=await searchParams;return <><Profile  location={typeof p.location==='string'?p.location:''}/></>}
