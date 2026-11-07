import PublicDataCache from '../../../../lib/public-page-cache.jsx';
import {tripResult} from '../../../../lib/public-trip.js';
import Report from './screen.jsx';
export async function generateMetadata({params}){const {id}=await params,{report}=await tripResult(id);return report?{title:report.title,description:report.story?.slice(0,160),alternates:{canonical:'https://finfolk.com.au/reports/'+id}}:{title:'Trip report unavailable',robots:{index:false,follow:false}};}
export default async function Page({params}){const {id}=await params;const result=await tripResult(id);return <>{result.report&&<PublicDataCache name="publicTrip" data={result.report} values={{id}}/>}<Report id={id} {...result}/></>;}
