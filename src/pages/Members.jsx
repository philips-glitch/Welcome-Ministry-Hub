import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { ROLES, roleName } from '../lib/permissions.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { GROUPS, TEAMS } from '../data.js';

const PAGE = 25;
const COLS = 'minmax(200px,1.6fr) 150px 130px 80px 90px 90px';
const inputStyle = { height: 36, borderRadius: 10, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 10px', font: 'inherit', fontSize: 13 };

export default function Members() {
  const { can, profile: me, refresh } = useAuth();
  const canManage = can('members.manage');
  const canRoles = can('roles.manage');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [fRole, setFRole] = useState('');
  const [fGroup, setFGroup] = useState('');
  const [fStatus, setFStatus] = useState('active');
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState(null);
  const [inviting, setInviting] = useState(false);

  const load = () => api.listProfiles().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => setPage(0), [q, fRole, fGroup, fStatus]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!s || (r.full_name || '').toLowerCase().includes(s) || r.email.toLowerCase().includes(s) || (r.ig_handle || '').toLowerCase().includes(s)) &&
      (!fRole || r.role_id === fRole) &&
      (!fGroup || (fGroup === 'none' ? !r.group_no : r.group_no === fGroup)) &&
      (fStatus === 'all' || (fStatus === 'active' ? r.active : !r.active)));
  }, [rows, q, fRole, fGroup, fStatus]);

  const update = async (row, patch, msg) => {
    try {
      const next = await api.updateProfile(row.id, patch);
      setRows((rs) => rs.map((r) => (r.id === row.id ? next : r)));
      setToast(['ok', msg]);
      if (row.id === me.id) refresh();
    } catch (e) { setToast(['bad', e.message]); }
  };

  const counts = useMemo(() => {
    const c = { all: 0, active: 0 };
    (rows || []).forEach((r) => { c.all++; if (r.active) { c.active++; c[r.role_id] = (c[r.role_id] || 0) + 1; } });
    return c;
  }, [rows]);

  if (error) return <div className="page"><span className="h1">Members</span><div className="card pad" style={{ color: '#9A2A1E' }}>Gagal memuat member: {error}</div></div>;

  const shown = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="muted" style={{ fontSize: 13 }}>{rows ? `${counts.active} aktif dari ${counts.all} akun` : 'Memuat…'}{api.mode === 'demo' ? ' · data demo' : ''}</span>
          <span className="h1">Member Management</span>
        </div>
        {canManage && <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setInviting(true)}>+ Undang member</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ROLES.length},1fr)`, gap: 10 }}>
        {ROLES.map((r) => (
          <button key={r.id} onClick={() => setFRole(fRole === r.id ? '' : r.id)} className="card" style={{ padding: '12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, borderColor: fRole === r.id ? '#1F4D3A' : undefined, borderWidth: fRole === r.id ? 2 : 1 }}>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{r.name}</span>
            <span style={{ font: "800 24px 'Bricolage Grotesque'" }}>{counts[r.id] || 0}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="row" style={{ padding: '12px 18px', borderBottom: '1px solid #E9E0CC', flexWrap: 'wrap' }}>
          <input aria-label="Cari member" placeholder="Cari nama, email, atau IG…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inputStyle, flex: '1 1 240px' }} />
          <select aria-label="Filter role" value={fRole} onChange={(e) => setFRole(e.target.value)} style={inputStyle}>
            <option value="">Semua role</option>
            {ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select aria-label="Filter grup" value={fGroup} onChange={(e) => setFGroup(e.target.value)} style={inputStyle}>
            <option value="">Semua grup</option>
            <option value="none">Tanpa grup</option>
            {GROUPS.map(([no, name]) => <option key={no} value={no}>{no} {name}</option>)}
          </select>
          <select aria-label="Filter status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={inputStyle}>
            <option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="all">Semua status</option>
          </select>
        </div>

        <div className="muted" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, fontSize: 12, fontWeight: 700, padding: '10px 18px', background: '#F6F0E2' }}>
          <span>Member</span><span>Role</span><span>Grup</span><span>Tim</span><span>Flag</span><span>Status</span>
        </div>
        {!rows && <div className="muted" style={{ padding: 18, fontSize: 13 }}>Memuat member…</div>}
        {rows && !shown.length && <div className="muted" style={{ padding: 18, fontSize: 13 }}>Tidak ada member yang cocok dengan filter ini.</div>}
        {shown.map((r) => {
          const self = r.id === me.id;
          const roleLocked = !canManage || self || ((r.role_id === 'super_admin') && !canRoles);
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'center', fontSize: 13, padding: '9px 18px', borderTop: '1px solid #F0E9DA', opacity: r.active ? 1 : 0.55 }}>
              <div className="col" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{r.full_name || '—'}{self && <span className="chip" style={{ marginLeft: 6, background: '#E3EFE6', color: '#1F4D3A' }}>KAMU</span>}</span>
                <span className="muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}{r.ig_handle ? ' · ' + r.ig_handle : ''}</span>
              </div>
              {roleLocked ? <span>{roleName(r.role_id)}</span> : (
                <select aria-label={`Role ${r.full_name}`} value={r.role_id} onChange={(e) => update(r, { role_id: e.target.value }, `${r.full_name} → ${roleName(e.target.value)}`)} style={{ ...inputStyle, height: 32 }}>
                  {ROLES.filter((x) => canRoles || x.id !== 'super_admin').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              )}
              {canManage ? (
                <select aria-label={`Grup ${r.full_name}`} value={r.group_no || ''} onChange={(e) => update(r, { group_no: e.target.value || null }, `${r.full_name} dipindah grup`)} style={{ ...inputStyle, height: 32 }}>
                  <option value="">—</option>
                  {GROUPS.map(([no, name]) => <option key={no} value={no}>{no} {name}</option>)}
                </select>
              ) : <span>{r.group_no ? `${r.group_no} ${GROUPS[+r.group_no - 1][1]}` : '—'}</span>}
              <span className="mono muted" style={{ fontSize: 12 }}>{r.service_team || '—'}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                {r.is_ministry_tl && <span className="chip" style={{ background: '#FBF1D8', color: '#7A5410' }}>TL</span>}
                {r.is_committee && <span className="chip" style={{ background: '#EDE6D6', color: '#56655C' }}>PANITIA</span>}
              </span>
              {canManage && !self ? (
                <button onClick={() => update(r, { active: !r.active }, `${r.full_name} ${r.active ? 'dinonaktifkan' : 'diaktifkan'}`)} className="chip" style={{ fontSize: 11, padding: '5px 10px', justifySelf: 'start', background: r.active ? '#E3EFE6' : '#FBE4E0', color: r.active ? '#1F4D3A' : '#9A2A1E' }}>
                  {r.active ? 'Aktif' : 'Nonaktif'}
                </button>
              ) : <span className="chip" style={{ justifySelf: 'start', background: r.active ? '#E3EFE6' : '#FBE4E0', color: r.active ? '#1F4D3A' : '#9A2A1E' }}>{r.active ? 'AKTIF' : 'NONAKTIF'}</span>}
            </div>
          );
        })}
        <div className="row" style={{ padding: '10px 18px', borderTop: '1px solid #F0E9DA', background: '#FBF8F0', fontSize: 12 }}>
          <span className="muted">{filtered.length ? `${page * PAGE + 1}–${Math.min(filtered.length, page * PAGE + PAGE)} dari ${filtered.length}` : '0 hasil'}</span>
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', height: 32 }} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹ Sebelumnya</button>
          <button className="btn btn-ghost" style={{ height: 32 }} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Berikutnya ›</button>
        </div>
      </div>

      {!canManage && <span className="muted" style={{ fontSize: 12 }}>Kamu hanya bisa melihat. Mengubah member butuh hak “Undang, ubah & nonaktifkan member”.</span>}
      {toast && (
        <div role="status" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 30, maxWidth: 420, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 30px -12px rgba(20,40,31,.35)', background: toast[0] === 'ok' ? '#E3EFE6' : '#FBE4E0', color: toast[0] === 'ok' ? '#1F4D3A' : '#9A2A1E' }} onClick={() => setToast(null)}>
          {toast[1]}
        </div>
      )}
      {inviting && <InviteDialog canRoles={canRoles} onClose={() => setInviting(false)} onDone={(row) => { setInviting(false); setToast(['ok', api.mode === 'demo' ? `${row.full_name} ditambahkan (demo, tanpa email)` : `Undangan dikirim ke ${row.email}`]); load(); }} />}
    </div>
  );
}

function InviteDialog({ canRoles, onClose, onDone }) {
  const [f, setF] = useState({ email: '', full_name: '', role_id: 'member', group_no: '', service_team: '', is_ministry_tl: false, is_committee: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Email tidak valid.');
    setBusy(true); setErr(null);
    try { onDone(await api.inviteMember({ ...f, full_name: f.full_name.trim() || null, group_no: f.group_no || null, service_team: f.service_team || null })); }
    catch (x) { setErr(x.message); setBusy(false); }
  };

  const field = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700 };
  return (
    <div role="dialog" aria-modal="true" aria-label="Undang member" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: 460, background: '#FFFDF8', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#1F4D3A' }}>Undang member</span>
          <span className="muted" style={{ fontSize: 13 }}>{api.mode === 'demo' ? 'Mode demo: akun langsung ditambahkan tanpa email.' : 'Member akan menerima magic link untuk masuk.'}</span>
        </div>
        <label style={field}>Email *<input autoFocus type="email" value={f.email} onChange={set('email')} style={inputStyle} /></label>
        <label style={field}>Nama lengkap<input value={f.full_name} onChange={set('full_name')} style={inputStyle} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label style={field}>Role
            <select value={f.role_id} onChange={set('role_id')} style={inputStyle}>{ROLES.filter((r) => canRoles || r.id !== 'super_admin').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          </label>
          <label style={field}>Grup
            <select value={f.group_no} onChange={set('group_no')} style={inputStyle}><option value="">—</option>{GROUPS.map(([no, name]) => <option key={no} value={no}>{no} {name}</option>)}</select>
          </label>
          <label style={field}>Tim pelayanan
            <select value={f.service_team} onChange={set('service_team')} style={inputStyle}><option value="">—</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
        </div>
        <div className="row" style={{ gap: 18, fontSize: 13 }}>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.is_ministry_tl} onChange={set('is_ministry_tl')} /> Ministry TL</label>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.is_committee} onChange={set('is_committee')} /> Panitia (tidak masuk grup)</label>
        </div>
        {err && <div role="alert" style={{ background: '#FBE4E0', color: '#9A2A1E', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Mengirim…' : api.mode === 'demo' ? 'Tambah member' : 'Kirim undangan'}</button>
        </div>
      </form>
    </div>
  );
}
