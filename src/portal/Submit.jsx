import { useEffect, useMemo, useState } from 'react';
import { DEMO_NOW } from '../data.js';
import { api } from '../lib/api.js';
import { tierPoints, DEFAULT_SCORING, fmtWIB } from '../lib/game.js';
import { submitRules, initials, avatarColor } from './portalData.js';
import { Confetti } from './motion.jsx';

const STEPS = ['Media', 'Link Image', 'Tag anggota', 'Cek aturan'];
const nowMs = () => (api.mode === 'demo' ? DEMO_NOW : Date.now());
const MAX_MB = 15;

export default function Submit({ go, me, challenge: c, data, riddleId, onSubmitted }) {
  const rules = submitRules(me);
  const scoring = { ...(c?.scoring?.type === 'riddle' ? DEFAULT_SCORING : {}), ...c?.scoring };
  const riddleMode = (c?.riddles_per_group || 0) > 0;
  const open = c && c.status === 'live' && (!c.deadline_at || new Date(c.deadline_at).getTime() > nowMs());

  // Riddles this group can (re)send: nothing yet, or rejected / asked to resubmit.
  const sendable = useMemo(() => data.draw
    .map((d) => ({ ...d, r: data.riddles.find((x) => x.id === d.riddle_id), sub: data.latest(d.riddle_id) }))
    .filter((d) => !d.sub || ['rejected', 'resubmit'].includes(d.sub.status)), [data]);
  const [target, setTarget] = useState(riddleId);
  useEffect(() => { if (riddleMode && !sendable.some((d) => d.riddle_id === target)) setTarget(sendable[0]?.riddle_id ?? null); }, [sendable, riddleMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = sendable.find((d) => d.riddle_id === target);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [ig, setIg] = useState('');
  const [tagged, setTagged] = useState(() => new Set());
  const [checks, setChecks] = useState([false, false, false, false]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!c) return <div className="p-card muted">Tidak ada challenge.</div>;
  if (done) {
    return (
      <div className="p-card p-pop" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, maxWidth: 560, position: 'relative', overflow: 'hidden' }}>
        <Confetti />
        <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#2F7A55' }}>✓ Terkirim — menunggu validasi</span>
        <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{done.label} · versi {done.version} · {fmtWIB(done.submitted_at)}. Captain akan memvalidasi{c.validate_by ? ' paling lambat ' + fmtWIB(c.validate_by) : ''}. Kalau ditolak, kamu bisa kirim ulang sebelum deadline.</span>
        <button className="p-btn-lg" onClick={() => go('challenge')} style={{ background: '#1F4D3A', color: '#FBF6EA' }}>Kembali ke challenge</button>
      </div>
    );
  }
  if (!open) return <div className="p-card muted">Challenge ini sedang tidak menerima submission.</div>;
  if (riddleMode && !sendable.length) return <div className="p-card muted">Semua riddle grup kamu sudah dikirim. Tunggu hasil validasi ya.</div>;

  const n = tagged.size;
  const pts = scoring.type === 'riddle' ? tierPoints(scoring.tiers, n) : null;
  const tiersDesc = [...(scoring.tiers || [])].sort((a, b) => b.min - a.min);
  const nextTier = scoring.type === 'riddle' ? [...tiersDesc].reverse().find((t) => t.min > n) : null;
  const hint = !nextTier ? 'Tier tertinggi — mantap!' : `Tambah ${nextTier.min - n} orang lagi untuk ${nextTier.pts} poin`;
  const needIg = scoring.type === 'riddle';
  const missing = [!file && 'foto', needIg && !ig.trim() && 'link image', !n && 'tag anggota', !checks.every(Boolean) && 'semua aturan'].filter(Boolean);
  const ready = !missing.length;
  const state = [file ? 'done' : 'now', ig.trim() || !needIg ? 'done' : file ? 'now' : 'todo', n ? 'done' : 'todo', checks.every(Boolean) ? 'done' : 'todo'];

  const pickFile = (f) => {
    setErr(null);
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('File harus berupa foto (JPG/PNG/HEIC).');
    if (f.size > MAX_MB * 1024 * 1024) return setErr(`Ukuran foto maks ${MAX_MB} MB.`);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const submit = async () => {
    if (!ready) return setErr('Lengkapi dulu: ' + missing.join(', ') + '.');
    setBusy(true); setErr(null);
    try {
      const row = await api.createSubmission({
        challenge_id: c.id, group_no: me.group.no, riddle_id: riddleMode ? target : null, file,
        ig_url: ig.trim() || null, tagged_ids: [...tagged], declaration: true,
      });
      setDone({ ...row, label: riddleMode ? `Riddle ${cur?.r?.no ?? ''}` : c.name });
      onSubmitted(row);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-cols">
      <div className="p-stack">
        <div className="row">
          <button onClick={() => go('challenge')} aria-label="Kembali" className="p-icon-btn" style={{ fontSize: 20 }}>‹</button>
          <div className="col"><span style={{ font: "800 22px 'Bricolage Grotesque'" }}>Submit {riddleMode ? `Riddle ${cur?.r?.no ?? ''}` : c.name}</span><span className="muted" style={{ fontSize: 12 }}>{c.name} · {me.group.name}</span></div>
        </div>
        {riddleMode && sendable.length > 1 && (
          <label className="col" style={{ gap: 6, fontSize: 13, fontWeight: 700 }}>Riddle
            <select value={target || ''} onChange={(e) => setTarget(e.target.value)} style={{ height: 44, borderRadius: 12, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 12px', font: 'inherit', fontSize: 14 }}>
              {sendable.map((d) => <option key={d.riddle_id} value={d.riddle_id}>Riddle {d.r?.no ?? d.slot}{d.sub ? ' · kirim ulang' : ''}</option>)}
            </select>
          </label>
        )}
        {cur?.r && <div className="p-card" style={{ fontStyle: 'italic', fontSize: 14, lineHeight: 1.45 }}>“{cur.r.prompt}”{cur.sub?.reject_reason && <div style={{ fontStyle: 'normal', color: '#9A2A1E', fontSize: 12, marginTop: 6 }}>Sebelumnya ditolak: {cur.sub.reject_reason}</div>}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
          {STEPS.map((s, i) => {
            const col = state[i] === 'done' ? '#2F7A55' : state[i] === 'now' ? '#1F4D3A' : null;
            return <div key={s} className="col" style={{ gap: 5 }}><div style={{ height: 5, borderRadius: 3, background: col || '#E9E0CC' }} /><span style={{ fontSize: 11, fontWeight: 700, color: col || '#56655C' }}>{s}</span></div>;
          })}
        </div>

        <section className="col" style={{ gap: 10 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>1 · Foto grup</span>
          <label className="p-card" style={{ position: 'relative', borderRadius: 18, padding: 12, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', border: file ? '1.5px solid #2F7A55' : '1.5px dashed #D5CAB0' }}>
            <div className={preview ? '' : 'placeholder-stripes mono'} style={{ width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#7B7260', flex: 'none', overflow: 'hidden' }}>
              {preview ? <img src={preview} alt="Pratinjau foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'foto'}
            </div>
            <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file ? file.name : 'Pilih foto grup'}</span>
              <span className="muted" style={{ fontSize: 12 }}>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ketuk untuk ganti` : `JPG / PNG, maks ${MAX_MB} MB`}</span>
            </div>
            <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          </label>
        </section>

        <section className="col" style={{ gap: 10 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>2 · Link Image{needIg ? '' : ' (opsional)'}</span>
          <input type="url" inputMode="url" placeholder="https://…" value={ig} onChange={(e) => setIg(e.target.value)} aria-label="Link Image"
            style={{ height: 52, borderRadius: 14, border: `1.5px solid ${ig.trim() ? '#2F7A55' : '#DCD2BC'}`, background: '#FFFDF8', padding: '0 14px', font: 'inherit', fontSize: 14 }} />
          <span className="muted" style={{ fontSize: 12 }}>Tempel link gambar, mis. Google Drive, Google Photos, atau Instagram.</span>
        </section>

        <section className="col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>3 · Siapa aja di foto?</span>
            <button className="link" style={{ fontSize: 13 }} onClick={() => setTagged(n === data.roster.length ? new Set() : new Set(data.roster.map((p) => p.id)))}>{n === data.roster.length && n ? 'Kosongkan' : 'Pilih semua'}</button>
          </div>
          <div key={pts ?? 'n'} className="p-bump" style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="num" style={{ font: "800 30px/1 'Bricolage Grotesque'" }}>{n}</span>
            <div className="col" style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>anggota ditag{pts != null ? ` → ${pts} poin partisipasi` : ''}</span>
              {pts != null && <span style={{ fontSize: 12, opacity: 0.85 }}>{hint}</span>}
            </div>
          </div>
          {!data.roster.length && <span className="muted" style={{ fontSize: 13 }}>Daftar anggota grup belum tersedia.</span>}
          <div className="p-roster">
            {data.roster.map((p) => {
              const sel = tagged.has(p.id);
              return (
                <button key={p.id} aria-pressed={sel} onClick={() => setTagged((t) => { const s = new Set(t); s.has(p.id) ? s.delete(p.id) : s.add(p.id); return s; })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64 }}>
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
      </div>

      <div className="p-sticky">
        <section className="col" style={{ gap: 8 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>4 · Cek aturan</span>
          {rules.map((label, i) => (
            <button key={i} onClick={() => setChecks((cs) => cs.map((v, j) => (j === i ? !v : v)))} aria-pressed={checks[i]} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 14, background: '#FFFDF8', border: `1px solid ${i === 3 ? '#E3A92B' : '#E9E0CC'}`, minHeight: 48, textAlign: 'left' }}>
              <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 7, border: '2px solid #1F4D3A', background: checks[i] ? '#1F4D3A' : 'transparent', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900 }}>{checks[i] ? '✓' : ''}</span>
              <span style={{ fontSize: 13, lineHeight: 1.4, fontWeight: i === 3 ? 700 : 500 }}>{label}</span>
            </button>
          ))}
        </section>
        <div className="col" style={{ gap: 8 }}>
          <button className="p-btn-lg" disabled={busy} onClick={submit} style={{ background: ready ? '#1F4D3A' : '#E2DACA', color: ready ? '#FBF6EA' : '#6B665A', cursor: ready ? 'pointer' : 'not-allowed' }}>{busy ? 'Mengirim…' : 'Kirim submission'}</button>
          <span role="status" className="muted" style={{ fontSize: 12, textAlign: 'center', color: err ? '#9A2A1E' : undefined }}>
            {err || (ready ? `${n} anggota ditag${pts != null ? ` · perkiraan partisipasi ${pts} pts` : ''}` : 'Belum lengkap: ' + missing.join(', '))}
          </span>
          {c.deadline_at && <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Deadline {fmtWIB(c.deadline_at)}</span>}
        </div>
      </div>
    </div>
  );
}
