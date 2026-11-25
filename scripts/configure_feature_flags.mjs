// Private local app.manage connection setup. Never prints the management token.
import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function validateSettings(value){
 let url;try{url=new URL(value.apiOrigin);}catch{throw Error('Choose a valid flag API origin.');}
 if(!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Use an HTTPS origin or a loopback HTTP origin, without a path or credentials.');
 if(typeof value.managementToken!=='string'||! /^[!-~]{32,4096}$/.test(value.managementToken))throw Error('A management token of at least 32 characters is required.');
 return {apiOrigin:url.origin,managementToken:value.managementToken};
}
export async function configure({root,apiOrigin,tokenFile,generate=false,replace=false,check=false}){
 const destination=path.join(root,'config/feature-flags.local.json');
 if(check){
  const config=validateSettings(JSON.parse(await readFile(destination,'utf8')));
  const response=await fetch(config.apiOrigin+'/v1/admin/feature-flags',{headers:{Authorization:'Bearer '+config.managementToken},redirect:'error',signal:AbortSignal.timeout(15000)});
  const result={configuration:destination,apiOrigin:config.apiOrigin,connected:response.ok,status:response.status};
  if(response.ok){const data=await response.json();result.environment=data.environment;result.flags=data.flags?.length;}
  return result;
 }
 if(generate===Boolean(tokenFile))throw Error('Choose exactly one of --generate or --token-file.');
 const config=validateSettings({apiOrigin:apiOrigin||'https://api.finfolk.com.au',managementToken:generate?randomBytes(32).toString('hex'):(await readFile(tokenFile,'utf8')).trim()});
 try{await stat(destination);if(!replace)throw Error('Private flag configuration already exists; use --replace intentionally.');}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(path.dirname(destination),{recursive:true});
 const temporary=destination+'.'+randomBytes(8).toString('hex')+'.tmp';
 await writeFile(temporary,JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});
 await rename(temporary,destination);
 return {configuration:destination,apiOrigin:config.apiOrigin,connected:false,requiresMatchingApiSecret:'FINFOLK_FLAG_MANAGEMENT_TOKEN'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),options={root:fileURLToPath(new URL('../',import.meta.url))};
  for(let i=0;i<args.length;i++){
   const arg=args[i];if(['--generate','--replace','--check'].includes(arg))options[arg.slice(2)]=true;
   else if(['--root','--api-origin','--token-file'].includes(arg)&&args[i+1])options[{'--root':'root','--api-origin':'apiOrigin','--token-file':'tokenFile'}[arg]]=args[++i];
   else throw Error('Use --api-origin, --token-file or --generate, --replace, --check.');
  }
  const result=await configure(options);console.log(JSON.stringify(result,null,2));if(options.check&&!result.connected)process.exitCode=1;
 }catch(error){console.error(error.code==='ENOENT'?'Private flag configuration or token file is missing.':error instanceof SyntaxError?'Private flag configuration JSON is invalid.':error.message);process.exitCode=1;}
}
