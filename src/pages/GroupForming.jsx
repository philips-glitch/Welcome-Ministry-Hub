import { useState } from 'react';
import { GROUPS, CAPTAINS, TEAMS, MEMBERS, autoAssign, validateGroups } from '../data.js';

const EXCLUDED = ['Angel', 'Philips', 'Stefanus', 'Yohan', 'Lidya', 'Marco'];
const RULES = [
  ['10 grup, 13–14 anggota', (v) => /anggota/.test(v)],
  ['Tiap grup ≥ 1 Ministry TL', (v) => /Ministry TL$/.test(v)],
  ['Group Leader bukan Ministry TL', (v) => /Group Leader/.test(v)],
  ['Tidak ada 2 orang dari tim pelayanan yang sama', (v) => /sama-sama/.test(v)],
];

export default function GroupForming({ groups, setGroups }) {
  const [locked, setLocked] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overGroup, setOverGroup] = useState(null);
  const { assign, leaders, seed } = groups;
  const { violations, badGroups, badMembers, ok } = validateGroups(assign, leaders);

  const reroll = () => {
    const s = Math.floor(Math.random() * 9000) + 1000;
    const a = autoAssign(s);
    setGroups({ seed: s, assign: a.g, leaders: a.leaders });
    setLocked(false);
  };

  const drop = (gi) => (e) => {
    e.preventDefault();
    setOverGroup(null);
    const raw = e.dataTransfer.getData('text/plain');
    const id = dragId ?? (raw === '' ? null : Number(raw));
    if (id == null || !MEMBERS[id]) return;
    setGroups((st) => {
      const g = st.assign.map((a) => a.filter((x) => x !== id));
      g[gi].push(id);
      // If a group loses its leader, promote the first non-TL member.
      const ls = st.leaders.map((l, i) => (l === id && i !== gi ? g[i].find((x) => !MEMBERS[x].tl) : l));
      return { ...st, assign: g, leaders: ls };
    });
    setDragId(null);
    setLocked(false);
  };

  return (
    <div className="page" style={{ padding: '22px 26px', gap: 16 }}>
      <div className="row">
        <div className="col">
          <span className="h2">Group Forming</span>
          <span className="muted" style={{ fontSize: 13 }}>137 member · 10 grup · 16 tim pelayanan · 13 Ministry TL</span>
        </div>
        <div className="select" style={{ marginLeft: 'auto', height: 38 }}><span className="muted">Seed</span><b className="mono">WM26-{String(seed).padStart(4, '0')}</b></div>
        <button className="btn btn-outline" style={{ height: 38 }} onClick={reroll}>Auto-assign</button>
        <button
          className="btn"
          disabled={!ok && !locked}
          onClick={() => ok && setLocked(true)}
          style={{ height: 38, fontWeight: 800, background: locked ? '#2F7A55' : ok ? '#1F4D3A' : '#E2DACA', color: ok || locked ? '#FBF6EA' : '#6B665A' }}
        >
          {locked ? '✓ Terkunci & dipublikasikan' : 'Lock & Publish Groups'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10 }}>
          {GROUPS.map(([no, name, color], gi) => {
            const ids = assign[gi];
            const n = ids.length;
            const sizeBad = n < 13 || n > 14;
            return (
              <div
                key={no}
                onDragOver={(e) => { e.preventDefault(); setOverGroup(gi); }}
                onDragLeave={() => setOverGroup((g) => (g === gi ? null : g))}
                onDrop={drop(gi)}
                style={{ background: overGroup === gi ? '#F3F8F4' : '#FFFDF8', border: `1.5px solid ${badGroups.has(gi) ? '#E7A79C' : overGroup === gi ? '#2F7A55' : '#E9E0CC'}`, borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 420 }}
              >
                <div className="row" style={{ gap: 6, paddingBottom: 6, borderBottom: `3px solid ${color}` }}>
                  <span style={{ font: "800 13px 'Bricolage Grotesque'" }}>{no} {name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: sizeBad ? '#B3261E' : '#E3EFE6', color: sizeBad ? '#fff' : '#1F4D3A' }}>{n}/14</span>
                </div>
                <span className="muted" style={{ fontSize: 10 }}>Captain: {CAPTAINS[gi]} · TL {ids.filter((id) => MEMBERS[id].tl).length}</span>
                {ids.map((id) => {
                  const m = MEMBERS[id];
                  const isL = leaders[gi] === id;
                  const bad = badMembers.has(id);
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(id)); setDragId(id); }}
                      onDragEnd={() => { setDragId(null); setOverGroup(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 7, background: bad ? '#FBE4E0' : isL ? '#E3EFE6' : m.tl ? '#FBF1D8' : '#FBF8F0', border: `1px solid ${bad ? '#D9695A' : '#EFE7D6'}`, cursor: 'grab', fontSize: 11, opacity: dragId === id ? 0.4 : 1 }}
                    >
                      <span style={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: isL ? '#1F4D3A' : '#7A5410' }}>{isL ? '★ GL' : m.tl ? 'TL' : ''}</span>
                      <span className="mono muted" style={{ fontSize: 9, fontWeight: 700 }}>{TEAMS[m.team]}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="col" style={{ gap: 12 }}>
          <div style={{ background: '#FFFDF8', border: `1.5px solid ${ok ? '#C9DECF' : '#E7A79C'}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>Cek aturan</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: ok ? '#E3EFE6' : '#FBE4E0', color: ok ? '#1F4D3A' : '#9A2A1E' }}>{ok ? 'SEMUA OK' : violations.length + ' MASALAH'}</span>
            </div>
            {violations.map((v) => (
              <div key={v} style={{ display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 10, background: '#FBE4E0', fontSize: 12, lineHeight: 1.4, color: '#7A1F16' }}><span style={{ fontWeight: 900 }}>!</span><span>{v}</span></div>
            ))}
            {[...RULES.map(([label, f]) => [label, violations.some(f)]), ['Panitia (Tim Acara, Angel, Philips) dikecualikan', false]].map(([label, bad]) => (
              <div key={label} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.4, alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 900, color: bad ? '#B3261E' : '#2F7A55' }}>{bad ? '✕' : '✓'}</span>
                <span style={{ color: '#3C4A42' }}>{label}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: "700 14px 'Bricolage Grotesque'" }}>Dikecualikan · panitia (6)</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {EXCLUDED.map((x) => <span key={x} className="muted" style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 7, background: '#EDE6D6' }}>{x}</span>)}
            </div>
          </div>
          <div className="card" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#3C4A42' }}>
            <span style={{ font: "700 14px 'Bricolage Grotesque'", color: '#1B2620' }}>Legenda</span>
            <span><b style={{ color: '#7A5410' }}>TL</b> Ministry TL (peran di tim pelayanan)</span>
            <span><b style={{ color: '#1F4D3A' }}>★ GL</b> Group Leader (tidak boleh TL)</span>
            <span><b className="mono">LB</b> kode tim pelayanan</span>
            <span>Garis merah = melanggar aturan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
