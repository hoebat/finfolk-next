import {mockAtlas} from './nextjs-atlas.mjs';
import {postsModule} from './nextjs-posts.mjs';
const extension=`
const previousIntegrationCall=api.call.bind(api),integrationCounts=new Map();window.integrationReads=[];window.integrationReleases=[];
window.setIntegrationActor=id=>{user=id?{uid:id,emailVerified:true}:null;notify();};api.ensureProfile=async()=>{};api.list=async()=>({sessions:[],more:false,cursor:null});api.profile=async()=>({displayName:user?.uid==='bob'?'Bob':'Alice'});
api.call=async(action,values={})=>{
 if(action==='me'&&user?.uid==='bob'){window.accountCalls.push({action,value:values});return {id:'bob',profile:{displayName:'Bob',bio:'',open:false,beaches:[],sharing:{},activities:[],availability:[],experience:''}};}
 if(action==='instagramDiscoveryStatus'){
  const owner=user,count=(integrationCounts.get(owner.uid)||0)+1;integrationCounts.set(owner.uid,count);const result={collection:owner.uid==='alice',publication:true,hashtags:false,pending:(owner.uid==='alice'?100:200)+count,sources:[]};window.accountCalls.push({action,value:values});window.integrationReads.push({actor:owner.uid,count});
  if(window.holdIntegrationRead){window.holdIntegrationRead=false;await new Promise(resolve=>window.integrationReleases.push(resolve));}
  if(window.failIntegrationRead){window.failIntegrationRead=false;throw Error('Integration status unavailable.');}
  return result;
 }
 return previousIntegrationCall(action,values);
};
`;
export async function mockAccountIntegration(page,base){await mockAtlas(page,base);await page.route('**/neon-client.js',route=>route.fulfill({contentType:'text/javascript',body:postsModule+extension}));}
