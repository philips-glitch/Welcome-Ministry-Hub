import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { roleName, ATTENDEE_ROLES } from '../lib/permissions.js';
import { fmtWIB, toLocalInput, fromLocalInput } from '../lib/game.js';
import { downloadXlsx } from '../lib/xlsxWrite.js';

const inputStyle = { height: 36, borderRadius: 10, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 10px', font: 'inherit', fontSize: 13 };
const COLS = 'minmax(180px,1.6fr) 120px 110px 110px minmax(150px,1fr) 150px';
const TOAST = { ok: ['#E3EFE6', '#1F4D3A'], bad: ['#FBE4E0', '#9A2A1E'] };
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':') : '');

// The link inside the QR: opens the portal's check-in page (login first if needed).
export const checkInUrl = (token) => `${window.location.origin}${window.location.pathname}#/portal/checkin?t=${encodeURIComponent(token)}`;

export default function Attendance() {
  const { groups } = useGame();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [qr, setQr] = useState(null);
  const [form, setForm] = useState(null);
  const [q, setQ] = useState('');
  const [fGroup, setFGroup] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fRole, setFRole] = useState('');
  const [big, setBig] = useState(false);
  const [toast, setToast] = useState(null);

  const reload = useCallback(() => api.getAttendance().then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), []);
  // Live list: refreshed every 10 seconds while the page is open.
  useEffect(() => { reload(); const t = setInterval(reload, 10000); return () => clearInterval(t); }, [reload]);
  useEffect(() => { if (data && !form) setForm({ name: data.event.name, opens_at: data.event.opens_at, closes_at: data.event.closes_at }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const token = data?.event.token;
  useEffect(() => { if (token) QRCode.toDataURL(checkInUrl(token), { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#14281F', light: '#FFFFFF' } }).then(setQr); }, [token]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const rows = data?.rows || [];
  const present = rows.filter((r) => r.checked_at);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (!fGroup || (fGroup === 'none' ? !r.group_no : r.group_no === fGroup)) && (!fRole || r.role_id === fRole)
      && (!fStatus || (fStatus === 'in' ? !!r.checked_at : !r.checked_at))
      && (!s || `${r.full_name} ${r.username}`.toLowerCase().includes(s)))
      // Latest scans on top, then everyone not here yet.
      .sort((a, b) => (b.checked_at ? new Date(b.checked_at).getTime() : 0) - (a.checked_at ? new Date(a.checked_at).getTime() : 0));
  }, [rows, q, fGroup, fRole, fStatus]);
  const groupName = (no) => (groups || []).find((g) => g.no === no)?.name;
  const byGroup = (groups || []).map((g) => [g, rows.filter((r) => r.group_no === g.no)]).filter(([, rs]) => rs.length);

  const saveEvent = async () => {
    try { const e = await api.saveAttendanceEvent(form); setData((d) => ({ ...d, event: e })); setToast(['ok', 'Jam absensi disimpan']); }
    catch (e) { setToast(['bad', e.message]); }
  };
  const regenerate = async () => {
    if (!window.confirm('Buat QR baru? QR lama (termasuk yang sudah dicetak / difoto) langsung tidak berlaku. Yang sudah absen tetap tercatat.')) return;
    try { const e = await api.regenerateAttendanceToken(); setData((d) => ({ ...d, event: e })); setToast(['ok', 'QR baru dibuat — QR lama tidak berlaku lagi']); }
    catch (e) { setToast(['bad', e.message]); }
  };
  const mark = async (r, on) => {
    if (!on && !window.confirm(`Batalkan kehadiran ${r.full_name}?`)) return;
    try { await api.markAttendance(r.id, on); await reload(); setToast(['ok', on ? `${r.full_name} ditandai hadir (manual)` : `Kehadiran ${r.full_name} dibatalkan`]); }
    catch (e) { setToast(['bad', e.message]); }
  };
  const exportXlsx = () => downloadXlsx(`Absensi ${data.event.name} ${new Date().toISOString().slice(0, 10)}.xlsx`, {
    sheet: 'Absensi',
    header: ['Nama', 'Username', 'Role', 'Grup', 'Status', 'Waktu absen (WIB)', 'Cara'],
    rows: shown.map((r) => [r.full_name, r.username, roleName(r.role_id), r.group_no ? `${r.group_no} ${groupName(r.group_no) || ''}`.trim() : '—',
      r.checked_at ? 'Hadir' : 'Belum hadir', r.checked_at ? fmtWIB(r.checked_at, { second: '2-digit' }) : '',
      r.checked_at ? (r.method === 'manual' ? `Manual oleh ${r.marked_by_name || 'panitia'}` : 'Scan QR') : '']),
    widths: [28, 18, 16, 18, 14, 26, 24],
  });

  if (error && !data) return <div className="page"><span className="h1">Absensi</span><div className="card pad" style={{ color: '#9A2A1E' }}>Gagal memuat absensi: {error}</div></div>;
  if (!data || !form) return <div className="page"><span className="muted">Memuat absensi…</span></div>;
  const ev = data.event;
  const now = Date.now();
  const state = ev.opens_at && now < new Date(ev.opens_at).getTime() ? ['BELUM DIBUKA', '#F8E9C4', '#7A5410'] : ev.closes_at && now > new Date(ev.closes_at).getTime() ? ['DITUTUP', '#FBE4E0', '#9A2A1E'] : ['AKTIF', '#E3EFE6', '#1F4D3A'];

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="muted" style={{ fontSize: 13 }}>Peserta scan QR pakai kamera HP → login portal → tercatat hadir · daftar diperbarui tiap 10 detik</span>
          <span className="h1">Absensi Acara</span>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={exportXlsx}>Export Excel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
          <span className="chip" style={{ alignSelf: 'flex-start', background: state[1], color: state[2] }}>QR {state[0]}</span>
          {qr ? <img src={qr} alt="QR code absensi" style={{ width: '100%', maxWidth: 300, borderRadius: 12 }} /> : <div style={{ width: 300, height: 300 }} />}
          <span style={{ font: "700 16px 'Bricolage Grotesque'", textAlign: 'center' }}>{ev.name}</span>
          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{fmtWIB(ev.opens_at)} – {fmtWIB(ev.closes_at)}</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
            <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={() => setBig(true)}>Layar penuh</button>
            <a className="btn btn-ghost" style={{ justifyContent: 'center', textDecoration: 'none', color: '#1F4D3A' }} href={qr || '#'} download="QR Absensi Flourish Hub.png">Download PNG</a>
          </div>
          <button className="link" style={{ fontSize: 12, color: '#9A2A1E' }} onClick={regenerate}>↻ Buat QR baru (QR lama tidak berlaku)</button>
        </div>

        <div className="col" style={{ gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            <div style={{ background: '#1F4D3A', color: '#FBF6EA', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 13, opacity: 0.85 }}>Hadir</span>
              <span style={{ font: "800 32px 'Bricolage Grotesque'" }}>{present.length}<span style={{ fontSize: 16, opacity: 0.7 }}> / {rows.length}</span></span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{rows.length ? Math.round((present.length / rows.length) * 100) : 0}% peserta</span>
            </div>
            <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="muted" style={{ fontSize: 13 }}>Belum hadir</span>
              <span style={{ font: "800 32px 'Bricolage Grotesque'" }}>{rows.length - present.length}</span>
            </div>
            <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="muted" style={{ fontSize: 13 }}>Scan terakhir</span>
              {present.length ? (() => { const last = [...present].sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at))[0]; return <><span style={{ fontWeight: 800, fontSize: 16 }}>{last.full_name}</span><span className="muted" style={{ fontSize: 12 }}>{time(last.checked_at)} WIB</span></>; })() : <span className="muted">—</span>}
            </div>
          </div>

          <div className="card" style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <label className="col" style={{ gap: 3, flex: '1 1 200px', fontSize: 12 }}><b>Nama acara</b>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} /></label>
            <label className="col" style={{ gap: 3, fontSize: 12 }}><b>Absensi dibuka (WIB)</b>
              <input type="datetime-local" value={toLocalInput(form.opens_at)} onChange={(e) => setForm({ ...form, opens_at: fromLocalInput(e.target.value) })} style={inputStyle} /></label>
            <label className="col" style={{ gap: 3, fontSize: 12 }}><b>Ditutup (WIB)</b>
              <input type="datetime-local" value={toLocalInput(form.closes_at)} onChange={(e) => setForm({ ...form, closes_at: fromLocalInput(e.target.value) })} style={inputStyle} /></label>
            <button className="btn btn-primary" onClick={saveEvent}>Simpan jam</button>
          </div>

          {byGroup.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
              {byGroup.map(([g, rs]) => (
                <button key={g.no} className="card" onClick={() => setFGroup(fGroup === g.no ? '' : g.no)} style={{ padding: '8px 10px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, borderColor: fGroup === g.no ? '#1F4D3A' : undefined, borderWidth: fGroup === g.no ? 2 : 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: g.color }}>{g.no} {g.name}</span>
                  <span style={{ fontWeight: 800 }}>{rs.filter((r) => r.checked_at).length}<span className="muted" style={{ fontWeight: 600 }}> / {rs.length}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="row" style={{ padding: '12px 18px', borderBottom: '1px solid #E9E0CC', flexWrap: 'wrap' }}>
          <input aria-label="Cari nama" placeholder="Cari nama atau username…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inputStyle, flex: '1 1 220px' }} />
          <select aria-label="Filter status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={inputStyle}>
            <option value="">Semua status</option><option value="in">Hadir</option><option value="out">Belum hadir</option>
          </select>
          <select aria-label="Filter grup" value={fGroup} onChange={(e) => setFGroup(e.target.value)} style={inputStyle}>
            <option value="">Semua grup</option><option value="none">Tanpa grup</option>
            {(groups || []).map((g) => <option key={g.no} value={g.no}>{g.no} {g.name}</option>)}
          </select>
          <select aria-label="Filter role" value={fRole} onChange={(e) => setFRole(e.target.value)} style={inputStyle}>
            <option value="">Semua role</option>
            {ATTENDEE_ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>{shown.length} orang</span>
        </div>
        <div className="muted" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, fontSize: 12, fontWeight: 700, padding: '10px 18px', background: '#F6F0E2' }}>
          <span>Nama</span><span>Role</span><span>Grup</span><span>Status</span><span>Waktu absen</span><span />
        </div>
        {!shown.length && <div className="muted" style={{ padding: 18, fontSize: 13 }}>Tidak ada yang cocok dengan filter ini.</div>}
        {shown.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center', fontSize: 13, padding: '9px 18px', borderTop: '1px solid #F0E9DA' }}>
            <div className="col" style={{ minWidth: 0 }}><span style={{ fontWeight: 700 }}>{r.full_name || '—'}</span><span className="muted" style={{ fontSize: 11 }}>@{r.username}</span></div>
            <span>{roleName(r.role_id)}</span>
            <span>{r.group_no ? `${r.group_no} ${groupName(r.group_no) || ''}` : '—'}</span>
            <span><span className="chip" style={r.checked_at ? { background: '#E3EFE6', color: '#1F4D3A' } : { background: '#F0E9DA', color: '#6B665A' }}>{r.checked_at ? '✓ HADIR' : 'BELUM'}</span></span>
            <div className="col" style={{ minWidth: 0 }}>
              {r.checked_at ? <>
                <span style={{ fontWeight: 600 }}>{fmtWIB(r.checked_at, { second: '2-digit' })}</span>
                <span className="muted" style={{ fontSize: 11 }}>{r.method === 'manual' ? <>Manual oleh <b>{r.marked_by_name || 'panitia'}</b></> : 'Scan QR'}</span>
              </> : <span className="muted">—</span>}
            </div>
            {r.checked_at
              ? <button className="link" style={{ fontSize: 12, color: '#9A2A1E', textAlign: 'left' }} onClick={() => mark(r, false)}>Batalkan</button>
              : <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={() => mark(r, true)}>Tandai hadir</button>}
          </div>
        ))}
      </div>

      {big && (
        <div onClick={() => setBig(false)} style={{ position: 'fixed', inset: 0, background: '#FBF6EA', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, cursor: 'zoom-out' }}>
          <span style={{ font: "800 clamp(24px, 4vw, 44px) 'Bricolage Grotesque'", color: '#1F4D3A', textAlign: 'center' }}>Scan untuk absen · {ev.name}</span>
          {qr && <img src={qr} alt="QR code absensi" style={{ width: 'min(70vh, 86vw)', height: 'auto' }} />}
          <span style={{ fontSize: 'clamp(14px, 2vw, 20px)', color: '#56655C', textAlign: 'center' }}>Buka kamera HP → arahkan ke QR → login Flourish Hub → selesai ✓ · <b>{present.length}</b> hadir</span>
          <span className="muted" style={{ fontSize: 12 }}>Klik di mana saja untuk menutup</span>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: TOAST[toast[0]][0], color: TOAST[toast[0]][1], padding: '10px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13, zIndex: 60, boxShadow: '0 6px 20px rgba(0,0,0,.12)' }}>{toast[1]}</div>}
    </div>
  );
}
