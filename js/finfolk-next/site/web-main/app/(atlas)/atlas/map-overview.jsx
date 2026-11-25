'use client';
import {overviewPaths,overviewViewport} from './map-overview.js';
import {OUTLINE_SOURCE} from '../../../src/state-outlines.js';
export default function MapOverview({bounds}){
 const viewport=overviewViewport(bounds);
 return <figure className="fm-overview" aria-label="Map overview: current view within Australia"><figcaption><strong>Australia</strong><span>{viewport?.outside?'View outside Australia':'Current view'}</span></figcaption><svg viewBox="0 0 220 160" role="img" aria-label="Australia with the current map viewport highlighted"><defs><clipPath id="fm-overview-clip"><rect width="220" height="160"/></clipPath></defs><g clipPath="url(#fm-overview-clip)">{overviewPaths.map(({id,path})=><path key={id} d={path} className="fm-overview-land"/>)}{viewport&&!viewport.outside&&<g className="fm-overview-position"><rect data-overview-viewport x={viewport.x} y={viewport.y} width={viewport.width} height={viewport.height}/><circle cx={viewport.cx} cy={viewport.cy} r="3"/></g>}</g></svg><small title={OUTLINE_SOURCE.licence}>{OUTLINE_SOURCE.attribution}</small></figure>;
}
