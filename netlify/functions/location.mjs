import {locationResponse} from '../../js/finfolk-next/site/web-main/lib/location-hint.js';
// Native Netlify context: https://docs.netlify.com/build/functions/api/#geo
export default function location(request,context){return locationResponse(context?.geo);}
export const config={path:'/api/location',method:['GET']};
