import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { DEMO_NOW } from '../data.js';
import { fmtWIB, statusMeta } from '../lib/game.js';
import { CountUp, urgency } from './motion.jsx';

const nowMs = () => (api.mode === 'demo' ? DEMO_NOW : Date.now());
const SECTIONS = [
  ['live', 'Sedang berjalan', (c) => c.status === 'live'],
  ['soon', 'Segera', (c) => c.status === 'scheduled'],
  ['done', 'Selesai', (c) => ['closed', 'published'].includes(c.status)],
];

// Time left, compact: "2h 04j", "5j 12m", "12m".
function left(iso) {
  const s = Math.floor((new Date(iso).getTime() - nowMs()) / 1000);
  if (s <= 0) return 'ditutup';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}h ${String(h).padStart(2, '0')}j` : h ? `${h}j ${m}m` : `${m}m`;
}

export default function ChallengeList({ me, challenges, openChallenge }) {
  // One pass for my group: all submissions + the draw of every riddle challenge.
  const [subs, setSubs] = useState([]);
  const [draws, setDraws] = useState({});
  useEffect(() => {
    if (!me.group) return;
    api.listSubmissions({ groupNo: me.group.no }).then(setSubs).catch(() => {});
    challenges.filter((c) => c.riddles_per_group > 0 && c.status !== 'scheduled').forEach((c) =>
      api.getDraw(c.id).then((d) => setDraws((x) => ({ ...x, [c.id]: d.filter((r) => r.group_no === me.group.no) }))).catch(() => {}));
  }, [me.group?.no, challenges]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = (c) => {
    const mine = subs.filter((s) => s.challenge_id === c.id);
    const pts = Math.round(mine.filter((s) => s.status === 'validated').reduce((a, s) => a + Number(s.score || 0), 0) * 10) / 10;
    if (c.riddles_per_group > 0) {
      const slots = draws[c.id] || [];
      const sent = slots.filter((d) => mine.some((s) => s.riddle_id === d.riddle_id)).length;
      return { total: slots.length || c.riddles_per_group, sent, pts };
    }
    const latest = [...mine].sort((a, b) => b.version - a.version)[0];
    return { total: 1, sent: latest ? 1 : 0, pts, status: latest?.status };
  };

  const any = SECTIONS.some(([, , f]) => challenges.some(f));
  return (
    <div className="p-stack">
      <div className="col" style={{ gap: 4 }}>
        <span className="p-title">Challenges</span>
        <span className="muted" style={{ fontSize: 13 }}>{me.group ? `Progres grup ${me.group.name}` : 'Kamu belum masuk grup'} · diumumkan tiap Kamis 20:00 WIB</span>
      </div>
      {!any && <div className="p-card muted">Belum ada challenge yang diumumkan. Pantau terus ya!</div>}
      {SECTIONS.map(([key, title, f]) => {
        const list = challenges.filter(f).sort((a, b) => (a.kind === b.kind ? (a.round ?? 99) - (b.round ?? 99) : a.kind === 'main' ? -1 : 1));
        if (!list.length) return null;
        return (
          <section key={key} className="col" style={{ gap: 10 }}>
            <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>{title} · {list.length}</span>
            <div className="p-grid-2">
              {list.map((c) => <Card key={c.id} c={c} p={progress(c)} section={key} me={me} onOpen={() => openChallenge(c.id)} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Card({ c, p, section, me, onOpen }) {
  const [, label, bg, fg] = statusMeta(c.status);
  const live = section === 'live';
  const soon = section === 'soon';
  const done = p.total > 0 && p.sent >= p.total;
  return (
    <button onClick={onOpen} className="p-card" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 12, border: live ? '1.5px solid #1F4D3A' : soon ? '1px dashed #D5CAB0' : undefined, opacity: section === 'done' ? 0.85 : 1 }}>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: c.kind === 'side' ? '#E3EFE6' : live ? '#1F4D3A' : '#F8E9C4', color: c.kind === 'side' ? '#1F4D3A' : live ? '#FBF6EA' : '#7A5410', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 13px 'Bricolage Grotesque'", flex: 'none' }}>{c.code}</div>
        <div className="col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <span style={{ font: "700 16px/1.2 'Bricolage Grotesque'" }}>{c.name}</span>
          <span className="muted" style={{ fontSize: 12 }}>{c.kind === 'side' ? `Side quest · +${c.scoring?.max ?? '?'} poin` : `Round ${c.round ?? '—'} · maks ${c.scoring?.max ?? '?'}${c.riddles_per_group ? '/riddle' : ''}`}</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: soon ? '#EDE6D6' : bg, color: soon ? '#56655C' : fg, whiteSpace: 'nowrap' }}>{soon ? 'SOON' : label.toUpperCase()}</span>
      </div>

      {soon ? (
        <span style={{ fontSize: 13, color: '#3C4A42' }}>{c.announce_at ? <>Diumumkan <b>{fmtWIB(c.announce_at)}</b></> : 'Tanggal diumumkan nanti'}</span>
      ) : (
        <>
          {me.group && (
            <div className="col" style={{ gap: 6 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: p.total }, (_, i) => (
                  <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: '#E9E0CC', overflow: 'hidden' }}>
                    {i < p.sent && <div className="p-fill" style={{ height: '100%', background: '#2F7A55', animationDelay: `${150 + i * 110}ms` }} />}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: done ? '#2F7A55' : '#3C4A42' }}>
                  {c.riddles_per_group ? `${p.sent}/${p.total} riddle terkirim` : p.sent ? (p.status === 'validated' ? '✓ Tervalidasi' : p.status === 'submitted' ? 'Menunggu validasi' : 'Perlu kirim ulang') : 'Belum dikirim'}
                </span>
                <span style={{ fontWeight: 800, color: '#1F4D3A' }}><CountUp value={p.pts} /> pts</span>
              </div>
            </div>
          )}
          {c.deadline_at && (
            <span className="muted" style={{ fontSize: 12 }}>
              {live ? <><Left iso={c.deadline_at} /> lagi · tutup {fmtWIB(c.deadline_at)}</> : `Ditutup ${fmtWIB(c.deadline_at)}`}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// Time left: plain red text normally, an amber pill under 24 h, a pulsing red pill under 3 h.
function Left({ iso }) {
  const u = urgency(iso);
  if (u === 'soon' || u === 'urgent') {
    return <b className={u === 'urgent' ? 'p-urgent' : 'p-soon'} style={{ padding: '2px 8px', borderRadius: 999, background: u === 'urgent' ? '#C4533F' : '#F8E9C4', color: u === 'urgent' ? '#fff' : '#7A5410' }}>{left(iso)}</b>;
  }
  return <b style={{ color: '#9A2A1E' }}>{left(iso)}</b>;
}
