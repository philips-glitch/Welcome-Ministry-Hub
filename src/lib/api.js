// Data/auth API used by every screen.
//   On Vercel with a database connected (DATABASE_URL at build time): the app's own server API (serverApi.js → /api).
//   Otherwise (plain `npm run dev`): the in-browser demo store with sample data (demoStore.js).
// __SERVER_API__ is set in vite.config.js.
import { demoApi } from './demoStore.js';
import { serverApi } from './serverApi.js';

export const api = __SERVER_API__ ? serverApi : demoApi;
