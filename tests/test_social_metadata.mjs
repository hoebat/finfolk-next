import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import preview from '../backend/preview-worker.mjs';
import {socialCard,addSocialMetadata} from '../backend/social-metadata.mjs';

const cases=[['/','home'],['/?utm_source=instagram&fbclid=tracking','home'],['/landing.html','home'],['/?view=discover&section=index&q=private-search','discover'],['/?view=maps&site=bondi','discover'],['/profiles?screen=profile&profile=private-id','people'],['/profiles.html?screen=people','people'],['/?view=logbook&session=private-id','logbook'],['/?view=account&token=secret-token','home']];
for(const [path,key] of cases){
  const request=new Request('https://finfolk.com.au'+path);
  const env={ASSETS:{fetch:async()=>new Response('<html><head><title>FinFolk</title></head><body>Actual page</body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','ETag':'"original"','Content-Length':'123'}})}};
  const response=await preview.fetch(request,env),html=await response.text();
  assert.equal(response.headers.get('ETag'),null);assert.equal(response.headers.get('Content-Length'),null);
  assert.doesNotMatch(html,/private-id|private-search|secret-token|fbclid/,'Request parameters stay out of previews');
  const window=new Window();window.document.write(html);
  const meta=key=>window.document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.content;
  const card=socialCard(request.url);assert.equal(card.key,key);
  assert.equal(meta('og:title'),card.title);assert.equal(meta('og:url'),card.url);assert.equal(meta('og:image'),card.imageURL);
  assert.equal(meta('og:image:width'),'1200');assert.equal(meta('og:image:height'),'630');assert.equal(meta('twitter:card'),'summary_large_image');assert.equal(meta('twitter:image'),card.imageURL);
  assert.equal(addSocialMetadata(html,request.url),html,'Repeated rendering does not duplicate metadata');
  await window.happyDOM.close();
}
for(const theme of ['acid-club','salt-paper'])for(const key of ['home','discover','people','logbook']){
  const png=await readFile(`js/finfolk-next/site/web-main/src/og-${key}-${theme}-v1.png`);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);assert.ok(png.length<1024*1024,'Social screenshot stays under 1 MB');
}
for(const [method,status,type,body] of [['GET',404,'text/html','Missing'],['GET',200,'image/png','Image'],['POST',200,'text/html','Submitted'],['HEAD',200,'text/html',null]]){
  const original=new Response(body,{status,headers:{'Content-Type':type}});
  const actual=await preview.fetch(new Request('https://finfolk.com.au/other',{method}),{ASSETS:{fetch:async()=>original}});
  assert.equal(actual,original,'Non-page responses and HEAD pass through unchanged');
}
console.log('SOCIAL_METADATA_PASS: crawler-visible cards, fixed public URLs, PNG dimensions, idempotent rendering and asset/API separation.');
