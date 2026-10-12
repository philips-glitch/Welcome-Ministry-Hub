import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NEXT_PUBLIC_* is what Vercel's Supabase integration creates (public URL + anon key only);
// unprefixed secrets such as SUPABASE_SERVICE_ROLE_KEY never reach the browser.
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
});
