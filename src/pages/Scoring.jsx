import { useMemo, useState } from 'react';
import { rank } from '../data.js';
import { useGame } from '../lib/gameStore.jsx';
import { useMembers } from '../lib/members.jsx';
import { isStaffOf } from '../lib/groups.js';
import { buildStandings } from '../lib/game.js';

export default function Scoring() {
  const { challenges, scores, pending } = useGame();
  const members = useMembers().rows || [];
  const { cols: SCORE_COLS, rows } = useMemo(() => {
    const captains = {};
    members.forEach((p) => { if (p.group_no && isStaffOf(p, p.group_no)) (captains[p.group_no] ||= []).push(p.full_name); });
    Object.keys(captains).forEach((k) => { captains[k] = captains[k].join(', '); });
    return buildStandings(scores, challenges || [], captains);
  }, [scores, challenges, members]);
  const FILTERS = [['total', 'Total', 'Semua challenge'], ...SCORE_COLS.map((c) => [c.key, c.short === 'SQ' ? 'Side Quest' : `${c.short} · ${c.label.split(' ')[0]}`, c.label])];
  const COLS = `48px minmax(150px,1.3fr) 110px repeat(${SCORE_COLS.length}, 58px) 72px minmax(120px,1fr)`;
  const [by, setBy] = useState('total');
  if (!FILTERS.some((f) => f[0] === by)) setBy('total');
  const ranked = rank(rows, by);
  const max = Math.max(1, ...ranked.map((r) => r[by]));
  const leader = rank(rows, 'total')[0];
  const second = rank(rows, 'total')[1];
  const totalPts = rows.reduce((a, r) => a + r.total, 0);
  const validated = rows.reduce((a, r) => a + r.validated, 0);
  const label = FILTERS.find((f) => f[0] === by)[2];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="muted" style={{ fontSize: 13 }}>Hanya skor tervalidasi yang dihitung · diperbarui langsung dari Validation Queue</span>
          <span className="h1">Scoring & Leaderboard</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <div style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Peringkat 1</span>
          <span className="row" style={{ gap: 8, font: "800 26px 'Bricolage Grotesque'" }}><span style={{ width: 12, height: 12, borderRadius: 4, background: leader.color }} />{leader.name}</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>{leader.total} pts · unggul {leader.total - second.total} dari {second.name}</span>
        </div>
        <Stat label="Total poin dibagikan" value={totalPts} sub={`10 grup · ${SCORE_COLS.length} kolom skor`} />
        <Stat label="Submission tervalidasi" value={validated} sub="semua challenge" color="#1F4D3A" />
        <Stat label="Menunggu validasi" value={pending} sub="belum masuk skor" color="#244F8F" />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #E9E0CC' }}>
          <span className="card-title">Standings · {label}</span>
          <div role="tablist" style={{ marginLeft: 'auto', display: 'flex', background: '#EDE6D6', borderRadius: 10, padding: 3, gap: 2, flexWrap: 'wrap' }}>
            {FILTERS.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={by === k} onClick={() => setBy(k)} style={{ fontSize: 12, fontWeight: 700, padding: '7px 10px', borderRadius: 8, background: by === k ? '#1F4D3A' : 'transparent', color: by === k ? '#FBF6EA' : '#56655C' }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="muted" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, fontSize: 12, fontWeight: 700, padding: '10px 18px', background: '#F6F0E2', alignItems: 'center' }}>
          <span>#</span><span>Grup</span><span>Captain</span>
          {SCORE_COLS.map((c) => <span key={c.key} title={c.label + (c.max ? ` · maks ${c.max}` : '')} style={{ textAlign: 'right', color: by === c.key ? '#1F4D3A' : c.open ? undefined : '#B5AC98' }}>{c.short}</span>)}
          <span style={{ textAlign: 'right', color: by === 'total' ? '#1F4D3A' : undefined }}>Total</span><span />
        </div>
        {ranked.map((r) => (
          <div key={r.no} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', fontSize: 13, padding: '10px 18px', borderTop: '1px solid #F0E9DA' }}>
            <span style={{ font: "800 16px 'Bricolage Grotesque'", color: r.rank <= 3 ? '#1F4D3A' : '#56655C' }}>{r.rank}</span>
            <span className="row" style={{ gap: 8, fontWeight: 700 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: r.color }} />{r.no} {r.name}</span>
            <span style={{ color: '#3C4A42' }}>{r.captain}</span>
            {SCORE_COLS.map(({ key: k }) => (
              <span key={k} className="num" style={{ textAlign: 'right', fontWeight: by === k ? 800 : 500, color: r[k] ? '#1B2620' : '#B5AC98' }}>{r[k] || '—'}</span>
            ))}
            <span className="num" style={{ textAlign: 'right', fontWeight: 800, font: by === 'total' ? "800 16px 'Bricolage Grotesque'" : undefined }}>{r.total}</span>
            <div style={{ height: 8, borderRadius: 4, background: '#EDE6D6', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: r.color, width: (r[by] / max) * 100 + '%' }} />
            </div>
          </div>
        ))}
        <div className="muted" style={{ padding: '10px 18px', fontSize: 12, borderTop: '1px solid #F0E9DA', background: '#FBF8F0' }}>
          Peringkat sama untuk poin sama. Kolom abu-abu = challenge masih draft. SQ = total semua side quest. Challenge draft tidak dihitung.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ font: "800 30px 'Bricolage Grotesque'", color }}>{value}</span>
      <span className="muted" style={{ fontSize: 12 }}>{sub}</span>
    </div>
  );
}
