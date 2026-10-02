import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { useMembers } from '../lib/members.jsx';
import { leaderName } from '../lib/groups.js';
import { computeScore, scoreParts, DEFAULT_SCORING, fmtWIB } from '../lib/game.js';
import { Lightbox } from '../components/Photo.jsx';

const CHECKS = ['Akun event di-tag di IG Story', 'Lokasi sesuai kunci jawaban', 'Jumlah peserta sesuai tag', 'Aturan diikuti · tanpa nama gereja', 'Tidak ada wajah jemaat tanpa izin'];
const REASONS = ['IG tag tidak ada', 'Lokasi salah', 'Foto tidak jelas', 'Indikasi AI / edit', 'Wajah jemaat tanpa izin'];
const STATUS_CHIP = { submitted: ['PENDING', '#E3ECF8', '#244F8F'], validated: ['VALID', '#E3EFE6', '#1F4D3A'], rejected: ['DITOLAK', '#FBE4E0', '#9A2A1E'], resubmit: ['ULANG', '#F8E9C4', '#7A5410'] };
const TOAST = { ok: ['#E3EFE6', '#1F4D3A'], warn: ['#F8E9C4', '#7A5410'], bad: ['#FBE4E0', '#9A2A1E'] };
const selectStyle = { height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid #DCD2BC', background: '#FFFDF8', font: 'inherit', fontSize: 13, fontWeight: 700 };

export default function ValidationQueue() {
  const { challenges, focus, reloadScores, groups: groupRows } = useGame();
  // [no, name, color] for a group number (falls back for a group that was deleted).
  const group = (no) => { const g = (groupRows || []).find((x) => x.no === no); return g ? [g.no, g.name, g.color] : [no, 'Grup ' + no, '#999']; };
  const members = useMembers().rows || [];
  const reviewable = (challenges || []).filter((c) => c.status !== 'draft');
  const [chId, setChId] = useState(null);
  const [fGroup, setFGroup] = useState('');
  const [fStatus, setFStatus] = useState('submitted');
  const [subs, setSubs] = useState(null);
  const [riddles, setRiddles] = useState([]);
  const [selId, setSelId] = useState(null);
  const [review, setReview] = useState(null);
  const [toast, setToast] = useState(null);
  const [media, setMedia] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => { if (!chId && challenges) setChId((focus || reviewable[0])?.id ?? null); }, [challenges]); // eslint-disable-line react-hooks/exhaustive-deps
  const challenge = reviewable.find((c) => c.id === chId);
  const scoring = { ...(challenge?.scoring?.type === 'riddle' ? DEFAULT_SCORING : {}), ...challenge?.scoring };

  useEffect(() => {
    if (!chId) return;
    setSubs(null); setSelId(null);
    Promise.all([api.listSubmissions({ challengeId: chId }), api.listRiddles(chId)]).then(([s, r]) => { setSubs(s); setRiddles(r); });
  }, [chId]);

  const list = useMemo(() => (subs || []).filter((s) => (!fGroup || s.group_no === fGroup) && (fStatus === 'all' || s.status === fStatus)), [subs, fGroup, fStatus]);
  const pendingHere = (subs || []).filter((s) => s.status === 'submitted').length;
  const cur = list.find((s) => s.id === selId) || null;

  // Pick the first item whenever the list changes and the selection fell out of it.
  useEffect(() => { if (!cur && list.length) select(list[0]); }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    setMedia(null); setZoom(false); setMediaLoading(!!cur?.media_path);
    if (cur?.media_path) api.mediaUrl(cur.media_path).then((u) => alive && setMedia(u)).catch(() => {}).finally(() => alive && setMediaLoading(false));
    return () => { alive = false; };
  }, [cur?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function select(s) {
    setSelId(s.id);
    setReview({
      checks: s.checks || [true, true, true, true, true],
      count: s.participant_count ?? s.tagged_ids.length,
      reason: s.reject_reason || null,
      override: false, overrideScore: '', overrideNote: '',
      manual: s.score ?? '',
    });
  }
  const move = (d = 1) => {
    if (!list.length) return;
    const i = list.findIndex((s) => s.id === selId);
    select(list[(i + d + list.length) % list.length]);
  };

  const auto = cur && review ? computeScore(scoring, { location_correct: review.checks[1], participant_count: review.count, manual: review.manual }) : 0;
  const score = review?.override && review.overrideScore !== '' ? Math.max(0, Math.min(scoring.max, Number(review.overrideScore))) : auto;
  const parts = cur && review ? scoreParts(scoring, { location_correct: review.checks[1], participant_count: review.count }) : null;
  const G = cur ? group(cur.group_no) : null;

  const decide = async (kind) => {
    if (!cur || !review) return;
    if (cur.status !== 'submitted') return setToast(['warn', 'Submission ini sudah diputuskan. Pilih yang masih pending.']);
    if ((kind === 'rejected' || kind === 'resubmit') && !review.reason) return setToast(['warn', 'Pilih alasan dulu sebelum menolak / minta resubmit.']);
    if (kind === 'validated' && review.override && !review.overrideNote.trim()) return setToast(['warn', 'Override skor wajib pakai alasan.']);
    const patch = {
      status: kind, checks: review.checks, location_correct: review.checks[1], participant_count: review.count,
      score: kind === 'validated' ? score : null,
      override_note: kind === 'validated' && review.override ? review.overrideNote.trim() : null,
      reject_reason: kind === 'validated' ? null : review.reason,
    };
    try {
      const row = await api.reviewSubmission(cur.id, patch);
      const next = subs.map((s) => (s.id === row.id ? row : s));
      setSubs(next);
      reloadScores();
      const label = `${G[1]}${riddleNo(cur) ? ' Riddle ' + riddleNo(cur) : ''}`;
      setToast([kind === 'validated' ? 'ok' : 'bad', kind === 'validated' ? `Disetujui · ${label} · ${score} pts` : kind === 'rejected' ? `Ditolak · ${label} · “${review.reason}”` : `Resubmit diminta · ${label}`]);
      // Advance to the next pending item.
      const i = next.findIndex((s) => s.id === row.id);
      const after = [...next.slice(i + 1), ...next.slice(0, i)].find((s) => s.status === 'submitted' && (!fGroup || s.group_no === fGroup));
      if (after) select(after);
    } catch (e) { setToast(['bad', e.message]); }
  };
  const riddleNo = (s) => riddles.find((r) => r.id === s.riddle_id)?.no;
  const riddle = cur && riddles.find((r) => r.id === cur.riddle_id);

  const keys = useRef();
  keys.current = { decide, move };
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role=dialog][aria-modal=true]')) return; // e.g. photo zoom open
      if (e.key === 'a' || e.key === 'A') keys.current.decide('validated');
      else if (e.key === 'r' || e.key === 'R') keys.current.decide('rejected');
      else if (e.key === 'ArrowRight') keys.current.move(1);
      else if (e.key === 'ArrowLeft') keys.current.move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tagged = cur ? cur.tagged_ids.map((id) => (members.find((p) => p.id === id)?.full_name || '').split(' ')[0]).filter(Boolean) : [];
  const setR = (patch) => setReview((r) => ({ ...r, ...patch }));

  return (
    <div className="col" style={{ minWidth: 0, minHeight: '100vh' }}>
      <div className="row" style={{ padding: '18px 24px', borderBottom: '1px solid #E9E0CC', flexWrap: 'wrap' }}>
        <span className="h2" style={{ marginRight: 10 }}>Validation Queue</span>
        <select aria-label="Challenge" value={chId || ''} onChange={(e) => setChId(e.target.value)} style={selectStyle}>
          {reviewable.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
        <select aria-label="Grup" value={fGroup} onChange={(e) => setFGroup(e.target.value)} style={selectStyle}>
          <option value="">Semua grup</option>
          {(groupRows || []).map(({ no, name }) => <option key={no} value={no}>{no} {name}</option>)}
        </select>
        <select aria-label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selectStyle}>
          <option value="submitted">Pending</option><option value="validated">Valid</option><option value="rejected">Ditolak</option><option value="resubmit">Minta ulang</option><option value="all">Semua status</option>
        </select>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{pendingHere} tersisa{challenge?.validate_by ? ' · SLA ' + fmtWIB(challenge.validate_by, { hour: undefined, minute: undefined }).replace(' WIB', '') : ''}</span>
      </div>

      {!subs ? <div className="muted" style={{ padding: 24 }}>Memuat submission…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: '290px minmax(0,1fr) 380px', flex: 1, minHeight: 760 }}>
          <div className="col" style={{ borderRight: '1px solid #E9E0CC', overflowY: 'auto' }}>
            {!list.length && <div className="muted" style={{ padding: 16, fontSize: 13 }}>Tidak ada submission dengan filter ini. 🎉</div>}
            {list.map((s) => {
              const [label, bg, fg] = STATUS_CHIP[s.status];
              const g = group(s.group_no);
              const on = s.id === selId;
              return (
                <button key={s.id} onClick={() => select(s)} className="row" style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #F0E9DA', background: on ? '#FFFDF8' : 'transparent', borderLeft: `4px solid ${on ? '#1F4D3A' : 'transparent'}` }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: g[2], color: '#fff', font: "800 13px 'Bricolage Grotesque'", display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{riddleNo(s) ?? g[1][0]}</span>
                  <div className="col" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{g[1]}{riddleNo(s) ? ` · Riddle ${riddleNo(s)}` : ''}{s.version > 1 ? ` · v${s.version}` : ''}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{fmtWIB(s.submitted_at, { day: undefined, month: undefined })} · {s.tagged_ids.length} org ditag</span>
                  </div>
                  <span className="chip" style={{ background: bg, color: fg }}>{label}</span>
                </button>
              );
            })}
          </div>

          {cur && review ? (
            <>
              <div className="col" style={{ padding: 20, gap: 14, minWidth: 0 }}>
                <div className="row">
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: G[2] }} />
                  <span style={{ font: "800 20px 'Bricolage Grotesque'" }}>{G[1]}{riddle ? ` · Riddle ${riddle.no}` : ''}</span>
                  <span className="muted" style={{ fontSize: 12 }}>dikirim {fmtWIB(cur.submitted_at)} · leader {leaderName(members, cur.group_no)} · v{cur.version}</span>
                </div>
                <div className={media ? '' : 'placeholder-stripes'} style={{ height: 380, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: '#6B665A', overflow: 'hidden', background: media ? '#14281F' : undefined, position: 'relative' }}>
                  {media ? (
                    <button onClick={() => setZoom(true)} title="Klik untuk memperbesar" style={{ width: '100%', height: '100%', padding: 0, cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={media} alt={`Foto ${G[1]}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      <span style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 12, fontWeight: 700, color: '#FBF6EA', background: 'rgba(20,40,31,.75)', padding: '4px 10px', borderRadius: 999 }}>⤢ Perbesar · {cur.media_name}</span>
                    </button>
                  ) : (
                    <>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{cur.media_name || 'tanpa foto'}</span>
                      <span style={{ fontSize: 12 }}>{mediaLoading ? 'Memuat foto…' : cur.media_path ? 'Foto tidak ditemukan di penyimpanan' : 'Submission ini tidak menyertakan foto tersimpan'}</span>
                    </>
                  )}
                </div>
                {zoom && media && <Lightbox src={media} alt={`Foto ${G[1]}`} caption={`${G[1]}${riddle ? ' · Riddle ' + riddle.no : ''} · v${cur.version}`} onClose={() => setZoom(false)} />}
                <div style={{ display: 'grid', gridTemplateColumns: riddle ? '1fr 1fr' : '1fr', gap: 10 }}>
                  {riddle && (
                    <>
                      <div className="card" style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em' }}>RIDDLE (dilihat member)</span>
                        <span style={{ fontSize: 14, fontStyle: 'italic' }}>“{riddle.prompt}”</span>
                      </div>
                      <div style={{ background: '#14281F', color: '#FBF6EA', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#E3A92B', letterSpacing: '.06em' }}>🔒 KUNCI JAWABAN · ADMIN ONLY</span>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{riddle.answer || '—'}</span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>Tidak pernah dikirim ke perangkat member.</span>
                      </div>
                    </>
                  )}
                  <div className="card" style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1', fontSize: 12, lineHeight: 1.5 }}>
                    <span><b>Link Image:</b> {cur.ig_url ? <a href={cur.ig_url.startsWith('http') ? cur.ig_url : 'https://' + cur.ig_url} target="_blank" rel="noreferrer">{cur.ig_url}</a> : '—'}</span>
                    <span><b>Deklarasi No-AI:</b> {cur.declaration ? '✓ dicentang oleh leader' : '✕ tidak dicentang'}</span>
                    <span className="muted">Ditag ({tagged.length}): {tagged.join(', ') || '—'}</span>
                    {cur.status !== 'submitted' && <span><b>Keputusan:</b> {STATUS_CHIP[cur.status][0]}{cur.score != null ? ` · ${cur.score} pts` : ''}{cur.reject_reason ? ` · “${cur.reject_reason}”` : ''}{cur.override_note ? ` · override: ${cur.override_note}` : ''}</span>}
                  </div>
                </div>
              </div>

              <div className="col" style={{ borderLeft: '1px solid #E9E0CC', background: '#FFFDF8', padding: 20, gap: 12 }}>
                <span style={{ font: "700 16px 'Bricolage Grotesque'" }}>Checklist</span>
                {CHECKS.map((label, i) => {
                  const on = review.checks[i];
                  return (
                    <button key={label} onClick={() => setR({ checks: review.checks.map((v, j) => (j === i ? !v : v)) })} className="row" style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid #E9E0CC', background: on ? '#FFFDF8' : '#FBE4E0' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid #1F4D3A', background: on ? '#1F4D3A' : 'transparent', color: '#FBF6EA', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{label}</span>
                    </button>
                  );
                })}
                {scoring.type === 'riddle' && (
                  <div className="row" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #E9E0CC' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Jumlah peserta di foto</span>
                    <StepBtn onClick={() => setR({ count: Math.max(0, review.count - 1) })}>−</StepBtn>
                    <span className="num" style={{ font: "800 18px 'Bricolage Grotesque'", width: 28, textAlign: 'center' }}>{review.count}</span>
                    <StepBtn onClick={() => setR({ count: Math.min(20, review.count + 1) })}>+</StepBtn>
                  </div>
                )}
                {scoring.type === 'manual' && (
                  <label className="row" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #E9E0CC', fontSize: 13, fontWeight: 600 }}>
                    <span style={{ flex: 1 }}>Nilai (0–{scoring.max})</span>
                    <input type="number" min="0" max={scoring.max} value={review.manual} onChange={(e) => setR({ manual: e.target.value })} style={{ width: 70, height: 32, borderRadius: 8, border: '1px solid #DCD2BC', padding: '0 8px', font: 'inherit' }} />
                  </label>
                )}
                <div style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="num" style={{ font: "800 36px/1 'Bricolage Grotesque'" }}>{score}</span>
                    <span style={{ fontSize: 13, opacity: 0.85 }}>/ {scoring.max} · {review.override ? 'override manual' : review.checks[0] ? 'dihitung otomatis' : 'IG tag belum ✓ — sebaiknya tolak'}</span>
                  </div>
                  {scoring.type === 'riddle' && parts && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', fontSize: 12, opacity: 0.9 }}>
                      <span>Lokasi {review.checks[1] ? 'benar' : 'salah'} × {scoring.location_weight}%</span><span className="num">{parts.loc.toFixed(1)}</span>
                      <span>Partisipasi {review.count} org → {parts.tier} × {scoring.participation_weight}%</span><span className="num">{parts.part.toFixed(1)}</span>
                    </div>
                  )}
                  {scoring.type === 'flat' && <span style={{ fontSize: 12, opacity: 0.9 }}>Poin tetap untuk submission yang tervalidasi.</span>}
                </div>
                <button className="link" style={{ textAlign: 'left' }} onClick={() => setR({ override: !review.override })}>{review.override ? '× Batal override' : '✎ Override skor manual…'}</button>
                {review.override && (
                  <div className="col" style={{ gap: 6, padding: 10, borderRadius: 10, background: '#F8E9C4' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7A5410' }}>Override skor wajib pakai alasan</span>
                    <div className="row" style={{ gap: 6 }}>
                      <input type="number" min="0" max={scoring.max} aria-label="Skor override" placeholder="Skor" value={review.overrideScore} onChange={(e) => setR({ overrideScore: e.target.value })} style={{ width: 70, height: 36, borderRadius: 8, background: '#FFFDF8', border: '1px solid #E3C987', padding: '0 8px', font: 'inherit' }} />
                      <input aria-label="Alasan override" value={review.overrideNote} onChange={(e) => setR({ overrideNote: e.target.value })} placeholder="mis. “1 anggota tertutup, dikonfirmasi captain”" style={{ flex: 1, height: 36, borderRadius: 8, background: '#FFFDF8', border: '1px solid #E3C987', padding: '0 10px', font: 'inherit', fontSize: 13 }} />
                    </div>
                  </div>
                )}
                <span className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Alasan (untuk tolak / minta ulang)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {REASONS.map((label) => {
                    const on = review.reason === label;
                    return <button key={label} onClick={() => setR({ reason: on ? null : label })} style={{ fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 999, background: on ? '#9A2A1E' : '#FBF6EA', color: on ? '#fff' : '#3C4A42', border: `1px solid ${on ? '#9A2A1E' : '#E9E0CC'}` }}>{label}</button>;
                  })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
                  <button onClick={() => decide('validated')} style={{ ...actBtn, height: 46, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 800, fontSize: 14 }}>Approve <span className="kbd" style={{ background: 'rgba(255,255,255,.18)' }}>A</span></button>
                  <button onClick={() => decide('rejected')} style={{ ...actBtn, height: 46, background: '#FBE4E0', color: '#9A2A1E', fontWeight: 800, fontSize: 14 }}>Reject <span className="kbd" style={{ background: 'rgba(154,42,30,.12)' }}>R</span></button>
                  <button onClick={() => decide('resubmit')} style={{ ...actBtn, border: '1px solid #DCD2BC' }}>Minta resubmit</button>
                  <button onClick={() => move(1)} style={{ ...actBtn, border: '1px solid #DCD2BC' }}>Lewati <span className="kbd" style={{ background: '#EDE6D6' }}>→</span></button>
                </div>
                <div role="status" style={{ minHeight: 40, borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, background: toast ? TOAST[toast[0]][0] : '#F6F0E2', color: toast ? TOAST[toast[0]][1] : '#56655C' }}>
                  {toast ? toast[1] : 'Tip: A = approve · R = reject · ← → = pindah'}
                </div>
              </div>
            </>
          ) : <div className="muted" style={{ padding: 24, gridColumn: 'span 2' }}>Pilih submission di kiri.</div>}
        </div>
      )}
    </div>
  );
}

const actBtn = { height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13 };

function StepBtn({ onClick, children }) {
  return <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #DCD2BC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{children}</button>;
}
