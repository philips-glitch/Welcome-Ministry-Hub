import useCountdown from '../useCountdown.js';
import { DEMO_NOW } from '../data.js';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { SUB_CHIP } from './portalData.js';
import { fmtWIB, statusMeta, withDefaults, formOf, isConnect, itemMax, teamMax, latestPerUnit } from '../lib/game.js';
import { CountUp, urgency } from './motion.jsx';
import { PhotoThumb } from '../components/Photo.jsx';
import { nameWithRole } from '../lib/permissions.js';

const STATUS = { validated: 'Validated', submitted: 'Submitted', rejected: 'Rejected', resubmit: 'Rejected' };
const nowMs = () => (api.mode === 'demo' ? DEMO_NOW : Date.now());
const EXTRA = [['connection', 'The Connection'], ['what_we_need', 'What We Need'], ['make_it_flourish', 'Make It Flourish'], ['flourish_hub', 'Flourish Hub'], ['duration', 'Durasi']];
const SOON = 'Coming soon';
const first = (name) => (name || '').split(' ')[0];

export default function ChallengeDetail({ go, me, challenge: c, data, pickRiddle, justSent }) {
  const cd = useCountdown(c?.deadline_at ? new Date(c.deadline_at).getTime() : 0);
  const { scores } = useGame();
  if (!c) return <div className="p-card muted">Challenge tidak ditemukan.</div>;
  const open = c.status === 'live' && (!c.deadline_at || new Date(c.deadline_at).getTime() > nowMs());
  // After the deadline, only an entry an admin reopened can still be changed (until it's validated again).
  const lateOk = (x) => !open && !!x?.reopened_at && x.status !== 'validated' && ['live', 'closed'].includes(c.status);
  const reopenNote = (x) => !!x?.reopened_at && x.status !== 'validated';
  // Until it opens, the event's details stay under wraps: every text section reads "Coming soon".
  const soon = ['draft', 'scheduled'].includes(c.status);
  const scoring = withDefaults(c.scoring);
  const form = formOf(c);
  const connect = isConnect(c);
  const riddleMode = !connect && c.riddles_per_group > 0;
  const nameOf = (id) => first(data.roster.find((p) => p.id === id)?.full_name) || 'leader';
  const [, statusLabel] = statusMeta(c.status);
  const perItem = itemMax(scoring);
  // Who reviewed it: "Yohan (Captain)".
  const by = (sub) => (sub.reviewed_by_name ? ` oleh ${nameWithRole(sub.reviewed_by_name, sub.reviewed_by_role)}` : '');
  const metaFor = (sub) => (!sub ? 'Belum ada submission'
    : sub.status === 'validated' ? `${sub.score}/${perItem} pts${form.tags && !connect ? ` · ${sub.participant_count ?? sub.tagged_ids.length} orang` : ''} · disetujui${by(sub)}`
    : sub.status === 'submitted' ? `Dikirim ${fmtWIB(sub.submitted_at)}${connect ? '' : ` oleh ${nameOf(sub.submitted_by)}`}`
    : `${sub.status === 'resubmit' ? 'Diminta ulang' : 'Ditolak'}${by(sub)}: ${sub.reject_reason || '—'}`);

  const riddleRows = riddleMode ? data.draw.map((d) => {
    const r = data.riddles.find((x) => x.id === d.riddle_id);
    const sub = data.latest(d.riddle_id);
    // Until the deadline an entry can be sent again, as long as it isn't validated.
    const canSend = me.canSubmit && ((open && sub?.status !== 'validated') || lateOk(sub));
    return { slot: d.slot, id: d.riddle_id, no: r?.no ?? d.slot, text: r?.prompt ?? '(riddle belum tersedia)', st: sub ? STATUS[sub.status] : 'Not Started', meta: metaFor(sub), canSend, resend: !!sub, sub };
  }) : [];
  const single = !riddleMode && !connect ? data.latest(null) : null;
  const canSingle = me.canSubmit && ((open && single?.status !== 'validated') || lateOk(single));

  // Connect: my people (latest entry per person), plus empty slots up to `people`.
  const people = scoring.people || 2;
  const mine = connect ? latestPerUnit(data.subs.filter((x) => x.submitted_by === me.id && x.target_id)).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)) : [];
  const activeMine = mine.filter((x) => ['submitted', 'validated'].includes(x.status));
  const canAdd = open && me.canSubmit && activeMine.length < people;

  // Progress for the hero.
  const latestAll = connect ? activeMine : riddleMode ? riddleRows.map((r) => r.sub).filter(Boolean) : single ? [single] : [];
  const sent = latestAll.length;
  const total = connect ? people : riddleMode ? riddleRows.length || c.riddles_per_group : 1;
  const waiting = latestAll.filter((s) => s.status === 'submitted').length;
  const pts = scores.find((s) => s.group_no === me.group?.no && s.challenge_id === c.id)?.points ?? 0;

  return (
    <div className="p-stack">
      {/* Hero */}
      <section style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 190, height: 190, borderRadius: '50%', background: '#2F7A55', opacity: 0.45 }} />
        <div className="row" style={{ gap: 10, position: 'relative' }}>
          <button onClick={() => go('challenges')} aria-label="Kembali ke daftar challenge" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(251,246,234,.14)', color: '#FBF6EA', fontSize: 20, flex: 'none' }}>‹</button>
          <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 600 }}>{c.code} · {c.kind === 'side' ? 'Side quest' : `Mini Event #${c.round ?? '—'}`}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', padding: '4px 9px', borderRadius: 999, background: c.status === 'live' ? '#E3A92B' : 'rgba(251,246,234,.18)', color: c.status === 'live' ? '#1B2620' : '#FBF6EA' }}>{statusLabel.toUpperCase()}</span>
        </div>
        <div className="col" style={{ gap: 6, position: 'relative' }}>
          <span style={{ font: "800 30px/1.08 'Bricolage Grotesque'", letterSpacing: '-0.01em' }}>{c.name}</span>
          {soon ? <span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9, fontWeight: 700, letterSpacing: '.02em' }}>{SOON}</span>
            : c.sections?.game_idea && <span style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9, maxWidth: 680 }}>{c.sections.game_idea}</span>}
        </div>

        <div className="p-hero-stats" style={{ position: 'relative' }}>
          <Stat label={open ? 'Tutup dalam' : c.status === 'scheduled' ? 'Dibuka' : 'Deadline'}
            value={open && c.deadline_at ? `${cd.d}h ${cd.h}:${cd.m}:${cd.s}` : c.status === 'scheduled' ? (c.open_at ? fmtWIB(c.open_at).replace(' WIB', '') : 'TBD') : c.deadline_at ? 'Ditutup' : '—'}
            sub={c.deadline_at ? fmtWIB(c.deadline_at) : 'belum diatur'} wide urgency={open ? urgency(c.deadline_at) : 'calm'} />
          {me.group && <Stat label={connect ? 'Teman baru kamu' : riddleMode ? 'Riddle terkirim' : 'Submission'} value={`${sent}/${total}`} sub={waiting ? `${waiting} menunggu validasi` : sent >= total ? 'semua terkirim' : 'ayo kirim!'} />}
          {me.group && <Stat label="Poin grup" value={<CountUp value={pts} />} sub={scoring.tba ? 'skor menyusul' : `dari maks ${teamMax(c)}`} />}
        </div>
        {me.group && (
          <div style={{ display: 'flex', gap: 4, position: 'relative' }}>
            {Array.from({ length: total }, (_, i) => (
              <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(251,246,234,.18)', overflow: 'hidden' }}>
                {i < sent && <div className="p-fill" style={{ height: '100%', background: '#E3A92B', animationDelay: `${i * 120}ms` }} />}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="p-cols">
        {/* Main: what to do */}
        <div className="p-stack">
          {connect ? (
            <section className="col" style={{ gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="p-h">Kenalan kamu</span><span className="muted" style={{ fontSize: 12 }}>{people} orang dari grup kamu</span>
              </div>
              {!me.group && <div className="p-card muted" style={{ fontSize: 13 }}>Kamu belum masuk grup.</div>}
              {me.group && (
                <div className="p-grid-2">
                  {mine.map((s) => {
                    const st = STATUS[s.status];
                    const [cbg, cfg] = SUB_CHIP[st];
                    const doneCard = s.status === 'validated';
                    const pending = s.status === 'submitted';
                    const resend = me.canSubmit && ((open && (pending || (['rejected', 'resubmit'].includes(s.status) && activeMine.length < people))) || lateOk(s));
                    return (
                      <div key={s.id} className={'p-card' + (justSent && justSent === s.target_id ? ' p-flash' : '')} style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: doneCard ? '#F3F8F4' : undefined }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span style={{ font: "800 13px 'Bricolage Grotesque'", width: 30, height: 30, borderRadius: 9, background: doneCard ? '#2F7A55' : '#1F4D3A', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{doneCard ? '✓' : (data.roster.find((p) => p.id === s.target_id)?.full_name || '?')[0]}</span>
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{data.roster.find((p) => p.id === s.target_id)?.full_name || 'Anggota grup'}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: cbg, color: cfg }}>{st.toUpperCase()}</span>
                        </div>
                        {s.answers?.q4 && <span style={{ fontSize: 13.5, lineHeight: 1.45, fontStyle: 'italic' }}>“{s.answers.q4}”</span>}
                        {(s.media_path || s.media_name) && <PhotoThumb path={s.media_path} name={s.media_name} height={140} caption={`Foto bareng · versi ${s.version}`} placeholder="Foto lama, tidak tersimpan" />}
                        <span className="muted" style={{ fontSize: 12 }}>{metaFor(s)}</span>
                        {reopenNote(s) && <span style={{ fontSize: 12, color: '#7A5410', fontWeight: 600 }}>Dibuka lagi oleh panitia — bisa diubah sampai divalidasi ulang.</span>}
                        {resend && (
                          <div style={{ display: 'grid', gridTemplateColumns: open ? '1fr 1fr' : '1fr', gap: 6 }}>
                            <button onClick={() => pickRiddle(s.target_id)} style={{ height: 42, borderRadius: 12, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>{pending ? 'Ubah jawaban' : 'Kirim ulang'}</button>
                            {open && <button onClick={() => pickRiddle(null, pending ? s.id : null)} style={{ height: 42, borderRadius: 12, border: '1px solid #DCD2BC', fontWeight: 700, fontSize: 13 }}>{pending ? 'Ganti orang' : 'Orang lain'}</button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {Array.from({ length: Math.max(0, people - mine.length) }, (_, i) => (
                    <div key={'slot' + i} className="p-card" style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderStyle: 'dashed', borderColor: canAdd ? '#1F4D3A' : undefined }}>
                      <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Teman baru #{mine.length + i + 1}</span>
                      <span className="muted" style={{ fontSize: 12, lineHeight: 1.45, flex: 1 }}>{open ? 'Ajak ngobrol satu orang di grup kamu, lalu jawab Q1–Q4 tentang dia.' : soon ? SOON : 'Challenge sudah ditutup.'}</span>
                      {canAdd && <button onClick={() => pickRiddle(null)} style={{ height: 42, borderRadius: 12, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>+ Pilih orang</button>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : riddleMode ? (
            <section className="col" style={{ gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="p-h">Riddle grup kamu</span><span className="muted" style={{ fontSize: 12 }}>{soon ? SOON : 'diundi acak oleh panitia'}</span>
              </div>
              {soon && <div className="p-card muted" style={{ fontSize: 13, fontStyle: 'italic' }}>{SOON}</div>}
              {!soon && data.loading && <span className="muted" style={{ fontSize: 13 }}>Memuat riddle…</span>}
              {!soon && !data.loading && !riddleRows.length && (
                <div className="p-card muted" style={{ fontSize: 13 }}>{!me.group ? 'Kamu belum masuk grup.' : c.status === 'scheduled' ? 'Riddle muncul saat challenge dibuka.' : 'Riddle belum diundi untuk grup kamu.'}</div>
              )}
              <div className="p-grid-2">
                {!soon && riddleRows.map((r) => {
                  const [cbg, cfg] = SUB_CHIP[r.st];
                  const doneCard = r.st === 'Validated';
                  return (
                    <div key={r.slot} className={'p-card' + (justSent && justSent === r.id ? ' p-flash' : '')} style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderColor: r.canSend ? '#1F4D3A' : undefined, background: doneCard ? '#F3F8F4' : undefined }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ font: "800 13px 'Bricolage Grotesque'", width: 30, height: 30, borderRadius: 9, background: doneCard ? '#2F7A55' : '#1F4D3A', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{doneCard ? '✓' : r.no}</span>
                        <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Riddle {r.no}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: cbg, color: cfg }}>{r.st.toUpperCase()}</span>
                      </div>
                      <span style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500, fontStyle: 'italic', flex: 1 }}>“{r.text}”</span>
                      {r.sub?.answers?.answer && <span style={{ fontSize: 13 }}><b>Jawaban kalian:</b> {r.sub.answers.answer}</span>}
                      {r.sub && (r.sub.media_path || r.sub.media_name) && (
                        <PhotoThumb path={r.sub.media_path} name={r.sub.media_name} height={150} caption={`Riddle ${r.no} · versi ${r.sub.version}`} placeholder="Foto lama, tidak tersimpan" />
                      )}
                      <span className="muted" style={{ fontSize: 12 }}>{r.meta}</span>
                      {reopenNote(r.sub) && <span style={{ fontSize: 12, color: '#7A5410', fontWeight: 600 }}>Dibuka lagi oleh panitia — bisa diubah sampai divalidasi ulang.</span>}
                      {r.canSend && <button onClick={() => pickRiddle(r.id)} style={{ height: 42, borderRadius: 12, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>{r.sub?.status === 'submitted' ? 'Ubah & kirim ulang' : r.resend ? 'Kirim ulang' : `Submit Riddle ${r.no}`}</button>}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="p-h">Submission grup</span>
              <span className="muted" style={{ fontSize: 13 }}>
                {soon ? SOON : !single ? 'Belum ada submission dari grup kamu.' : `Status: ${STATUS[single.status]}${single.score != null ? ` · ${single.score} pts` : ''}${single.reject_reason ? ` · “${single.reject_reason}”` : ''} · versi ${single.version}`}
              </span>
              {single?.ig_url && form.photo === 'none' && <a href={single.ig_url.startsWith('http') ? single.ig_url : 'https://' + single.ig_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: '#1F4D3A', overflowWrap: 'anywhere' }}>▶ {single.ig_url}</a>}
              {single && (single.media_path || single.media_name) && <PhotoThumb path={single.media_path} name={single.media_name} height={200} caption={`${c.name} · versi ${single.version}`} placeholder="Foto lama, tidak tersimpan" />}
              {canSingle
                ? <button className="p-btn-lg" onClick={() => pickRiddle(null)} style={{ background: '#1F4D3A', color: '#FBF6EA' }}>{single ? (single.status === 'submitted' ? 'Ubah & kirim ulang' : 'Kirim ulang') : 'Submit challenge'}</button>
                : <button className="p-btn-lg" disabled style={{ background: '#E2DACA', color: '#6B665A', cursor: 'not-allowed' }}>{!open ? (soon ? SOON : 'Submit ditutup') : single?.status === 'validated' ? 'Sudah divalidasi' : 'Submit oleh Group Leader'}</button>}
            </section>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            {!open ? (soon ? SOON : 'Challenge ini sudah ditutup.')
              : connect ? (me.noPoints ? 'Kamu captain: ikut main seperti member, tapi tanpa poin — skor kamu selalu 0 dan tidak dihitung ke poin grup.' : me.canSubmit ? 'Setiap anggota submit sendiri. Jawabanmu hanya terlihat oleh kamu dan panitia. Selama belum divalidasi, kamu bisa ubah sampai deadline.' : 'Challenge ini dikerjakan tiap peserta grup.')
              : me.canSubmit ? 'Kamu Group Leader: kamu yang submit untuk grup. Selama belum divalidasi, bisa diubah sampai deadline.' : 'Hanya Group Leader yang bisa submit. Kirim foto kamu ke Leader ya.'}
          </span>
        </div>

        {/* Side: the rules, collapsible */}
        <div className="p-sticky">
          <Fold title="Cara main" open>
            {soon ? <Soon /> : c.sections?.how_to_play ? <Prose text={c.sections.how_to_play} /> : <p style={{ ...para, color: '#56655C' }}>Detail menyusul dari panitia.</p>}
          </Fold>
          {soon ? <Fold title="Aturan" open><Soon /></Fold> : c.sections?.rules && <Fold title="Aturan" open><Prose text={c.sections.rules} /></Fold>}
          {soon ? <Fold title="Poin & reward" open><Soon /></Fold> : (
            <Fold title={scoring.tba ? 'Cara skor · menyusul' : `Cara skor · maks ${teamMax(c)}`} open={!scoring.tba}>
              {!scoring.tba && <ScoringSummary c={c} scoring={scoring} />}
              {c.sections?.points_rewards && <div style={{ marginTop: scoring.tba ? 0 : 10 }}><Prose text={c.sections.points_rewards} muted /></div>}
            </Fold>
          )}
          {soon && (
            <Fold title="Info lainnya" open>
              <div className="col" style={{ gap: 10 }}>
                {EXTRA.filter(([k]) => ['connection', 'flourish_hub'].includes(k)).map(([k, t]) => <div key={k} className="col" style={{ gap: 2 }}><b style={{ fontSize: 13 }}>{t}</b><Soon /></div>)}
              </div>
            </Fold>
          )}
          {!soon && scoring.type === 'riddle' && (
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
          {!soon && EXTRA.some(([k]) => c.sections?.[k]) && (
            <Fold title="Info lainnya">
              <div className="col" style={{ gap: 10 }}>
                {EXTRA.filter(([k]) => c.sections?.[k]).map(([k, t]) => <div key={k} className="col" style={{ gap: 2 }}><b style={{ fontSize: 13 }}>{t}</b><Prose text={c.sections[k]} /></div>)}
              </div>
            </Fold>
          )}
        </div>
      </div>
    </div>
  );
}

const para = { margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#3C4A42' };
const Soon = () => <p style={{ ...para, color: '#56655C', fontStyle: 'italic' }}>{SOON}</p>;

// Section text: "- " lines become a bullet list, other lines paragraphs.
function Prose({ text, muted }) {
  const blocks = [];
  String(text).split('\n').map((l) => l.trim()).filter(Boolean).forEach((t) => {
    const last = blocks[blocks.length - 1];
    if (t.startsWith('- ')) { if (last?.items) last.items.push(t.slice(2)); else blocks.push({ items: [t.slice(2)] }); }
    else blocks.push({ text: t });
  });
  const style = muted ? { ...para, color: '#56655C' } : para;
  return (
    <div className="col" style={{ gap: 6 }}>
      {blocks.map((b, i) => (b.items
        ? <ul key={i} style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>{b.items.map((x, j) => <li key={j} style={style}>{x}</li>)}</ul>
        : <p key={i} style={style}>{b.text}</p>))}
    </div>
  );
}

function ScoringSummary({ c, scoring: s }) {
  const tiers = (ts) => [...(ts || [])].sort((a, b) => b.min - a.min).map((t) => `≥${t.min} org: ${t.pts}`).join(' · ');
  const bar = (parts) => <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>{parts.map(([w, col], i) => <div key={i} style={{ flex: w || 0.001, background: col }} />)}</div>;
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, lineHeight: 1.4 };
  if (s.type === 'riddle') {
    return (
      <div className="col" style={{ gap: 10 }}>
        {bar([[s.location_weight, '#1F4D3A'], [s.participation_weight, '#E3A92B']])}
        <div style={grid}>
          <div className="col"><span style={{ fontWeight: 700 }}>{s.location_weight}% Lokasi benar</span><span className="muted">Benar penuh · Salah 0</span></div>
          <div className="col"><span style={{ fontWeight: 700 }}>{s.participation_weight}% Partisipasi</span><span className="muted">{tiers(s.tiers)}</span></div>
        </div>
      </div>
    );
  }
  if (s.type === 'connect') {
    return (
      <div className="col" style={{ gap: 10 }}>
        {bar([[s.individual_weight, '#1F4D3A'], [s.participation_weight, '#E3A92B']])}
        <div style={grid}>
          <div className="col"><span style={{ fontWeight: 700 }}>{s.individual_weight}% Rata-rata skor</span><span className="muted">Maks {itemMax(s)} per orang × {s.people} orang</span></div>
          <div className="col"><span style={{ fontWeight: 700 }}>{s.participation_weight}% Partisipasi</span><span className="muted">(yang submit + yang diajak kenalan) ÷ anggota grup × ½</span></div>
        </div>
      </div>
    );
  }
  if (s.type === 'rubric') {
    const items = c.riddles_per_group > 0 ? c.riddles_per_group : 1;
    return (
      <div className="col" style={{ gap: 8, fontSize: 13, lineHeight: 1.4 }}>
        {s.criteria.map((k) => (
          <div key={k.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span>{k.label}{items > 1 ? ` (per riddle)` : ''}</span><b className="num">{k.binary ? `${k.max} / 0` : k.max}</b>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, borderTop: '1px solid #EFE7D6', paddingTop: 8 }}>
          <span>Partisipasi tim <span className="muted">({tiers(s.participation?.tiers)})</span></span><b className="num">{Math.max(0, ...(s.participation?.tiers || []).map((t) => t.pts))}</b>
        </div>
      </div>
    );
  }
  return <p style={para}>{s.type === 'flat' ? `Tervalidasi = ${s.max} poin.` : `Dinilai panitia, 0–${s.max} poin.`}</p>;
}

// urgency: 'soon' (< 24 h) pulses amber, 'urgent' (< 3 h) turns red and pulses.
function Stat({ label, value, sub, wide, urgency: u = 'calm' }) {
  return (
    <div className={u === 'urgent' ? 'p-urgent p-urgent-bg' : u === 'soon' ? 'p-soon' : undefined} style={{ background: 'rgba(251,246,234,.12)', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, gridColumn: wide ? 'span 2' : undefined, minWidth: 0 }}>
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
