import {test,expect} from '@playwright/test';
test('a stalled storage worker falls back within two seconds and preserves online reads',async({page})=>{
 await page.goto('/__test');
 const result=await page.evaluate(async()=>{
  const port={postMessage(){},addEventListener(){},start(){},close(){}};
  globalThis.SharedWorker=class{constructor(){this.port=port}};
  const {createApplicationBackbone}=await import('/next-backbone.js');
  const messages=[];window.addEventListener('finfolk:cache-status',e=>messages.push(e.detail));
  const start=performance.now(),app=createApplicationBackbone({authUrl:'https://stalled.invalid',apiUrl:location.origin,cacheBackend:'sqlite'});
  const value=await app.member('alice',async()=>({name:'Online'})).call('me');
  return {value,elapsed:performance.now()-start,fallback:messages.some(m=>m.mode==='unavailable')};
 });
 expect(result.value).toEqual({name:'Online'});expect(result.elapsed).toBeLessThan(4000);expect(result.fallback).toBe(true);
});
