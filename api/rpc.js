// Vercel Function: POST /api/rpc — the app's data API (see server/rpc.js).
import { getDb } from '../server/db.js';
import { handleRpc } from '../server/rpc.js';

export default async function handler(req, res) {
  let db;
  try { db = await getDb(); } catch (e) {
    console.error('[db]', e);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: /DATABASE_URL/.test(e.message) ? e.message : 'Database tidak bisa dihubungi. Coba lagi sebentar.' }));
  }
  return handleRpc(req, res, db);
}
