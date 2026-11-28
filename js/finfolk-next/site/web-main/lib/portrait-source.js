export const validPortrait=value=>typeof value==='string'&&value.length<=65558&&/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value);
export function portraitBlob(value){
 if(!validPortrait(value))return null;
 const split=value.indexOf(','),type=value.slice(5,value.indexOf(';')),bytes=Uint8Array.from(atob(value.slice(split+1)),c=>c.charCodeAt(0));
 return new Blob([bytes],{type});
}
