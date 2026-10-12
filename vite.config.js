import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Server mode when a database is connected at build time (Vercel + Neon sets DATABASE_URL), or when
// server/dev.js runs the API locally (FLOURISH_SERVER=1). Otherwise the app runs on demo data.
export default defineConfig({
  plugins: [react()],
  define: { __SERVER_API__: JSON.stringify(!!(process.env.DATABASE_URL || process.env.FLOURISH_SERVER)) },
});
