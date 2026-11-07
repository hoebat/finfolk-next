import assert from 'node:assert/strict';
import {landOutsideWater} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/explore-coast-mask.js';
const ring=(w,s,e,n)=>[[w,s],[e,s],[e,n],[w,n],[w,s]],water={geometry:{type:'Polygon',coordinates:[ring(0,0,4,4),ring(1,1,2,2)]}},adjacent={geometry:{type:'Polygon',coordinates:[ring(3,0,6,4)]}};
const mask=landOutsideWater([water,water,adjacent]);
function inRing([x,y],r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [a,b]=r[i],[c,d]=r[j];if(((b>y)!==(d>y))&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
const covered=(m,p)=>m.features.some(f=>f.geometry.coordinates.some(([outer,...holes])=>inRing(p,outer)&&!holes.some(h=>inRing(p,h))));
assert.equal(covered(mask,[-1,2]),true,'Land must hide contour geometry');assert.equal(covered(mask,[.5,.5]),false,'Water must remain unmasked');assert.equal(covered(mask,[1.5,1.5]),true,'Islands inside water polygons remain land');assert.equal(covered(mask,[3.5,2]),false,'Overlapping/buffered water tiles must not form false land seams');assert.equal(covered(mask,[5,2]),false);assert.equal(covered(landOutsideWater([]),[.5,.5]),true,'Do not show contours over unclassified coastline while tiles load');assert.equal(covered(landOutsideWater([{geometry:{type:'LineString',coordinates:[]}}]),[.5,.5]),true);
console.log('EXPLORE_COAST_MASK_PASS: land, sea, islands, duplicate/overlapping water tiles and unloaded coastline.');
