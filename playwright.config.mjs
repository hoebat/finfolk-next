import {defineConfig} from '@playwright/test';
if(process.platform==='darwin')process.env.TMPDIR='/private/tmp';
export default defineConfig({testDir:'tests/browser',timeout:60000,workers:1,fullyParallel:false,
 reporter:[['list'],['junit',{outputFile:'.cache/test-results/browser.xml'}]],
 use:{baseURL:'http://127.0.0.1:8137',headless:true,trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'firefox',use:{browserName:'firefox'}},{name:'webkit',use:{browserName:'webkit'}}],
 webServer:{command:'node tests/browser/server.mjs',url:'http://127.0.0.1:8137/__test',reuseExistingServer:false},
 outputDir:'.cache/browser-results'});
