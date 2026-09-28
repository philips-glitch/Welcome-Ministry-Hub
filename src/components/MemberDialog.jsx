import { useEffect, useState } from 'react';
import { ROLES } from '../lib/permissions.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useMembers } from '../lib/members.jsx';
import { api } from '../lib/api.js';
import { GROUPS, TEAMS } from '../data.js';

const input = { height: 38, borderRadius: 10, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 10px', font: 'inherit', fontSize: 13, fontWeight: 500, color: '#1B2620', width: '100%' };
const field = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, minWidth: 0 };
const EDITABLE = ['full_name', 'role_id', 'group_no', 'service_team', 'ig_handle', 'is_ministry_tl', 'is_committee', 'active'];

// Register a new member (admin sets the starting password) or edit an existing one.
export default function MemberDialog({ member, defaults = {}, onClose, onSaved }) {
  const { profile: me, can } = useAuth();
  const { create, update, setPassword } = useMembers();
  const editing = !!member;
  const canRoles = can('roles.manage');
  const self = editing && member.id === me.id;
  const roleLocked = self || (editing && member.role_id === 'super_admin' && !canRoles);

  const [f, setF] = useState(() => ({
    full_name: '', email: '', password: '', role_id: 'member', group_no: '', service_team: '', ig_handle: '',
    is_ministry_tl: false, is_committee: false, active: true,
    ...defaults,
    ...(member && Object.fromEntries(Object.entries(member).map(([k, v]) => [k, v ?? '']))),
    password: '',
  }));
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clean = (k, v) => (['group_no', 'service_team', 'ig_handle'].includes(k) ? (String(v).trim() || null) : k === 'full_name' ? String(v).trim() : v);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) return setErr('Nama wajib diisi.');
    if (!editing && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Email tidak valid.');
    if (!editing && f.password.length < 8) return setErr('Password minimal 8 karakter.');
    if (editing && newPw && newPw.length < 8) return setErr('Password baru minimal 8 karakter.');
    setBusy(true); setErr(null);
    try {
      if (!editing) {
        const fields = Object.fromEntries(EDITABLE.filter((k) => k !== 'active').map((k) => [k, clean(k, f[k])]));
        const row = await create({ ...fields, email: f.email.trim().toLowerCase(), password: f.password });
        onSaved(`${row.full_name} terdaftar${row.group_no ? ` di grup ${row.group_no}` : ''}. Berikan email & password ke member.`);
      } else {
        const patch = {};
        EDITABLE.forEach((k) => { const v = clean(k, f[k]); if (v !== (member[k] ?? (typeof v === 'boolean' ? false : null))) patch[k] = v; });
        if (roleLocked) delete patch.role_id;
        if (self) delete patch.active;
        if (Object.keys(patch).length) await update(member.id, patch);
        if (newPw) await setPassword(member.id, newPw);
        onSaved(`${f.full_name.trim()} disimpan${newPw ? ' · password baru aktif' : ''}.`);
      }
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={editing ? 'Edit member' : 'Daftarkan member'} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} noValidate
        style={{ width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#FFFDF8', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#1F4D3A' }}>{editing ? 'Edit member' : 'Daftarkan member'}</span>
          <span className="muted" style={{ fontSize: 13 }}>{editing ? member.email : 'Akun langsung aktif. Member masuk dengan email & password ini.'}</span>
        </div>

        <label style={field}>Nama lengkap *<input autoFocus value={f.full_name} onChange={set('full_name')} style={input} /></label>
        {!editing && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={field}>Email *<input type="email" autoComplete="off" value={f.email} onChange={set('email')} style={input} /></label>
            <label style={field}>Password awal *<input type="text" autoComplete="new-password" placeholder="min. 8 karakter" value={f.password} onChange={set('password')} style={input} /></label>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label style={field}>Grup
            <select value={f.group_no} onChange={set('group_no')} style={input}>
              <option value="">Belum ada grup</option>
              {GROUPS.map(([no, name]) => <option key={no} value={no}>{no} {name}</option>)}
            </select>
          </label>
          <label style={field}>Role
            <select value={f.role_id} onChange={set('role_id')} disabled={roleLocked} style={input} title={self ? 'Tidak bisa mengubah role sendiri' : undefined}>
              {ROLES.filter((r) => canRoles || r.id !== 'super_admin' || f.role_id === 'super_admin').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label style={field}>Tim pelayanan
            <select value={f.service_team} onChange={set('service_team')} style={input}>
              <option value="">—</option>
              {TEAMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <label style={field}>Instagram<input placeholder="@username" value={f.ig_handle} onChange={set('ig_handle')} style={input} /></label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 13 }}>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.is_ministry_tl} onChange={set('is_ministry_tl')} /> Ministry TL</label>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.is_committee} onChange={set('is_committee')} /> Panitia (tidak masuk grup)</label>
          {editing && !self && <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Akun aktif</label>}
        </div>

        {editing && (
          <div className="col" style={{ gap: 6, padding: 12, borderRadius: 12, background: '#F6F0E2' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Reset password</span>
            <input type="text" autoComplete="new-password" placeholder="Kosongkan kalau tidak diganti · min. 8 karakter" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={input} />
            <span className="muted" style={{ fontSize: 11 }}>{api.mode === 'demo' ? 'Mode demo: password disimpan di browser ini saja.' : 'Password lama langsung tidak berlaku.'}</span>
          </div>
        )}

        {err && <div role="alert" style={{ background: '#FBE4E0', color: '#9A2A1E', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : editing ? 'Simpan' : 'Daftarkan'}</button>
        </div>
      </form>
    </div>
  );
}
