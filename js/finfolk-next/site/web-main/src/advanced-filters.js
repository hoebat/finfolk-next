// Preserve the existing filter values/URLs while making the detailed controls optional.
const groups=[
  {id:'index',defaults:{'region-filter':'','index-waterbody':'','index-access':''}},
  {id:'suggest',defaults:{'recommendation-focus':'activity','suggest-area':'','suggest-waterbody':'','suggest-access':'','target-filter':'10','distance-filter':'','sort-filter':'name','camping-filter':false}},
];
export function installAdvancedFilters({onReset}) {
  const mounted=groups.map(group=>{
    const details=document.getElementById(group.id+'-advanced');
    if(!details)return null;
    const controls=Object.entries(group.defaults).map(([id,value])=>({control:document.getElementById(id),value}));
    const reset=document.getElementById(group.id+'-advanced-reset');
    reset.onclick=()=>{
      for(const {control,value} of controls)if(control.type==='checkbox')control.checked=value;else control.value=value;
      onReset();
    };
    return {controls,reset,badge:document.getElementById(group.id+'-advanced-count')};
  }).filter(Boolean);
  return function updateAdvancedFilters(){
    for(const {controls,reset,badge} of mounted){
      const count=controls.filter(({control,value})=>!control.disabled&&!control.closest('label').hidden&&(control.type==='checkbox'?control.checked!==value:control.value!==value)).length;
      badge.hidden=count===0;badge.textContent=String(count);badge.setAttribute('aria-label',`${count} active`);
      reset.disabled=count===0;
    }
  };
}
