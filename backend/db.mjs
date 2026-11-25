import pg from 'pg';
export function database(connectionString) {
  const parsed = new URL(connectionString);
  if (parsed.searchParams.get('sslmode') === 'require')
    parsed.searchParams.set('sslmode', 'verify-full');
  const pool = new pg.Pool({
    connectionString: parsed.href,
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', () =>
    console.error(
      'Postgres idle connection closed; the next request will reconnect.',
    ),
  );
  async function query(text, values = []) {
    return (await pool.query(text, values)).rows;
  }
  async function transaction(fn) {
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      const result = await fn(async (text, values = []) => (await connection.query(text, values)).rows);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    } finally { connection.release(); }
  }
  return { query, transaction, pool };
}
