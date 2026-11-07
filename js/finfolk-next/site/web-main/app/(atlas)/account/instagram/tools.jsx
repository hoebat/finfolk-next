'use client';
import {Button,External,useLogbookAction} from '../../logbook/tools.jsx';
export {Button,External};
export function useInstagramAction(session){return useLogbookAction(session,{formatError:error=>error.message});}
export function Field({title,type='text',value,...props}){return <label>{title}{type==='textarea'?<textarea defaultValue={value||''} {...props}/>:<input type={type} defaultValue={type==='checkbox'?undefined:value||''} {...props}/>}</label>}
export function Source({row}){try{const url=new URL(row.data?.sourceUrl);if(url.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(url.hostname))return <External href={url.href}>View source on Instagram ↗</External>;}catch{}return null;}
