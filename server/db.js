// Postgres access for the API. On Vercel: Neon (or any Postgres) via DATABASE_URL.
// Locally (server/dev.js, server/test.js) a PGlite in-memory database is injected with setDb().
import pg from 'pg';
import { migrate } from './schema.js';

let db = null;
let ready = null;

// The common interface: query(text, params) → { rows }, exec(sql) for multi-statement scripts, tx(fn) for a transaction.
function fromPool(pool) {
  return {
    query: (text, params) => pool.query(text, params),
    exec: (sql) => pool.query(sql),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn({ query: (t, p) => client.query(t, p) });
        await client.query('commit');
        return out;
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw e;
      } finally { client.release(); }
    },
  };
}

export function setDb(custom) { db = custom; ready = null; }

export async function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Database belum terhubung (DATABASE_URL tidak ada).');
    db = fromPool(new pg.Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } }));
  }
  // Schema + seed once per cold start (idempotent).
  ready ||= migrate(db).catch((e) => { ready = null; throw e; });
  await ready;
  return db;
}

// PGlite adapter (dev/test): same interface as fromPool.
export function fromPglite(lite) {
  return {
    query: (text, params) => lite.query(text, params),
    exec: (sql) => lite.exec(sql),
    tx: (fn) => lite.transaction((t) => fn({ query: (q, p) => t.query(q, p) })),
  };
}
