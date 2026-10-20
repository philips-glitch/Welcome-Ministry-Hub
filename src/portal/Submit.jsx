import { useEffect, useMemo, useState } from 'react';
import { DEMO_NOW } from '../data.js';
import { api } from '../lib/api.js';
import { tierPoints, withDefaults, formOf, isConnect, itemMax, fmtWIB, proportionalParts } from '../lib/game.js';
import { isPlayer } from '../lib/groups.js';
import { submitRules, initials, avatarColor } from './portalData.js';
import { Confetti } from './motion.jsx';
import { resizeImage, formatBytes } from '../lib/image.js';

const nowMs = () => (api.mode === 'demo' ? DEMO_NOW : Date.now());
const MAX_MB = 25; // before resizing; photos are shrunk to ≤1600 px JPEG in the browser
const h3 = { font: "700 15px 'Bricolage Grotesque'" };
const textField = { borderRadius: 14, border: '1.5px solid #DCD2BC', background: '#FFFDF8', padding: '12px 14px', font: 'inherit', fontSize: 14 };

// One form for every challenge type. What it asks for comes from the challenge's form settings
// (formOf): photo, link, answer, tags, rules — or, for connect challenges, a person + Q&A.
export default function Submit({ go, me, challenge: c, data, riddleId, replaces, onSubmitted }) {
  const scoring = withDefaults(c?.scoring);
  const form = formOf(c);
  const connect = isConnect(c);
  const riddleMode = !connect && (c?.riddles_per_group || 0) > 0;
  const open = c && c.status === 'live' && (!c.deadline_at || new Date(c.deadline_at).getTime() > nowMs());
  // After the deadline only what an admin reopened can still be changed (until it's validated again).
  const reopenedOk = (x) => !!x?.reopened_at && x.status !== 'validated' && ['live', 'closed'].includes(c?.status);
  const rules = form.confirm?.length ? form.confirm : submitRules(me);

  // Until the deadline anything not yet validated can be (re)sent. Riddles: not sent yet, pending, or rejected.
  const sendable = useMemo(() => (riddleMode ? data.draw : [])
    .map((d) => ({ ...d, r: data.riddles.find((x) => x.id === d.riddle_id), sub: data.latest(d.riddle_id) }))
    .filter((d) => (open ? d.sub?.status !== 'validated' : reopenedOk(d.sub))), [data, riddleMode, open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Connect: validated people are locked; pending ones can be edited; the entry being switched frees its seat.
  const people = scoring.people || 2;
  const { pickable, locked, active, reopened } = useMemo(() => {
    const mine = data.subs.filter((x) => x.submitted_by === me.id && x.target_id);
    const latest = (tid) => mine.filter((x) => x.target_id === tid).sort((a, b) => b.version - a.version)[0];
    const swap = replaces ? mine.find((x) => x.id === replaces) : null;
    const tids = [...new Set(mine.map((x) => x.target_id))];
    return {
      pickable: data.roster.filter((p) => p.id !== me.id),
      locked: new Set(tids.filter((tid) => latest(tid).status === 'validated')),
      active: new Set(tids.filter((tid) => tid !== swap?.target_id && ['submitted', 'validated'].includes(latest(tid).status))),
      reopened: new Set(tids.filter((tid) => reopenedOk(latest(tid)))),
    };
  }, [data, me.id, replaces]);
  const blocked = (id) => (!open && !reopened.has(id)) || locked.has(id) || (!active.has(id) && active.size >= people);
  const full = locked.size >= people;

  const [target, setTarget] = useState(riddleId);
  useEffect(() => { if (riddleMode && !sendable.some((d) => d.riddle_id === target)) setTarget(sendable[0]?.riddle_id ?? null); }, [sendable, riddleMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = sendable.find((d) => d.riddle_id === target);
  const person = connect && !blocked(target) ? pickable.find((p) => p.id === target) : null;
  const prevForPerson = person && data.subs.filter((x) => x.submitted_by === me.id && x.target_id === person.id).sort((a, b) => b.version - a.version)[0];
  // The version this one replaces (same person / riddle / challenge, not validated): prefill it, keep its photo.
  const prior = connect ? (prevForPerson?.status !== 'validated' ? prevForPerson : null) : riddleMode ? cur?.sub || null : data.latest(null);

  const [file, setFile] = useState(null);
  const [origSize, setOrigSize] = useState(null);
  const [shrinking, setShrinking] = useState(false);
  const [preview, setPreview] = useState(null);
  const [ig, setIg] = useState('');
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState({});
  const [tagged, setTagged] = useState(() => new Set());
  const [checks, setChecks] = useState(() => rules.map(() => false));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!prior) return;
    if (connect) setAnswers({ ...(prior.answers || {}) });
    else { setIg(prior.ig_url || ''); setAnswer(prior.answers?.answer || ''); setTagged(new Set(prior.tagged_ids || [])); }
  }, [prior?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const keepPhoto = !file && !!prior?.media_path;

  if (!c) return <div className="p-card muted">Tidak ada challenge.</div>;
  if (done) {
    return (
      <div className="p-card p-pop" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, maxWidth: 560, position: 'relative', overflow: 'hidden' }}>
        <Confetti />
        <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#2F7A55' }}>✓ Terkirim — menunggu validasi</span>
        <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{done.label} · versi {done.version} · {fmtWIB(done.submitted_at)}. Captain akan memvalidasi{c.validate_by ? ' paling lambat ' + fmtWIB(c.validate_by) : ''}. Selama belum divalidasi, kamu masih bisa mengubahnya sampai deadline.</span>
        <button className="p-btn-lg" onClick={() => go('challenge')} style={{ background: '#1F4D3A', color: '#FBF6EA' }}>Kembali ke challenge</button>
      </div>
    );
  }
  const lateEditable = riddleMode ? sendable.length > 0 : connect ? reopened.size > 0 : reopenedOk(data.latest(null));
  if (!open && !lateEditable) return <div className="p-card muted">Challenge ini sedang tidak menerima submission.</div>;
  if (riddleMode && !sendable.length) return <div className="p-card muted">Semua riddle grup kamu sudah divalidasi.</div>;
  if (connect && full) return <div className="p-card muted">{people} orang kamu sudah divalidasi semua. Mantap!</div>;

  const n = tagged.size;
  const pts = scoring.type === 'riddle' ? tierPoints(scoring.tiers, n) : null;
  const tiersDesc = [...(scoring.tiers || [])].sort((a, b) => b.min - a.min);
  const nextTier = scoring.type === 'riddle' ? [...tiersDesc].reverse().find((t) => t.min > n) : null;
  const hint = !nextTier ? 'Tier tertinggi — mantap!' : `Tambah ${nextTier.min - n} orang lagi untuk ${nextTier.pts} poin`;
  // Skenario 1: participation = members selected ÷ team size × participation_pts (captains can't be picked).
  const prop = scoring.type === 'proportional';
  const pickList = prop ? data.roster.filter(isPlayer) : data.roster;
  const propPart = prop ? proportionalParts(scoring, { participant_count: [...tagged].filter((id) => pickList.some((p) => p.id === id)).length, team_size: pickList.length }).part : null;
  const teamTiers = scoring.type === 'rubric' ? [...(scoring.participation?.tiers || [])].sort((a, b) => b.min - a.min).map((t) => `≥${t.min} org: ${t.pts}`).join(' · ') : null;
  const allChecked = checks.every(Boolean);
  const answersDone = connect && scoring.questions.every((q) => (answers[q.key] || '').trim());

  // [label, ok, optional, missing-label]
  const steps = connect ? [
    ['Orang', !!person, false, 'pilih orang'],
    ['Jawaban', answersDone, false, 'semua jawaban'],
    ...(form.photo !== 'none' ? [['Foto', !!file || keepPhoto, form.photo === 'optional', 'foto']] : []),
    ['Cek aturan', allChecked, false, 'semua aturan'],
  ] : [
    ...(form.photo !== 'none' ? [['Foto', !!file || keepPhoto, form.photo === 'optional', 'foto']] : []),
    ...(form.answer_label ? [['Jawaban', !!answer.trim(), false, 'jawaban']] : []),
    ...(form.link !== 'none' ? [['Link', !!ig.trim(), form.link === 'optional', form.link_label.toLowerCase()]] : []),
    ...(form.tags ? [['Tag anggota', n > 0, false, 'tag anggota']] : []),
    ['Cek aturan', allChecked, false, 'semua aturan'],
  ];
  const missing = steps.filter(([, ok, optional]) => !ok && !optional).map((s) => s[3]);
  const ready = !missing.length && !shrinking;
  const firstOpen = steps.findIndex(([, ok, optional]) => !ok && !optional);
  let num = 0;
  const step = (title) => `${++num} · ${title}`;

  const pickFile = async (f) => {
    setErr(null);
    if (!f) return;
    if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) return setErr('File harus berupa foto (JPG/PNG/HEIC).');
    if (f.size > MAX_MB * 1024 * 1024) return setErr(`Ukuran foto maks ${MAX_MB} MB.`);
    setShrinking(true);
    const { file: out } = await resizeImage(f);
    setShrinking(false);
    if (preview) URL.revokeObjectURL(preview);
    setOrigSize(f.size); setFile(out); setPreview(URL.createObjectURL(out));
  };
  const submit = async () => {
    if (!ready) return setErr('Lengkapi dulu: ' + missing.join(', ') + '.');
    setBusy(true); setErr(null);
    try {
      const row = await api.createSubmission({
        challenge_id: c.id, group_no: me.group.no, declaration: true,
        file: form.photo === 'none' ? null : file,
        ig_url: form.link === 'none' ? null : ig.trim() || null,
        tagged_ids: form.tags && !connect ? [...tagged] : [],
        riddle_id: riddleMode ? target : null,
        target_id: connect ? person.id : null,
        replaces: connect ? replaces || null : null,
        keep_media: form.photo !== 'none' && keepPhoto,
        answers: connect ? Object.fromEntries(scoring.questions.map((q) => [q.key, answers[q.key].trim()])) : form.answer_label ? { answer: answer.trim() } : null,
      });
      setDone({ ...row, label: connect ? `Kenalan dengan ${person.full_name}` : riddleMode ? `Riddle ${cur?.r?.no ?? ''}` : c.name });
      onSubmitted(row);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  // A function so its step number is taken where it renders.
  const photoBlock = () => form.photo !== 'none' && (
    <section className="col" style={{ gap: 10 }}>
      <span style={h3}>{step(connect ? `Foto bareng (opsional · +${scoring.photo_bonus} poin)` : form.photo === 'optional' ? 'Foto (opsional)' : 'Foto')}</span>
      <label className="p-card" style={{ position: 'relative', borderRadius: 18, padding: 12, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', border: file || keepPhoto ? '1.5px solid #2F7A55' : '1.5px dashed #D5CAB0' }}>
        <div className={preview ? '' : 'placeholder-stripes mono'} style={{ width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#7B7260', flex: 'none', overflow: 'hidden' }}>
          {preview ? <img src={preview} alt="Pratinjau foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'foto'}
        </div>
        <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file ? file.name : keepPhoto ? 'Pakai foto sebelumnya' : connect ? 'Pilih foto kalian berdua' : 'Pilih foto grup'}</span>
          <span className="muted" style={{ fontSize: 12 }}>{shrinking ? 'Memperkecil foto…' : file ? `${origSize && origSize > file.size ? formatBytes(origSize) + ' → ' : ''}${formatBytes(file.size)} · ketuk untuk ganti` : keepPhoto ? 'Ketuk untuk ganti foto' : `JPG / PNG / HEIC, maks ${MAX_MB} MB · otomatis diperkecil`}</span>
        </div>
        <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      </label>
      {connect && <span className="muted" style={{ fontSize: 12 }}>Satu foto jelas kalian berdua, diambil saat/sekitar ngobrol. Tanpa foto = +0, tidak ada penalti.</span>}
    </section>
  );

  return (
    <div className="p-cols">
      <div className="p-stack">
        <div className="row">
          <button onClick={() => go('challenge')} aria-label="Kembali" className="p-icon-btn" style={{ fontSize: 20 }}>‹</button>
          <div className="col"><span style={{ font: "800 22px 'Bricolage Grotesque'" }}>{connect ? (person ? `Kenalan: ${person.full_name.split(' ')[0]}` : replaces ? 'Ganti orang' : 'Kenalan baru') : `Submit ${riddleMode ? `Riddle ${cur?.r?.no ?? ''}` : c.name}`}</span><span className="muted" style={{ fontSize: 12 }}>{c.name} · {me.group.name}</span></div>
        </div>
        {riddleMode && sendable.length > 1 && (
          <label className="col" style={{ gap: 6, fontSize: 13, fontWeight: 700 }}>Riddle
            <select value={target || ''} onChange={(e) => setTarget(e.target.value)} style={{ height: 44, borderRadius: 12, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 12px', font: 'inherit', fontSize: 14 }}>
              {sendable.map((d) => <option key={d.riddle_id} value={d.riddle_id}>Riddle {d.r?.no ?? d.slot}{d.sub ? ' · kirim ulang' : ''}</option>)}
            </select>
          </label>
        )}
        {cur?.r && <div className="p-card" style={{ fontStyle: 'italic', fontSize: 14, lineHeight: 1.45 }}>“{cur.r.prompt}”{cur.sub?.reject_reason && <div style={{ fontStyle: 'normal', color: '#9A2A1E', fontSize: 12, marginTop: 6 }}>Sebelumnya ditolak: {cur.sub.reject_reason}</div>}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length},1fr)`, gap: 4 }}>
          {steps.map(([label, ok, optional], i) => {
            const col = ok ? '#2F7A55' : i === firstOpen ? '#1F4D3A' : null;
            return <div key={label} className="col" style={{ gap: 5 }}><div style={{ height: 5, borderRadius: 3, background: col || '#E9E0CC' }} /><span style={{ fontSize: 11, fontWeight: 700, color: col || '#56655C' }}>{label}{optional ? ' (opsional)' : ''}</span></div>;
          })}
        </div>

        {connect && (
          <section className="col" style={{ gap: 10 }}>
            <span style={h3}>{step('Kenalan sama siapa?')}</span>
            <span className="muted" style={{ fontSize: 12 }}>Pilih orang di grup kamu yang belum terlalu kamu kenal. Selama belum divalidasi, jawabanmu bisa diubah sampai deadline.</span>
            {!pickable.length && <span className="muted" style={{ fontSize: 13 }}>Daftar anggota grup belum tersedia.</span>}
            <div className="p-roster" role="radiogroup" aria-label="Pilih orang">
              {pickable.map((p) => {
                const sel = person?.id === p.id;
                const done2 = blocked(p.id);
                const why = locked.has(p.id) ? 'sudah divalidasi' : `sudah ${people} orang`;
                return (
                  <button key={p.id} role="radio" aria-checked={sel} aria-label={p.full_name + (done2 ? ` (${why})` : active.has(p.id) ? ' (ubah jawaban)' : '')} disabled={done2} onClick={() => setTarget(p.id)} title={done2 ? why : active.has(p.id) ? 'Ubah jawaban' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64, opacity: done2 ? 0.35 : 1, cursor: done2 ? 'not-allowed' : 'pointer' }}>
                    <div style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', background: avatarColor(p.id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, boxShadow: `0 0 0 3px ${sel ? '#1F4D3A' : 'transparent'}`, opacity: sel || !person ? 1 : 0.5 }}>
                      {initials(p.full_name)}
                      {(sel || done2) && <span style={{ position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: '50%', background: sel ? '#E3A92B' : '#2F7A55', color: sel ? '#1B2620' : '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #FBF6EA' }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#3C4A42', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.full_name || '').split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
            {prevForPerson?.reject_reason && <span style={{ color: '#9A2A1E', fontSize: 12 }}>Sebelumnya ditolak: {prevForPerson.reject_reason}</span>}
          </section>
        )}

        {connect && (
          <section className="col" style={{ gap: 12 }}>
            <span style={h3}>{step('Jawab setelah ngobrol')}</span>
            {scoring.questions.map((q, i) => (
              <label key={q.key} className="col" style={{ gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Q{i + 1}. {q.text} <span className="muted" style={{ fontWeight: 600 }}>· {q.max} poin</span></span>
                <textarea rows={i === scoring.questions.length - 1 ? 3 : 2} value={answers[q.key] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  placeholder={q.ref ? 'Jawab dari obrolan kalian' : 'Hal spesifik yang kamu temukan dari obrolan'} style={{ ...textField, resize: 'vertical', lineHeight: 1.45 }} />
              </label>
            ))}
            <span className="muted" style={{ fontSize: 12 }}>Jawaban terbuka, bukan pilihan ganda. Maks {itemMax(scoring)} poin untuk orang ini{form.photo !== 'none' ? ` (termasuk bonus foto ${scoring.photo_bonus})` : ''}.</span>
          </section>
        )}

        {!connect && photoBlock()}

        {form.answer_label && (
          <section className="col" style={{ gap: 10 }}>
            <span style={h3}>{step(form.answer_label)}</span>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Menurut kalian, jawabannya apa?" aria-label={form.answer_label} style={{ ...textField, height: 52, padding: '0 14px' }} />
          </section>
        )}

        {form.link !== 'none' && (
          <section className="col" style={{ gap: 10 }}>
            <span style={h3}>{step(form.link_label + (form.link === 'optional' ? ' (opsional)' : ''))}</span>
            <input type="url" inputMode="url" placeholder="https://…" value={ig} onChange={(e) => setIg(e.target.value)} aria-label={form.link_label}
              style={{ ...textField, height: 52, padding: '0 14px', borderColor: ig.trim() ? '#2F7A55' : '#DCD2BC' }} />
            <span className="muted" style={{ fontSize: 12 }}>{form.photo === 'none' ? 'Tempel link yang bisa dibuka panitia, mis. IG Story atau Google Drive.' : 'Tempel link gambar, mis. Google Drive, Google Photos, atau Instagram.'}</span>
          </section>
        )}

        {form.tags && !connect && (
          <section className="col" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={h3}>{step(form.tag_label)}</span>
              <button className="link" style={{ fontSize: 13 }} onClick={() => setTagged(n === pickList.length ? new Set() : new Set(pickList.map((p) => p.id)))}>{n === pickList.length && n ? 'Kosongkan' : 'Pilih semua'}</button>
            </div>
            <div key={pts ?? n} className="p-bump" style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="num" style={{ font: "800 30px/1 'Bricolage Grotesque'" }}>{n}</span>
              <div className="col" style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{prop ? `dari ${pickList.length} anggota ikut → ${propPart} poin partisipasi` : `anggota ditag${pts != null ? ` → ${pts} poin partisipasi` : ''}`}</span>
                {prop && <span style={{ fontSize: 12, opacity: 0.85 }}>Pilih nama anggota yang ikut riddle ini. Partisipasi = yang dipilih ÷ anggota grup × {withDefaults(scoring).participation_pts}.</span>}
                {pts != null && <span style={{ fontSize: 12, opacity: 0.85 }}>{hint}</span>}
                {teamTiers && <span style={{ fontSize: 12, opacity: 0.85 }}>Partisipasi tim dihitung dari semua yang ditag di submission tervalidasi ({teamTiers})</span>}
              </div>
            </div>
            {!data.roster.length && <span className="muted" style={{ fontSize: 13 }}>Daftar anggota grup belum tersedia.</span>}
            <div className="p-roster">
              {pickList.map((p) => {
                const sel = tagged.has(p.id);
                return (
                  <button key={p.id} aria-pressed={sel} aria-label={p.full_name} onClick={() => setTagged((t) => { const s = new Set(t); s.has(p.id) ? s.delete(p.id) : s.add(p.id); return s; })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64 }}>
                    <div style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', background: avatarColor(p.id), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, boxShadow: `0 0 0 3px ${sel ? '#1F4D3A' : 'transparent'}`, opacity: sel ? 1 : 0.45 }}>
                      {initials(p.full_name)}
                      {sel && <span style={{ position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: '50%', background: '#E3A92B', color: '#1B2620', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #FBF6EA' }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#3C4A42', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.full_name || '').split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {connect && photoBlock()}
      </div>

      <div className="p-sticky">
        <section className="col" style={{ gap: 8 }}>
          <span style={h3}>{step('Cek aturan')}</span>
          {rules.map((label, i) => {
            const strong = !form.confirm?.length && i === 3;
            return (
              <button key={i} onClick={() => setChecks((cs) => cs.map((v, j) => (j === i ? !v : v)))} aria-pressed={checks[i]} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 14, background: '#FFFDF8', border: `1px solid ${strong ? '#E3A92B' : '#E9E0CC'}`, minHeight: 48, textAlign: 'left' }}>
                <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 7, border: '2px solid #1F4D3A', background: checks[i] ? '#1F4D3A' : 'transparent', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900 }}>{checks[i] ? '✓' : ''}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4, fontWeight: strong ? 700 : 500 }}>{label}</span>
              </button>
            );
          })}
        </section>
        <div className="col" style={{ gap: 8 }}>
          <button className="p-btn-lg" disabled={busy} onClick={submit} style={{ background: ready ? '#1F4D3A' : '#E2DACA', color: ready ? '#FBF6EA' : '#6B665A', cursor: ready ? 'pointer' : 'not-allowed' }}>{busy ? 'Mengirim…' : 'Kirim submission'}</button>
          <span role="status" className="muted" style={{ fontSize: 12, textAlign: 'center', color: err ? '#9A2A1E' : undefined }}>
            {err || (ready ? (connect ? `Siap dikirim · ${person.full_name}` : form.tags ? `${n} anggota ditag${pts != null ? ` · perkiraan partisipasi ${pts} pts` : ''}` : 'Siap dikirim') : 'Belum lengkap: ' + missing.join(', '))}
          </span>
          {c.deadline_at && <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Deadline {fmtWIB(c.deadline_at)}</span>}
        </div>
      </div>
    </div>
  );
}
