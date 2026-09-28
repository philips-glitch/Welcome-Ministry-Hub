import useCountdown from '../useCountdown.js';
import { DEMO_NOW } from '../data.js';
import { api } from '../lib/api.js';
import { SUB_CHIP } from './portalData.js';
import { fmtWIB, statusMeta, DEFAULT_SCORING } from '../lib/game.js';

const STATUS = { validated: 'Validated', submitted: 'Submitted', rejected: 'Rejected', resubmit: 'Rejected' };
const nowMs = () => (api.mode === 'demo' ? DEMO_NOW : Date.now());

export default function ChallengeDetail({ go, me, challenge: c, challenges, setChId, data, pickRiddle }) {
  const cd = useCountdown(c?.deadline_at ? new Date(c.deadline_at).getTime() : 0);
  if (!c) return <div className="p-card muted">Belum ada challenge yang diumumkan.</div>;
  const open = c.status === 'live' && (!c.deadline_at || new Date(c.deadline_at).getTime() > nowMs());
  const scoring = { ...(c.scoring?.type === 'riddle' ? DEFAULT_SCORING : {}), ...c.scoring };
  const nameOf = (id) => data.roster.find((p) => p.id === id)?.full_name?.split(' ')[0] || 'leader';

  const riddleRows = data.draw.map((d) => {
    const r = data.riddles.find((x) => x.id === d.riddle_id);
    const sub = data.latest(d.riddle_id);
    const st = sub ? STATUS[sub.status] : 'Not Started';
    const meta = !sub ? 'Belum ada submission'
      : sub.status === 'validated' ? `Tervalidasi · ${sub.score}/${scoring.max} pts · ${sub.participant_count ?? sub.tagged_ids.length} orang`
      : sub.status === 'submitted' ? `Dikirim ${fmtWIB(sub.submitted_at)} oleh ${nameOf(sub.submitted_by)} · ${sub.tagged_ids.length} orang`
      : `${sub.status === 'resubmit' ? 'Diminta ulang' : 'Ditolak'}: ${sub.reject_reason || '—'}`;
    const canSend = open && me.canSubmit && (!sub || ['rejected', 'resubmit'].includes(sub.status));
    return { slot: d.slot, id: d.riddle_id, no: r?.no ?? d.slot, text: r?.prompt ?? '(riddle belum tersedia)', st, meta, canSend, resend: !!sub };
  });
  const single = !c.riddles_per_group ? data.latest(null) : null;
  const canSingle = open && me.canSubmit && (!single || ['rejected', 'resubmit'].includes(single.status));

  return (
    <div className="p-cols">
      <div className="p-stack">
        {challenges.length > 1 && (
          <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {challenges.map((x) => (
              <button key={x.id} role="tab" aria-selected={x.id === c.id} onClick={() => setChId(x.id)} style={{ flex: 'none', height: 34, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: x.id === c.id ? '#1F4D3A' : '#FFFDF8', color: x.id === c.id ? '#FBF6EA' : '#3C4A42', border: '1px solid #E9E0CC' }}>{x.code} · {x.name}</button>
            ))}
          </div>
        )}
        <div className="row">
          <button onClick={() => go('home')} aria-label="Kembali" className="p-icon-btn" style={{ fontSize: 20 }}>‹</button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{c.kind === 'side' ? 'Side quest' : `Round ${c.round ?? '—'}`}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: statusMeta(c.status)[2], color: statusMeta(c.status)[3] }}>{statusMeta(c.status)[1].toUpperCase()}</span>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="p-title">{c.name}</span>
          {c.sections?.game_idea && <span style={{ fontSize: 15, lineHeight: 1.5, color: '#3C4A42', maxWidth: 640 }}>{c.sections.game_idea}</span>}
          {c.sections?.how_to_play && <span style={{ fontSize: 14, lineHeight: 1.5, color: '#56655C', maxWidth: 640 }}><b>Cara main:</b> {c.sections.how_to_play}</span>}
        </div>

        {c.riddles_per_group > 0 && (
          <div className="col" style={{ gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="p-h">Riddle grup kamu</span><span className="muted" style={{ fontSize: 12 }}>diundi acak oleh panitia</span>
            </div>
            {data.loading && <span className="muted" style={{ fontSize: 13 }}>Memuat riddle…</span>}
            {!data.loading && !riddleRows.length && <div className="p-card muted" style={{ fontSize: 13 }}>{me.group ? 'Riddle belum diundi untuk grup kamu.' : 'Kamu belum masuk grup.'}</div>}
            <div className="p-grid-2">
              {riddleRows.map((r) => (
                <div key={r.slot} className="p-card" style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ font: "800 13px 'Bricolage Grotesque'", width: 28, height: 28, borderRadius: 9, background: '#1F4D3A', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.no}</span>
                    <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Riddle {r.no}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: SUB_CHIP[r.st][0], color: SUB_CHIP[r.st][1] }}>{r.st.toUpperCase()}</span>
                  </div>
                  <span style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500, fontStyle: 'italic', flex: 1 }}>“{r.text}”</span>
                  <span className="muted" style={{ fontSize: 12 }}>{r.meta}</span>
                  {r.canSend && <button onClick={() => pickRiddle(r.id)} style={{ height: 40, borderRadius: 12, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>{r.resend ? 'Kirim ulang' : `Submit Riddle ${r.no}`}</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {scoring.type === 'riddle' && (
          <div className="col" style={{ gap: 10 }}>
            <span className="p-h">Do's & Don'ts</span>
            <div className="p-grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ background: '#E3EFE6', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.35 }}>
                <span style={{ fontWeight: 800, color: '#1F4D3A' }}>✓ Lakukan</span><span>Selfie satu grup di lokasi</span><span>Post IG Story, tag akun event</span><span>Ajak sebanyak mungkin anggota</span>
              </div>
              <div style={{ background: '#FBE4E0', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.35 }}>
                <span style={{ fontWeight: 800, color: '#9A2A1E' }}>✕ Jangan</span><span>Pakai AI / edit lokasi</span><span>Sebut nama gereja</span><span>Foto wajah jemaat tanpa izin</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-sticky">
        {c.deadline_at && (
          <div className="p-card row" style={{ borderRadius: 18, padding: '12px 14px', gap: 12 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F4D3A" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
            <div className="col" style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>{open ? 'Tutup dalam' : c.status === 'scheduled' ? 'Belum dibuka' : 'Submission ditutup'}</span>
              <span className="num" style={{ font: "800 20px 'Bricolage Grotesque'" }}>{open ? `${cd.d}h ${cd.h}j ${cd.m}m ${cd.s}d` : c.status === 'scheduled' && c.open_at ? fmtWIB(c.open_at) : '—'}</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: '#3C4A42' }}>{fmtWIB(c.deadline_at).replace(' WIB', '')}<br />WIB</span>
          </div>
        )}
        <div className="p-card" style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>Cara skor · maks {scoring.max}{c.riddles_per_group ? ' per riddle' : ''}</span>
          {scoring.type === 'riddle' ? (
            <>
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}><div style={{ flex: scoring.location_weight, background: '#1F4D3A' }} /><div style={{ flex: scoring.participation_weight, background: '#E3A92B' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, lineHeight: 1.4 }}>
                <div className="col"><span style={{ fontWeight: 700 }}>{scoring.location_weight}% Lokasi benar</span><span className="muted">Benar penuh · Salah 0</span></div>
                <div className="col"><span style={{ fontWeight: 700 }}>{scoring.participation_weight}% Partisipasi</span><span className="muted">{[...scoring.tiers].sort((a, b) => b.min - a.min).map((t) => `≥${t.min} org: ${t.pts}`).join(' · ')}</span></div>
              </div>
            </>
          ) : <span className="muted" style={{ fontSize: 13 }}>{scoring.type === 'flat' ? `Tervalidasi = ${scoring.max} poin.` : `Dinilai panitia, 0–${scoring.max} poin.`}</span>}
          {c.sections?.points_rewards && <span className="muted" style={{ fontSize: 12 }}>{c.sections.points_rewards}</span>}
        </div>

        {!c.riddles_per_group && (
          <div className="col" style={{ gap: 8 }}>
            {single && <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Status: {STATUS[single.status]}{single.score != null ? ` · ${single.score} pts` : ''}{single.reject_reason ? ` · “${single.reject_reason}”` : ''}</span>}
            {canSingle
              ? <button className="p-btn-lg" onClick={() => pickRiddle(null)} style={{ background: '#1F4D3A', color: '#FBF6EA' }}>{single ? 'Kirim ulang' : 'Submit challenge'}</button>
              : <button className="p-btn-lg" disabled style={{ background: '#E2DACA', color: '#6B665A', cursor: 'not-allowed' }}>{!open ? 'Submit belum / sudah ditutup' : single ? 'Sudah dikirim' : 'Submit oleh Group Leader'}</button>}
          </div>
        )}
        <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{open ? 'Hanya Group Leader yang bisa submit. Anggota bisa kirim foto ke Leader.' : c.status === 'scheduled' ? 'Challenge ini belum dibuka.' : 'Challenge ini sudah ditutup.'}</span>
      </div>
    </div>
  );
}
