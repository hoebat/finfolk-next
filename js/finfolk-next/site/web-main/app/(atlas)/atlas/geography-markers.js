// Combine nearby area summaries in screen space, retaining every site's count
// and bounds for the zoom action. Nothing is displaced from its map position.
export function clusterRegionMarkers(groups,project,{width,height,spacing=56}){
 const nodes=groups.filter(group=>{const p=project(group.point);return p.x>=-22&&p.y>=-22&&p.x<=width+22&&p.y<=height+22}).map(group=>[group]);
 const centre=members=>[0,1].map(axis=>members.reduce((sum,group)=>sum+group.point[axis],0)/members.length);
 let merged=true;
 while(merged){merged=false;outer:for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=project(centre(nodes[i])),b=project(centre(nodes[j]));if(Math.hypot(a.x-b.x,a.y-b.y)<spacing){nodes[i].push(...nodes[j]);nodes.splice(j,1);merged=true;break outer;}}}
 return nodes.map(members=>members.length===1?members[0]:{id:'areas:'+members.map(g=>g.id).sort().join('|'),name:members.map(g=>g.name).join(' · '),count:members.reduce((sum,g)=>sum+g.count,0),point:centre(members),points:members.flatMap(g=>g.points)});
}
