import { useState } from 'react';
import { CountUp, useFlip, useLastSeen } from './motion.jsx';
import { rank } from '../data.js';

export default function Leaderboard({ standings: { cols, rows }, me }) {
  // Tabs: Total + every opened scoreboard column (main rounds, Side Q).
  const LB_TABS = [['Total', 'total'], ...cols.filter((c) => c.open).map((c) => [c.short === 'SQ' ? 'Side Q' : c.label.split(' ')[0], c.key])];
  const [tab, setTab] = useState(0);
  const key = (LB_TABS[tab] || LB_TABS[0])[1];
  const lb = rank(rows, key);
  const podium = [[lb[1], 96], [lb[0], 128], [lb[2], 72]];
  const mine = me.group && lb.find((g) => g.no === me.group.no);
  const rest = lb.slice(3).filter((g) => g !== mine);
  // Rows slide to their new place when the ranking (or the tab) changes.
  const who = me.group?.no || 'none';
  const flipRef = useFlip([key, rest.map((g) => g.no).join()], `flourish-lb:${who}:${key}`);
  // Overall rank change since this member last opened the leaderboard.
  const totalRank = me.group ? rank(rows, 'total').find((g) => g.no === me.group.no)?.rank ?? null : null;
  const lastRank = useLastSeen(`flourish-lb-rank:${who}`, totalRank);
  const moved = lastRank != null && totalRank != null ? lastRank - totalRank : 0;
  const top = (k) => Math.max(1, ...rows.map((r) => r[k]));
  const breakdown = mine && cols.filter((c) => c.open).map((c) => ({
    label: c.short === 'SQ' ? 'Side Quest' : `${c.label.split(' ')[0]} (${c.short})`,
    val: mine[c.key] ? (c.short === 'SQ' ? '+' : '') + mine[c.key] : '—',
    pct: (mine[c.key] / top(c.key)) * 100, color: c.short === 'SQ' ? '#E3A92B' : '#1F4D3A',
  }));

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
              <span className="muted" style={{ fontSize: 13 }}><CountUp value={g[key]} /> pts</span>
              <div className="p-rise" style={{ animationDelay: `${[120, 0, 240][i]}ms`, width: '100%', borderRadius: '14px 14px 4px 4px', background: i === 1 ? '#E3A92B' : i === 0 ? '#1F4D3A' : '#2F7A55', height: h, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10, font: "800 24px 'Bricolage Grotesque'", color: i === 1 ? '#1B2620' : '#FBF6EA' }}>{g.rank}</div>
            </div>
          ))}
        </div>

        <div ref={flipRef} className="col" style={{ gap: 6 }}>
          {rest.map((g) => (
            <div key={g.no} data-flip={g.no} className="row" style={{ padding: '10px 12px', borderRadius: 14, background: '#FFFDF8', border: '1px solid #E9E0CC' }}>
              <span className="muted" style={{ font: "700 14px 'Bricolage Grotesque'", width: 26 }}>{g.rank}</span>
              <span style={{ width: 10, height: 28, borderRadius: 5, background: g.color }} />
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{g.name}</span>
              <span style={{ fontWeight: 700 }}><CountUp value={g[key]} /></span>
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
                {moved !== 0 && (
                  <span className="p-pop" style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: moved > 0 ? '#E3EFE6' : '#FBE4E0', color: moved > 0 ? '#1F4D3A' : '#9A2A1E', animationDelay: '500ms' }}>
                    {moved > 0 ? `▲ naik ${moved} peringkat` : `▼ turun ${-moved} peringkat`} sejak terakhir kamu cek
                  </span>
                )}
              </div>
              <span style={{ font: "800 20px 'Bricolage Grotesque'" }}><CountUp value={mine[key]} /></span>
            </div>
            {breakdown.map((b) => (
              <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 46px', gap: 10, alignItems: 'center', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{b.label}</span>
                <div style={{ height: 8, borderRadius: 4, background: '#EDE6D6', overflow: 'hidden' }}><div key={key} className="p-fill" style={{ height: '100%', borderRadius: 4, background: b.color, width: Math.min(100, b.pct) + '%' }} /></div>
                <span className="num" style={{ textAlign: 'right', color: '#3C4A42' }}>{b.val}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-card muted" style={{ fontSize: 13 }}>Kamu belum masuk grup, jadi tidak ada rincian grup.</div>
        )}
        <div style={{ background: '#E3EFE6', borderRadius: 16, padding: '12px 14px', fontSize: 13, lineHeight: 1.45, color: '#1F4D3A' }}>
          <b>Masih ada {cols.filter((c) => !c.open).length} challenge lagi.</b> Semua grup masih bisa naik.
        </div>
      </div>
    </div>
  );
}
