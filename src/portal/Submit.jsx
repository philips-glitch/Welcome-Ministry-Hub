import { useEffect, useState } from 'react';
import { tier } from '../data.js';
import { ROSTER, submitRules, initials } from './portalData.js';

const STEPS = ['Media', 'Bukti IG', 'Tag anggota', 'Cek aturan'];

export default function Submit({ go, me, submitted, setSubmitted }) {
  const SUBMIT_RULES = submitRules(me);
  const [tagged, setTagged] = useState(() => new Set([0, 1, 2, 3, 4, 6, 7, 8, 10, 11, 12]));
  const [checks, setChecks] = useState([true, true, false, false]);
  const [upPct, setUpPct] = useState(68);
  const [upFail, setUpFail] = useState(false);

  // Simulated upload on weak Wi-Fi: creeps forward unless paused.
  useEffect(() => {
    if (upFail || upPct >= 100) return;
    const iv = setInterval(() => setUpPct((p) => Math.min(100, p + 0.6)), 1000);
    return () => clearInterval(iv);
  }, [upFail, upPct >= 100]);

  const n = tagged.size;
  const pts = tier(n);
  const hint = n >= 10 ? 'Tier tertinggi — mantap!' : n >= 7 ? `Tambah ${10 - n} orang lagi untuk 10 poin` : `Tambah ${7 - n} orang lagi untuk 6 poin`;
  const done = upPct >= 100 && !upFail;
  const ready = checks.every(Boolean) && done;
  const toggleTag = (i) => { setTagged((t) => { const s = new Set(t); s.has(i) ? s.delete(i) : s.add(i); return s; }); setSubmitted(false); };
  const toggleCheck = (i) => { setChecks((c) => c.map((v, j) => (j === i ? !v : v))); setSubmitted(false); };
  const uploadAction = () => (done ? (setUpPct(5), setSubmitted(false)) : setUpFail((f) => !f));

  const up = upFail
    ? { label: Math.round(upPct) + '%', color: '#C4533F', note: 'Upload terhenti. Bagian yang sudah terkirim aman.', noteColor: '#9A2A1E', action: 'Coba lagi' }
    : done ? { label: '4.2 MB ✓', color: '#2F7A55', note: 'Upload selesai', noteColor: '#2F7A55', action: 'Ganti foto' }
    : { label: Math.round(upPct) + '% · 4.2 MB', color: '#E3A92B', note: 'Wi-Fi lemah — upload lanjut otomatis', noteColor: '#7A5410', action: 'Jeda' };

  const submit = submitted
    ? { bg: '#2F7A55', fg: '#FBF6EA', label: '✓ Terkirim — menunggu validasi', hint: 'Masih bisa resubmit sampai Min 23:55. Versi lama disimpan.' }
    : ready ? { bg: '#1F4D3A', fg: '#FBF6EA', label: 'Kirim submission', hint: `${n} anggota ditag · perkiraan partisipasi ${pts} pts` }
    : { bg: '#E2DACA', fg: '#6B665A', label: 'Kirim submission', hint: !done ? 'Tunggu upload selesai dulu ya' : 'Centang semua aturan & deklarasi No-AI dulu' };

  // Step progress: media/IG done once upload finishes, tagging in progress, rules done when all checked.
  const stepState = [done ? 'done' : 'now', 'done', n > 0 ? 'done' : 'now', checks.every(Boolean) ? 'done' : 'todo'];

  return (
    <div className="p-cols">
      <div className="p-stack">
        <div className="row">
          <button onClick={() => go('challenge')} aria-label="Kembali" className="p-icon-btn" style={{ fontSize: 20 }}>‹</button>
          <div className="col"><span style={{ font: "800 22px 'Bricolage Grotesque'" }}>Submit Riddle 2</span><span className="muted" style={{ fontSize: 12 }}>Photo Challenge · {me.group.name}</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
          {STEPS.map((s, i) => {
            const c = stepState[i] === 'done' ? '#2F7A55' : stepState[i] === 'now' ? '#1F4D3A' : null;
            return (
              <div key={s} className="col" style={{ gap: 5 }}>
                <div style={{ height: 5, borderRadius: 3, background: c || '#E9E0CC' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: c || '#56655C' }}>{s}</span>
              </div>
            );
          })}
        </div>

        <section className="col" style={{ gap: 10 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>1 · Foto grup</span>
          <div className="p-card" style={{ borderRadius: 18, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="placeholder-stripes mono" style={{ width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#7B7260', flex: 'none' }}>foto</div>
            <div className="col" style={{ gap: 6, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}><span style={{ fontWeight: 700 }}>IMG_2041.jpg</span><span className="num muted">{up.label}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: '#EDE6D6', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, background: up.color, width: (done ? 100 : Math.round(upPct)) + '%', transition: 'width .6s' }} /></div>
              <span style={{ fontSize: 12, color: up.noteColor }}>{up.note}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={uploadAction} style={{ flex: 1, height: 44, borderRadius: 14, border: '1px solid #C9DECF', background: '#E3EFE6', fontWeight: 700, fontSize: 13, color: '#1F4D3A' }}>{up.action}</button>
            <button style={{ flex: 1, height: 44, borderRadius: 14, border: '1px solid #E9E0CC', background: '#FFFDF8', fontWeight: 700, fontSize: 13, color: '#3C4A42' }}>atau link Drive</button>
          </div>
        </section>

        <section className="col" style={{ gap: 10 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>2 · Bukti IG Story</span>
          <div style={{ height: 52, borderRadius: 14, border: '1.5px solid #2F7A55', background: '#FFFDF8', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
            <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>instagram.com/stories/vine.wm04/3219…</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#2F7A55', whiteSpace: 'nowrap' }}>✓ tag ditemukan</span>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Link Story kedaluwarsa 24 jam — upload screenshot juga biar aman.</span>
        </section>

        <section className="col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>3 · Siapa aja di foto?</span>
            <button className="link" style={{ fontSize: 13 }} onClick={() => { setTagged(new Set(ROSTER.map((_, i) => i))); setSubmitted(false); }}>Pilih semua</button>
          </div>
          <div style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="num" style={{ font: "800 30px/1 'Bricolage Grotesque'" }}>{n}</span>
            <div className="col" style={{ flex: 1 }}><span style={{ fontSize: 13, fontWeight: 700 }}>anggota → {pts} poin partisipasi</span><span style={{ fontSize: 12, opacity: 0.85 }}>{hint}</span></div>
          </div>
          <div className="p-roster">
            {ROSTER.map(([name, color], i) => {
              const sel = tagged.has(i);
              return (
                <button key={name} onClick={() => toggleTag(i)} aria-pressed={sel} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 64 }}>
                  <div style={{ position: 'relative', width: 52, height: 52, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, boxShadow: `0 0 0 3px ${sel ? '#1F4D3A' : 'transparent'}`, opacity: sel ? 1 : 0.45 }}>
                    {initials(name)}
                    {sel && <span style={{ position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: '50%', background: '#E3A92B', color: '#1B2620', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #FBF6EA' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#3C4A42' }}>{name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="p-sticky">
        <section className="col" style={{ gap: 8 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>4 · Cek aturan</span>
          {SUBMIT_RULES.map((label, i) => (
            <button key={i} onClick={() => toggleCheck(i)} aria-pressed={checks[i]} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 14, background: '#FFFDF8', border: `1px solid ${i === 3 ? '#E3A92B' : '#E9E0CC'}`, minHeight: 48, textAlign: 'left' }}>
              <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 7, border: '2px solid #1F4D3A', background: checks[i] ? '#1F4D3A' : 'transparent', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900 }}>{checks[i] ? '✓' : ''}</span>
              <span style={{ fontSize: 13, lineHeight: 1.4, fontWeight: i === 3 ? 700 : 500 }}>{label}</span>
            </button>
          ))}
        </section>
        <div className="col" style={{ gap: 8 }}>
          <button className="p-btn-lg" disabled={!ready && !submitted} onClick={() => ready && setSubmitted(true)} style={{ background: submit.bg, color: submit.fg, cursor: ready ? 'pointer' : 'not-allowed' }}>{submit.label}</button>
          <span className="muted" role="status" style={{ fontSize: 12, textAlign: 'center' }}>{submit.hint}</span>
          <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, borderTop: '1px dashed #D5CAB0', paddingTop: 10 }}><span>Riwayat versi</span><span>v1 · draft · 16 Okt 18:40 oleh Grace</span></div>
        </div>
      </div>
    </div>
  );
}
