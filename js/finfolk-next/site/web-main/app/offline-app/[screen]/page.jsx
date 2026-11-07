import {definition} from '../../../lib/page-models.js';
import {Suspense} from 'react';
import {offlineTemplates,offlineDynamicTemplates} from '../../../lib/offline-documents.js';
import OfflineDocument from './screen.jsx';
export const dynamicParams=false;
export function generateStaticParams(){return [...new Set([...Object.values(offlineTemplates),...Object.values(offlineDynamicTemplates)])].map(screen=>({screen}));}
export async function generateMetadata({params}){const {screen}=await params;return {title:{home:{absolute:'FinFolk — Discover Freediving'},discover:'Discover dive sites',logbook:'Logbook',account:'Your FinFolk',directory:'Freediving directory',listing:'Freediving page',events:'Events',event:'Event','event-editor':'Create or edit event','event-invitation':'Private event invitation','page-invitation':'Page admin invitation',people:'People',profile:'My profile','profile-edit':'Edit profile',member:'Diver profile',report:'Trip report'}[screen],robots:{index:false,follow:false}};}
export default async function Page({params}){definition('offline-templates');const {screen}=await params;return <Suspense><OfflineDocument screen={screen}/></Suspense>;}
