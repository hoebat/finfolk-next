const locationName=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+beach\s*$/,'').replace(/[^a-z0-9]+/g,' ').trim();
export function directoryLocation(beach){return {state:beach.state_id||beach.state||'',locality:beach.name.split(' · ')[0].replace(/\s+Beach$/i,'')};}
export function businessesAtBeach(rows,beach){
 const names=new Set([beach.name,...(beach.aliases||[])].map(locationName).filter(Boolean)),states=new Set([beach.state_id,beach.state].map(locationName).filter(Boolean));
 return rows.filter(row=>(!row.country||['australia','au','aus'].includes(locationName(row.country)))&&states.has(locationName(row.state))&&String(row.locality||'').split(/[,;|\n]/).some(value=>names.has(locationName(value))));
}
