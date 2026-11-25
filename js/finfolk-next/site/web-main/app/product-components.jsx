import {thumbnailGeometry} from '../src/beach-thumbnail.js';

export function LocationArtwork({site}) {
 const geometry=thumbnailGeometry(site);
 if(!geometry.path)return null;
 return <svg className="ff-location-art" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label={`${site.state||site.state_id} location map`}>
  <path d={geometry.path}/>
  {geometry.dot&&<circle cx={geometry.dot[0]} cy={geometry.dot[1]} r="3.5"/>}
  <text x={geometry.width/2} y={geometry.height-6} textAnchor="middle">{geometry.label}</text>
 </svg>;
}

export function SessionMetrics({duration,depth}) {
 const metrics=[{value:duration,unit:'min',label:'Duration'},{value:depth,unit:'m',label:'Maximum depth'}].filter(metric=>Number.isFinite(metric.value));
 if(!metrics.length)return null;
 return <dl className="ff-session-metrics">{metrics.map(metric=><div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}<small>{metric.unit}</small></dd></div>)}</dl>;
}
