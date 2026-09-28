import useCountdown from '../useCountdown.js';
import { R1_DEADLINE } from '../data.js';

const WEEK = [
  ['✓ KAM 15', 'Diumumkan', 'done'],
  ['MIN 18', 'Deadline 23:55', 'now'],
  ['SEL 20', 'Validasi', ''],
  ['RAB 21', 'Repost IG', ''],
];

export default function Home({ go }) {
  const cd = useCountdown(R1_DEADLINE);
  return (
    <div className="p-cols">
      <div className="p-stack">
        <button onClick={() => go('challenge')} style={{ textAlign: 'left', background: '#1F4D3A', borderRadius: 24, padding: 20, color: '#FBF6EA', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: '50%', background: '#2F7A55', opacity: 0.5 }} />
          <div className="row" style={{ gap: 8, position: 'relative' }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: '#E3A92B', color: '#1B2620', padding: '4px 9px', borderRadius: 999 }}>Live</span>
            <span style={{ fontSize: 13, opacity: 0.85 }}>Deadline berikutnya</span>
          </div>
          <span style={{ font: "800 24px/1.15 'Bricolage Grotesque'", position: 'relative' }}>Photo Challenge</span>
          <div className="p-countdown" style={{ position: 'relative' }}>
            {[[cd.d, 'hari'], [cd.h, 'jam'], [cd.m, 'menit'], [cd.s, 'detik']].map(([v, l]) => (
              <div key={l} style={{ background: 'rgba(251,246,234,.12)', borderRadius: 14, padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="num" style={{ font: "800 28px 'Bricolage Grotesque'" }}>{v}</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 13, position: 'relative' }}>
            <span>Min, 18 Okt · 23:55 WIB</span><span style={{ fontWeight: 700 }}>2 dari 4 riddle terkirim</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(251,246,234,.18)', position: 'relative' }}>
            <div style={{ width: '50%', height: '100%', borderRadius: 4, background: '#E3A92B' }} />
          </div>
        </button>

        <div className="col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="p-h">Challenge aktif</span>
            <button className="link" style={{ fontSize: 13 }} onClick={() => go('challenge')}>Lihat semua</button>
          </div>
          <div className="p-grid-2">
            <div className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row">
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F8E9C4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A5410', flex: 'none' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                </div>
                <div className="col" style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 15 }}>R4 · Scrapbook / Poster</span><span className="muted" style={{ fontSize: 12 }}>Jalan terus s/d Kam, 19 Nov · 23:55</span></div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: '#E3EFE6', color: '#1F4D3A' }}>LIVE</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>{[1, 1, 0, 0, 0].map((on, i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: on ? '#2F7A55' : '#E9E0CC' }} />)}</div>
              <span className="muted" style={{ fontSize: 12 }}>2/5 bagian siap: nama tim, slogan. Kurang: foto anggota, fun facts, foto aktivitas.</span>
            </div>
            <div className="p-card" style={{ border: '1px dashed #D5CAB0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EDE6D6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#56655C', flex: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>
              </div>
              <div className="col" style={{ flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 15 }}>R2 · Video Challenge</span><span className="muted" style={{ fontSize: 12 }}>Diumumkan Kam, 22 Okt · 20:00</span></div>
              <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: '#EDE6D6', color: '#56655C' }}>SOON</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-sticky">
        <div className="col" style={{ gap: 10 }}>
          <span className="p-h">Minggu ini</span>
          <div className="p-week">
            {WEEK.map(([d, l, st]) => (
              <div key={d} style={{ background: st === 'done' ? '#E3EFE6' : '#FFFDF8', border: st === 'now' ? '2px solid #1F4D3A' : st === 'done' ? 'none' : '1px solid #E9E0CC', borderRadius: 14, padding: st === 'now' ? '9px 7px' : '10px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: st === 'done' ? '#2F7A55' : st === 'now' ? '#1F4D3A' : '#56655C' }}>{d}</span>
                <span style={{ fontSize: 12, fontWeight: st === 'now' ? 700 : 600, lineHeight: 1.25 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <button className="p-card p-row-link" onClick={() => go('leaderboard')}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: '#F8E9C4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#7A5410' }}>RANK</span>
            <span style={{ font: "800 24px/1 'Bricolage Grotesque'" }}>#3</span>
          </div>
          <div className="col" style={{ gap: 2, flex: 1 }}><span style={{ fontWeight: 700, fontSize: 15 }}>28 poin · dari 10 grup</span><span className="muted" style={{ fontSize: 13 }}>Tinggal 2 poin lagi ke #2. Gas!</span></div>
          <span style={{ fontSize: 20, color: '#1F4D3A' }}>›</span>
        </button>
      </div>
    </div>
  );
}
