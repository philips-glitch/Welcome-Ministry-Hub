import { useState } from 'react';
import { timeAgo, clockNow } from '../lib/clock.js';

const TONE = {
  good: ['#E3EFE6', '#1F4D3A'], bad: ['#FBE4E0', '#9A2A1E'], warn: ['#F8E9C4', '#7A5410'], info: ['#E3ECF8', '#244F8F'],
};
const ICON = {
  review: { good: '✓', bad: '✕', warn: '↻', info: '✓' },
  challenge: 'M5 21V4h11l-2 4 2 4H5',
  reminder: 'M12 13V9m0 4 2.5 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
};

// Group by day, relative to the app clock.
function dayLabel(iso) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  const today = new Date(clockNow() + 7 * 3600e3).toISOString().slice(0, 10);
  const yest = new Date(clockNow() + 7 * 3600e3 - 86400e3).toISOString().slice(0, 10);
  if (d === today) return 'Hari ini';
  if (d === yest) return 'Kemarin';
  return new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Notifications({ notif, openChallenge }) {
  const [filter, setFilter] = useState('all');
  const list = notif.items.filter((n) => filter === 'all' || !n.read);
  const days = [];
  list.forEach((n) => {
    const label = dayLabel(n.created_at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(n); else days.push({ label, items: [n] });
  });

  const open = (n) => {
    notif.markRead([n.id]);
    if (n.challenge_id) openChallenge(n.challenge_id);
  };

  return (
    <div className="p-stack" style={{ maxWidth: 760 }}>
      <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="col" style={{ gap: 4, flex: 1 }}>
          <span className="p-title">Notifikasi</span>
          <span className="muted" style={{ fontSize: 13 }}>{notif.unread ? `${notif.unread} belum dibaca` : 'Semua sudah dibaca'}</span>
        </div>
        <button className="link" style={{ fontSize: 13 }} disabled={!notif.unread} onClick={notif.markAll}>Tandai semua dibaca</button>
      </div>

      <div role="tablist" style={{ display: 'flex', background: '#EDE6D6', borderRadius: 12, padding: 4, gap: 4, maxWidth: 320 }}>
        {[['all', 'Semua'], ['unread', `Belum dibaca${notif.unread ? ` (${notif.unread})` : ''}`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} style={{ flex: 1, height: 36, borderRadius: 9, fontSize: 13, fontWeight: 700, background: filter === k ? '#FFFDF8' : 'transparent', color: filter === k ? '#1F4D3A' : '#56655C' }}>{l}</button>
        ))}
      </div>

      {!list.length && (
        <div className="p-card muted" style={{ textAlign: 'center', padding: 28, fontSize: 14 }}>
          {filter === 'unread' ? 'Tidak ada notifikasi baru. 🎉' : 'Belum ada notifikasi. Info challenge, hasil validasi, dan pengingat deadline akan muncul di sini.'}
        </div>
      )}

      {days.map((d) => (
        <section key={d.label} className="col" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{d.label}</span>
          <div className="p-card" style={{ padding: 0, overflow: 'hidden' }}>
            {d.items.map((n, i) => {
              const [bg, fg] = TONE[n.tone] || TONE.info;
              const glyph = n.kind === 'review' ? ICON.review[n.tone] || '✓' : null;
              return (
                <button key={n.id} onClick={() => open(n)} className="row"
                  style={{ width: '100%', textAlign: 'left', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderTop: i ? '1px solid #F0E9DA' : 'none', background: n.read ? 'transparent' : '#FBF6EA' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontWeight: 900, fontSize: 16 }}>
                    {glyph || <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[n.kind]} /></svg>}
                  </span>
                  <span className="col" style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: n.read ? 600 : 800, color: '#1B2620' }}>{n.title}</span>
                    {n.body && <span style={{ fontSize: 13, lineHeight: 1.45, color: '#3C4A42' }}>{n.body}</span>}
                    <span className="muted" style={{ fontSize: 11, marginTop: 2 }}>{timeAgo(n.created_at)}{n.group_no ? ' · grup kamu' : ' · semua peserta'}{n.challenge_id ? ' · buka challenge ›' : ''}</span>
                  </span>
                  {!n.read && <span aria-label="Belum dibaca" style={{ width: 9, height: 9, borderRadius: '50%', background: '#C4533F', flex: 'none', marginTop: 6 }} />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
