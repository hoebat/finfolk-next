import assert from 'node:assert/strict';
import {AtlasController} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/controller.js';
import * as siteModel from '../js/finfolk-next/site/web-main/src/site-model.js';
const controller=new AtlasController(),site={id:'cove',name:'Cove',waterbody:'ocean',region:'site-cove',area_id:'coast',state_id:'VIC',point:[145,-38],detail_file:'detail.json'};
controller.siteModel=siteModel;controller.beaches={states:[],areas:[],beaches:[site]};controller.catalog={regions:[]};controller.areaData=async()=>({beaches:[{...site,region:'retired-survey'}]});
await controller.beach('cove');assert.equal(site.region,'site-cove');assert.equal(controller.catalog.regions.find(region=>region.id==='site-cove').site_only,true);
controller.region={id:'previous'};controller.map={ready:true,layers:{measurement:true},draw(){},resize(){}};controller.sync=()=>{};controller.setContext=()=>{};controller.tools={beachMeasurement(){throw Error('No contours');}};controller.contoursReady=true;controller.update({selectedSite:'previous-site',depths:[]});controller.load=async id=>{controller.region={id};controller.contoursReady=false;return false;};
const selected=await controller.chooseSite('cove',{writeURL:false});assert.equal(selected,undefined);assert.equal(controller.state.selectedSite,'previous-site','failed survey loading must not commit a new selected site');
console.log('MAP_COVERAGE_MODEL_PASS: stale rich-detail region is normalized into its own site map; failed contour loading cannot commit a partial site selection.');
