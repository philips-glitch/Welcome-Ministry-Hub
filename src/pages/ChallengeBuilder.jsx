import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { useMembers } from '../lib/members.jsx';
import {
  STATUSES, statusMeta, SECTIONS, SCORING_TYPES, DEFAULT_SCORING, computeScore, drawRiddles, fmtWIB, toLocalInput, fromLocalInput,
} from '../lib/game.js';

const input = { height: 36, borderRadius: 8, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 10px', font: 'inherit', fontSize: 13, color: '#1B2620', minWidth: 0 };
const card = { background: '#FFFDF8', border: '1px solid #E9E0CC', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 };
const h = { font: "700 14px 'Bricolage Grotesque'" };
const SCHEDULE = [['announce_at', 'Announce'], ['open_at', 'Open'], ['deadline_at', 'Deadline'], ['validate_by', 'Validasi']];

function blank(challenges) {
  const nextRound = Math.max(0, ...challenges.filter((c) => c.kind === 'main').map((c) => c.round || 0)) + 1;
  return {
    code: 'R' + nextRound, kind: 'main', round: nextRound, name: 'Challenge baru', pic_id: null, status: 'draft',
    announce_at: null, open_at: null, deadline_at: null, validate_by: null, sections: {}, scoring: { type: 'manual', max: 20 },
    riddles_per_group: 0, sort: challenges.length + 1,
  };
}

export default function ChallengeBuilder() {
  const { challenges, saveChallenge, deleteChallenge } = useGame();
  const [activeId, setActiveId] = useState(null);
  const [toast, setToast] = useState(null);
  const say = (kind, msg) => { setToast([kind, msg]); setTimeout(() => setToast((t) => (t && t[1] === msg ? null : t)), 4000); };

  useEffect(() => { if (challenges && !challenges.some((c) => c.id === activeId)) setActiveId(challenges[0]?.id ?? null); }, [challenges, activeId]);
  if (!challenges) return <div className="page"><span className="muted">Memuat challenge…</span></div>;
  const active = challenges.find((c) => c.id === activeId);

  const create = async () => {
    try { const row = await saveChallenge(blank(challenges)); setActiveId(row.id); say('ok', `${row.code} dibuat sebagai draft.`); }
    catch (e) { say('bad', e.message); }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', minWidth: 0, minHeight: '100vh' }}>
      <div className="col" style={{ borderRight: '1px solid #E9E0CC', padding: '18px 12px', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 8px' }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>Challenges</span>
          <button className="link" onClick={create}>+ Baru</button>
        </div>
        {challenges.map((c) => {
          const [, label, bg, fg] = statusMeta(c.status);
          const on = c.id === activeId;
          return (
            <button key={c.id} onClick={() => setActiveId(c.id)} className="col" style={{ textAlign: 'left', gap: 4, padding: 10, borderRadius: 10, background: on ? '#FFFDF8' : 'transparent', border: `1px solid ${on ? '#1F4D3A' : 'transparent'}` }}>
              <div className="row" style={{ gap: 6, width: '100%' }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{c.code} · {c.name}</span>
                <span className="chip" style={{ fontSize: 9, padding: '2px 6px', background: bg, color: fg }}>{label.toUpperCase()}</span>
              </div>
              <span className="muted" style={{ fontSize: 11 }}>{c.kind === 'side' ? 'Side quest' : `Round ${c.round ?? '—'}`} · {c.deadline_at ? 's/d ' + fmtWIB(c.deadline_at, { weekday: undefined, hour: undefined, minute: undefined }).replace(' WIB', '') : 'tanggal TBD'}</span>
            </button>
          );
        })}
      </div>
      {active
        ? <Editor key={active.id} challenge={active} save={saveChallenge} remove={deleteChallenge} say={say} />
        : <div className="page"><div className="card pad muted">Belum ada challenge. Klik “+ Baru”.</div></div>}
      {toast && (
        <div role="status" onClick={() => setToast(null)} style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 30, maxWidth: 420, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 30px -12px rgba(20,40,31,.35)', background: toast[0] === 'ok' ? '#E3EFE6' : '#FBE4E0', color: toast[0] === 'ok' ? '#1F4D3A' : '#9A2A1E' }}>{toast[1]}</div>
      )}
    </div>
  );
}

function Editor({ challenge, save, remove, say }) {
  const { rows: members } = useMembers();
  const [f, setF] = useState(() => structuredClone(challenge));
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const strip = ({ updated_at, created_at, ...c }) => JSON.stringify(c);
  const dirty = strip(f) !== strip(challenge);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setScoring = (patch) => setF((x) => ({ ...x, scoring: { ...x.scoring, ...patch } }));
  const scoring = { ...(f.scoring.type === 'riddle' ? DEFAULT_SCORING : {}), ...f.scoring };
  const staff = (members || []).filter((p) => p.active && !['member', 'group_leader'].includes(p.role_id));

  const [riddles, setRiddles] = useState(null);
  const [draw, setDraw] = useState([]);
  useEffect(() => {
    api.listRiddles(challenge.id).then(setRiddles);
    api.getDraw(challenge.id).then(setDraw);
  }, [challenge.id]);

  const problems = [];
  if (!f.code.trim()) problems.push('Kode wajib diisi.');
  if (!f.name.trim()) problems.push('Nama wajib diisi.');
  if (scoring.type === 'riddle' && Number(scoring.location_weight) + Number(scoring.participation_weight) !== 100) problems.push('Bobot lokasi + partisipasi harus 100%.');
  if (f.open_at && f.deadline_at && f.deadline_at <= f.open_at) problems.push('Deadline harus setelah waktu Open.');
  if (['scheduled', 'live'].includes(f.status) && !f.deadline_at) problems.push('Status Scheduled/Live butuh deadline.');
  if (f.status === 'live' && f.riddles_per_group > 0 && !draw.length) problems.push('Riddle belum diundi untuk grup.');

  const submit = async () => {
    if (problems.length) return say('bad', problems[0]);
    setBusy(true);
    try {
      const row = await save({ ...f, code: f.code.trim().toUpperCase(), name: f.name.trim(), round: f.kind === 'main' ? Number(f.round) || null : null, scoring });
      setF(structuredClone(row));
      say('ok', `${row.code} disimpan.`);
    } catch (e) { say('bad', e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="col" style={{ padding: '22px 24px', gap: 18, minWidth: 0 }}>
      {/* Header */}
      <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="col" style={{ gap: 6, flex: '1 1 360px' }}>
          <div className="row" style={{ gap: 8 }}>
            <input aria-label="Kode" value={f.code} onChange={(e) => set('code', e.target.value)} style={{ ...input, width: 72, fontWeight: 800 }} />
            <select aria-label="Jenis" value={f.kind} onChange={(e) => set('kind', e.target.value)} style={input}>
              <option value="main">Main challenge</option><option value="side">Side quest</option>
            </select>
            {f.kind === 'main' && <label className="row muted" style={{ gap: 6, fontSize: 12 }}>Round<input type="number" min="1" value={f.round ?? ''} onChange={(e) => set('round', e.target.value)} style={{ ...input, width: 60 }} /></label>}
            <select aria-label="PIC" value={f.pic_id || ''} onChange={(e) => set('pic_id', e.target.value || null)} style={input}>
              <option value="">PIC: —</option>
              {staff.map((p) => <option key={p.id} value={p.id}>PIC: {p.full_name}</option>)}
            </select>
          </div>
          <input aria-label="Nama challenge" value={f.name} onChange={(e) => set('name', e.target.value)} style={{ ...input, height: 44, font: "800 24px 'Bricolage Grotesque'", color: '#1F4D3A', border: '1px solid transparent', background: 'transparent', padding: '0 4px' }} />
        </div>
        <div role="radiogroup" aria-label="Status" style={{ display: 'flex', background: '#EDE6D6', borderRadius: 10, padding: 3, gap: 2 }}>
          {STATUSES.map(([k, label]) => (
            <button key={k} role="radio" aria-checked={f.status === k} onClick={() => set('status', k)} style={{ fontSize: 12, fontWeight: 700, padding: '7px 10px', borderRadius: 8, background: f.status === k ? '#1F4D3A' : 'transparent', color: f.status === k ? '#FBF6EA' : '#56655C' }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 8, padding: '10px 12px', borderRadius: 12, background: dirty ? '#F8E9C4' : '#F6F0E2', fontSize: 13, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: dirty ? '#7A5410' : '#56655C', flex: 1 }}>
          {problems.length && dirty ? '⚠ ' + problems[0] : dirty ? 'Ada perubahan yang belum disimpan.' : f.status === 'draft' ? 'Draft: tidak terlihat oleh member.' : 'Tersimpan. Terlihat oleh member.'}
        </span>
        <button className="btn btn-ghost" style={{ height: 34 }} disabled={!dirty || busy} onClick={() => setF(structuredClone(challenge))}>Batalkan</button>
        <button className="btn btn-primary" style={{ height: 34 }} disabled={!dirty || busy} onClick={submit}>{busy ? 'Menyimpan…' : 'Simpan challenge'}</button>
        <button className="btn" style={{ height: 34, color: '#9A2A1E' }} onClick={() => setConfirmDel(true)}>Hapus</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SECTIONS.map(([k, title], i) => (
            <label key={k} className="card" style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ font: "800 11px 'Bricolage Grotesque'", width: 22, height: 22, borderRadius: 7, background: '#E3EFE6', color: '#1F4D3A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{title}</span>
              </div>
              <textarea rows={4} value={f.sections?.[k] || ''} onChange={(e) => set('sections', { ...f.sections, [k]: e.target.value })}
                style={{ font: 'inherit', fontSize: 12.5, lineHeight: 1.5, color: '#3C4A42', border: '1px solid #EFE7D6', borderRadius: 8, padding: '8px 10px', background: '#FBF8F0', resize: 'vertical' }} />
            </label>
          ))}
        </div>

        <div className="col" style={{ gap: 12 }}>
          <div style={card}>
            <span style={h}>Jadwal · WIB</span>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 10px', fontSize: 13, alignItems: 'center' }}>
              {SCHEDULE.map(([k, label]) => [
                <span key={k} className="muted">{label}</span>,
                <input key={k + 'i'} type="datetime-local" aria-label={label} value={toLocalInput(f[k])} onChange={(e) => set(k, fromLocalInput(e.target.value))} style={input} />,
              ])}
            </div>
          </div>
          <ScoringEditor scoring={scoring} setScoring={setScoring} />
        </div>
      </div>

      {(scoring.type === 'riddle' || f.riddles_per_group > 0 || (riddles && riddles.length > 0)) && (
        <RiddleBank challenge={challenge} form={f} set={set} riddles={riddles} setRiddles={setRiddles} draw={draw} setDraw={setDraw} save={save} say={say} />
      )}

      {confirmDel && (
        <div role="dialog" aria-modal="true" aria-label="Hapus challenge" onClick={() => setConfirmDel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, background: '#FFFDF8', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ font: "800 20px 'Bricolage Grotesque'", color: '#9A2A1E' }}>Hapus {challenge.code} · {challenge.name}?</span>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Riddle, undian, dan <b>semua submission & skor</b> challenge ini ikut terhapus permanen. Tidak bisa dibatalkan.</span>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Batal</button>
              <button className="btn" style={{ background: '#9A2A1E', color: '#fff' }} onClick={async () => {
                try { await remove(challenge.id); say('ok', `${challenge.code} dihapus.`); } catch (e) { say('bad', e.message); setConfirmDel(false); }
              }}>Hapus permanen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoringEditor({ scoring, setScoring }) {
  const s = scoring;
  const num = (v) => (v === '' ? '' : Number(v));
  const ex1 = s.type === 'riddle' && computeScore(s, { location_correct: true, participant_count: 11 });
  const ex2 = s.type === 'riddle' && computeScore(s, { location_correct: false, participant_count: 8 });
  return (
    <div style={card}>
      <div className="row"><span style={h}>Formula skor</span>
        <label className="row muted" style={{ marginLeft: 'auto', gap: 6, fontSize: 12 }}>Maks<input type="number" min="0" aria-label="Skor maksimal" value={s.max} onChange={(e) => setScoring({ max: num(e.target.value) })} style={{ ...input, width: 64, height: 30 }} /></label>
      </div>
      <select aria-label="Jenis skor" value={s.type} onChange={(e) => setScoring(e.target.value === 'riddle' ? { ...DEFAULT_SCORING, max: s.max || 10 } : { type: e.target.value })} style={input}>
        {SCORING_TYPES.map(([k, l, d]) => <option key={k} value={k}>{l} — {d}</option>)}
      </select>
      {s.type === 'riddle' && (
        <>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{ flex: s.location_weight || 0.001, background: '#1F4D3A' }} /><div style={{ flex: s.participation_weight || 0.001, background: '#E3A92B' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: '6px 8px', fontSize: 12.5, alignItems: 'center' }}>
            <span><b>Lokasi benar</b> · benar = penuh / salah = 0</span>
            <label className="row" style={{ gap: 2 }}><input type="number" min="0" max="100" aria-label="Bobot lokasi" value={s.location_weight} onChange={(e) => setScoring({ location_weight: num(e.target.value) })} style={{ ...input, width: 52, height: 30 }} />%</label>
            <span><b>Partisipasi</b> · tier di bawah</span>
            <label className="row" style={{ gap: 2 }}><input type="number" min="0" max="100" aria-label="Bobot partisipasi" value={s.participation_weight} onChange={(e) => setScoring({ participation_weight: num(e.target.value) })} style={{ ...input, width: 52, height: 30 }} />%</label>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {s.tiers.map((t, i) => (
              <div key={i} className="row" style={{ gap: 6, fontSize: 12 }}>
                <span className="muted">≥</span>
                <input type="number" min="0" aria-label={`Tier ${i + 1} minimal orang`} value={t.min} onChange={(e) => setScoring({ tiers: s.tiers.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)) })} style={{ ...input, width: 56, height: 30 }} />
                <span className="muted">org →</span>
                <input type="number" min="0" aria-label={`Tier ${i + 1} poin`} value={t.pts} onChange={(e) => setScoring({ tiers: s.tiers.map((x, j) => (j === i ? { ...x, pts: num(e.target.value) } : x)) })} style={{ ...input, width: 56, height: 30 }} />
                <span className="muted">poin</span>
                <button className="link" style={{ marginLeft: 'auto', color: '#9A2A1E' }} disabled={s.tiers.length <= 1} onClick={() => setScoring({ tiers: s.tiers.filter((_, j) => j !== i) })}>Hapus</button>
              </div>
            ))}
            <button className="link" style={{ textAlign: 'left' }} onClick={() => setScoring({ tiers: [...s.tiers, { min: 0, pts: 0 }] })}>+ Tier</button>
          </div>
          <span className="muted" style={{ fontSize: 12, background: '#F6F0E2', borderRadius: 8, padding: '8px 10px' }}>
            Contoh: lokasi benar + 11 orang = <b style={{ color: '#1B2620' }}>{ex1}</b> · salah + 8 orang = <b style={{ color: '#1B2620' }}>{ex2}</b>
          </span>
        </>
      )}
      {s.type === 'flat' && <span className="muted" style={{ fontSize: 12 }}>Setiap submission yang tervalidasi mendapat {s.max} poin.</span>}
      {s.type === 'manual' && <span className="muted" style={{ fontSize: 12 }}>Validator mengisi nilai 0–{s.max} saat approve.</span>}
    </div>
  );
}

function RiddleBank({ challenge, form, set, riddles, setRiddles, draw, setDraw, save, say }) {
  const GROUPS = useGame().groups || [];
  const [showAns, setShowAns] = useState(true);
  const [editing, setEditing] = useState({}); // id|'new' → draft row
  const n = Number(form.riddles_per_group) || 0;
  const locked = form.draw_locked;
  const used = useMemo(() => { const u = {}; draw.forEach((d) => { u[d.riddle_id] = (u[d.riddle_id] || 0) + 1; }); return u; }, [draw]);
  const byId = Object.fromEntries((riddles || []).map((r) => [r.id, r]));

  const saveRow = async (key) => {
    const d = editing[key];
    if (!d.prompt.trim() || !d.answer.trim() || !Number(d.no)) return say('bad', 'Nomor, riddle, dan jawaban wajib diisi.');
    try {
      const row = await api.saveRiddle({ ...(key === 'new' ? {} : { id: key }), challenge_id: challenge.id, no: Number(d.no), prompt: d.prompt.trim(), answer: d.answer.trim() });
      setRiddles((rs) => [...rs.filter((r) => r.id !== row.id), row].sort((a, b) => a.no - b.no));
      setEditing(({ [key]: _, ...rest }) => rest);
      say('ok', `Riddle #${row.no} disimpan.`);
    } catch (e) { say('bad', e.message); }
  };
  const delRow = async (r) => {
    if (used[r.id] && locked) return say('bad', 'Riddle sudah diundi dan undian terkunci.');
    try { await api.deleteRiddle(r.id); setRiddles((rs) => rs.filter((x) => x.id !== r.id)); setDraw((ds) => ds.filter((d) => d.riddle_id !== r.id)); say('ok', `Riddle #${r.no} dihapus.`); }
    catch (e) { say('bad', e.message); }
  };
  const shuffle = async () => {
    if (locked) return;
    if (!riddles?.length || riddles.length < n) return say('bad', `Butuh minimal ${n} riddle di bank.`);
    if (n < 1) return say('bad', 'Isi jumlah riddle per grup dulu.');
    const seed = Math.floor(Math.random() * 9000) + 1000;
    const rows = drawRiddles(riddles.map((r) => r.id), n, seed, GROUPS);
    try {
      if (Number(challenge.riddles_per_group) !== n) await save({ id: challenge.id, riddles_per_group: n });
      await api.saveDraw(challenge.id, rows, seed);
      setDraw(rows.map((r) => ({ ...r, challenge_id: challenge.id })));
      set('draw_seed', seed);
      say('ok', `Undian baru (seed ${seed}) disimpan.`);
    } catch (e) { say('bad', e.message); }
  };
  const toggleLock = async () => {
    if (!locked && !draw.length) return say('bad', 'Undi dulu sebelum mengunci.');
    try { const row = await save({ id: challenge.id, draw_locked: !locked }); set('draw_locked', row.draw_locked); say('ok', row.draw_locked ? 'Undian dikunci.' : 'Undian dibuka lagi.'); }
    catch (e) { say('bad', e.message); }
  };

  const edit = (r) => setEditing((e) => ({ ...e, [r ? r.id : 'new']: r ? { no: r.no, prompt: r.prompt, answer: r.answer || '' } : { no: (riddles?.length ? Math.max(...riddles.map((x) => x.no)) : 0) + 1, prompt: '', answer: '' } }));
  const cols = '36px minmax(0,1.6fr) minmax(0,1fr) 44px 90px';

  return (
    <div className="card" style={{ borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row">
        <span className="card-title">Riddle bank & undian</span>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#14281F', color: '#E3A92B' }}>🔒 JAWABAN ADMIN ONLY</span>
        <button className="link" style={{ marginLeft: 'auto' }} onClick={() => setShowAns((v) => !v)}>{showAns ? 'Sembunyikan jawaban' : 'Tampilkan jawaban'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 18 }}>
        <div className="col">
          <div className="muted" style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, fontSize: 11, fontWeight: 800, padding: '6px 8px', background: '#F6F0E2', borderRadius: 8 }}>
            <span>#</span><span>Riddle (tampil ke member)</span><span>Jawaban</span><span>Dipakai</span><span />
          </div>
          {!riddles && <span className="muted" style={{ padding: 8, fontSize: 12 }}>Memuat…</span>}
          {riddles?.map((r) => editing[r.id] ? <RiddleEdit key={r.id} d={editing[r.id]} cols={cols} onChange={(d) => setEditing((e) => ({ ...e, [r.id]: d }))} onSave={() => saveRow(r.id)} onCancel={() => setEditing(({ [r.id]: _, ...rest }) => rest)} /> : (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, fontSize: 12, padding: '7px 8px', borderBottom: '1px solid #F0E9DA', alignItems: 'center' }}>
              <b>{r.no}</b>
              <span style={{ fontStyle: 'italic', lineHeight: 1.35 }}>{r.prompt}</span>
              <span style={{ fontWeight: 600, color: showAns ? '#FBF6EA' : '#56655C', background: showAns ? '#14281F' : '#EDE6D6', borderRadius: 5, padding: '2px 6px' }}>{showAns ? r.answer || '—' : '••••••••'}</span>
              <span className="num" style={{ textAlign: 'center' }}>{used[r.id] || 0}×</span>
              <span className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button className="link" onClick={() => edit(r)}>Edit</button>
                <button className="link" style={{ color: '#9A2A1E' }} onClick={() => delRow(r)}>Hapus</button>
              </span>
            </div>
          ))}
          {editing.new
            ? <RiddleEdit d={editing.new} cols={cols} onChange={(d) => setEditing((e) => ({ ...e, new: d }))} onSave={() => saveRow('new')} onCancel={() => setEditing(({ new: _, ...rest }) => rest)} />
            : <button className="link" style={{ textAlign: 'left', padding: '8px' }} onClick={() => edit(null)}>+ Tambah riddle</button>}
        </div>

        <div className="col" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <label className="row muted" style={{ gap: 6, fontSize: 12 }}>Riddle per grup
              <input type="number" min="0" max="10" aria-label="Riddle per grup" value={form.riddles_per_group} disabled={locked} onChange={(e) => set('riddles_per_group', Number(e.target.value))} style={{ ...input, width: 56, height: 32 }} />
            </label>
            <span className="muted" style={{ fontSize: 12 }}>Seed</span><b className="mono" style={{ fontSize: 13, border: '1px solid #E9E0CC', borderRadius: 6, padding: '4px 8px' }}>{form.draw_seed ?? '—'}</b>
            <button className="btn btn-outline" disabled={locked} onClick={shuffle} style={{ marginLeft: 'auto', height: 34, padding: '0 12px', borderRadius: 9, fontSize: 12, opacity: locked ? 0.4 : 1 }}>{draw.length ? 'Acak ulang' : 'Undi'}</button>
            <button className="btn" onClick={toggleLock} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontSize: 12, fontWeight: 800, background: locked ? '#2F7A55' : '#1F4D3A', color: '#FBF6EA' }}>{locked ? '✓ Undian terkunci' : 'Kunci undian'}</button>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>{n} riddle berbeda per grup, diambil acak dari {riddles?.length ?? 0}. Grup tidak bisa memilih. Undian tersimpan langsung.</span>
          {GROUPS.map(({ no, name, color }) => {
            const mine = draw.filter((d) => d.group_no === no).sort((a, b) => a.slot - b.slot);
            return (
              <div key={no} className="row" style={{ gap: 8, padding: '5px 0', borderBottom: '1px solid #F0E9DA' }}>
                <span style={{ width: 8, height: 22, borderRadius: 3, background: color }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, width: 120 }}>{no} {name}</span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {mine.length ? mine.map((d) => <span key={d.slot} title={byId[d.riddle_id]?.prompt} style={{ width: 30, height: 26, borderRadius: 7, background: '#E3EFE6', color: '#1F4D3A', font: "800 12px 'Bricolage Grotesque'", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{byId[d.riddle_id]?.no ?? '?'}</span>)
                    : <span className="muted" style={{ fontSize: 11 }}>belum diundi</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RiddleEdit({ d, cols, onChange, onSave, onCancel }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, fontSize: 12, padding: '7px 8px', borderBottom: '1px solid #F0E9DA', alignItems: 'center', background: '#FBF8F0' }}>
      <input type="number" min="1" aria-label="Nomor riddle" value={d.no} onChange={(e) => onChange({ ...d, no: e.target.value })} style={{ ...input, height: 30, padding: '0 4px' }} />
      <textarea rows={2} aria-label="Riddle" placeholder="Teks riddle" value={d.prompt} onChange={(e) => onChange({ ...d, prompt: e.target.value })} style={{ ...input, height: 'auto', padding: 6, resize: 'vertical' }} />
      <input aria-label="Jawaban" placeholder="Lokasi jawaban" value={d.answer} onChange={(e) => onChange({ ...d, answer: e.target.value })} style={{ ...input, height: 30 }} />
      <span />
      <span className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        <button className="link" onClick={onSave}>Simpan</button>
        <button className="link muted" onClick={onCancel}>Batal</button>
      </span>
    </div>
  );
}
