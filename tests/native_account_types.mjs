import assert from 'node:assert/strict';
import ts from 'typescript';
import {resolve} from 'node:path';
const file=resolve('.cache/native-account-contract-check.ts');
const declaration=resolve('js/finfolk-next/packages/edge/native-account');
const source=`import type {NativeAccountOperations,NativeAccountProfile} from ${JSON.stringify(declaration)};
declare const save:(value:NativeAccountOperations["preferences"]["input"])=>void;
save({profile:{displayName:"Diver",activities:["freediving"],depthGoal:null,sharing:{depth:true}}});
// @ts-expect-error Unknown activity must not compile.
save({profile:{activities:["skydiving"]}});
// @ts-expect-error Roles cannot be assigned through a preference patch.
save({profile:{admin:true}});
// @ts-expect-error Sharing flags must be booleans.
save({profile:{sharing:{depth:"yes"}}});
save({profile:{portrait:"",featuredLogs:["fixture-id"],featuredPosts:[]}});
// @ts-expect-error Featured selections contain IDs, not embedded client-owned records.
save({profile:{featuredLogs:[{id:"untrusted"}]}});
declare const stats:NativeAccountOperations["stats"]["output"];
const minutes:number|null|undefined=stats.stats.minutes;
// @ts-expect-error A statistics response has no private session notes.
const notes=stats.stats.notes;
declare const profile:NativeAccountProfile;
const depth:number|null|undefined=profile.depthGoal;
declare const published:NonNullable<NativeAccountOperations["publicSession"]["output"]>;
const visibility:"public"=published.visibility;
declare const header:NativeAccountOperations["publicProfile"]["output"];
// @ts-expect-error Sharing preferences cannot appear in a public profile.
const privateSharing=header.sharing;
declare const site:NativeAccountOperations["siteDetail"]["output"];
const longitude:number=site.point[0];
const attribution:string=site.attribution;
// @ts-expect-error Private site payload fields never enter public UI types.
const privateSiteNote=site.privateNote;
declare const draft:NativeAccountOperations["siteSubmissionSave"]["output"];
const version:number=draft.version;
// @ts-expect-error Review payloads do not grant an owner-controlled role field.
const draftRole=draft.payload.admin;
declare const delivered:NativeAccountOperations["eventInviteRetry"]["output"];
const deliveryState:"queued"|"sending"|"sent"|"failed"|"cancelled"=delivered.delivery.state;
// @ts-expect-error Encrypted work never enters generated UI types.
const ciphertext=delivered.delivery.sealed_token;
declare const discover:(value:NativeAccountOperations["directoryDiscover"]["input"])=>void;
discover({region:"Sydney",state:"NSW",category:"School"});
// @ts-expect-error Internal discovery completion payloads are server-only.
discover({region:"Sydney",state:"NSW",category:"School",candidates:[]});

`;
const options={noEmit:true,strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,types:[]};
const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
host.readFile=path=>path===file?source:read(path);host.fileExists=path=>path===file||exists(path);
const program=ts.createProgram([file],options,host),diagnostics=ts.getPreEmitDiagnostics(program);
assert.deepEqual(diagnostics.map(item=>ts.flattenDiagnosticMessageText(item.messageText,'\n')),[]);
console.log('PASS: generated account types compile and reject invalid preference patches');
