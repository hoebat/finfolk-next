import assert from "node:assert/strict";
import {
  parseCommentCommand as parse,
  checkinDay,
  commentAllowed, commentRollout, publicStatus,
} from "../backend/instagram-commands.mjs";
for (const text of ["/STATUS @finfolk.com.au", "@FinFolk.com.au /status"])
  assert.equal(parse(text).command, "status");
assert.equal(parse("nice beach @finfolk.com.au"), null);
assert.equal(parse("/checkin @another"), null);
assert.equal(parse("/checkin @finfolk.com.au.evil"), null);
for (const text of [
  "/status /checkin Bondi @finfolk.com.au",
  "/status foo @finfolk.com.au",
  "/unknown @finfolk.com.au",
  "/checkin Bondi\n/status @finfolk.com.au",
])
  assert.equal(parse(text).command, "help");
assert.deepEqual(parse("/checkin 2026-10-20 Bondi Beach @finfolk.com.au"), {
  command: "checkin",
  args: { beach: "Bondi Beach", day: "2026-10-20" },
});
for (const input of ["20/10/2026", "2026-xx-xx", "2026-10-20T12:00"]) {
  const parsed = parse("/checkin " + input + " Bondi Beach @finfolk.com.au");
  assert.equal(
    parsed.args.day,
    input,
    "Malformed dates must not silently become today",
  );
}
const base = {
  now: new Date("2026-10-31T03:00:00Z"),
  timezone: "Australia/Sydney",
  commentAt: "2026-10-31T01:00:00Z",
};
assert.deepEqual(checkinDay(base), { day: "2026-10-31" });
assert.deepEqual(checkinDay({ ...base, day: "2026-10-02" }), {
  day: "2026-10-02",
});
for (const day of ["2026-10-01", "2026-11-01", "2026-02-30", "bad"])
  assert.ok(checkinDay({ ...base, day }).error);
assert.ok(
  checkinDay({ ...base, commentAt: "2026-10-30T01:00:00Z" }).confirmation,
);
assert.ok(checkinDay({ ...base, commentAt: null }).confirmation);
// DST start: calendar-day arithmetic, not fixed hours.
assert.deepEqual(
  checkinDay({
    now: new Date("2026-10-04T16:00:00Z"),
    commentAt: "2026-10-04T13:01:00Z",
    timezone: "Australia/Sydney",
  }),
  { day: "2026-10-05" },
);
assert.ok(
  checkinDay({
    now: new Date("2026-10-04T13:01:00Z"),
    commentAt: "2026-10-04T12:59:00Z",
    timezone: "Australia/Sydney",
  }).confirmation,
);
console.log("Instagram comment parser, dates, DST and midnight checks passed.");

const rollout = {INSTAGRAM_COMMAND_REPLIES_ENABLED:'true', INSTAGRAM_COMMENT_MODE:'public', INSTAGRAM_COMMENT_ACTIVE_SINCE:'2026-11-01T00:00:00Z'};
const fresh = {timestamp:'2026-11-02T00:00:00Z',media:{id:'123'}};
const clock = new Date('2026-11-03T00:00:00Z');
assert.equal(commentAllowed(rollout,fresh,clock),true);
for(const env of [{}, {...rollout,INSTAGRAM_COMMENT_MODE:'paused'}, {...rollout,INSTAGRAM_COMMENT_ACTIVE_SINCE:''}, {...rollout,INSTAGRAM_COMMAND_REPLIES_ENABLED:'false'}]) assert.equal(commentAllowed(env,fresh,clock),false);
assert.equal(commentAllowed(rollout,{...fresh,timestamp:'2026-10-31T00:00:00Z'},clock),false);
assert.equal(commentAllowed(rollout,{...fresh,timestamp:'2026-11-04T00:00:00Z'},clock),false);
assert.equal(commentAllowed({...rollout,INSTAGRAM_COMMENT_MODE:'pilot'},fresh,clock),false);
assert.equal(commentAllowed({...rollout,INSTAGRAM_COMMENT_MODE:'pilot',INSTAGRAM_COMMENT_TEST_POSTS:'123'},fresh,clock),true);
assert.deepEqual(commentRollout({}).commands,['help','status']);
assert.deepEqual(commentRollout({INSTAGRAM_COMMENT_COMMANDS:'unknown'}).commands,[]);

const queries = [];
assert.match(await publicStatus(async sql=>{queries.push(sql);return [];},'https://www.instagram.com/p/example/'),/has not been published/);
assert.equal(queries.length,2);
assert.ok(queries.every(sql=>!sql.includes("state='pending'") && !sql.includes('instagram_connections')));
assert.match(await publicStatus(async()=>[{id:'public-trip'}],'https://www.instagram.com/p/example/'),/public-trip/);
assert.equal(await publicStatus(async()=>{throw Error('Should not query without a source');},null),'This post has not been published on FinFolk.');

// Bare commands are accepted only after provider-verified brand ownership.
assert.equal(parse('/ping'),null);
assert.equal(parse('/ping',{allowUnmentioned:true}).command,'ping');
for(const text of ['/menu','/site','/privacy'])assert.ok(parse(text,{allowUnmentioned:true}));
assert.equal(parse('/site @finfolk.com.au.evil'),null);
assert.equal(parse('/menu @finfolk.com.au').command,'help');
for(const name of ['connect','cancel','disconnect','points','in','out','claim']){
 const result=parse('/'+name+' never-store-this @finfolk.com.au');
 assert.equal(result.command,'help');assert.ok(!JSON.stringify(result).includes('never-store-this'));
}
const {publicCommentReply}=await import('../backend/instagram-commands.mjs');
const sharedEnv={INSTAGRAM_COMMENT_COMMANDS:'help,status,ping,site,privacy'};
for(const text of ['/help','/ping','/site','/privacy','/help account','/help diagnostics']){
 const reply=publicCommentReply(parse(text,{allowUnmentioned:true}),sharedEnv);
 assert.equal(typeof reply,'string');assert.ok(Buffer.byteLength(reply)<900);
}
assert.match(publicCommentReply(parse('/connect private-code',{allowUnmentioned:true}),sharedEnv),/in a DM/);
console.log('SHARED_COMMENT_PARSER_PASS: public aliases, verified-owned plain commands, private-command guidance and no argument leaks.');
