import {loadPublicPage} from './public-page.js';
export async function publicTrip(id){return (await loadPublicPage('public-report',{id})).report;}
export async function tripResult(id){try{return {report:await publicTrip(id)}}catch(error){return {report:null,error:error.message}}}
