import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { useMembers } from '../lib/members.jsx';
import { leaderName, validatesOnly, playsWithoutPoints } from '../lib/groups.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { computeScore, scoreParts, withDefaults, formOf, isConnect, itemMax, marksMissing, tierPoints, fmtWIB } from '../lib/game.js';
import { Lightbox } from '../components/Photo.jsx';

// Defaults for riddle-photo challenges; other challenges set their own in challenges.form.
const CHECKS = ['Akun event di-tag di IG Story', 'Lokasi sesuai kunci jawaban', 'Jumlah peserta sesuai tag', 'Aturan diikuti · tanpa nama gereja', 'Tidak ada wajah jemaat tanpa izin'];
const REASONS = ['IG tag tidak ada', 'Lokasi salah', 'Foto tidak jelas', 'Indikasi AI / edit', 'Wajah jemaat tanpa izin'];
const STATUS_CHIP = { submitted: ['PENDING', '#E3ECF8', '#244F8F'], validated: ['VALID', '#E3EFE6', '#1F4D3A'], rejected: ['DITOLAK', '#FBE4E0', '#9A2A1E'], resubmit: ['ULANG', '#F8E9C4', '#7A5410'] };
const TOAST = { ok: ['#E3EFE6', '#1F4D3A'], warn: ['#F8E9C4', '#7A5410'], bad: ['#FBE4E0', '#9A2A1E'] };
const selectStyle = { height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid #DCD2BC', background: '#FFFDF8', font: 'inherit', fontSize: 13, fontWeight: 700 };
const first = (name) => (name || '').split(' ')[0];

export default function ValidationQueue() {
  const { challenges, focus, reloadScores, groups: groupRows } = useGame();
  // [no, name, color] for a group number (falls back for a group that was deleted).
  const group = (no) => { const g = (groupRows || []).find((x) => x.no === no); return g ? [g.no, g.name, g.color] : [no, 'Grup ' + no, '#999']; };
  const members = useMembers().rows || [];
  // Captains validate their own group only; PICs and admins see every group.
  const auth = useAuth();
  const only = validatesOnly(auth.profile);
  // Super Admin / PIC can reopen a validated submission so its sender can change it again.
  const canReopen = auth.can('challenges.manage');
  const nameOf = (id) => members.find((p) => p.id === id)?.full_name || '?';
  // Captains play without points: their entries score 0 and they aren't counted as participants.
  const noPoints = (id) => playsWithoutPoints(members.find((p) => p.id === id));
  const reviewable = (challenges || []).filter((c) => c.status !== 'draft');
  const [chId, setChId] = useState(null);
  const [fGroup, setFGroup] = useState('');
  const [fStatus, setFStatus] = useState('submitted');
  const [subs, setSubs] = useState(null);
  const [riddles, setRiddles] = useState([]);
  const [gtkm, setGtkm] = useState({});
  const [selId, setSelId] = useState(null);
  const [review, setReview] = useState(null);
  const [toast, setToast] = useState(null);
  const [media, setMedia] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => { if (!chId && challenges) setChId((focus || reviewable[0])?.id ?? null); }, [challenges]); // eslint-disable-line react-hooks/exhaustive-deps
  const challenge = reviewable.find((c) => c.id === chId);
  const scoring = withDefaults(challenge?.scoring);
  const form = formOf(challenge);
  const connect = isConnect(challenge);
  const checksList = form.checks?.length ? form.checks : CHECKS;
  const reasons = form.reasons?.length ? form.reasons : REASONS;
  const max = itemMax(scoring);

  useEffect(() => {
    if (!chId) return;
    setSubs(null); setSelId(null); setGtkm({});
    Promise.all([api.listSubmissions({ challengeId: chId }), api.listRiddles(chId)]).then(([s, r]) => {
      if (only !== null) s = s.filter((x) => x.group_no === only);
      setSubs(s); setRiddles(r);
      // Get to Know Me answers of everyone being described: the key for Q1–Q3.
      const ids = [...new Set(s.map((x) => x.target_id).filter(Boolean))];
      if (ids.length) api.getGtkm(ids).then(setGtkm).catch(() => {});
    });
  }, [chId, only]);

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
      checks: s.checks || checksList.map(() => true),
      count: s.participant_count ?? s.tagged_ids.filter((id) => !noPoints(id)).length,
      marks: { ...(s.marks || {}) },
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

  const auto = cur && review ? computeScore(scoring, { location_correct: review.checks[1], participant_count: review.count, manual: review.manual, marks: review.marks }) : 0;
  const byCaptain = !!cur && noPoints(cur.submitted_by);
  const score = byCaptain ? 0 : review?.override && review.overrideScore !== '' ? Math.max(0, Math.min(max, Number(review.overrideScore))) : auto;
  const parts = cur && review && scoring.type === 'riddle' ? scoreParts(scoring, { location_correct: review.checks[1], participant_count: review.count }) : null;
  const missing = review ? marksMissing(scoring, review.marks) : [];
  const G = cur ? group(cur.group_no) : null;
  const titleOf = (s) => (s.target_id ? `${first(nameOf(s.submitted_by))} → ${first(nameOf(s.target_id))}` : `${group(s.group_no)[1]}${riddleNo(s) ? ` · Riddle ${riddleNo(s)}` : ''}`);

  // Rubric challenges: team participation = everyone tagged across the group's validated submissions.
  const teamTagged = cur && scoring.type === 'rubric'
    ? new Set((subs || []).filter((s) => s.group_no === cur.group_no && s.status === 'validated' && s.id !== cur.id).flatMap((s) => s.tagged_ids)) : null;
  const teamWith = teamTagged ? [...new Set([...teamTagged, ...cur.tagged_ids])].filter((id) => !noPoints(id)).length : 0;

  const reopen = async () => {
    if (!cur || cur.status !== 'validated') return;
    if (!window.confirm(`Buka lagi “${titleOf(cur)}”? Skornya dihapus dan pengirim bisa mengubahnya lagi (walau deadline sudah lewat) sampai divalidasi ulang.`)) return;
    try {
      const row = await api.reopenSubmission(cur.id);
      setSubs((xs) => xs.map((s) => (s.id === row.id ? row : s)));
      reloadScores();
      setToast(['ok', `Dibuka lagi · ${titleOf(cur)} — pengirim bisa mengubahnya`]);
    } catch (e) { setToast(['bad', e.message]); }
  };

  const decide = async (kind) => {
    if (!cur || !review) return;
    if (cur.status !== 'submitted') return setToast(['warn', 'Submission ini sudah diputuskan. Pilih yang masih pending.']);
    if ((kind === 'rejected' || kind === 'resubmit') && !review.reason) return setToast(['warn', 'Pilih alasan dulu sebelum menolak / minta resubmit.']);
    if (kind === 'validated' && missing.length && !review.override) return setToast(['warn', `Beri nilai dulu: ${missing.map((m) => m.label || m.key.toUpperCase()).join(', ')}.`]);
    if (kind === 'validated' && review.override && !review.overrideNote.trim()) return setToast(['warn', 'Override skor wajib pakai alasan.']);
    const patch = {
      status: kind, checks: review.checks,
      location_correct: scoring.type === 'riddle' ? review.checks[1] : null,
      participant_count: scoring.type === 'riddle' ? review.count : null,
      marks: ['connect', 'rubric'].includes(scoring.type) ? review.marks : null,
      score: kind === 'validated' ? score : null,
      override_note: kind === 'validated' && review.override ? review.overrideNote.trim() : null,
      reject_reason: kind === 'validated' ? null : review.reason,
    };
    try {
      const row = await api.reviewSubmission(cur.id, patch);
      const next = subs.map((s) => (s.id === row.id ? row : s));
      setSubs(next);
      reloadScores();
      const label = titleOf(cur);
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

  const tagged = cur ? cur.tagged_ids.map((id) => first(members.find((p) => p.id === id)?.full_name)).filter(Boolean) : [];
  const setR = (patch) => setReview((r) => ({ ...r, ...patch }));
  const setMark = (k, v) => setReview((r) => ({ ...r, marks: { ...r.marks, [k]: v } }));
  const link = cur?.ig_url && (cur.ig_url.startsWith('http') ? cur.ig_url : 'https://' + cur.ig_url);
  const showMedia = cur && (form.photo !== 'none' || cur.media_path);

  return (
    <div className="col" style={{ minWidth: 0, minHeight: '100vh' }}>
      <div className="row" style={{ padding: '18px 24px', borderBottom: '1px solid #E9E0CC', flexWrap: 'wrap' }}>
        <span className="h2" style={{ marginRight: 10 }}>Validation Queue</span>
        <select aria-label="Challenge" value={chId || ''} onChange={(e) => setChId(e.target.value)} style={selectStyle}>
          {reviewable.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
        <select aria-label="Grup" value={fGroup} onChange={(e) => setFGroup(e.target.value)} style={selectStyle}>
          <option value="">Semua grup</option>
          {(groupRows || []).filter(({ no }) => only === null || no === only).map(({ no, name }) => <option key={no} value={no}>{no} {name}</option>)}
        </select>
        <select aria-label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selectStyle}>
          <option value="submitted">Pending</option><option value="validated">Valid</option><option value="rejected">Ditolak</option><option value="resubmit">Minta ulang</option><option value="all">Semua status</option>
        </select>
        {only !== null && <span className="muted" style={{ fontSize: 12 }}>{only ? `Captain: kamu memvalidasi grup kamu (${only}) saja.` : 'Kamu belum punya grup, jadi belum ada submission untuk divalidasi.'}</span>}
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
                    <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(s)}{s.version > 1 ? ` · v${s.version}` : ''}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{fmtWIB(s.submitted_at, { day: undefined, month: undefined })} · {s.target_id ? g[1] : `${s.tagged_ids.length} org ditag`}</span>
                  </div>
                  <span className="chip" style={{ background: bg, color: fg }}>{label}</span>
                </button>
              );
            })}
          </div>

          {cur && review ? (
            <>
              <div className="col" style={{ padding: 20, gap: 14, minWidth: 0 }}>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: G[2] }} />
                  <span style={{ font: "800 20px 'Bricolage Grotesque'" }}>{cur.target_id ? `${nameOf(cur.submitted_by)} → ${nameOf(cur.target_id)}` : `${G[1]}${riddle ? ` · Riddle ${riddle.no}` : ''}`}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{cur.target_id ? `${G[1]} · ` : ''}dikirim {fmtWIB(cur.submitted_at)}{cur.target_id ? '' : ` · leader ${leaderName(members, cur.group_no)}`} · v{cur.version}</span>
                </div>

                {connect && <AnswerSheet scoring={scoring} answers={cur.answers || {}} key_={gtkm[cur.target_id]} marks={review.marks} setMark={setMark} locked={cur.status !== 'submitted'} />}

                {form.photo === 'none' && !cur.media_path && (
                  <a href={link || undefined} target="_blank" rel="noreferrer" className="card" style={{ borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: '#1B2620', opacity: link ? 1 : 0.6 }}>
                    <span style={{ width: 48, height: 48, borderRadius: 14, background: '#1F4D3A', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>▶</span>
                    <div className="col" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 800 }}>{link ? `Buka · ${form.link_label}` : 'Tidak ada link'}</span>
                      <span className="muted" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{cur.ig_url || '—'}</span>
                    </div>
                  </a>
                )}

                {showMedia && (
                  <div className={media ? '' : 'placeholder-stripes'} style={{ height: connect ? 260 : 380, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: '#6B665A', overflow: 'hidden', background: media ? '#14281F' : undefined, position: 'relative' }}>
                    {media ? (
                      <button onClick={() => setZoom(true)} title="Klik untuk memperbesar" style={{ width: '100%', height: '100%', padding: 0, cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={media} alt={`Foto ${titleOf(cur)}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        <span style={{ position: 'absolute', right: 10, bottom: 10, fontSize: 12, fontWeight: 700, color: '#FBF6EA', background: 'rgba(20,40,31,.75)', padding: '4px 10px', borderRadius: 999 }}>⤢ Perbesar · {cur.media_name}</span>
                      </button>
                    ) : (
                      <>
                        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{cur.media_name || (form.photo === 'optional' ? 'tanpa foto (opsional)' : 'tanpa foto')}</span>
                        <span style={{ fontSize: 12 }}>{mediaLoading ? 'Memuat foto…' : cur.media_path ? 'Foto tidak ditemukan di penyimpanan' : cur.media_name ? 'Submission ini tidak menyertakan foto tersimpan' : connect ? 'Tidak ada bonus foto' : 'Submission ini tidak menyertakan foto'}</span>
                      </>
                    )}
                  </div>
                )}
                {zoom && media && <Lightbox src={media} alt={`Foto ${titleOf(cur)}`} caption={`${titleOf(cur)} · v${cur.version}`} onClose={() => setZoom(false)} />}
                <div style={{ display: 'grid', gridTemplateColumns: riddle ? '1fr 1fr' : '1fr', gap: 10 }}>
                  {riddle && (
                    <>
                      <div className="card" style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em' }}>RIDDLE (dilihat member)</span>
                        <span style={{ fontSize: 14, fontStyle: 'italic' }}>“{riddle.prompt}”</span>
                        {cur.answers?.answer && <span style={{ fontSize: 13, marginTop: 4 }}><b>Jawaban tim:</b> {cur.answers.answer}</span>}
                      </div>
                      <div style={{ background: '#14281F', color: '#FBF6EA', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#E3A92B', letterSpacing: '.06em' }}>🔒 KUNCI JAWABAN · ADMIN ONLY</span>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{riddle.answer || '—'}</span>
                        <span style={{ fontSize: 11, opacity: 0.7 }}>Tidak pernah dikirim ke perangkat member.</span>
                      </div>
                    </>
                  )}
                  <div className="card" style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1', fontSize: 12, lineHeight: 1.5 }}>
                    {form.link !== 'none' && <span><b>{form.link_label}:</b> {link ? <a href={link} target="_blank" rel="noreferrer">{cur.ig_url}</a> : '—'}</span>}
                    <span><b>{connect ? 'Konfirmasi aturan' : 'Deklarasi No-AI'}:</b> {cur.declaration ? `✓ dicentang oleh ${connect ? first(nameOf(cur.submitted_by)) : 'leader'}` : '✕ tidak dicentang'}</span>
                    {!connect && <span className="muted">Ditag ({tagged.length}): {tagged.join(', ') || '—'}</span>}
                    {cur.status !== 'submitted' && <span><b>Keputusan:</b> {STATUS_CHIP[cur.status][0]}{cur.score != null ? ` · ${cur.score} pts` : ''}{cur.reject_reason ? ` · “${cur.reject_reason}”` : ''}{cur.override_note ? ` · override: ${cur.override_note}` : ''}</span>}
                    {(cur.adjustments || []).map((a, i) => (
                      <span key={i} style={{ color: '#56655C' }}><b>Poin diubah</b> {a.from ?? '—'} → {a.to} oleh {a.by_name || 'panitia'} · {fmtWIB(a.at)} · “{a.note}”</span>
                    ))}
                    {cur.status === 'validated' && canReopen && !noPoints(cur.submitted_by) && (
                      <AdjustScore key={cur.id} sub={cur} max={max}
                        onSaved={(row) => { setSubs((xs) => xs.map((s) => (s.id === row.id ? row : s))); reloadScores(); setToast(['ok', `Poin diubah · ${titleOf(cur)} · ${row.score} pts`]); }}
                        onError={(m) => setToast(['bad', m])} />
                    )}
                    {cur.status === 'validated' && canReopen && <button className="link" style={{ textAlign: 'left', color: '#7A5410', fontSize: 12 }} onClick={reopen}>↺ Buka lagi — skor dihapus, pengirim bisa mengubahnya</button>}
                    {cur.status === 'submitted' && cur.reopened_at && <span style={{ color: '#7A5410' }}><b>Dibuka lagi</b> oleh panitia {fmtWIB(cur.reopened_at)} — pengirim bisa mengubahnya sampai divalidasi ulang.</span>}
                  </div>
                </div>
              </div>

              <div className="col" style={{ borderLeft: '1px solid #E9E0CC', background: '#FFFDF8', padding: 20, gap: 12 }}>
                <span style={{ font: "700 16px 'Bricolage Grotesque'" }}>Checklist</span>
                {checksList.map((label, i) => {
                  const on = review.checks[i] ?? true;
                  return (
                    <button key={label} onClick={() => setR({ checks: checksList.map((_, j) => (j === i ? !on : review.checks[j] ?? true)) })} className="row" style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid #E9E0CC', background: on ? '#FFFDF8' : '#FBE4E0' }}>
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
                {connect && (
                  <button onClick={() => setMark('photo', !review.marks.photo)} disabled={!cur.media_name && !cur.media_path} className="row" style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: '1px solid #E9E0CC', opacity: cur.media_name || cur.media_path ? 1 : 0.5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, border: '2px solid #1F4D3A', background: review.marks.photo ? '#1F4D3A' : 'transparent', color: '#FBF6EA', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{review.marks.photo ? '✓' : ''}</span>
                    <div className="col" style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Foto valid · +{scoring.photo_bonus}</span>
                      <span className="muted" style={{ fontSize: 11 }}>Jelas berdua · saat/sekitar ngobrol · pantas</span>
                    </div>
                  </button>
                )}
                {scoring.type === 'rubric' && (
                  <div className="col" style={{ gap: 8 }}>
                    {scoring.criteria.map((k) => (
                      <div key={k.key} className="col" style={{ gap: 6, padding: '10px 12px', borderRadius: 10, border: `1px solid ${review.marks[k.key] == null || review.marks[k.key] === '' ? '#E3C987' : '#E9E0CC'}` }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{k.label}</span>
                          {k.binary ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[[k.max, `Benar · ${k.max}`], [0, 'Salah · 0']].map(([v, l]) => (
                                <button key={v} onClick={() => setMark(k.key, v)} style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8, border: '1px solid #DCD2BC', background: review.marks[k.key] === v ? (v ? '#1F4D3A' : '#9A2A1E') : '#FFFDF8', color: review.marks[k.key] === v ? '#FBF6EA' : '#3C4A42' }}>{l}</button>
                              ))}
                            </div>
                          ) : (
                            <label className="row" style={{ gap: 4, fontSize: 12 }}>
                              <input type="number" min="0" max={k.max} aria-label={k.label} value={review.marks[k.key] ?? ''} onChange={(e) => setMark(k.key, e.target.value === '' ? '' : Math.max(0, Math.min(k.max, Number(e.target.value))))} style={{ width: 56, height: 30, borderRadius: 8, border: '1px solid #DCD2BC', padding: '0 6px', font: 'inherit' }} />
                              <span className="muted">/ {k.max}</span>
                            </label>
                          )}
                        </div>
                        {k.hint && <span className="muted" style={{ fontSize: 11 }}>{k.hint}</span>}
                      </div>
                    ))}
                    <span className="muted" style={{ fontSize: 12, background: '#F6F0E2', borderRadius: 8, padding: '8px 10px' }}>
                      Partisipasi tim (otomatis, sekali per tim): {teamWith} orang ditag di submission tervalidasi{cur.status === 'submitted' ? ' termasuk yang ini' : ''} → <b style={{ color: '#1B2620' }}>{tierPoints(scoring.participation?.tiers, teamWith)} poin</b>
                    </span>
                  </div>
                )}
                <div style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="num" style={{ font: "800 36px/1 'Bricolage Grotesque'" }}>{score}</span>
                    <span style={{ fontSize: 13, opacity: 0.85 }}>/ {max} · {byCaptain ? 'captain — ikut main tanpa poin' : review.override ? 'override manual' : missing.length ? `belum dinilai: ${missing.map((m) => m.label || m.key.toUpperCase()).join(', ')}` : scoring.type === 'riddle' && !review.checks[0] ? 'IG tag belum ✓ — sebaiknya tolak' : 'dihitung otomatis'}</span>
                  </div>
                  {parts && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', fontSize: 12, opacity: 0.9 }}>
                      <span>Lokasi {review.checks[1] ? 'benar' : 'salah'} × {scoring.location_weight}%</span><span className="num">{parts.loc.toFixed(1)}</span>
                      <span>Partisipasi {review.count} org → {parts.tier} × {scoring.participation_weight}%</span><span className="num">{parts.part.toFixed(1)}</span>
                    </div>
                  )}
                  {byCaptain && <span style={{ fontSize: 12, opacity: 0.9 }}>Ini submission captain: tetap divalidasi, tapi skornya selalu 0 dan tidak dihitung ke poin tim.</span>}
                  {connect && !byCaptain && (
                    <span style={{ fontSize: 12, opacity: 0.9 }}>Skor orang ini. Skor tim = rata-rata member ÷ {scoring.people * max} × {scoring.individual_weight} + partisipasi × {scoring.participation_weight} (partisipasi = (yang submit + yang diajak kenalan) ÷ anggota grup × ½).</span>
                  )}
                  {scoring.type === 'flat' && <span style={{ fontSize: 12, opacity: 0.9 }}>Poin tetap untuk submission yang tervalidasi.</span>}
                </div>
                <button className="link" style={{ textAlign: 'left' }} onClick={() => setR({ override: !review.override })}>{review.override ? '× Batal override' : '✎ Override skor manual…'}</button>
                {review.override && (
                  <div className="col" style={{ gap: 6, padding: 10, borderRadius: 10, background: '#F8E9C4' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7A5410' }}>Override skor wajib pakai alasan</span>
                    <div className="row" style={{ gap: 6 }}>
                      <input type="number" min="0" max={max} aria-label="Skor override" placeholder="Skor" value={review.overrideScore} onChange={(e) => setR({ overrideScore: e.target.value })} style={{ width: 70, height: 36, borderRadius: 8, background: '#FFFDF8', border: '1px solid #E3C987', padding: '0 8px', font: 'inherit' }} />
                      <input aria-label="Alasan override" value={review.overrideNote} onChange={(e) => setR({ overrideNote: e.target.value })} placeholder="mis. “dikonfirmasi captain”" style={{ flex: 1, height: 36, borderRadius: 8, background: '#FFFDF8', border: '1px solid #E3C987', padding: '0 10px', font: 'inherit', fontSize: 13 }} />
                    </div>
                  </div>
                )}
                <span className="muted" style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Alasan (untuk tolak / minta ulang)</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {reasons.map((label) => {
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

// Connect challenges: each answer next to the person's Member Form answer, scored 0 / half / full.
function AnswerSheet({ scoring, answers, key_, marks, setMark, locked }) {
  return (
    <div className="card" style={{ borderRadius: 14, overflow: 'hidden' }}>
      {scoring.questions.map((q, i) => {
        const ref = q.ref ? key_?.[q.ref] : null;
        const steps = [0, q.max / 2, q.max];
        return (
          <div key={q.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid #F0E9DA' : 'none', alignItems: 'center' }}>
            <div className="col" style={{ gap: 6, minWidth: 0 }}>
              <span className="muted" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em' }}>Q{i + 1} · {q.text}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{answers[q.key] || <span className="muted" style={{ fontWeight: 500 }}>— kosong —</span>}</span>
              {q.ref ? (
                <span style={{ fontSize: 12, background: '#14281F', color: '#FBF6EA', borderRadius: 8, padding: '6px 10px', alignSelf: 'flex-start' }}>
                  <b style={{ color: '#E3A92B' }}>🔒 Member Form:</b> {ref || <span style={{ opacity: 0.7 }}>belum ada data — cek hasil Member Form</span>}
                </span>
              ) : <span className="muted" style={{ fontSize: 11 }}>Discovery: {q.max} spesifik & asli · {q.max / 2} relevan tapi umum · 0 kosong / disalin dari profil</span>}
            </div>
            <div style={{ display: 'flex', gap: 4 }} role="radiogroup" aria-label={`Nilai Q${i + 1}`}>
              {steps.map((v) => {
                const on = marks[q.key] === v;
                return <button key={v} role="radio" aria-checked={on} disabled={locked} onClick={() => setMark(q.key, v)} style={{ width: 40, height: 36, borderRadius: 8, fontWeight: 800, fontSize: 14, border: '1px solid #DCD2BC', background: on ? (v === q.max ? '#1F4D3A' : v ? '#C98A12' : '#9A2A1E') : '#FFFDF8', color: on ? '#FBF6EA' : '#3C4A42' }}>{v}</button>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const actBtn = { height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13 };

function StepBtn({ onClick, children }) {
  return <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #DCD2BC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{children}</button>;
}

// Super Admin / PIC: change the points of a validated submission — a reason is required and kept.
function AdjustScore({ sub, max, onSaved, onError }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(String(sub.score ?? ''));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { onSaved(await api.adjustScore(sub.id, score === '' ? '' : Number(score), note.trim())); setOpen(false); setNote(''); }
    catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };
  if (!open) return <button className="link" style={{ textAlign: 'left', fontSize: 12 }} onClick={() => setOpen(true)}>✎ Ubah poin (wajib dengan alasan)</button>;
  return (
    <div className="col" style={{ gap: 6, padding: 10, borderRadius: 10, background: '#FBF3E0', border: '1px solid #E3C987', marginTop: 4 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <input type="number" min="0" max={max} step="0.5" aria-label="Poin baru" value={score} onChange={(e) => setScore(e.target.value)}
          style={{ width: 80, height: 34, borderRadius: 8, background: '#FFFDF8', border: '1px solid #E3C987', padding: '0 8px', font: 'inherit' }} />
        <span className="muted" style={{ fontSize: 12 }}>/ {max} · sekarang {sub.score ?? 0} pts</span>
      </div>
      <textarea rows={2} aria-label="Alasan perubahan poin" placeholder="Alasan (wajib), mis. “foto ternyata bukan di lokasi”" value={note} onChange={(e) => setNote(e.target.value)}
        style={{ font: 'inherit', fontSize: 12.5, borderRadius: 8, border: '1px solid #E3C987', background: '#FFFDF8', padding: '6px 8px', resize: 'vertical' }} />
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-primary" style={{ height: 32 }} disabled={busy || note.trim().length < 3 || score === ''} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan poin'}</button>
        <button className="btn btn-ghost" style={{ height: 32 }} onClick={() => setOpen(false)}>Batal</button>
      </div>
    </div>
  );
}
