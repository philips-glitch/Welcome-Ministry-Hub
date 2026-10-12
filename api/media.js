// Vercel Function: GET /api/media?path=… — submission photos (see server/rpc.js → handleMedia).
import { getDb } from '../server/db.js';
import { handleMedia } from '../server/rpc.js';

export default async function handler(req, res) {
  let db;
  try { db = await getDb(); } catch (e) { console.error('[db]', e); res.statusCode = 503; return res.end(); }
  return handleMedia(req, res, db);
}
