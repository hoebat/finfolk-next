import assert from 'node:assert/strict';
import test from 'node:test';
import {DATASET_ORIGIN,DATASET_PROVIDER_BASE,DATASET_RELEASE_BASE,osmTileURL} from '../js/finfolk-next/site/web-main/src/map-data.js';
import {surfaceForRegion,surfaceURL} from '../js/finfolk-next/site/web-main/src/surfaces.js';
import {addDepthShading} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-style.js';
import {cachedTile} from '../js/finfolk-next/site/web-main/src/render-cache.js';
test('survey releases, basemap, terrain and publisher imagery use the dataset service',()=>{
 assert.equal(DATASET_ORIGIN,'https://datasets.finfolk.com.au');
 assert.match(DATASET_RELEASE_BASE,/\/v1\/map\/releases\/[a-f0-9]{64}\/$/);
 const sources=[];addDepthShading({addSource:(id,source)=>sources.push(source),getStyle:()=>({layers:[]}),addLayer(){}});
 const urls=[DATASET_RELEASE_BASE,DATASET_PROVIDER_BASE+'openfreemap/styles/liberty',osmTileURL(10,923,631),...sources.flatMap(source=>source.tiles)];
 for(const id of ['bondi','port-phillip','vic-corner-inlet']){
  const surface=surfaceForRegion({id,rasters:[]});urls.push(surfaceURL(surface,[144,-39,145,-38],800,600),surface.service+'/legend?f=json');
 }
 for(const url of urls)assert.equal(new URL(url).origin,DATASET_ORIGIN,url);
 const image={complete:true,naturalWidth:256};const images=new Map([[osmTileURL(9,461,315),image]]);assert.equal(cachedTile(images,10,923,631).image,image,'Parent tile fallback must use the same dataset URL as rendering');
});
