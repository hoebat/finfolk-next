'use client';
import {useEffect,useState} from 'react';
import {DATASET_RELEASE_BASE} from './dataset-release.js';
export default function PlaceDepth({site,summary}){
 const [details,setDetails]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{setDetails(null);setError(false);if(!site.detail_file){setLoading(false);return;}setLoading(true);const abort=new AbortController();fetch(new URL(site.detail_file,DATASET_RELEASE_BASE),{signal:abort.signal}).then(response=>{if(!response.ok)throw Error('Details unavailable');return response.json();}).then(data=>{if(!abort.signal.aborted)setDetails(data.beaches?.find(row=>row.id===site.id)||null);}).catch(()=>{if(!abort.signal.aborted)setError(true);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();},[site.id,site.detail_file,retry]);
 const beach={...site,...details},evidence=beach.depth_evidence||[],hasContours=Object.values(summary?.depths||{}).some(row=>Number.isFinite(row?.distance_m)),outside=Object.values(summary?.depths||{}).some(row=>row?.status==='outside-radius');
 return <section className="fm-place-depth" aria-label="Depth information"><h3>Depth</h3>
 {loading&&!summary&&!evidence.length?<p role="status">Loading published depth information…</p>:hasContours?<><p>Distance from the published reference point to each depth contour.</p><dl>{[5,10,15,20].map(depth=>{const value=summary.depths?.[depth];return <div key={depth}><dt>{depth} m contour</dt><dd>{Number.isFinite(value?.distance_m)?Math.round(value.distance_m)+' m away':value?.status==='outside-radius'?'Not mapped within 3 km':'Not mapped locally'}</dd></div>;})}</dl></>:<p>{outside?'No mapped depth contour is available within 3 km of this reference point.':evidence.length?'Published depth references':'Local survey depths are not published for this beach.'}</p>}
 {error&&<p role="status">Further depth details couldn’t load. <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry depth details</button></p>}
 {evidence.map((row,i)=><p key={i}><strong>{row.depth_m} m</strong>{' · '+[row.kind,row.reference].filter(Boolean).join(' · ')}{row.source_url&&<> · <a href={row.source_url} target="_blank" rel="noopener noreferrer">Depth source ↗</a></>}</p>)}
 {summary&&(hasContours||outside)&&<><p className="fm-depth-source">Survey: {summary.survey_date||'not published'}<br/>Datum: {summary.datum||'unverified'}</p>{summary.source_url&&<a href={summary.source_url} target="_blank" rel="noopener noreferrer">Survey source ↗</a>}</>}
 {(hasContours||evidence.length>0)&&<p className="fm-depth-source">Published reference depths; no tide adjustment.</p>}
 </section>;
}
