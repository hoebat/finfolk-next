import assert from 'node:assert/strict';
import { parseInstagramCommand } from '../backend/instagram-dm.mjs';
import { InstagramProvider } from '../backend/instagram-provider.mjs';
import { claimsEnabled } from '../backend/instagram-claims.mjs';
assert.deepEqual(parseInstagramCommand(' /HeLp '),{command:'help',args:''});
assert.deepEqual(parseInstagramCommand('/claim '+'a'.repeat(24)),{command:'claim_retired',args:''});
assert.equal(parseInstagramCommand('/claim bad').command,'claim_retired');
assert.deepEqual(parseInstagramCommand('/in Brighton Beach, VIC'),{command:'in',args:'Brighton Beach, VIC'});
assert.deepEqual(parseInstagramCommand('/out'),{command:'out',args:''});
assert.equal(parseInstagramCommand('/out extra').command,'unknown');
assert.deepEqual(parseInstagramCommand('/checkin Bondi Beach'),{command:'in',args:'Bondi Beach'});
assert.equal(parseInstagramCommand('please /points').command,'prompt');
assert.equal(parseInstagramCommand('/points extra').command,'unknown');
assert.equal(parseInstagramCommand('/claim '+ 'a'.repeat(24)+'\n/points').command,'unknown');
assert.equal(claimsEnabled({INSTAGRAM_AUTO_CLAIM_ENABLED:'true'}),false);
const env={provider:'instagram-facebook',graphVersion:'v26.0',token:'test',appId:'111',pageId:'222',accountId:'333'};
const instagramSender=(sender,config,fetcher)=>new InstagramProvider(config,fetcher).profile(sender);
await assert.rejects(()=>instagramSender('100',env,async()=>({ok:true,json:async()=>({id:'100',username:'alice'})})),/could not confirm/);
assert.deepEqual(await instagramSender('100',env,async()=>({ok:true,json:async()=>({id:'100',username:'Alice',is_user_follow_business:false})})),{handle:'alice',follows:false});
console.log('Instagram DM parser/provider checks passed: exact slash syntax, code hashing, private command parsing and fail-closed follow/identity checks.');

await assert.rejects(()=>instagramSender('100',env,async()=>({ok:true,json:async()=>({id:'wrong',username:'alice',is_user_follow_business:true})})),/could not confirm/);

const {helpText} = await import('../backend/instagram-dm-commands.mjs');
const {requiresFollower,hasPersonalCommands} = await import('../backend/messaging-config.mjs');
for (const command of ['help','ping','site','privacy','disconnect','unknown','prompt','claim_retired','status','cancel']) assert.equal(requiresFollower(command),false);
for (const command of ['connect','in','out','points']) assert.equal(requiresFollower(command),true);
assert.equal(hasPersonalCommands(['help','ping']),false);
assert.equal(hasPersonalCommands(['help','connect']),true);
const basicHelp=helpText(['help','ping']);
assert.match(basicHelp,/Hey! Welcome to FinFolk/);
assert.match(basicHelp,/https:\/\/finfolk\.com\.au/);
assert.match(basicHelp,/You don’t need to follow or connect/);
assert.ok(!basicHelp.includes('/claim'));
assert.ok(!basicHelp.includes('/checkin'));
assert.ok(Buffer.byteLength(helpText(),'utf8')<900);
console.log('PUBLIC_HELP_PASS: welcoming bounded help, enabled commands only, no registration or follower requirement; personal commands retain follower policy.');

for(const [input,expected] of [['/MENU','help'],['help','help'],['/site','site'],['/privacy','privacy'],['/cancel','cancel'],['/disconnect','disconnect']])assert.equal(parseInstagramCommand(input).command,expected);
assert.deepEqual(parseInstagramCommand('/help ACCOUNT'),{command:'help',args:'account'});
assert.equal(parseInstagramCommand('/in '+ 'x'.repeat(201)).command,'unknown','Overlong locations cannot be silently truncated and executed');
const {publicInstagramReply}=await import('../backend/instagram-dm-commands.mjs');
for(const input of ['/site','/privacy','/disconnect','/help account','/help diagnostics','/ping extra']){
 const reply=publicInstagramReply({...parseInstagramCommand(input),correlation_id:'test'});
 assert.equal(typeof reply,'string');assert.ok(Buffer.byteLength(reply)<1000);
}
assert.match(publicInstagramReply(parseInstagramCommand('/ping extra')),/Usage: \/ping/);
console.log('SHARED_COMMANDS_PASS: aliases, help topics, navigation, privacy, management guidance and bounded arguments.');

assert.ok(!publicInstagramReply({command:'help',args:'account'},{MESSAGING_ENABLED_COMMANDS:['help','connect']}).includes('/status'),'Account help only advertises enabled status');
