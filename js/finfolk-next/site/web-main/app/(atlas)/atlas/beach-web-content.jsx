'use client';
import {useState} from 'react';
import social from '../../../src/social.json';
import {PostCard} from './place-media.jsx';
import {beachWebContent,publicWebURL} from './beach-web-model.js';
import './beach-web-content.css';
import BeachPhotoResults from './beach-photo-results.jsx';
function External({href,children,...props}){return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;}
function WebCard({source}){
 const [loaded,setLoaded]=useState(true),[failed,setFailed]=useState(false);
 const image=source.image&&publicWebURL(source.image.url)?source.image:null;
 return <article className="ff-web-card" data-association={source.association}>
  <div className="ff-web-card-top"><span>{source.kind}</span><small>{source.association==='nearby'?'Nearby area':source.association==='catalog'?'Catalog source':'At this beach'}</small></div>
  <h4><External href={source.url}>{source.title}<span aria-hidden="true"> ↗</span></External></h4>
  <p>{source.summary}</p>
  {image&&<>{loaded?<img src={image.url} alt={image.alt} loading="lazy" onError={()=>{setLoaded(false);setFailed(true);}}/>:<button type="button" onClick={()=>{setLoaded(true);setFailed(false);}}>{failed?'Photo unavailable · retry':'Load photograph'}</button>}<small className="ff-web-credit">Photo © {image.credit} · <External href={image.licence_url}>{image.licence}</External> · <External href={source.url}>Original photograph</External></small></>}
  <footer><span>{source.publisher}</span>{source.reviewed_at&&<small>Reviewed {source.reviewed_at}</small>}</footer>
 </article>;
}
export default function BeachWebContent({site}){
 const {sources,posts,videos}=beachWebContent(site,social);
 return <section className="ff-beach-web" aria-label="From around the web">
  <header><span className="ff-web-eyebrow">A little coastal inspiration</span><h3>From around the web</h3><p>Guides, photographs and stories for {site.name}.</p></header>
  <div className="ff-web-grid">{sources.map(source=><WebCard key={site.id+':'+source.id} source={source}/>)}</div>
  {posts.length>0&&<div className="ff-web-social">{posts.map(post=><div key={site.id+':'+post.url}><span className="ff-web-eyebrow">{post.nearby?'Around the area':'At this beach'}</span><PostCard post={post} autoLoad/></div>)}</div>}
  {videos?.length>0&&<div className="ff-web-videos">{videos.map(video=><article className="ff-web-video" key={video.id}><iframe src={'https://www.youtube-nocookie.com/embed/'+video.id} title={video.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen/><h4>{video.title}</h4><small>{video.author} · <External href={'https://www.youtube.com/watch?v='+video.id}>YouTube ↗</External></small></article>)}</div>}
  <BeachPhotoResults key={site.id} site={site}/>
  <p className="ff-web-note">Historical photos and videos · not current conditions.</p>
 </section>;
}
