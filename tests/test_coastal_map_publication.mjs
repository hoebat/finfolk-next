import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import {build,buildIncremental,featureBounds} from '../scripts/build_coastal_map_tiles.mjs';

const root=await mkdtemp(join(tmpdir(),'coastal-publication-'));
try{
 const metadata={id:'coastal-fixture',title:'Native survey',kind:'survey',datum:'Unverified source reference',survey_date:'2023',licence:'CC BY 4.0',attribution:'Survey owner',source_url:'https://example.test/source',resolution_m:1};
 const feature={type:'Feature',geometry:{type:'LineString',coordinates:[[144.9,-38],[145,-38.01]]},properties:{depth_m:10,source_elevation_m:-10,datum:metadata.datum,source_id:metadata.id,kind:'survey'}};
 const distant={...feature,geometry:{type:'LineString',coordinates:[[145.6,-38.21],[145.61,-38.2]]}};
 const shard=join(root,'source.json.gz');await writeFile(shard,gzipSync(JSON.stringify({collection:{type:'FeatureCollection',features:[feature,distant]}})));
 const plan={release:'fixture-release',origin:'https://example.test',prefix:'coastal/fixture-release',native_cog_count:1,sources:[{id:metadata.id,metadata,rasters:[{sha256:'a'.repeat(64)}],contours:[shard]}]};
 const baseline={version:1,sources:[{id:'existing-published-source',tiles:['/old/{z}/{x}/{y}.pbf']}]};
 const pp=join(root,'plan.json'),bp=join(root,'baseline.json'),target=join(root,'map');await writeFile(pp,JSON.stringify(plan));await writeFile(bp,JSON.stringify(baseline));
 const result=await build(pp,bp,target);assert.deepEqual(result.sources[0],baseline.sources[0]);assert.equal(result.native_coastal_cog_count,1);assert.equal(result.sources[1].native_cog_count,1);assert.equal(result.sources[1].datum,metadata.datum);
 let seen=0,empty=0;
 async function inspect(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory()){await inspect(file);continue;}if(!entry.name.endsWith('.pbf'))continue;const tile=new VectorTile(new Pbf(await readFile(file))),layer=tile.layers.contours;if(!layer){empty++;continue;}for(let i=0;i<layer.length;i++){const f=layer.feature(i);assert.equal(f.type,2);assert.equal(f.properties.source_elevation_m,-10);assert.equal(f.properties.depth_m,10);assert.equal(f.properties.datum,metadata.datum);seen++;}}}
 await inspect(target);assert.ok(seen>0);assert.ok(empty>0);const repeated=await build(pp,bp,target);assert.deepEqual(repeated,result);
 assert.throws(()=>featureBounds([{...feature,properties:{depth_m:-10}}]),/Invalid native contour/);
 const nextPlan={...plan,sources:plan.sources.map(source=>({...source,reuse_contours:true,contours:['/must-not-be-read']}))};
 await writeFile(pp,JSON.stringify(nextPlan));await writeFile(bp,JSON.stringify(result));
 const incremental=await buildIncremental(pp,bp,join(root,'next-map'));
 assert.deepEqual(incremental.sources,result.sources,'Unchanged tiles and source descriptors must be reused exactly');
 assert.equal(incremental.native_coastal_cog_count,1);
 console.log('COASTAL_PUBLICATION_PASS: native reference properties, existing sources preserved, valid and empty MVTs, stable resume.');
}finally{await rm(root,{recursive:true,force:true});}
