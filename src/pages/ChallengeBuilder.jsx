import { useState } from 'react';
import { GROUPS, RIDDLES, DRAW0, drawRiddles } from '../data.js';

const CHALLENGES = [
  ['R1 · Photo Challenge', 'SCHEDULED', '15–18 Okt · Cindy'],
  ['R4 · Scrapbook / Poster', 'SCHEDULED', '15 Okt–19 Nov · Rocky'],
  ['R2 · Video Challenge', 'DRAFT', '22 Okt–1 Nov · Danny & Cherien'],
  ['R3 · Spice It Up', 'DRAFT', '4–8 Nov · Maya'],
  ['R5 · Beyond UR', 'DRAFT', 'tanggal TBD'],
  ['R6 · The Legacy Challenge', 'DRAFT', 'tanggal TBD'],
  ['SQ · Get To Know Me', 'LIVE', 'Side quest · +10'],
  ['SQ · Find Your Match', 'LIVE', 'Side quest · +15'],
  ['SQ · Connect 10', 'SCHEDULED', 'Side quest · +30'],
];
const CH_CHIP = { DRAFT: ['#EDE6D6', '#56655C'], SCHEDULED: ['#E3ECF8', '#244F8F'], LIVE: ['#E3A92B', '#1B2620'] };
const STATUSES = ['Draft', 'Scheduled', 'Live', 'Closed', 'Results Published'];
const TEMPLATE = [
  ['Game Idea', 'Riddle berburu lokasi di area gereja. Tiap grup dapat 4 riddle acak dari bank 10.'],
  ['How to Play', 'Pecahkan riddle → datang ke lokasi → selfie satu grup → post IG Story tag akun event → Leader submit di portal.'],
  ['The Connection', 'Memaksa grup bergerak bareng dan ngobrol di luar jam pelayanan biasa.'],
  ['Points & Rewards', 'Maks 10/riddle: 50% lokasi benar + 50% partisipasi. “First correct” direpost Rabu.'],
  ['Flourish Hub', 'Submit: foto grup + link/screenshot IG Story + tag anggota + deklarasi No-AI. Verifikasi oleh captain.'],
  ['What We Need', 'PIC: Cindy · Venue: seluruh area gedung · Material: riddle card digital.'],
  ['Make It Flourish', 'Repost foto terbaik; captain kasih shout-out di grup WA.'],
  ['Duration', 'Kam 15 Okt 20:00 – Min 18 Okt 23:55 WIB'],
];
const SCHEDULE = [['Announce', 'Kam, 15 Okt 2026 · 20:00'], ['Open', 'Kam, 15 Okt 2026 · 20:00'], ['Deadline', 'Min, 18 Okt 2026 · 23:55'], ['Validasi', 'Sel, 20 Okt · EOD']];
const box = { border: '1px solid #E9E0CC', borderRadius: 8, padding: '6px 10px', fontWeight: 600 };
const panel = { borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 };
const panelTitle = { font: "700 14px 'Bricolage Grotesque'" };

export default function ChallengeBuilder() {
  const [active, setActive] = useState(0);
  const [chStatus, setChStatus] = useState(1);
  const [tmpl, setTmpl] = useState(() => TEMPLATE.map(([, body]) => body));
  const [rSeed, setRSeed] = useState(0);
  const [rLocked, setRLocked] = useState(false);
  const [showAns, setShowAns] = useState(true);

  const draw = rSeed === 0 ? DRAW0 : drawRiddles(rSeed);
  const used = Array(11).fill(0);
  draw.forEach((a) => a.forEach((n) => used[n]++));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', minWidth: 0, minHeight: '100vh' }}>
      <div className="col" style={{ borderRight: '1px solid #E9E0CC', padding: '18px 12px', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 8px' }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>Challenges</span>
          <button className="link">+ Baru</button>
        </div>
        {CHALLENGES.map(([name, status, meta], i) => (
          <button key={name} onClick={() => setActive(i)} className="col" style={{ textAlign: 'left', gap: 4, padding: 10, borderRadius: 10, background: i === active ? '#FFFDF8' : 'transparent', border: `1px solid ${i === active ? '#1F4D3A' : 'transparent'}` }}>
            <div className="row" style={{ gap: 6, width: '100%' }}>
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{name}</span>
              <span className="chip" style={{ fontSize: 9, padding: '2px 6px', background: CH_CHIP[status][0], color: CH_CHIP[status][1] }}>{status}</span>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{meta}</span>
          </button>
        ))}
      </div>

      <div className="col" style={{ padding: '22px 24px', gap: 18, minWidth: 0 }}>
        {active !== 0 ? (
          <div className="card pad muted" style={{ fontSize: 14 }}>
            Editor untuk <b style={{ color: '#1B2620' }}>{CHALLENGES[active][0]}</b> belum ada di design. Contoh lengkap: R1 · Photo Challenge.
          </div>
        ) : (
          <>
            <div className="row">
              <div className="col">
                <span className="muted" style={{ fontSize: 12 }}>R1 · PIC Cindy · Tipe: Main challenge</span>
                <span style={{ font: "800 26px 'Bricolage Grotesque'", color: '#1F4D3A' }}>Photo Challenge</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', background: '#EDE6D6', borderRadius: 10, padding: 3, gap: 2 }}>
                {STATUSES.map((label, i) => (
                  <button key={label} onClick={() => setChStatus(i)} style={{ fontSize: 12, fontWeight: 700, padding: '7px 10px', borderRadius: 8, background: i === chStatus ? '#1F4D3A' : 'transparent', color: i === chStatus ? '#FBF6EA' : '#56655C' }}>{label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 18, alignItems: 'start' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {TEMPLATE.map(([title], i) => (
                  <label key={title} className="card" style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ font: "800 11px 'Bricolage Grotesque'", width: 22, height: 22, borderRadius: 7, background: '#E3EFE6', color: '#1F4D3A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{title}</span>
                    </div>
                    <textarea
                      value={tmpl[i]}
                      onChange={(e) => setTmpl((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
                      rows={4}
                      style={{ font: 'inherit', fontSize: 12.5, lineHeight: 1.5, color: '#3C4A42', border: '1px solid #EFE7D6', borderRadius: 8, padding: '8px 10px', background: '#FBF8F0', minHeight: 58, resize: 'vertical' }}
                    />
                  </label>
                ))}
              </div>

              <div className="col" style={{ gap: 12 }}>
                <div className="card" style={panel}>
                  <span style={panelTitle}>Jadwal · WIB</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px 10px', fontSize: 13, alignItems: 'center' }}>
                    {SCHEDULE.map(([k, v]) => [<span key={k} className="muted">{k}</span>, <span key={k + 'v'} style={box}>{v}</span>])}
                  </div>
                </div>
                <div className="card" style={{ ...panel, gap: 10 }}>
                  <div className="row"><span style={panelTitle}>Formula skor</span><span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700 }}>Maks <b>10</b> / submission</span></div>
                  <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}><div style={{ flex: 1, background: '#1F4D3A' }} /><div style={{ flex: 1, background: '#E3A92B' }} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 54px', gap: '6px 8px', fontSize: 12.5, alignItems: 'center' }}>
                    <span><b>Lokasi benar</b> · benar 10 / salah 0</span><span style={{ ...box, borderRadius: 6, padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>50%</span>
                    <span><b>Partisipasi</b> · tier di bawah</span><span style={{ ...box, borderRadius: 6, padding: '4px 6px', textAlign: 'right', fontWeight: 700 }}>50%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, fontSize: 12 }}>
                    {[['10–14 org', 10], ['7–9 org', 6], ['≤ 6 org', 2]].map(([k, v]) => (
                      <div key={k} className="col" style={{ border: '1px solid #E9E0CC', borderRadius: 8, padding: '6px 8px' }}><span className="muted">{k}</span><b>{v}</b></div>
                    ))}
                  </div>
                  <div className="row" style={{ gap: 8, fontSize: 12.5 }}><span className="muted">Difficulty tier</span><span style={{ ...box, marginLeft: 'auto', borderRadius: 6, padding: '4px 8px', fontWeight: 700 }}>— (tidak dipakai) ▾</span></div>
                  <span className="muted" style={{ fontSize: 12, background: '#F6F0E2', borderRadius: 8, padding: '8px 10px' }}>
                    Contoh: lokasi benar + 11 orang = 5 + 5 = <b style={{ color: '#1B2620' }}>10</b> · salah + 8 orang = 0 + 3 = <b style={{ color: '#1B2620' }}>3</b>
                  </span>
                </div>
                <div className="card" style={panel}>
                  <span style={panelTitle}>Side Quest (bonus opsional)</span>
                  <div className="col" style={{ gap: 6, fontSize: 12.5 }}>
                    {[['Get To Know Me', '+10'], ['Find Your Match', '+15'], ['Connect 10', '+30']].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{k}</span><b>{v}</b></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="row">
                <span className="card-title">Riddle bank & undian</span>
                <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#14281F', color: '#E3A92B' }}>🔒 JAWABAN ADMIN ONLY</span>
                <button className="link" style={{ marginLeft: 'auto' }} onClick={() => setShowAns((v) => !v)}>{showAns ? 'Sembunyikan jawaban' : 'Tampilkan jawaban'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18 }}>
                <div className="col">
                  <div className="muted" style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1.6fr) minmax(0,1fr) 40px', gap: 10, fontSize: 11, fontWeight: 800, padding: '6px 8px', background: '#F6F0E2', borderRadius: 8 }}>
                    <span>#</span><span>Riddle (tampil ke member)</span><span>Jawaban</span><span>Dipakai</span>
                  </div>
                  {RIDDLES.map(([text, ans], i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1.6fr) minmax(0,1fr) 40px', gap: 10, fontSize: 12, padding: '7px 8px', borderBottom: '1px solid #F0E9DA', alignItems: 'center' }}>
                      <b>{i + 1}</b>
                      <span style={{ fontStyle: 'italic', lineHeight: 1.35 }}>{text}</span>
                      <span style={{ fontWeight: 600, color: showAns ? '#FBF6EA' : '#56655C', background: showAns ? '#14281F' : '#EDE6D6', borderRadius: 5, padding: '2px 6px' }}>{showAns ? ans : '••••••••'}</span>
                      <span className="num" style={{ textAlign: 'center' }}>{used[i + 1]}×</span>
                    </div>
                  ))}
                </div>
                <div className="col" style={{ gap: 10 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="muted" style={{ fontSize: 12 }}>Seed</span>
                    <b className="mono" style={{ fontSize: 13, border: '1px solid #E9E0CC', borderRadius: 6, padding: '4px 8px' }}>R1-{rSeed === 0 ? 7731 : rSeed}</b>
                    <button
                      className="btn btn-outline"
                      disabled={rLocked}
                      onClick={() => setRSeed(Math.floor(Math.random() * 9000) + 1000)}
                      style={{ marginLeft: 'auto', height: 34, padding: '0 12px', borderRadius: 9, fontSize: 12, opacity: rLocked ? 0.4 : 1 }}
                    >Acak ulang</button>
                    <button className="btn" onClick={() => setRLocked((v) => !v)} style={{ height: 34, padding: '0 12px', borderRadius: 9, fontSize: 12, fontWeight: 800, background: rLocked ? '#2F7A55' : '#1F4D3A', color: '#FBF6EA' }}>
                      {rLocked ? '✓ Undian terkunci' : 'Kunci undian'}
                    </button>
                  </div>
                  <span className="muted" style={{ fontSize: 11 }}>4 riddle berbeda per grup, diambil acak dari 10. Grup tidak bisa memilih.</span>
                  {draw.map((rs, gi) => (
                    <div key={gi} className="row" style={{ gap: 8, padding: '5px 0', borderBottom: '1px solid #F0E9DA' }}>
                      <span style={{ width: 8, height: 22, borderRadius: 3, background: GROUPS[gi][2] }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, width: 120 }}>{GROUPS[gi][0]} {GROUPS[gi][1]}</span>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {rs.map((r) => <span key={r} style={{ width: 30, height: 26, borderRadius: 7, background: '#E3EFE6', color: '#1F4D3A', font: "800 12px 'Bricolage Grotesque'", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
