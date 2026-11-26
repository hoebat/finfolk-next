// Reviewed public links, authored here. Add location evidence before associating a source.
// Keep regional material explicitly nearby; do not infer a beach from a search result.
export const beachWebCollections=[{
 id:'becher-point-wa',
 site_ids:['35625ef1-6f46-53de-ac20-5483e6e6b2c4'],
 state:'WA',names:['Becher Point Beach','Becher Point','Becher Pt'],
 bounds:[115.68,-32.40,115.75,-32.34],
 query:'Becher Point Port Kennedy Western Australia',
 sources:[
  {id:'becher-photo',kind:'Photograph',title:'Becher Point, through a local lens',publisher:'Calistemon · Wikimedia Commons',url:'https://commons.wikimedia.org/wiki/File:Becher_Point,_Western_Australia,_July_2023_01.jpg',summary:'A view of the point at Port Kennedy, photographed on 14 July 2023.',association:'beach',reviewed_at:'2026-11-26',image:{url:'https://upload.wikimedia.org/wikipedia/commons/2/26/Becher_Point%2C_Western_Australia%2C_July_2023_01.jpg',alt:'Becher Point at Port Kennedy, Western Australia, in July 2023',credit:'Calistemon',licence:'CC BY-SA 4.0',licence_url:'https://creativecommons.org/licenses/by-sa/4.0/'}},
  {id:'becher-walk-south',kind:'Walking guide',title:'Secret Harbour to Becher Point',publisher:'Garry Middle · Perth-Peel Coastal Walk Trail',url:'https://perthpeelcoastalwalk.com/secret-harbour-to-becher-point',summary:'A photo guide to the coastal walk from Secret Harbour to the point.',association:'beach',reviewed_at:'2026-11-26'},
  {id:'becher-walk-north',kind:'Walking guide',title:'Port Kennedy coast to Becher Point',publisher:'Garry Middle · Perth-Peel Coastal Walk Trail',url:'https://perthpeelcoastalwalk.com/nude-beach-to-becher-point',summary:'Beach photographs and a walking route approaching the point from the north.',association:'beach',reviewed_at:'2026-11-26'},
  {id:'becher-beachsafe',kind:'Beach reference',title:'Becher Pt beach guide',publisher:'Surf Life Saving Australia · Beachsafe',url:'https://www.beachsafe.org.au/beach/wa/rockingham/port-kennedy/becher-pt',summary:'The Beachsafe reference for Becher Pt, beach WA 794.',association:'beach',reviewed_at:'2026-11-26'},
  {id:'becher-wetlands',kind:'Nature',title:'The Becher Point Wetlands',publisher:'Australian Government · DCCEEW',url:'https://www.dcceew.gov.au/water/wetlands/australian-ramsar-wetlands/becher-point-wetlands',summary:'The nearby inland Ramsar wetlands and their coastal dune landscape.',association:'nearby',reviewed_at:'2026-11-26'}
 ]
},{
 id:'port-melbourne-vic',state:'VIC',site_ids:[],names:['Port Melbourne Beach'],bounds:[144.92,-37.85,144.96,-37.83],
 sources:[],videos:[{id:'RMNxzur-zYk',title:'Port Melbourne Beach Walking Tour',author:'WANDER',source:'https://www.youtube.com/watch?v=RMNxzur-zYk',reviewed_at:'2026-11-26'}]
}];

// Existing reviewed social.json entries use these legacy identifiers.
export const socialBeachIdentities=[
 {id:'bondi',site_ids:['bondi','e0585b2a-67e1-561b-ac30-a8d066799b65'],state:'NSW',names:['Bondi Beach'],bounds:[151.26,-33.91,151.30,-33.87]},
 {id:'hyams-beach',site_ids:['hyams-beach','2b3194f9-17ec-5058-ab7e-e89ee899d435','7de42fb4-4741-50e7-a8e2-ab8f288473c6'],state:'NSW',names:['Hyams Beach'],bounds:[150.68,-35.13,150.72,-35.08]},
 {id:'whitehaven',site_ids:['whitehaven','37f1b67c-3a36-51e0-a649-5e602c564a10'],state:'QLD',names:['Whitehaven Beach'],bounds:[149.01,-20.32,149.07,-20.23]},
 {id:'lucky-bay',site_ids:['lucky-bay','c1ad2ee3-fc4e-5359-aecd-7e6fc3b194e7'],state:'WA',names:['Lucky Bay','Lucky Bay Beach'],bounds:[122.20,-34.02,122.27,-33.96]},
 {id:'hellfire-bay',site_ids:['hellfire-bay','b6ff2182-3bbd-5de2-a16f-ea72c85b63a3'],state:'WA',names:['Hellfire Bay','Hellfire Bay Beach'],bounds:[122.14,-34.03,122.19,-33.98]},
 {id:'brighton-vic',site_ids:['brighton','brighton-vic','6623d714-8e68-5530-a2ea-f0c9bcfc75fb'],state:'VIC',names:['Brighton Beach','Dendy Street Beach'],bounds:[144.97,-37.94,145.00,-37.90]},
 {id:'surfers-paradise',site_ids:['surfers-paradise','ecc3f90f-d18a-554a-ae49-4108d14346e2'],state:'QLD',names:['Surfers Paradise','Surfers Paradise Beach'],bounds:[153.42,-28.02,153.45,-27.98]}
];
