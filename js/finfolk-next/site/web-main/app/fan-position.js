// Keep each fan centred on its own trigger and its labels outside the targets.
export function fanPosition(index,count,kind='primary'){
 const angle=(kind==='account'?(count===1?90:60+60*index/(count-1)):kind==='context'?(count===1?90:35+75*index/(count-1)):12+78*index/Math.max(1,count-1))*Math.PI/180;
 const dx=Math.cos(angle),dy=Math.sin(angle),radius=kind==='account'?120:kind==='context'?132:156,labelRadius=30+35*Math.abs(dx)+11*dy;
 return {'--fan-x':(-radius*dx)+'px','--fan-y':(-radius*dy)+'px','--fan-label-x':(-labelRadius*dx)+'px','--fan-label-y':(-labelRadius*dy)+'px','--fan-delay':(index*30)+'ms'};
}
