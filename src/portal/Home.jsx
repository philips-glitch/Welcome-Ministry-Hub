import useCountdown from '../useCountdown.js';
import { DEMO_NOW } from '../data.js';
import { api } from '../lib/api.js';
import { fmtWIB, statusMeta } from '../lib/game.js';

const nowMs = () => (api.mode === 'demo' ? DEMO_NOW : Date.now());
const short = (iso) => fmtWIB(iso, { hour: undefined, minute: undefined, month: undefined }).replace(' WIB', '').toUpperCase();

export default function Home({ go, me, standings, focus, challenges, data, openChallenge }) {
  const cd = useCountdown(focus?.deadline_at ? new Date(focus.deadline_at).getTime() : 0);
  const idx = me.group ? standings.findIndex((g) => g.no === me.group.no) : -1;
  const mine = standings[idx];
  const ahead = idx > 0 ? standings.slice(0, idx).reverse().find((g) => g.total > mine.total) : null;
  const rankHint = !mine ? 'Kamu belum masuk grup.' : mine.rank === 1 ? 'Grup kamu memimpin. Pertahankan!' : `Tinggal ${Math.round((ahead.total - mine.total) * 10) / 10} poin lagi ke #${ahead.rank}. Gas!`;

  const slots = data?.draw.length || 0;
  const sent = data ? data.draw.filter((d) => data.latest(d.riddle_id)).length : 0;
  const others = challenges.filter((c) => c.id !== focus?.id);
  const week = focus ? [
    ['announce_at', 'Diumumkan'], ['deadline_at', 'Deadline'], ['validate_by', 'Validasi'],
  ].filter(([k]) => focus[k]).map(([k, label]) => ({ label, day: short(focus[k]), time: k === 'deadline_at' ? fmtWIB(focus[k], { weekday: undefined, day: undefined, month: undefined }).replace(' WIB', '') : null, past: new Date(focus[k]).getTime() < nowMs() })) : [];
  const nextIdx = week.findIndex((w) => !w.past);

  return (
    <div className="p-cols">
      <div className="p-stack">
        {focus ? (
          <button onClick={() => openChallenge(focus.id)} style={{ textAlign: 'left', background: '#1F4D3A', borderRadius: 24, padding: 20, color: '#FBF6EA', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: '#2F7A55', opacity: 0.5 }} />
            <div className="row" style={{ gap: 8, position: 'relative' }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: '#E3A92B', color: '#1B2620', padding: '4px 9px', borderRadius: 999 }}>{statusMeta(focus.status)[1]}</span>
              <span style={{ fontSize: 13, opacity: 0.85 }}>{focus.status === 'live' ? 'Deadline berikutnya' : 'Segera dimulai'}</span>
            </div>
            <span style={{ font: "800 24px/1.15 'Bricolage Grotesque'", position: 'relative' }}>{focus.name}</span>
            {focus.deadline_at && (
              <div className="p-countdown" style={{ position: 'relative' }}>
                {[[cd.d, 'hari'], [cd.h, 'jam'], [cd.m, 'menit'], [cd.s, 'detik']].map(([v, l]) => (
                  <div key={l} style={{ background: 'rgba(251,246,234,.12)', borderRadius: 14, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span className="num" style={{ font: "800 28px 'Bricolage Grotesque'" }}>{v}</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{l}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 13, position: 'relative' }}>
              <span>{focus.deadline_at ? fmtWIB(focus.deadline_at) : 'Deadline belum diumumkan'}</span>
              {slots > 0 && <span style={{ fontWeight: 700 }}>{sent} dari {slots} riddle terkirim</span>}
            </div>
            {slots > 0 && (
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(251,246,234,.18)', position: 'relative' }}>
                <div style={{ width: (sent / slots) * 100 + '%', height: '100%', borderRadius: 4, background: '#E3A92B' }} />
              </div>
            )}
          </button>
        ) : (
          <div className="p-card muted">Belum ada challenge yang diumumkan. Pantau terus ya!</div>
        )}

        <div className="col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="p-h">Challenge lainnya</span>
            <button className="link" style={{ fontSize: 13 }} onClick={() => go('challenges')}>Lihat semua</button>
          </div>
          <div className="p-grid-2">
            {others.map((c) => {
              const [, label, bg, fg] = statusMeta(c.status);
              const soon = c.status === 'scheduled';
              return (
                <button key={c.id} onClick={() => openChallenge(c.id)} className="p-card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, border: soon ? '1px dashed #D5CAB0' : undefined }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: c.kind === 'side' ? '#E3EFE6' : '#F8E9C4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.kind === 'side' ? '#1F4D3A' : '#7A5410', fontWeight: 800, fontSize: 12, flex: 'none' }}>{c.code}</div>
                  <div className="col" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{soon ? (c.announce_at ? 'Diumumkan ' + fmtWIB(c.announce_at) : 'Tanggal TBD') : c.deadline_at ? 's/d ' + fmtWIB(c.deadline_at) : ''}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: soon ? '#EDE6D6' : bg, color: soon ? '#56655C' : fg }}>{soon ? 'SOON' : label.toUpperCase()}</span>
                </button>
              );
            })}
            {!others.length && <span className="muted" style={{ fontSize: 13 }}>Belum ada challenge lain.</span>}
          </div>
        </div>
      </div>

      <div className="p-sticky">
        {week.length > 0 && (
          <div className="col" style={{ gap: 10 }}>
            <span className="p-h">Jadwal {focus.code}</span>
            <div className="p-week" style={{ gridTemplateColumns: `repeat(${week.length},1fr)` }}>
              {week.map((w, i) => {
                const now = i === nextIdx;
                return (
                  <div key={w.label} style={{ background: w.past ? '#E3EFE6' : '#FFFDF8', border: now ? '2px solid #1F4D3A' : w.past ? 'none' : '1px solid #E9E0CC', borderRadius: 14, padding: now ? '9px 7px' : '10px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: w.past ? '#2F7A55' : now ? '#1F4D3A' : '#56655C' }}>{w.past ? '✓ ' : ''}{w.day}</span>
                    <span style={{ fontSize: 12, fontWeight: now ? 700 : 600, lineHeight: 1.25 }}>{w.label}{w.time ? ' ' + w.time : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <button className="p-card p-row-link" onClick={() => go('leaderboard')}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: '#F8E9C4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#7A5410' }}>RANK</span>
            <span style={{ font: "800 24px/1 'Bricolage Grotesque'" }}>{mine ? '#' + mine.rank : '—'}</span>
          </div>
          <div className="col" style={{ gap: 2, flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{mine ? `${mine.total} poin · dari ${standings.length} grup` : 'Lihat leaderboard'}</span>
            <span className="muted" style={{ fontSize: 13 }}>{rankHint}</span>
          </div>
          <span style={{ fontSize: 20, color: '#1F4D3A' }}>›</span>
        </button>
      </div>
    </div>
  );
}
