import assert from 'node:assert/strict';
export async function checkFanOut(page,host){
 const fab=await host.locator('.ff-primary-fab').boundingBox(),viewport=page.viewportSize(),items=host.locator('.ff-fan-destinations .ff-nav-item'),boxes=[];
 assert.equal(await host.locator('.ff-pane-primary').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','Speed dial has no menu card');
 for(const item of await items.all()){
  const box=await item.boundingBox(),label=await item.locator(':scope>span').boundingBox();assert(Math.abs(box.width-48)<.1);assert(Math.abs(box.height-48)<.1);
  for(const rect of[box,label])assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width&&rect.y+rect.height<=viewport.height,'Action and label fit the viewport');
  assert(Math.hypot(box.x+24-fab.x-28,box.y+24-fab.y-28)>72,'Actions fan away from the FAB');
  assert(await item.evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('a')===e;}),'Each action is unobstructed');boxes.push({box,label});
 }
 const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){assert(Math.hypot(boxes[i].box.x-boxes[j].box.x,boxes[i].box.y-boxes[j].box.y)>=48,'Circular action targets do not overlap');assert(!overlaps(boxes[i].label,boxes[j].label),'Labels do not overlap');}
}
