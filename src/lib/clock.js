import { api } from './api.js';
import { demoNow } from './demoNotify.js';

// "Now" for display logic: the demo clock in demo mode, real time with Supabase.
export const clockNow = () => (api.mode === 'demo' ? demoNow() : Date.now());

// "baru saja", "12 mnt lalu", "3 jam lalu"; older than a day → the WIB time ("20:00 WIB"),
// since lists already group by day.
export function timeAgo(iso) {
  const s = Math.max(0, Math.floor((clockNow() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace('.', ':') + ' WIB';
}
