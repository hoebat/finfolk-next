const states=new Set(['NSW','VIC','QLD','WA','SA','TAS','ACT','NT']);
export function locationHint(geo){const country=/^[A-Z]{2}$/.test(geo?.country?.code||'')?geo.country.code:null,subdivision=typeof geo?.subdivision?.code==='string'?geo.subdivision.code.replace(/^AU-/,''):null,state=country==='AU'&&states.has(subdivision)?subdivision:null;return {country,state};}
export function locationResponse(geo){return Response.json(locationHint(geo),{headers:{'Cache-Control':'private, no-store','Vary':'*'}});}
