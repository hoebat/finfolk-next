import People from './screen.jsx';
export const metadata={title:'People',robots:{index:false,follow:false}};
export default async function PeoplePage({searchParams}){const params=await searchParams;return <><People  filters={{q:typeof params.q==='string'?params.q:'',location:typeof params.location==='string'?params.location:'',availability:typeof params.availability==='string'?params.availability:'',experience:typeof params.experience==='string'?params.experience:''}}/></>}
