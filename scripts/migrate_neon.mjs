import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { createHash } from 'node:crypto';
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url)
  throw Error(
    'DATABASE_URL_UNPOOLED is required. Run neon deploy or neon env pull.',
  );
if (new URL(url).hostname.includes('-pooler'))
  throw Error('Use the direct connection for migrations.');
const migrationDirectory=process.env.FINFOLK_TEST_MIGRATIONS_DIR
  ? new URL('file://'+process.env.FINFOLK_TEST_MIGRATIONS_DIR.replace(/\/$/,'')+'/')
  : new URL('../backend/migrations/', import.meta.url);
if(process.env.FINFOLK_TEST_MIGRATIONS_DIR &&
  (url!==process.env.FINFOLK_TEST_DATABASE_URL || !['127.0.0.1','localhost','postgres'].includes(new URL(url).hostname) || !/^\/finfolk_test_/.test(new URL(url).pathname)))throw Error('Migration fixture overrides require a disposable local test database.');
const migrationNames = (await readdir(migrationDirectory)).filter(n => n.endsWith('.sql')).sort();
const through = process.env.MIGRATIONS_THROUGH;
if (through && !migrationNames.includes(through)) throw Error('Unknown migration boundary.');
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(76425381)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS public.finfolk_migrations(name text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz DEFAULT now())',
  );
  for (const name of migrationNames) {
    if (through && name > through) break;
    const body = await readFile(
        new URL(name, migrationDirectory),
        'utf8',
      ),
      hash = createHash('sha256').update(body).digest('hex'),
      { rows } = await client.query(
        'SELECT hash FROM public.finfolk_migrations WHERE name=$1',
        [name],
      );
    if (rows.length) {
      if (rows[0].hash !== hash)
        throw Error('Previously applied migration changed: ' + name);
      continue;
    }
    await client.query(body);
    await client.query(
      'INSERT INTO public.finfolk_migrations(name,hash) VALUES($1,$2)',
      [name, hash],
    );
    console.log('Applied ' + name);
  }
  const catalog = JSON.parse(
    await readFile(
      process.env.BEACH_CATALOG ||
        new URL('../js/finfolk-next/site/web-main/src/beaches.json', import.meta.url),
      'utf8',
    ),
  );
  const zones = {
    VIC: 'Australia/Melbourne',
    NSW: 'Australia/Sydney',
    JBT: 'Australia/Sydney',
    QLD: 'Australia/Brisbane',
    SA: 'Australia/Adelaide',
    WA: 'Australia/Perth',
    NT: 'Australia/Darwin',
    TAS: 'Australia/Hobart',
    ACT: 'Australia/Sydney',
  };
  const canonical = catalog.beaches.map((b) => {
    const state = String(b.state_id || b.state || '').toUpperCase();
    const zone =
      b.timezone ||
      (b.area_id?.includes('lord-howe')
        ? 'Australia/Lord_Howe'
        : b.area_id?.includes('christmas')
          ? 'Indian/Christmas'
          : b.area_id?.includes('cocos')
            ? 'Indian/Cocos'
            : zones[state]) ||
      'Australia/Sydney';
    return { id: b.id, name: b.name, timezone: zone, area_name: b.area_name || '', state };
  });
  await client.query(
    'INSERT INTO finfolk.beaches(id,name,timezone,area_name,state) SELECT id,name,timezone,area_name,state FROM jsonb_to_recordset($1::jsonb) AS b(id text,name text,timezone text,area_name text,state text) ON CONFLICT(id) DO UPDATE SET name=excluded.name,timezone=excluded.timezone,area_name=excluded.area_name,state=excluded.state',
    [JSON.stringify(canonical)],
  );
  await client.query('COMMIT');
  console.log('Canonical beaches seeded: ' + catalog.beaches.length);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
