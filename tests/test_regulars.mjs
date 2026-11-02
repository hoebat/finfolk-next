import assert from 'node:assert/strict';
import {
  windowFor,
  localDay,
  visitCount,
  tierFor,
  visibleStats,
  preferences,
  compatibility,
  socialPost,
  profilePortrait,
} from '../backend/community-core.mjs';
const now = new Date('2026-10-31T00:00:00Z'),
  zone = 'Australia/Sydney',
  viewer = { open: true },
  owner = { open: true },
  days = Array.from({length:8},(_,i)=>'2026-10-'+String(24+i));
assert.deepEqual(windowFor(now, zone), {
  today: '2026-10-31',
  start: '2026-10-02',
});
assert.equal(
  visitCount(
    ['2026-10-01', '2026-10-02', '2026-10-02', '2026-11-01'],
    now,
    zone,
  ),
  1,
);
const tier = (a, b, extra = {}) =>
  tierFor({
    viewer,
    owner,
    viewerDays: days.slice(0, a),
    ownerDays: days.slice(0, b),
    now,
    zone,
    ...extra,
  });
assert.equal(tier(2, 5), 0);
assert.equal(tier(3, 3), 0);
assert.equal(tier(8, 7), 0);
assert.equal(tier(8, 8), 2);
assert.equal(tier(8, 8, {viewerDays:Array(8).fill(days[0])}), 0);
assert.equal(tier(8, 8, { owner: { open: false } }), 0);
assert.equal(tier(0, 0, { connection: 'accepted', owner: { open: false } }), 2);
assert.equal(tier(8, 8, { connection: 'accepted', blocked: true }), -1);
assert.equal(tier(8, 8, { now: new Date('2026-12-01T00:00:00Z') }), 0);
assert.equal(localDay(new Date('2026-10-03T14:30:00Z'), zone), '2026-10-04');
assert.deepEqual(
  visibleStats(
    { visits: 5, dives: 9, typicalDepth: 30 },
    { visits: true, depth: true },
    1,
  ),
  { visits: 5 },
);
assert.deepEqual(
  visibleStats(
    { visits: 5, dives: 9, typicalDepth: null },
    { visits: true, depth: true },
    2,
  ),
  { visits: 5, typicalDepth: null },
);
assert.equal(preferences().open, false);
assert.ok(Object.values(preferences().sharing).every((v) => v === false));
assert.throws(() =>
  preferences({ instagram: 'https://instagram.com.evil.test/a' }),
);
assert.throws(() => socialPost('javascript:alert(1)'));
assert.ok(
  socialPost('https://www.tiktok.com/@finfolk/video/123').includes(
    '/video/123',
  ),
);
const p = {
  beaches: ['bondi'],
  activities: ['freediving'],
  availability: ['weekend mornings'],
  experience: 'new',
  depthGoal: 10,
};
const portrait='data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
assert.equal(profilePortrait(portrait),portrait);assert.equal(profilePortrait(''),'');
for(const invalid of ['https://example.test/avatar.webp','data:image/svg+xml;base64,PHN2Zz4=','data:image/webp;base64,AAAA',portrait+'A'.repeat(70000)])assert.throws(()=>profilePortrait(invalid));
assert.deepEqual(preferences({featuredLogs:['same','same','<script>'],featuredPosts:['post-one']}).featuredLogs,['same']);
assert.equal(compatibility(p, p).reasons.length, 5);
console.log(
  'Regulars rules passed: rolling 30 days, 8-day gate, timezone/DST, reciprocity, expiry, accepted buddies, blocks and opt-in fields.',
);
