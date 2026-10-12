import { useEffect, useState } from 'react';
import { ROLES } from '../lib/permissions.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useMembers } from '../lib/members.jsx';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { normalizeUsername, usernameError, suggestUsername } from '../lib/username.js';
import { GTKM_FIELDS } from '../lib/game.js';

const input = { height: 38, borderRadius: 10, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 10px', font: 'inherit', fontSize: 13, fontWeight: 500, color: '#1B2620', width: '100%' };
const field = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, minWidth: 0 };
const EDITABLE = ['full_name', 'contact_email', 'role_id', 'group_no', 'service_team', 'position', 'ministry_role', 'ig_handle', 'is_ministry_tl', 'is_committee', 'active'];

// Register a new member (admin sets the starting password) or edit an existing one.
export default function MemberDialog({ member, defaults = {}, onClose, onSaved }) {
  const { profile: me, can } = useAuth();
  const { rows, create, update, setPassword, setUsername } = useMembers();
  // Suggestions from the current roster (teams are named after their team leader in the ministry data).
  const options = (k) => [...new Set((rows || []).map((p) => p[k]).filter(Boolean))].sort();
  const GROUPS = useGame().groups || [];
  const editing = !!member;
  const canRoles = can('roles.manage');
  const self = editing && member.id === me.id;
  const roleLocked = self || (editing && member.role_id === 'super_admin' && !canRoles);

  const [f, setF] = useState(() => ({
    full_name: '', username: '', contact_email: '', password: '', role_id: 'member', group_no: '', service_team: '', position: '', ministry_role: '', ig_handle: '',
    is_ministry_tl: false, is_committee: false, active: true,
    ...defaults,
    ...(member && Object.fromEntries(Object.entries(member).map(([k, v]) => [k, v ?? '']))),
    password: '',
  }));
  const [newPw, setNewPw] = useState('');
  // Member Form answers (Get to Know Me): the answer key for R1, readable by staff only.
  const [gtkm, setGtkm] = useState({});
  const [gtkm0, setGtkm0] = useState({});
  useEffect(() => {
    if (!editing) return;
    api.getGtkm([member.id]).then((m) => { setGtkm(m[member.id] || {}); setGtkm0(m[member.id] || {}); }).catch(() => {});
  }, [editing, member?.id]);
  const gtkmChanged = GTKM_FIELDS.some(([k]) => (gtkm[k] || '').trim() !== (gtkm0[k] || '').trim());
  const saveGtkm = (id) => (gtkmChanged ? api.saveGtkm(id, Object.fromEntries(GTKM_FIELDS.map(([k]) => [k, (gtkm[k] || '').trim() || null]))) : null);
  // While registering, the username follows the name until the admin types one.
  const [userTouched, setUserTouched] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((x) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const next = { ...x, [k]: v };
    if (k === 'full_name' && !userTouched) next.username = suggestUsername(v);
    return next;
  });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clean = (k, v) => (['group_no', 'service_team', 'position', 'ministry_role', 'ig_handle', 'contact_email'].includes(k) ? (String(v).trim() || null) : k === 'full_name' ? String(v).trim() : v);
  const uname = normalizeUsername(f.username);
  const usernameChanged = editing && uname !== member.username;

  const submit = async (e) => {
    e.preventDefault();
    if (!f.full_name.trim()) return setErr('Nama wajib diisi.');
    const uErr = usernameError(f.username);
    if (uErr) return setErr(uErr);
    if (String(f.contact_email || '').trim() && !/^\S+@\S+\.\S+$/.test(String(f.contact_email).trim())) return setErr('Email kontak tidak valid (atau kosongkan).');
    if (!editing && f.password.length < 8) return setErr('Password minimal 8 karakter.');
    if (editing && newPw && newPw.length < 8) return setErr('Password baru minimal 8 karakter.');
    setBusy(true); setErr(null);
    try {
      if (!editing) {
        const fields = Object.fromEntries(EDITABLE.filter((k) => k !== 'active').map((k) => [k, clean(k, f[k])]));
        const row = await create({ ...fields, username: uname, password: f.password });
        await saveGtkm(row.id);
        onSaved(`${row.full_name} terdaftar${row.group_no ? ` di grup ${row.group_no}` : ''}. Login: @${row.username} + password awal.`);
      } else {
        const patch = {};
        EDITABLE.forEach((k) => { const v = clean(k, f[k]); if (v !== (member[k] ?? (typeof v === 'boolean' ? false : null))) patch[k] = v; });
        if (roleLocked) delete patch.role_id;
        if (self) delete patch.active;
        if (Object.keys(patch).length) await update(member.id, patch);
        if (usernameChanged) await setUsername(member.id, uname);
        if (newPw) await setPassword(member.id, newPw);
        await saveGtkm(member.id);
        onSaved(`${f.full_name.trim()} disimpan${usernameChanged ? ` · login sekarang @${uname}` : ''}${newPw ? ' · password baru aktif' : ''}${gtkmChanged ? ' · data Get to Know Me diperbarui' : ''}.`);
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
          <span className="muted" style={{ fontSize: 13 }}>{editing ? `@${member.username}` : 'Akun langsung aktif. Member masuk dengan username & password ini.'}</span>
        </div>

        <label style={field}>Nama lengkap *<input autoFocus value={f.full_name} onChange={set('full_name')} style={input} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr' : '1fr 1fr', gap: 10 }}>
          <label style={field}>Username *
            <input autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="mis. nadia.putri" value={f.username}
              onChange={(e) => { setUserTouched(true); setF((x) => ({ ...x, username: e.target.value.toLowerCase() })); }} style={input} />
            <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>
              {usernameChanged ? `Login berubah dari @${member.username} ke @${uname || '…'}. Kabari member-nya.` : 'Huruf kecil, angka, titik, garis bawah · 3–24 karakter.'}
            </span>
          </label>
          {!editing && <label style={field}>Password awal *<input type="text" autoComplete="new-password" placeholder="min. 8 karakter" value={f.password} onChange={set('password')} style={input} /></label>}
        </div>
        <label style={field}>Email kontak (opsional)<input type="email" autoComplete="off" placeholder="tidak dipakai untuk login" value={f.contact_email} onChange={set('contact_email')} style={input} /></label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <label style={field}>Grup
            <select value={f.group_no} onChange={set('group_no')} style={input}>
              <option value="">Belum ada grup</option>
              {GROUPS.map(({ no, name }) => <option key={no} value={no}>{no} {name}</option>)}
            </select>
          </label>
          <label style={field}>Role
            <select value={f.role_id} onChange={set('role_id')} disabled={roleLocked} style={input} title={self ? 'Tidak bisa mengubah role sendiri' : undefined}>
              {ROLES.filter((r) => canRoles || r.id !== 'super_admin' || f.role_id === 'super_admin').map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label style={field}>Tim asal
            <input list="md-teams" value={f.service_team} onChange={set('service_team')} placeholder="mis. Bryce Clement" style={input} />
            <datalist id="md-teams">{options('service_team').map((t) => <option key={t} value={t} />)}</datalist>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={field}>Posisi pelayanan
            <input list="md-positions" value={f.position} onChange={set('position')} placeholder="mis. Usher" style={input} />
            <datalist id="md-positions">{options('position').map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label style={field}>Status pelayanan
            <input list="md-mroles" value={f.ministry_role} onChange={set('ministry_role')} placeholder="mis. Volunteer" style={input} />
            <datalist id="md-mroles">{options('ministry_role').map((t) => <option key={t} value={t} />)}</datalist>
          </label>
        </div>
        <label style={field}>Instagram<input placeholder="@username" value={f.ig_handle} onChange={set('ig_handle')} style={input} /></label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', fontSize: 13 }}>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.is_ministry_tl} onChange={set('is_ministry_tl')} /> Ministry TL</label>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.is_committee} onChange={set('is_committee')} /> Panitia (tidak masuk grup)</label>
          {editing && !self && <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={f.active} onChange={set('active')} /> Akun aktif</label>}
        </div>

        {['member', 'group_leader', 'captain'].includes(f.role_id) && (
          <details style={{ borderRadius: 12, background: '#F6F0E2', padding: '10px 12px' }} open={GTKM_FIELDS.some(([k]) => gtkm[k])}>
            <summary style={{ fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Get to Know Me · jawaban Member Form (kunci validasi R1)</summary>
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              {GTKM_FIELDS.map(([k, label]) => (
                <label key={k} style={field}>{label}<input value={gtkm[k] || ''} onChange={(e) => setGtkm((g) => ({ ...g, [k]: e.target.value }))} style={input} /></label>
              ))}
              <span className="muted" style={{ fontSize: 11 }}>Hanya terlihat oleh panitia & validator, tidak pernah dikirim ke member.</span>
            </div>
          </details>
        )}

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
