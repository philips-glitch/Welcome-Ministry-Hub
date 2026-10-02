// Small animation helpers for the portal. Everything respects "reduce motion".
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clockNow } from '../lib/clock.js';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Number that counts from its previous value (0 on first render) to `value`.
export function CountUp({ value, duration = 700, decimals }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(reducedMotion() ? target : 0);
  const from = useRef(reducedMotion() ? target : 0);
  useEffect(() => {
    if (reducedMotion()) { setShown(target); from.current = target; return; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (target - a) * eased);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, duration]);
  const d = decimals ?? (Number.isInteger(target) ? 0 : 1);
  return <span className="num">{shown.toFixed(d).replace(/\.0$/, d ? '' : '')}</span>;
}

// One-shot confetti burst in the brand colours, positioned over its parent.
const COLORS = ['#E3A92B', '#6DB553', '#F4C14F', '#2F7A55', '#FBF6EA', '#C4533F'];
export function Confetti({ count = 36 }) {
  const [pieces] = useState(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.25, dur: 1.1 + Math.random() * 0.9,
    rot: Math.random() * 720 - 360, drift: Math.random() * 80 - 40, color: COLORS[i % COLORS.length],
    w: 6 + Math.random() * 6, h: Math.random() < 0.5 ? 6 : 12, round: Math.random() < 0.35,
  })));
  if (reducedMotion()) return null;
  return (
    <div aria-hidden="true" className="p-confetti">
      {pieces.map((p, i) => (
        <span key={i} style={{
          left: p.left + '%', width: p.w, height: p.h, background: p.color, borderRadius: p.round ? '50%' : 2,
          animationDelay: p.delay + 's', animationDuration: p.dur + 's', '--rot': p.rot + 'deg', '--drift': p.drift + 'px',
        }} />
      ))}
    </div>
  );
}

// FLIP: children with data-flip="<key>" slide from their old position to the new one when the order changes.
// With `storageKey`, the last order seen is remembered across visits, so a ranking that changed while the
// member was elsewhere still animates on the next visit (rows start from where they were last time).
export function useFlip(deps, storageKey) {
  const ref = useRef(null);
  const last = useRef(new Map());
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const items = [...el.querySelectorAll('[data-flip]')];
    const keys = items.map((n) => n.dataset.flip);
    const tops = items.map((n) => n.getBoundingClientRect().top);
    const now = new Map(keys.map((k, i) => [k, tops[i]]));
    let before = last.current;
    if (!before.size && storageKey) {
      // First render: rebuild "previous positions" from the stored order (rows are equal height).
      try {
        const prev = JSON.parse(localStorage.getItem(storageKey) || '[]');
        before = new Map(prev.map((k, i) => [k, tops[i]]).filter(([, t]) => t != null));
      } catch { /* storage unavailable */ }
    }
    if (!reducedMotion()) {
      items.forEach((n, i) => {
        const b = before.get(n.dataset.flip);
        const dy = b == null ? 0 : b - tops[i];
        if (!dy) return;
        n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: 520, delay: 250, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      });
    }
    last.current = now;
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { /* ignore */ } }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

// The value this member saw last time for `key` (persisted), then remembers `value` for next time.
export function useLastSeen(key, value) {
  const [prev] = useState(() => { try { const v = localStorage.getItem(key); return v == null ? null : JSON.parse(v); } catch { return null; } });
  useEffect(() => { if (value != null) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } } }, [key, value]);
  return prev;
}

// Deadline urgency for styling: 'calm' | 'soon' (< 24 h) | 'urgent' (< 3 h) | 'closed'.
export function urgency(iso) {
  if (!iso) return 'calm';
  const left = new Date(iso).getTime() - clockNow();
  if (left <= 0) return 'closed';
  if (left < 3 * 3600e3) return 'urgent';
  if (left < 24 * 3600e3) return 'soon';
  return 'calm';
}

// Remember the previous value of something (for "it just went up" effects).
export function usePrevious(v) {
  const r = useRef(v);
  useEffect(() => { r.current = v; }, [v]);
  return r.current;
}
