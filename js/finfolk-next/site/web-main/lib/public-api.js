export async function publicAPI(path){
 const response=await fetch((process.env.FINFOLK_API_ORIGIN||'https://api.finfolk.com.au')+'/v1/'+path,{cache:'no-store'});
 if(response.status===404)return null;
 if(!response.ok)throw Error('FinFolk is temporarily unavailable. Please try again.');
 return response.json();
}
export const siteOrigin=()=>process.env.FINFOLK_SITE_ORIGIN||'https://finfolk.com.au';
