import assert from 'node:assert/strict';
import {addStateBoundaries} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-style.js';
const layers=[];
assert.equal(addStateBoundaries({getStyle:()=>({sources:{tiles:{type:'vector'}},layers:[{id:'provider-boundaries',source:'tiles','source-layer':'boundary',minzoom:5}]}),addLayer:layer=>layers.push(layer)}),true);
assert.deepEqual(layers.map(l=>l.id),['ff-state-boundary-halo','ff-state-boundaries']);
for(const layer of layers){assert.equal(layer.source,'tiles');assert.equal(layer.minzoom,0);assert.deepEqual(layer.filter,['==',['to-number',['get','admin_level']],4]);}
assert.equal(addStateBoundaries({getStyle:()=>({sources:{},layers:[]})}),false,'A missing provider boundary layer must preserve map fallback');
console.log('STATE_BOUNDARIES_PASS: dataset vector source reused, state borders visible at national zoom, safe fallback.');
