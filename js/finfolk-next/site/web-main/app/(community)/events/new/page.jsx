import Editor from './screen.jsx';
export const metadata={title:'Create or edit event',robots:{index:false,follow:false}};
export default async function Page({searchParams}){const p=await searchParams;return <Editor values={Object.fromEntries(['id','duplicate','page'].map(key=>[key,typeof p[key]==='string'?p[key]:'']))}/>}
