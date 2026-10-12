// Local full-stack dev: the API (server/rpc.js) + the Vite app on one port, with PGlite as the database.
//   npm run dev:server   → http://localhost:3602   (in-memory database, fresh on every start;
//   set PGLITE_DIR to a folder outside OneDrive to keep data between runs)
// First Super Admins: angel + philips, password from ADMIN_SETUP_PASSWORD (default "demo1234", local only).
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { createServer as createVite } from 'vite';
import { setDb, getDb, fromPglite } from './db.js';
import { handleRpc, handleMedia } from './rpc.js';

process.env.FLOURISH_SERVER = '1';
process.env.ADMIN_SETUP_PASSWORD ||= 'demo1234';
const port = Number(process.env.PORT || 3602);

setDb(fromPglite(new PGlite(process.env.PGLITE_DIR)));
const db = await getDb();
const vite = await createVite({ server: { middlewareMode: true }, appType: 'spa' });

http.createServer((req, res) => {
  if (req.url.startsWith('/api/rpc')) return handleRpc(req, res, db);
  if (req.url.startsWith('/api/media')) return handleMedia(req, res, db);
  vite.middlewares(req, res);
}).listen(port, () => console.log(`Flourish Hub (server mode, PGlite) → http://localhost:${port}`));
