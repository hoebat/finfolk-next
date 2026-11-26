import {createPublicSiteStore} from './site-directory-cache.js';
import {accountConfiguration} from './browser-client.js';
const sites=createPublicSiteStore({scope:async()=>(await accountConfiguration()).authProvider,load:async()=>{const {readPublicPageModel}=await import('./public-page-client.js');return readPublicPageModel('atlas','siteCatalog')}});
export const publicSites=sites;
export const readPublishedSites=()=>sites.read();
export const rememberPublishedSites=directory=>sites.remember(directory);
