// Process boundary used by Clojure HTTP integration facts; contains no assertions.
import pg from 'pg';
import {createMockSocial} from '../backend/messaging-mock.mjs';

const pool = new pg.Pool({connectionString: process.env.FINFOLK_TEST_DATABASE_URL});
let mock;
try {
  mock = await createMockSocial({db: {query: (...args) => pool.query(...args)},
    databaseURL: process.env.FINFOLK_TEST_DATABASE_URL,
    fixture: JSON.parse(process.env.FINFOLK_MOCK_FIXTURE ?? 'null'),
    enabled: process.env.FINFOLK_MOCK_ENABLED === '1'});
  console.log('MOCK_READY:' + JSON.stringify({url: mock.url, secret: mock.secret,
    adminToken: mock.adminToken, application: mock.application, inboxes: mock.inboxes,
    memberTokens: mock.memberTokens}));
  await new Promise(resolve => {process.once('SIGTERM', resolve); process.once('SIGINT', resolve);});
} catch {
  console.error('Native mock server failed to start'); process.exitCode = 1;
} finally {await mock?.close(); await pool.end();}
