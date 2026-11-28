import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
export async function checkFanOut(page,host,{pane='primary',trigger='.ff-primary-fab',itemsSelector='.ff-fan-destinations .ff-nav-item,.ff-account-widget>button'}={}){
 if(pane==='primary')assert.equal(await host.locator('.ff-fan-destinations').evaluate(element=>getComputedStyle(element).backgroundColor),'rgba(0, 0, 0, 0)','The fan origin stays transparent so the close icon is visible');
 const fab=await host.locator(trigger).boundingBox(),viewport=page.viewportSize(),items=host.locator(itemsSelector),panel=host.locator('.ff-pane-'+pane),boxes=[];
 assert.equal(await panel.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','The vertical menu has no card background');
 for(const item of await items.all()){
  await item.scrollIntoViewIfNeeded();const box=await item.boundingBox(),label=await item.locator('.ff-fan-caption,.ff-branch-caption').boundingBox();assert(Math.abs(box.width-48)<.1);assert(Math.abs(box.height-48)<.1);
  for(const rect of[box,label])assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width&&rect.y+rect.height<=viewport.height,'The action and its label fit the viewport');
  assert(Math.abs(box.x+24-fab.x-fab.width/2)<1,`Circular actions align vertically with the FAB: ${box.x+24} versus ${fab.x+fab.width/2}`);
  assert(label.x+label.width<box.x,'Labels sit to the left of the circles');
  assert(await item.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Each circle remains clickable');
  const scroll=await panel.evaluate(e=>e.scrollTop);boxes.push({y:box.y+scroll,labelY:label.y+scroll,labelHeight:label.height});
 }
 for(let i=1;i<boxes.length;i++){assert(boxes[i-1].y-boxes[i].y>=55,'Actions follow their declared order upwards from the bottom');assert(boxes[i].labelY+boxes[i].labelHeight<=boxes[i-1].labelY,'Labels do not overlap');}

}

export async function checkActionFan(page,host,pane,trigger){if(await host.locator('.ff-primary-fab').count())trigger='.ff-primary-fab';return checkFanOut(page,host,{pane,trigger,itemsSelector:'.ff-action-fan>.ff-fan-action'});}

export async function openMenuBranch(host,name){
 const branch=host.getByRole('button',{name,exact:true});
 if(!await branch.isVisible())await host.getByRole('button',{name:'Open menu',exact:true}).click();
 await branch.click();
}
export async function checkMenuFocus(host,name){
 const target=await host.locator('.ff-primary-fab').count()?host.locator('.ff-primary-fab'):host.getByRole('button',{name,exact:true});
 await expect(target).toBeFocused({timeout:30000});
 if(await host.locator('.ff-primary-fab').count())await checkSingleFab(host);
}
export async function checkSingleFab(host){
 await expect(host.getByRole('button')).toHaveCount(1,{timeout:30000});
 await expect(host.getByRole('button',{name:'Open menu',exact:true})).toBeVisible();
}
