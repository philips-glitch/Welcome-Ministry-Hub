import useCountdown from '../useCountdown.js';
import { R1_DEADLINE } from '../data.js';
import { MY_RIDDLES, SUB_CHIP } from './portalData.js';

export default function ChallengeDetail({ go, submitted }) {
  const cd = useCountdown(R1_DEADLINE);
  const riddles = MY_RIDDLES.map((r) => (r[0] === '2' && submitted ? ['2', 'Submitted', r[2], 'Baru saja dikirim oleh Nadia'] : r));

  return (
    <div className="p-cols">
      <div className="p-stack">
        <div className="row">
          <button onClick={() => go('home')} aria-label="Kembali" className="p-icon-btn" style={{ fontSize: 20 }}>‹</button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Round 1 · PIC: Cindy</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: '#E3A92B', color: '#1B2620' }}>LIVE</span>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="p-title">Photo Challenge</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: '#3C4A42', maxWidth: 640 }}>Pecahkan 4 riddle, datangi lokasinya bareng-bareng, lalu selfie satu grup di sana. Makin banyak yang ikut, makin banyak poinnya.</span>
        </div>

        <div className="col" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="p-h">Riddle grup kamu</span><span className="muted" style={{ fontSize: 12 }}>diundi acak oleh panitia</span>
          </div>
          <div className="p-grid-2">
            {riddles.map(([no, st, text, meta]) => (
              <div key={no} className="p-card" style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ font: "800 13px 'Bricolage Grotesque'", width: 28, height: 28, borderRadius: 9, background: '#1F4D3A', color: '#FBF6EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{no}</span>
                  <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Riddle {no}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: SUB_CHIP[st][0], color: SUB_CHIP[st][1] }}>{st.toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 500, fontStyle: 'italic', flex: 1 }}>“{text}”</span>
                <span className="muted" style={{ fontSize: 12 }}>{meta}</span>
              </div>
            ))}
          </div>
        </div>

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
      </div>

      <div className="p-sticky">
        <div className="p-card row" style={{ borderRadius: 18, padding: '12px 14px', gap: 12 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F4D3A" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
          <div className="col" style={{ flex: 1 }}>
            <span className="muted" style={{ fontSize: 12 }}>Tutup dalam</span>
            <span className="num" style={{ font: "800 20px 'Bricolage Grotesque'" }}>{cd.d}h {cd.h}j {cd.m}m {cd.s}d</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: '#3C4A42' }}>Min, 18 Okt<br />23:55 WIB</span>
        </div>

        <div className="p-card" style={{ borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>Cara skor · maks 10 per riddle</span>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}><div style={{ flex: 1, background: '#1F4D3A' }} /><div style={{ flex: 1, background: '#E3A92B' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, lineHeight: 1.4 }}>
            <div className="col"><span style={{ fontWeight: 700 }}>50% Lokasi benar</span><span className="muted">Benar 10 · Salah 0</span></div>
            <div className="col"><span style={{ fontWeight: 700 }}>50% Partisipasi</span><span className="muted">10–14 org: 10 · 7–9: 6 · ≤6: 2</span></div>
          </div>
        </div>

        <div className="col" style={{ gap: 8 }}>
          <button className="p-btn-lg" onClick={() => go('submit')} style={{ background: '#1F4D3A', color: '#FBF6EA' }}>{submitted ? 'Lihat submission Riddle 2' : 'Submit Riddle 2'}</button>
          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Hanya Group Leader yang bisa submit. Anggota bisa upload foto ke draft grup.</span>
        </div>
      </div>
    </div>
  );
}
