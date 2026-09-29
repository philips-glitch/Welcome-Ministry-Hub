import useCountdown from '../useCountdown.js';
import { DEMO_NOW } from '../data.js';
import { api } from '../lib/api.js';
import { SUB_CHIP } from './portalData.js';
import { fmtWIB, statusMeta, DEFAULT_SCORING } from '../lib/game.js';

const STATUS = { validated: 'Validated', submitted: 'Submitted', rejected: 'Rejected', resubmit: 'Rejected' };
const nowMs = () => (api.mode === 'demo' ? DEMO_NOW : Date.now());
const EXTRA = [['connection', 'The Connection'], ['what_we_need', 'What We Need'], ['make_it_flourish', 'Make It Flourish'], ['flourish_hub', 'Flourish Hub'], ['duration', 'Durasi']];

export default function ChallengeDetail({ go, me, challenge: c, data, pickRiddle }) {
  const cd = useCountdown(c?.deadline_at ? new Date(c.deadline_at).getTime() : 0);
  if (!c) return <div className="p-card muted">Challenge tidak ditemukan.</div>;
  const open = c.status === 'live' && (!c.deadline_at || new Date(c.deadline_at).getTime() > nowMs());
  const scoring = { ...(c.scoring?.type === 'riddle' ? DEFAULT_SCORING : {}), ...c.scoring };
  const riddleMode = c.riddles_per_group > 0;
  const nameOf = (id) => data.roster.find((p) => p.id === id)?.full_name?.split(' ')[0] || 'leader';
  const [, statusLabel] = statusMeta(c.status);

  const riddleRows = data.draw.map((d) => {
    const r = data.riddles.find((x) => x.id === d.riddle_id);
    const sub = data.latest(d.riddle_id);
    const st = sub ? STATUS[sub.status] : 'Not Started';
    const meta = !sub ? 'Belum ada submission'
      : sub.status === 'validated' ? `${sub.score}/${scoring.max} pts · ${sub.participant_count ?? sub.tagged_ids.length} orang`
      : sub.status === 'submitted' ? `Dikirim ${fmtWIB(sub.submitted_at)} oleh ${nameOf(sub.submitted_by)}`
      : `${sub.status === 'resubmit' ? 'Diminta ulang' : 'Ditolak'}: ${sub.reject_reason || '—'}`;
    const canSend = open && me.canSubmit && (!sub || ['rejected', 'resubmit'].includes(sub.status));
    return { slot: d.slot, id: d.riddle_id, no: r?.no ?? d.slot, text: r?.prompt ?? '(riddle belum tersedia)', st, meta, canSend, resend: !!sub };
  });
  const single = !riddleMode ? data.latest(null) : null;
  const canSingle = open && me.canSubmit && (!single || ['rejected', 'resubmit'].includes(single.status));

  // Group progress for the hero.
  const latestAll = riddleMode ? riddleRows.map((r) => data.latest(r.id)).filter(Boolean) : single ? [single] : [];
  const sent = latestAll.length;
  const total = riddleMode ? riddleRows.length || c.riddles_per_group : 1;
  const pts = Math.round(data.subs.filter((s) => s.status === 'validated').reduce((a, s) => a + Number(s.score || 0), 0) * 10) / 10;
  const waiting = latestAll.filter((s) => s.status === 'submitted').length;
  const maxPts = scoring.max * (riddleMode ? total : 1);

  return (
    <div className="p-stack">
      {/* Hero */}
      <section style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 190, height: 190, borderRadius: '50%', background: '#2F7A55', opacity: 0.45 }} />
        <div className="row" style={{ gap: 10, position: 'relative' }}>
          <button onClick={() => go('challenges')} aria-label="Kembali ke daftar challenge" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(251,246,234,.14)', color: '#FBF6EA', fontSize: 20, flex: 'none' }}>‹</button>
          <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>{c.code} · {c.kind === 'side' ? 'Side quest' : `Round ${c.round ?? '—'}`}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', padding: '4px 9px', borderRadius: 999, background: c.status === 'live' ? '#E3A92B' : 'rgba(251,246,234,.18)', color: c.status === 'live' ? '#1B2620' : '#FBF6EA' }}>{statusLabel.toUpperCase()}</span>
        </div>
        <div className="col" style={{ gap: 6, position: 'relative' }}>
          <span style={{ font: "800 30px/1.08 'Bricolage Grotesque'", letterSpacing: '-0.01em' }}>{c.name}</span>
          {c.sections?.game_idea && <span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9, maxWidth: 680 }}>{c.sections.game_idea}</span>}
        </div>

        <div className="p-hero-stats" style={{ position: 'relative' }}>
          <Stat label={open ? 'Tutup dalam' : c.status === 'scheduled' ? 'Dibuka' : 'Deadline'}
            value={open && c.deadline_at ? `${cd.d}h ${cd.h}:${cd.m}:${cd.s}` : c.status === 'scheduled' ? (c.open_at ? fmtWIB(c.open_at).replace(' WIB', '') : 'TBD') : c.deadline_at ? 'Ditutup' : '—'}
            sub={c.deadline_at ? fmtWIB(c.deadline_at) : 'belum diatur'} wide />
          {me.group && <Stat label={riddleMode ? 'Riddle terkirim' : 'Submission'} value={`${sent}/${total}`} sub={waiting ? `${waiting} menunggu validasi` : sent >= total ? 'semua terkirim' : 'ayo kirim!'} />}
          {me.group && <Stat label="Poin grup" value={`${pts}`} sub={`dari maks ${maxPts}`} />}
        </div>
        {me.group && (
          <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
            {Array.from({ length: total }, (_, i) => <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: i < sent ? '#E3A92B' : 'rgba(251,246,234,.18)' }} />)}
          </div>
        )}
      </section>

      <div className="p-cols">
        {/* Main: what to do */}
        <div className="p-stack">
          {riddleMode ? (
            <section className="col" style={{ gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="p-h">Riddle grup kamu</span><span className="muted" style={{ fontSize: 12 }}>diundi acak oleh panitia</span>
              </div>
              {data.loading && <span className="muted" style={{ fontSize: 13 }}>Memuat riddle…</span>}
              {!data.loading && !riddleRows.length && (
                <div className="p-card muted" style={{ fontSize: 13 }}>{!me.group ? 'Kamu belum masuk grup.' : c.status === 'scheduled' ? 'Riddle muncul saat challenge dibuka.' : 'Riddle belum diundi untuk grup kamu.'}</div>
              )}
              <div className="p-grid-2">
                {riddleRows.map((r) => {
                  const [cbg, cfg] = SUB_CHIP[r.st];
                  const doneCard = r.st === 'Validated';
                  return (
                    <div key={r.slot} className="p-card" style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderColor: r.canSend ? '#1F4D3A' : undefined, background: doneCard ? '#F3F8F4' : undefined }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ font: "800 13px 'Bricolage Grotesque'", width: 30, height: 30, borderRadius: 9, background: doneCard ? '#2F7A55' : '#1F4D3A', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{doneCard ? '✓' : r.no}</span>
                        <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Riddle {r.no}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: cbg, color: cfg }}>{r.st.toUpperCase()}</span>
                      </div>
                      <span style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500, fontStyle: 'italic', flex: 1 }}>“{r.text}”</span>
                      <span className="muted" style={{ fontSize: 12 }}>{r.meta}</span>
                      {r.canSend && <button onClick={() => pickRiddle(r.id)} style={{ height: 42, borderRadius: 12, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>{r.resend ? 'Kirim ulang' : `Submit Riddle ${r.no}`}</button>}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="p-h">Submission grup</span>
              <span className="muted" style={{ fontSize: 13 }}>
                {!single ? 'Belum ada submission dari grup kamu.' : `Status: ${STATUS[single.status]}${single.score != null ? ` · ${single.score} pts` : ''}${single.reject_reason ? ` · “${single.reject_reason}”` : ''} · versi ${single.version}`}
              </span>
              {canSingle
                ? <button className="p-btn-lg" onClick={() => pickRiddle(null)} style={{ background: '#1F4D3A', color: '#FBF6EA' }}>{single ? 'Kirim ulang' : 'Submit challenge'}</button>
                : <button className="p-btn-lg" disabled style={{ background: '#E2DACA', color: '#6B665A', cursor: 'not-allowed' }}>{!open ? (c.status === 'scheduled' ? 'Belum dibuka' : 'Submit ditutup') : single ? 'Sudah dikirim' : 'Submit oleh Group Leader'}</button>}
            </section>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            {open ? (me.canSubmit ? 'Kamu Group Leader: kamu yang submit untuk grup.' : 'Hanya Group Leader yang bisa submit. Kirim foto kamu ke Leader ya.') : c.status === 'scheduled' ? 'Challenge ini belum dibuka.' : 'Challenge ini sudah ditutup.'}
          </span>
        </div>

        {/* Side: the rules, collapsible */}
        <div className="p-sticky">
          <Fold title="Cara main" open>
            {c.sections?.how_to_play ? <p style={para}>{c.sections.how_to_play}</p> : <p style={{ ...para, color: '#56655C' }}>Detail menyusul dari panitia.</p>}
          </Fold>
          <Fold title={`Cara skor · maks ${scoring.max}${riddleMode ? ' per riddle' : ''}`} open>
            {scoring.type === 'riddle' ? (
              <div className="col" style={{ gap: 10 }}>
                <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}><div style={{ flex: scoring.location_weight, background: '#1F4D3A' }} /><div style={{ flex: scoring.participation_weight, background: '#E3A92B' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, lineHeight: 1.4 }}>
                  <div className="col"><span style={{ fontWeight: 700 }}>{scoring.location_weight}% Lokasi benar</span><span className="muted">Benar penuh · Salah 0</span></div>
                  <div className="col"><span style={{ fontWeight: 700 }}>{scoring.participation_weight}% Partisipasi</span><span className="muted">{[...scoring.tiers].sort((a, b) => b.min - a.min).map((t) => `≥${t.min} org: ${t.pts}`).join(' · ')}</span></div>
                </div>
              </div>
            ) : <p style={para}>{scoring.type === 'flat' ? `Tervalidasi = ${scoring.max} poin.` : `Dinilai panitia, 0–${scoring.max} poin.`}</p>}
            {c.sections?.points_rewards && <p style={{ ...para, color: '#56655C', marginTop: 8 }}>{c.sections.points_rewards}</p>}
          </Fold>
          {scoring.type === 'riddle' && (
            <Fold title="Do's & Don'ts">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#E3EFE6', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 800, color: '#1F4D3A' }}>✓ Lakukan</span><span>Selfie satu grup di lokasi</span><span>Post IG Story, tag akun event</span><span>Ajak sebanyak mungkin anggota</span>
                </div>
                <div style={{ background: '#FBE4E0', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.35 }}>
                  <span style={{ fontWeight: 800, color: '#9A2A1E' }}>✕ Jangan</span><span>Pakai AI / edit lokasi</span><span>Sebut nama gereja</span><span>Foto wajah jemaat tanpa izin</span>
                </div>
              </div>
            </Fold>
          )}
          <Fold title="Jadwal">
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13 }}>
              {[['Diumumkan', c.announce_at], ['Dibuka', c.open_at], ['Deadline', c.deadline_at], ['Validasi', c.validate_by]].filter(([, v]) => v).map(([k, v]) => [
                <span key={k} className="muted">{k}</span>, <span key={k + 'v'} style={{ fontWeight: 600 }}>{fmtWIB(v)}</span>,
              ])}
            </div>
          </Fold>
          {EXTRA.some(([k]) => c.sections?.[k]) && (
            <Fold title="Info lainnya">
              <div className="col" style={{ gap: 8 }}>
                {EXTRA.filter(([k]) => c.sections?.[k]).map(([k, t]) => <p key={k} style={para}><b>{t}:</b> {c.sections[k]}</p>)}
              </div>
            </Fold>
          )}
        </div>
      </div>
    </div>
  );
}

const para = { margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#3C4A42' };

function Stat({ label, value, sub, wide }) {
  return (
    <div style={{ background: 'rgba(251,246,234,.12)', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, gridColumn: wide ? 'span 2' : undefined, minWidth: 0 }}>
      <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>{label}</span>
      <span className="num" style={{ font: "800 22px/1.15 'Bricolage Grotesque'", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
      <span style={{ fontSize: 11, opacity: 0.75 }}>{sub}</span>
    </div>
  );
}

function Fold({ title, open, children }) {
  return (
    <details className="p-fold" open={open}>
      <summary>{title}</summary>
      <div style={{ padding: '0 16px 14px' }}>{children}</div>
    </details>
  );
}
