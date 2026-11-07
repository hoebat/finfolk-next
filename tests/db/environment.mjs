import assert from 'node:assert/strict';
import {connect,migrate} from './harness.mjs';
import {database} from '../../backend/db.mjs';
import {importBundle} from '../../backend/environment-imports.mjs';
import {registerEnvironment,refreshTarget} from '../../backend/environment.mjs';
import {Hono} from 'hono';
const client=await connect();
try{
 await migrate(client);
 const db=database(process.env.FINFOLK_TEST_DATABASE_URL);
 try{
 const meta={url:'https://example.com/data',licence:'fixture',attribution:'Fixture provider',cacheAllowed:true,redistributionAllowed:true,retentionSeconds:604800};
 await importBundle(db,{version:1,sources:[{id:'open-meteo',enabled:true,metadata:meta}]});
 await db.query("INSERT INTO finfolk.beaches(id,name,timezone,area_name,state) VALUES('environment-fixture','Fixture','Australia/Melbourne','Fixture','VIC')");
 const site={id:'environment-fixture',name:'Fixture',point:[145,-38],timezone:'Australia/Melbourne',waterbody:'ocean'};
 await db.query("INSERT INTO finfolk.site_profiles(id,revision,waterbody,access_mode,status,payload) VALUES($1,1,'ocean','unknown','published',$2::jsonb)",[site.id,JSON.stringify(site)]);
 const target={id:'fixture-target',source_id:'open-meteo',product:'marine',configuration:{point:site.point}};
 await db.query("INSERT INTO finfolk.environment_targets(id,source_id,product,configuration) VALUES($1,$2,$3,$4::jsonb)",[target.id,target.source_id,target.product,JSON.stringify(target.configuration)]);
 await db.query('INSERT INTO finfolk.environment_jobs(target_id) VALUES($1)',[target.id]);
 const time=Math.floor(Date.now()/1000);let calls=0;
 const fetcher=async()=>{calls++;return Response.json({longitude:145,latitude:-38,hourly:{time:[time,time+3600],wave_height:[1,null],sea_level_height_msl:[0.2,0.3]},hourly_units:{wave_height:'m',sea_level_height_msl:'m'}});};
 await Promise.all([refreshTarget(db,target,{},fetcher),refreshTarget(db,target,{},fetcher)]);
 assert.equal(calls,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk.environment_snapshots'))[0].n,1);
 const snapshots=await db.query('SELECT * FROM finfolk.environment_snapshots');assert.equal(snapshots[0].payload.datum,'global_msl');
 const app=new Hono();registerEnvironment(app,{db,fetcher:async()=>Response.json({longitude:145,latitude:-38,hourly:{time:[time,time+3600],wave_height:[1,2],sea_level_height_msl:[0.2,0.3],temperature_2m:[15,16],wind_speed_10m:[2,3],wind_direction_10m:[0,90],weather_code:[0,1]},hourly_units:{wave_height:'m',sea_level_height_msl:'m',temperature_2m:'°C',wind_speed_10m:'m/s',wind_direction_10m:'°',weather_code:'wmo code'}})});
 const response=await app.request('/v1/sites/environment-fixture/conditions?days=1',{}, {CONDITIONS_ENABLED:'true'});assert.equal(response.status,200);const conditions=await response.json();assert.equal(conditions.weather.status,'available');assert.equal(conditions.tides.status,'unavailable');assert.equal(conditions.modelledSeaLevel.datum,'global_msl');
 assert.equal((await app.request('/v1/sites/environment-fixture/conditions',{},{})).status,503);
 assert.equal((await app.request('/v1/sites/environment-fixture/depth-datasets',{}, {DEPTH_CATALOG_ENABLED:'true'})).status,200);
 const bundle={version:1,sources:[],stations:[{id:'station',source_id:'open-meteo',upstream_id:'station',metadata:{point:site.point,timezone:site.timezone,datums:['LAT']}}],predictions:[{stationId:'station',source_id:'open-meteo',payload:{datum:'MSL',issuedAt:new Date().toISOString(),attribution:'Fixture',samples:[{time:new Date().toISOString(),height:1}]}}]};
 await assert.rejects(importBundle(db,bundle),/station_datum_mismatch/);assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk.tide_stations'))[0].n,0,'Failed imports roll back station changes.');
 console.log('Environment DB passed: atomic imports, datum validation, concurrent lease claims, snapshots and route flags.');
 }finally{await db.pool.end();}
}finally{await client.end();}
