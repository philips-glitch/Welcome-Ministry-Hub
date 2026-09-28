import { useEffect, useRef, useState } from 'react';
import { GROUPS, RIDDLES, MEMBERS, tier, pad, memberName } from '../data.js';

const CHECKS = ['Akun event di-tag di IG Story', 'Lokasi sesuai kunci jawaban', 'Jumlah peserta sesuai tag', 'Aturan diikuti · tanpa nama gereja', 'Tidak ada wajah jemaat tanpa izin'];
const REASONS = ['IG tag tidak ada', 'Lokasi salah', 'Foto tidak jelas', 'Indikasi AI / edit', 'Wajah jemaat tanpa izin'];
const STATUS_CHIP = { pending: ['PENDING', '#E3ECF8', '#244F8F'], validated: ['VALID', '#E3EFE6', '#1F4D3A'], rejected: ['DITOLAK', '#FBE4E0', '#9A2A1E'], resubmit: ['ULANG', '#F8E9C4', '#7A5410'] };
const TOAST = { ok: ['#E3EFE6', '#1F4D3A'], warn: ['#F8E9C4', '#7A5410'], bad: ['#FBE4E0', '#9A2A1E'] };
const submittedAt = (m) => { const t = 9 * 60 + m * 3; return `Jum ${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };
const freshReview = (item) => ({ checks: [true, true, true, true, true], count: item.count, reason: null, override: false, overrideNote: '' });

export default function ValidationQueue({ queue, setQueue, groups }) {
  const [qi, setQi] = useState(() => Math.max(0, queue.findIndex((q) => q.status === 'pending')));
  const [review, setReview] = useState(() => freshReview(queue[qi]));
  const [toast, setToast] = useState(null);

  const cur = queue[qi];
  const G = GROUPS[cur.gi];
  const pending = queue.filter((q) => q.status === 'pending').length;
  const t = tier(review.count);
  const score = (review.checks[1] ? 5 : 0) + t / 2;

  const select = (i, list = queue) => { setQi(i); setReview(freshReview(list[i])); };
  const nextPending = (from, list) => {
    const n = list.length;
    for (let k = 1; k <= n; k++) { const j = (from + k) % n; if (list[j].status === 'pending') return j; }
    return from;
  };
  const go = () => select(nextPending(qi, queue));

  const decide = (kind) => {
    if (cur.status !== 'pending') return;
    if ((kind === 'reject' || kind === 'resubmit') && !review.reason) {
      setToast(['warn', 'Pilih alasan dulu sebelum menolak / minta resubmit.']);
      return;
    }
    const status = kind === 'approve' ? 'validated' : kind === 'reject' ? 'rejected' : 'resubmit';
    const next = queue.map((q, i) => (i === qi ? { ...q, status, score } : q));
    setQueue(next);
    setToast([
      kind === 'approve' ? 'ok' : 'bad',
      kind === 'approve' ? `Disetujui · ${G[1]} Riddle ${cur.rno} · ${score} pts`
        : kind === 'reject' ? `Ditolak · ${G[1]} Riddle ${cur.rno} · “${review.reason}”`
        : `Resubmit diminta · ${G[1]} Riddle ${cur.rno}`,
    ]);
    select(nextPending(qi, next), next);
  };

  // Keyboard shortcuts: A approve · R reject · → next. Ref keeps the listener on the latest closures.
  const keys = useRef();
  keys.current = { decide, go };
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'a' || e.key === 'A') keys.current.decide('approve');
      else if (e.key === 'r' || e.key === 'R') keys.current.decide('reject');
      else if (e.key === 'ArrowRight') keys.current.go();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tagged = groups.assign[cur.gi].slice(0, cur.count).map((id) => MEMBERS[id].name.split(' ')[0]).join(', ');
  const toggleCheck = (i) => setReview((r) => { const c = [...r.checks]; c[i] = !c[i]; return { ...r, checks: c }; });

  return (
    <div className="col" style={{ minWidth: 0, minHeight: '100vh' }}>
      <div className="row" style={{ padding: '18px 24px', borderBottom: '1px solid #E9E0CC' }}>
        <span className="h2" style={{ marginRight: 10 }}>Validation Queue</span>
        <div className="select"><span className="muted">Challenge</span><b>R1 Photo</b> ▾</div>
        <div className="select"><span className="muted">Grup</span><b>Semua</b> ▾</div>
        <div className="select"><span className="muted">Status</span><b>Pending</b> ▾</div>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{pending} tersisa · SLA Sel 20 Okt EOD</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px minmax(0,1fr) 380px', flex: 1, minHeight: 760 }}>
        {/* List */}
        <div className="col" style={{ borderRight: '1px solid #E9E0CC' }}>
          {queue.map((q, i) => {
            const [label, bg, fg] = STATUS_CHIP[q.status];
            const active = i === qi;
            return (
              <button key={i} onClick={() => select(i)} className="row" style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #F0E9DA', background: active ? '#FFFDF8' : 'transparent', borderLeft: `4px solid ${active ? '#1F4D3A' : 'transparent'}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: GROUPS[q.gi][2], color: '#fff', font: "800 13px 'Bricolage Grotesque'", display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{q.rno}</span>
                <div className="col" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{GROUPS[q.gi][1]} · Riddle {q.rno}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{submittedAt(q.min)} · {q.count} org ditag</span>
                </div>
                <span className="chip" style={{ background: bg, color: fg }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Evidence */}
        <div className="col" style={{ padding: 20, gap: 14, minWidth: 0 }}>
          <div className="row">
            <span style={{ width: 12, height: 12, borderRadius: 4, background: G[2] }} />
            <span style={{ font: "800 20px 'Bricolage Grotesque'" }}>{G[1]} · Riddle {cur.rno}</span>
            <span className="muted" style={{ fontSize: 12 }}>dikirim {submittedAt(cur.min)} oleh {memberName(groups.leaders[cur.gi])} · v1</span>
          </div>
          <div className="placeholder-stripes" style={{ height: 380, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: '#6B665A' }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>foto grup · IMG_2041.jpg · 4.2 MB</span>
            <span style={{ fontSize: 12 }}>klik untuk zoom · EXIF: 16 Okt 17:42</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 14 }}>
            <div className="mono muted" style={{ height: 200, borderRadius: 12, background: 'repeating-linear-gradient(135deg,#DCE6DF 0 8px,#E8EFE9 8px 16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>screenshot<br />IG Story</div>
            <div className="col" style={{ gap: 10 }}>
              <div className="card" style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em' }}>RIDDLE (dilihat member)</span>
                <span style={{ fontSize: 14, fontStyle: 'italic' }}>“{RIDDLES[cur.rno - 1][0]}”</span>
              </div>
              <div style={{ background: '#14281F', color: '#FBF6EA', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#E3A92B', letterSpacing: '.06em' }}>🔒 KUNCI JAWABAN · ADMIN ONLY</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{RIDDLES[cur.rno - 1][1]}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>Tidak pernah dikirim ke perangkat member.</span>
              </div>
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>Ditag: {tagged}</div>
            </div>
          </div>
        </div>

        {/* Decision panel */}
        <div className="col" style={{ borderLeft: '1px solid #E9E0CC', background: '#FFFDF8', padding: 20, gap: 12 }}>
          <span style={{ font: "700 16px 'Bricolage Grotesque'" }}>Checklist</span>
          {CHECKS.map((label, i) => {
            const on = review.checks[i];
            return (
              <button key={label} onClick={() => toggleCheck(i)} className="row" style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid #E9E0CC', background: on ? '#FFFDF8' : '#FBE4E0' }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid #1F4D3A', background: on ? '#1F4D3A' : 'transparent', color: '#FBF6EA', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</span>
              </button>
            );
          })}
          <div className="row" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #E9E0CC' }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Jumlah peserta di foto</span>
            <StepBtn onClick={() => setReview((r) => ({ ...r, count: Math.max(0, r.count - 1) }))}>−</StepBtn>
            <span className="num" style={{ font: "800 18px 'Bricolage Grotesque'", width: 28, textAlign: 'center' }}>{review.count}</span>
            <StepBtn onClick={() => setReview((r) => ({ ...r, count: Math.min(14, r.count + 1) }))}>+</StepBtn>
          </div>
          <div style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="num" style={{ font: "800 36px/1 'Bricolage Grotesque'" }}>{score}</span>
              <span style={{ fontSize: 13, opacity: 0.85 }}>/ 10 · {review.checks[0] ? 'dihitung otomatis' : 'IG tag belum ✓ — sebaiknya tolak'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', fontSize: 12, opacity: 0.9 }}>
              <span>Lokasi {review.checks[1] ? 'benar 10' : 'salah 0'} × 50%</span><span className="num">{review.checks[1] ? '5.0' : '0.0'}</span>
              <span>Partisipasi {review.count} org → {t} × 50%</span><span className="num">{(t / 2).toFixed(1)}</span>
            </div>
          </div>
          <button className="link" style={{ textAlign: 'left' }} onClick={() => setReview((r) => ({ ...r, override: !r.override }))}>
            {review.override ? '× Batal override' : '✎ Override skor manual…'}
          </button>
          {review.override && (
            <div className="col" style={{ gap: 6, padding: 10, borderRadius: 10, background: '#F8E9C4' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7A5410' }}>Override skor wajib pakai alasan (tercatat di Audit Log)</span>
              <input
                value={review.overrideNote}
                onChange={(e) => setReview((r) => ({ ...r, overrideNote: e.target.value }))}
                placeholder="mis. “1 anggota tertutup di belakang, dikonfirmasi captain”"
                style={{ height: 36, borderRadius: 8, background: '#FFFDF8', border: '1px solid #E3C987', padding: '0 10px', fontSize: 13, font: 'inherit' }}
              />
            </div>
          )}
          <span className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Alasan (untuk tolak / minta ulang)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REASONS.map((label) => {
              const on = review.reason === label;
              return (
                <button key={label} onClick={() => setReview((r) => ({ ...r, reason: on ? null : label }))} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 999, background: on ? '#9A2A1E' : '#FBF6EA', color: on ? '#fff' : '#3C4A42', border: `1px solid ${on ? '#9A2A1E' : '#E9E0CC'}` }}>{label}</button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
            <button onClick={() => decide('approve')} style={{ ...actBtn, height: 46, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 800, fontSize: 14 }}>Approve <span className="kbd" style={{ background: 'rgba(255,255,255,.18)' }}>A</span></button>
            <button onClick={() => decide('reject')} style={{ ...actBtn, height: 46, background: '#FBE4E0', color: '#9A2A1E', fontWeight: 800, fontSize: 14 }}>Reject <span className="kbd" style={{ background: 'rgba(154,42,30,.12)' }}>R</span></button>
            <button onClick={() => decide('resubmit')} style={{ ...actBtn, border: '1px solid #DCD2BC' }}>Minta resubmit</button>
            <button onClick={go} style={{ ...actBtn, border: '1px solid #DCD2BC' }}>Lewati <span className="kbd" style={{ background: '#EDE6D6' }}>→</span></button>
          </div>
          <div role="status" style={{ minHeight: 40, borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, background: toast ? TOAST[toast[0]][0] : '#F6F0E2', color: toast ? TOAST[toast[0]][1] : '#56655C' }}>
            {toast ? toast[1] : 'Tip: A = approve · R = reject · → = berikutnya'}
          </div>
        </div>
      </div>
    </div>
  );
}

const actBtn = { height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13 };

function StepBtn({ onClick, children }) {
  return <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #DCD2BC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{children}</button>;
}
