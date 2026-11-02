export const AVAILABILITY=['weekday mornings','weekday afternoons','weekend mornings','weekend afternoons'];
export const EXPERIENCES={new:'New to freediving',comfortable:'Comfortable in the water',experienced:'Experienced'};
export const SHARING={visits:'Visit days',months:'Active months',dives:'Dive count',time:'Time in the water',depth:'Typical depth'};
export const profileURL=(screen='me',values={})=>{
 const url=new URL('./profiles',location.href);url.searchParams.set('screen',screen);
 for(const [key,value]of Object.entries(values))if(value)url.searchParams.set(key,value);
 return url.pathname+url.search;
};
export function socialURL(value,platform){
 try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.hostname.replace(/^www\./,'')!==platform+'.com')return null;
 const pattern=platform==='instagram'?/^\/[A-Za-z0-9._]{1,30}\/?$/:/^\/@[A-Za-z0-9._]{1,30}\/?$/;
 return pattern.test(url.pathname)&&!['p','reel','accounts','stories','explore'].includes(url.pathname.split('/')[1])?url.href:null;}catch{return null;}
}
export function publishedLogs(rows,selected,owner){
 const publicRows=rows.filter(row=>row.visibility==='public'&&(!owner||row.ownerId===owner));
 return Array.isArray(selected)?selected.map(id=>publicRows.find(row=>row.id===id)).filter(Boolean):publicRows.slice(0,6);
}
export async function portraitDataURL(file,win=window){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP portrait.');
 if(file.size>2*1024*1024)throw Error('Choose a portrait of 2 MiB or less.');
 const source=win.URL.createObjectURL(file),image=new win.Image();
 try{
  image.src=source;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40_000_000)throw Error('Choose a smaller portrait.');
  const canvas=win.document.createElement('canvas'),scale=Math.min(1,480/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  for(const mime of ['image/webp','image/jpeg'])for(const quality of [.8,.65,.5]){const data=canvas.toDataURL(mime,quality);if(data.startsWith('data:'+mime+';base64,')&&data.length<=65_558)return data;}
  throw Error('Choose a simpler or smaller portrait.');
 }finally{win.URL.revokeObjectURL(source);}
}
