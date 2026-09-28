import { GROUPS, CAPTAINS, R1STAT, R1_DEADLINE, memberName } from '../data.js';
import useCountdown from '../useCountdown.js';

const DOT = { V: ['#2F7A55', 'none'], S: ['#6F95CF', 'none'], D: ['#E3A92B', 'none'], N: ['transparent', '1.5px solid #CFC4AA'], X: ['#C4533F', 'none'] };
const LAST_ACT = ['Jum 18:40', 'Jum 17:02', 'Jum 16:15', 'Jum 18:05', 'Kam 22:30', 'Jum 12:10', 'Jum 19:01', 'Kam 21:45', 'Jum 08:20', 'Kam 20:50'];

// Timeline spans day 8 → 51 of October (51 = 20 Nov).
const X = (d) => ((d - 8) / 43) * 100 + '%';
const W = (a, b) => ((b - a) / 43) * 100 + '%';
const seg = (a, b, label, bg, fg = '#FBF6EA', border = 'none') => ({ left: X(a), width: W(a, b), label, bg, fg, border });
const TODAY = X(16.8);
const TICKS = [[8, 'Kam 8 Okt'], [15, '15 Okt'], [22, '22 Okt'], [29, '29 Okt'], [36, '5 Nov'], [43, '12 Nov'], [50, '19 Nov']];
const GANTT = [
  { name: 'Grup diumumkan', pic: 'Tim Acara', segs: [seg(8, 9, '', '#E3A92B', '#1B2620'), seg(9.2, 14, 'Kam 8 Okt', 'transparent', '#7A5410')] },
  { name: 'R1 Photo', pic: 'Cindy', segs: [seg(15, 19, 'Photo · 15–18', '#1F4D3A'), seg(19, 21, 'valid.', '#C9DECF', '#1F4D3A'), seg(21, 22, 'IG', '#F8E9C4', '#7A5410')] },
  { name: 'R4 Scrapbook', pic: 'Rocky', segs: [seg(15, 51, 'Scrapbook / Poster · s/d Kam 19 Nov 23:55', '#2F7A55')] },
  { name: 'R2 Video', pic: 'Danny & Cherien', segs: [seg(22, 25, 'umumkan', '#C9DECF', '#1F4D3A'), seg(25, 33, 'Video · 25 Okt–1 Nov', '#1F4D3A'), seg(33, 35, 'valid.', '#C9DECF', '#1F4D3A')] },
  { name: 'R3 Spice It Up', pic: 'Maya', segs: [seg(35, 37, 'pilih', '#F8E9C4', '#7A5410'), seg(37, 40, 'Spice', '#1F4D3A'), seg(40, 42, 'valid.', '#C9DECF', '#1F4D3A')] },
  { name: 'R5 · R6', pic: 'draft · TBD', segs: [seg(42, 51, 'Beyond UR · Legacy — tanggal TBD', 'transparent', '#56655C', '1.5px dashed #BFB396')] },
  { name: 'Side Quests', pic: 'bonus', segs: [seg(8, 51, 'Get To Know Me · Find Your Match · Connect 10', '#F3EEE2', '#56655C', '1px solid #E3D9C2')] },
];
const OVERDUE = [
  { title: 'Get To Know Me · Hyssop', who: 'Captain Philips · 2 submission', late: '+3 hari', color: '#5C63B8' },
  { title: 'Find Your Match · Oak', who: 'Captain Maya · 1 submission', late: '+3 hari', color: '#9A6435' },
  { title: 'Get To Know Me · Palm', who: 'Captain Cherien · 1 submission', late: '+2 hari', color: '#3E86C9' },
];
const SCHEDULED = [
  ['Reminder 24 jam · R1', 'Sab 17 Okt 23:55'],
  ['Reminder 3 jam · R1', 'Min 18 Okt 20:55'],
  ['Announce R2 Video', 'Kam 22 Okt 20:00'],
  ['Repost R1 “first correct”', 'Rab 21 Okt'],
];
const COLS = '1.4fr 1.2fr 110px 70px 70px 80px 1fr';
const statCard = { padding: 18, display: 'flex', flexDirection: 'column', gap: 6 };
const bigNum = { font: "800 30px 'Bricolage Grotesque'" };

export default function Overview({ groups, pending, onNavigate }) {
  const cd = useCountdown(R1_DEADLINE);
  const rows = GROUPS.map(([no, name, color], i) => {
    const st = R1STAT[i];
    const c = (ch) => [...st].filter((x) => x === ch).length;
    return { no, name, color, captain: CAPTAINS[i], leader: memberName(groups.leaders[i]), dots: [...st], rec: c('V') + c('S') + c('X'), pen: c('S'), val: c('V'), last: LAST_ACT[i] };
  });
  const received = rows.reduce((a, r) => a + r.rec, 0);
  const pendingR1 = rows.reduce((a, r) => a + r.pen, 0);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="muted" style={{ fontSize: 13 }}>Jumat, 16 Oktober 2026 · minggu 2 dari 7</span>
          <span className="h1">Overview</span>
        </div>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <button className="btn btn-ghost">Jadwalkan pengumuman</button>
          <button className="btn btn-primary" onClick={() => onNavigate(3)}>Buka Validation Queue · {pending}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 14 }}>
        <div style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#E3A92B', color: '#1B2620', padding: '3px 8px', borderRadius: 999 }}>LIVE</span>
            <span style={{ fontSize: 13, opacity: 0.85 }}>R1 · Photo Challenge · PIC Cindy</span>
          </div>
          <span className="num" style={{ font: "800 26px 'Bricolage Grotesque'" }}>{cd.d}h {cd.h}:{cd.m}:{cd.s}</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>tutup Min, 18 Okt · 23:55 WIB</span>
        </div>
        <div className="card" style={statCard}>
          <span className="muted" style={{ fontSize: 13 }}>Submission R1 masuk</span>
          <span style={bigNum}>{received}<span className="muted" style={{ fontSize: 16 }}> / 40</span></span>
          <span className="muted" style={{ fontSize: 12 }}>4 riddle × 10 grup</span>
        </div>
        <div className="card" style={statCard}>
          <span className="muted" style={{ fontSize: 13 }}>Menunggu validasi</span>
          <span style={{ ...bigNum, color: '#244F8F' }}>{pendingR1}</span>
          <span className="muted" style={{ fontSize: 12 }}>SLA: Sel, 20 Okt EOD</span>
        </div>
        <div style={{ ...statCard, background: '#FBE4E0', border: '1px solid #F0C4BC', borderRadius: 16, color: '#9A2A1E' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Validasi lewat SLA</span>
          <span style={bigNum}>3</span>
          <span style={{ fontSize: 12 }}>Side Quest · harusnya Sel, 13 Okt</span>
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="card-title">Timeline 8 Okt – 19 Nov</span>
          <span className="muted" style={{ fontSize: 12 }}>Kam 20:00 umumkan → Min 23:55 deadline → Sel EOD validasi → Rab repost</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 150, right: 0, top: 22, bottom: 0, pointerEvents: 'none', zIndex: 2 }}>
            <div style={{ position: 'absolute', left: TODAY, top: 0, bottom: 0, width: 2, background: '#C4533F' }} />
          </div>
          <span />
          <div style={{ position: 'relative', height: 22 }}>
            {TICKS.map(([d, label], i) => (
              <span key={d} className="muted" style={{ position: 'absolute', left: X(d), fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', transform: i === 0 ? 'none' : i === 6 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{label}</span>
            ))}
          </div>
          {GANTT.map((r) => (
            <div key={r.name} style={{ display: 'contents' }}>
              <div style={{ height: 38, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderTop: '1px solid #F0E9DA' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{r.pic}</span>
              </div>
              <div style={{ position: 'relative', height: 38, borderTop: '1px solid #F0E9DA', background: 'repeating-linear-gradient(90deg,transparent 0 calc(16.279% - 1px),#F0E9DA calc(16.279% - 1px) 16.279%)' }}>
                {r.segs.map((s, j) => (
                  <div key={j} style={{ position: 'absolute', top: 8, height: 22, borderRadius: 6, left: s.left, width: s.width, background: s.bg, border: s.border, color: s.fg, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden' }}>{s.label}</div>
                ))}
              </div>
            </div>
          ))}
          <span />
          <div style={{ position: 'relative', height: 18 }}>
            <span style={{ position: 'absolute', left: TODAY, top: 4, fontSize: 11, fontWeight: 800, color: '#C4533F', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>HARI INI · 16 Okt</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 16, marginTop: 8 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: '1px solid #E9E0CC' }}>
            <span className="card-title">Submission per grup · R1</span>
            <span className="muted" style={{ fontSize: 12 }}>
              <Legend c="#2F7A55" /> validated <Legend c="#6F95CF" /> pending <Legend c="#E3A92B" /> draft <Legend c="transparent" b="1.5px solid #CFC4AA" /> belum <Legend c="#C4533F" /> ditolak
            </span>
          </div>
          <div className="muted" style={{ display: 'grid', gridTemplateColumns: COLS, fontSize: 12, fontWeight: 700, padding: '10px 18px', background: '#F6F0E2' }}>
            <span>Grup</span><span>Captain · Leader</span><span>Riddle</span><span>Masuk</span><span>Pending</span><span>Valid</span><span>Aktivitas terakhir</span>
          </div>
          {rows.map((g) => (
            <div key={g.no} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', fontSize: 13, padding: '9px 18px', borderTop: '1px solid #F0E9DA' }}>
              <span className="row" style={{ gap: 8, fontWeight: 700 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: g.color }} />{g.no} {g.name}</span>
              <span style={{ color: '#3C4A42' }}>{g.captain} · {g.leader}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                {g.dots.map((d, k) => <span key={k} style={{ width: 18, height: 18, borderRadius: 5, background: DOT[d][0], border: DOT[d][1] }} />)}
              </span>
              <span className="num">{g.rec}</span>
              <span className="num" style={{ color: '#244F8F', fontWeight: 700 }}>{g.pen}</span>
              <span className="num" style={{ color: '#1F4D3A', fontWeight: 700 }}>{g.val}</span>
              <span className="muted">{g.last}</span>
            </div>
          ))}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="card-title">Validasi lewat SLA</span>
            {OVERDUE.map((o) => (
              <div key={o.title} className="row" style={{ padding: 10, borderRadius: 12, background: '#FBF6EA', border: '1px solid #F0C4BC' }}>
                <span style={{ width: 8, height: 34, borderRadius: 4, background: o.color }} />
                <div className="col" style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{o.title}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{o.who}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#9A2A1E' }}>{o.late}</span>
              </div>
            ))}
            <button className="link" style={{ textAlign: 'left' }}>Kirim reminder ke captain →</button>
          </div>
          <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="card-title">Pengumuman terjadwal</span>
            <div className="col" style={{ gap: 8, fontSize: 13 }}>
              {SCHEDULED.map(([label, when]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{label}</span><span style={{ fontWeight: 700 }}>{when}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ c, b = 'none' }) {
  return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: c, border: b, marginLeft: 4, verticalAlign: 'middle' }} />;
}
