import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtWIB } from '../lib/game.js';

// Opened by the event's QR code (#/portal/checkin?t=…): marks the signed-in person present.
export default function CheckIn({ me, go }) {
  const token = new URLSearchParams(window.location.hash.split('?')[1] || '').get('t');
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    api.checkIn(token).then(setRes).catch((e) => setError(e.message));
  }, [token]);

  const card = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: 32, maxWidth: 520, margin: '0 auto' };
  const back = <button onClick={() => go('home')} style={{ height: 44, padding: '0 18px', borderRadius: 14, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>Ke Home</button>;

  if (!token) return (
    <div className="p-card" style={card}>
      <span style={{ font: "700 20px 'Bricolage Grotesque'" }}>Absensi acara</span>
      <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Di lokasi acara, buka kamera HP dan scan QR code absensi dari panitia. Kamu akan langsung tercatat hadir.</span>
      {back}
    </div>
  );
  if (error) return (
    <div className="p-card" style={card}>
      <div style={{ width: 72, height: 72, borderRadius: 24, background: '#FBE4E0', color: '#9A2A1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800 }}>!</div>
      <span style={{ font: "700 20px 'Bricolage Grotesque'" }}>Absen belum berhasil</span>
      <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{error}</span>
      {back}
    </div>
  );
  if (!res) return <div className="p-card" style={card}><span className="muted">Mencatat kehadiran…</span></div>;
  return (
    <div className="p-card" style={card}>
      <div className="p-pop" style={{ width: 84, height: 84, borderRadius: 28, background: '#E3EFE6', color: '#1F4D3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 800 }}>✓</div>
      <span style={{ font: "800 24px 'Bricolage Grotesque'", color: '#1F4D3A' }}>{res.already ? 'Kamu sudah absen' : 'Kamu tercatat hadir!'}</span>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{me.name}</span>
      <span className="muted" style={{ fontSize: 14 }}>{me.roleName}{me.group ? ` · ${me.group.name} · Grup ${me.group.no}` : ''}</span>
      <span style={{ fontSize: 14 }}>{res.event} · {fmtWIB(res.checked_at, { second: '2-digit' })}</span>
      <span className="muted" style={{ fontSize: 12 }}>Tunjukkan layar ini ke panitia kalau diminta. Selamat datang di Flourish! 🌱</span>
      {back}
    </div>
  );
}
