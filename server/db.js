// Postgres access for the API. On Vercel: DATABASE_URL (Neon) or POSTGRES_URL (the database Vercel's
// Supabase integration connects — used as plain Postgres through its connection pooler).
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
    const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!raw) throw new Error('Database belum terhubung (DATABASE_URL / POSTGRES_URL tidak ada).');
    // TLS is set here; an sslmode in the URL would override it (and reject hosted poolers' certificates).
    const u = new URL(raw);
    u.searchParams.delete('sslmode');
    const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
    db = fromPool(new pg.Pool({ connectionString: u.toString(), max: 3, ssl: local ? false : { rejectUnauthorized: false } }));
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
