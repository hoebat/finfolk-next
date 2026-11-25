import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
// macOS 27 protects Firefox's shared app-data directory independently of -profile.
// Keep automated Firefox data inside this repository's ignored test cache.
// https://github.com/microsoft/playwright/issues/42768
export function firefoxLaunchOptions(){
 if(process.platform!=='darwin')return {};
 const appData=resolve('.cache/playwright/firefox-app-data');mkdirSync(appData,{recursive:true});
 return {env:{...process.env,CFFIXED_USER_HOME:appData}};
}
