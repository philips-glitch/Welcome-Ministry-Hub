import { useState } from 'react';
import { rank } from '../data.js';
import { LB_TABS } from './portalData.js';

export default function Leaderboard({ standings, me }) {
  const [tab, setTab] = useState(0);
  const key = LB_TABS[tab][1];
  const lb = rank(standings, key);
  const podium = [[lb[1], 96], [lb[0], 128], [lb[2], 72]];
  const mine = me.group && lb.find((g) => g.no === me.group.no);
  const rest = lb.slice(3).filter((g) => g !== mine);
  const breakdown = mine && [
    { label: 'Photo (R1)', val: `${mine.r1}/40`, pct: (mine.r1 / 40) * 100, color: '#1F4D3A' },
    { label: 'Side Quest', val: mine.sq ? '+' + mine.sq : '—', pct: (mine.sq / 55) * 100, color: '#E3A92B' },
    { label: 'Video (R2)', val: mine.r2 || '—', pct: 0, color: '#1F4D3A' },
    { label: 'Scrapbook', val: mine.r4 || '—', pct: 0, color: '#1F4D3A' },
  ];

  return (
    <div className="p-cols">
      <div className="p-stack">
        <div className="col" style={{ gap: 4 }}>
          <span className="p-title">Leaderboard</span>
          <span className="muted" style={{ fontSize: 12 }}>Hanya skor tervalidasi · diperbarui setelah validasi captain</span>
        </div>
        <div role="tablist" style={{ display: 'flex', background: '#EDE6D6', borderRadius: 14, padding: 4, gap: 4, maxWidth: 520 }}>
          {LB_TABS.map(([label], i) => (
            <button key={label} role="tab" aria-selected={i === tab} onClick={() => setTab(i)} style={{ flex: 1, height: 38, borderRadius: 11, fontSize: 13, fontWeight: 700, background: i === tab ? '#FFFDF8' : 'transparent', color: i === tab ? '#1F4D3A' : '#56655C' }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1fr', gap: 8, alignItems: 'end', paddingTop: 8, maxWidth: 520, width: '100%', margin: '0 auto' }}>
          {podium.map(([g, h], i) => (
            <div key={g.no} className="col" style={{ alignItems: 'center', gap: 6 }}>
              <div style={{ width: 54, height: 54, borderRadius: 18, background: g.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 20px 'Bricolage Grotesque'", boxShadow: `0 0 0 4px #FBF6EA,0 0 0 6px ${g.color}` }}>{g.name[0]}</div>
              <span style={{ fontWeight: 700, fontSize: 14, textAlign: 'center' }}>{g.name}</span>
              <span className="num muted" style={{ fontSize: 13 }}>{g[key]} pts</span>
              <div style={{ width: '100%', borderRadius: '14px 14px 4px 4px', background: i === 1 ? '#E3A92B' : i === 0 ? '#1F4D3A' : '#2F7A55', height: h, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10, font: "800 24px 'Bricolage Grotesque'", color: i === 1 ? '#1B2620' : '#FBF6EA' }}>{g.rank}</div>
            </div>
          ))}
        </div>

        <div className="col" style={{ gap: 6 }}>
          {rest.map((g) => (
            <div key={g.no} className="row" style={{ padding: '10px 12px', borderRadius: 14, background: '#FFFDF8', border: '1px solid #E9E0CC' }}>
              <span className="muted" style={{ font: "700 14px 'Bricolage Grotesque'", width: 26 }}>{g.rank}</span>
              <span style={{ width: 10, height: 28, borderRadius: 5, background: g.color }} />
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{g.name}</span>
              <span className="num" style={{ fontWeight: 700 }}>{g[key]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-sticky">
        {mine ? (
          <div style={{ background: '#FFFDF8', border: `2px solid ${mine.color}`, borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row">
              <span style={{ font: "800 16px 'Bricolage Grotesque'", width: 26 }}>{mine.rank}</span>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: mine.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{mine.name[0]}</div>
              <div className="col" style={{ flex: 1 }}>
                <span style={{ fontWeight: 700 }}>{mine.name} <span style={{ fontSize: 11, fontWeight: 800, color: mine.color }}>· GRUP KAMU</span></span>
                <span className="muted" style={{ fontSize: 12 }}>Rincian per challenge</span>
              </div>
              <span className="num" style={{ font: "800 20px 'Bricolage Grotesque'" }}>{mine[key]}</span>
            </div>
            {breakdown.map((b) => (
              <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 46px', gap: 10, alignItems: 'center', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{b.label}</span>
                <div style={{ height: 8, borderRadius: 4, background: '#EDE6D6', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, background: b.color, width: Math.min(100, b.pct) + '%' }} /></div>
                <span className="num" style={{ textAlign: 'right', color: '#3C4A42' }}>{b.val}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-card muted" style={{ fontSize: 13 }}>Kamu belum masuk grup, jadi tidak ada rincian grup.</div>
        )}
        <div style={{ background: '#E3EFE6', borderRadius: 16, padding: '12px 14px', fontSize: 13, lineHeight: 1.45, color: '#1F4D3A' }}>
          <b>Masih ada 4 challenge lagi.</b> Semua grup masih bisa naik.
        </div>
      </div>
    </div>
  );
}
