'use client';
import {useState} from 'react';
import {useLogbookAction} from '../../logbook/tools.jsx';
export function useSiteActions(session,{includeDetails=true}={}){const [details,setDetails]=useState([]),action=useLogbookAction(session,{formatError:error=>{setDetails(includeDetails?error.details||[]:[]);return error.message||'Please try again.';}});return {...action,details,clear:()=>{setDetails([]);action.notify('');},run:(work,done)=>{setDetails([]);return action.run(work,done);}};}
export function SiteStatus({action}){return <p role="status">{action.message}{action.details?.map((item,i)=><span style={{display:'block',marginBlock:'1em'}} key={i}>Row {item.row}: {item.message}</span>)}</p>}
export function SiteButton({children,onClick,disabled}){return <button type="button" disabled={disabled} onClick={onClick}>{children}</button>}
export function Field({title,name,type='text',value,...props}){return <label>{title}{type==='textarea'?<textarea aria-label={title} name={name} defaultValue={value??''} {...props}/>:<input aria-label={title} name={name} type={type} {...(type==='checkbox'?{defaultChecked:!!value}:{defaultValue:value??''})} {...props}/>}</label>}
export function Select({title,name,value,choices,controlled=false,...props}){return <label>{title}<select aria-label={title} name={name} {...(controlled?{value}:{defaultValue:value})} {...props}>{choices.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>}
export function Source({title,url}){try{const parsed=new URL(url);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password?<a href={parsed.href} target="_blank" rel="noopener noreferrer">{title}</a>:null;}catch{return null;}}
