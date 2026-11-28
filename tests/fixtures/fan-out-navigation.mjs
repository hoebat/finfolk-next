import assert from 'node:assert/strict';
export async function checkFanOut(page,host,{pane='primary',trigger='.ff-primary-fab',itemsSelector='.ff-fan-destinations .ff-nav-item,.ff-account-widget>button'}={}){
 const fab=await host.locator(trigger).boundingBox(),viewport=page.viewportSize(),items=host.locator(itemsSelector),boxes=[];
 assert.equal(await host.locator('.ff-pane-'+pane).evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','Speed dial has no menu card');
 for(const item of await items.all()){
  const box=await item.boundingBox(),label=await item.locator('.ff-fan-caption,.ff-branch-caption').boundingBox();assert(Math.abs(box.width-48)<.1);assert(Math.abs(box.height-48)<.1);
  for(const rect of[box,label])assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width&&rect.y+rect.height<=viewport.height,'Action and label fit the viewport');
  assert(Math.hypot(box.x+24-fab.x-fab.width/2,box.y+24-fab.y-fab.height/2)>72,'Actions fan away from the FAB');
  assert(await item.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Each action is unobstructed');boxes.push({box,label});
 }
 const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){assert(Math.hypot(boxes[i].box.x-boxes[j].box.x,boxes[i].box.y-boxes[j].box.y)>=48,'Circular action targets do not overlap');assert(!overlaps(boxes[i].label,boxes[j].label),'Labels do not overlap');}
}

export async function checkActionFan(page,host,pane,trigger){if(await host.locator('.ff-primary-fab').count())trigger='.ff-primary-fab';return checkFanOut(page,host,{pane,trigger,itemsSelector:'.ff-action-fan>.ff-fan-action'});}

export async function openMenuBranch(host,name){
 const branch=host.getByRole('button',{name,exact:true});
 if(!await branch.isVisible())await host.getByRole('button',{name:'Open menu',exact:true}).click();
 await branch.click();
}
export async function checkMenuFocus(host,name){
 const target=await host.locator('.ff-primary-fab').count()?host.locator('.ff-primary-fab'):host.getByRole('button',{name,exact:true});
 assert(await target.evaluate(element=>element===document.activeElement),'Focus returns to the menu trigger');
 if(await host.locator('.ff-primary-fab').count())await checkSingleFab(host);
}
export async function checkSingleFab(host){
 assert.equal(await host.getByRole('button').count(),1,'The collapsed mobile menu has exactly one button');
 assert(await host.getByRole('button',{name:'Open menu',exact:true}).isVisible());
}
