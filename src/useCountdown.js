import { useEffect, useState } from 'react';
import { DEMO_NOW, pad } from './data.js';
import { api } from './lib/api.js';

// Ticks every second. Demo mode runs on the demo clock (Jum, 16 Okt 2026 · 19:12 WIB); Supabase mode on real time.
export default function useCountdown(target) {
  const [t0] = useState(Date.now);
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  const now = api.mode === 'demo' ? DEMO_NOW + (Date.now() - t0) : Date.now();
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  return { d: Math.floor(diff / 86400), h: pad(Math.floor((diff % 86400) / 3600)), m: pad(Math.floor((diff % 3600) / 60)), s: pad(diff % 60) };
}
