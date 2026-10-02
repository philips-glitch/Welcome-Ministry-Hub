import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { useMembers } from '../lib/members.jsx';
import { roleName } from '../lib/permissions.js';
import { GROUP_MIN, GROUP_MAX } from '../lib/groups.js';

const PALETTE = ['#7F8F24', '#2A8C82', '#C4533F', '#8A4FA3', '#C98A12', '#D0577E', '#3E86C9', '#9A6435', '#4E9A55', '#5C63B8', '#B5446E', '#2F6F8F', '#8C7A2B', '#6B5BA8'];
const input = { height: 38, borderRadius: 10, border: '1px solid #DCD2BC', background: '#FFFDF8', padding: '0 10px', font: 'inherit', fontSize: 13, fontWeight: 500, color: '#1B2620', width: '100%' };
const field = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, minWidth: 0 };
const pad = (v) => String(v).trim().padStart(2, '0');

// Create or edit a group: number, name, colour, size limits and captains (staff whose profile
// points at the group). Edit mode can also delete — blocked once the group has submissions.
export default function GroupDialog({ group, onClose, onSaved }) {
  const { groups, createGroup, updateGroup, deleteGroup } = useGame();
  const { rows: members, updateMany, reload: reloadMembers } = useMembers();
  const editing = !!group;
  const all = groups || [];
  const staff = useMemo(() => (members || []).filter((p) => p.active && !['member', 'group_leader'].includes(p.role_id)).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')), [members]);
  const nextNo = pad(Math.max(0, ...all.map((g) => Number(g.no) || 0)) + 1);
  const unusedColor = PALETTE.find((c) => !all.some((g) => g.color.toLowerCase() === c.toLowerCase())) || PALETTE[0];

  const [f, setF] = useState(() => ({
    no: group?.no ?? nextNo, name: group?.name ?? '', color: group?.color ?? unusedColor,
    min_size: group?.min ?? GROUP_MIN, max_size: group?.max ?? GROUP_MAX,
  }));
  const [captains, setCaptains] = useState(() => new Set(editing ? staff.filter((p) => p.group_no === group.no).map((p) => p.id) : []));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [subCount, setSubCount] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Deleting is only allowed for a group without submission history.
  useEffect(() => { if (editing) api.listSubmissions({ groupNo: group.no }).then((r) => setSubCount(r.length)).catch(() => setSubCount(null)); }, [editing, group?.no]);

  const problems = () => {
    if (!/^\d{1,3}$/.test(String(f.no).trim())) return 'Nomor grup harus angka (1–3 digit).';
    const no = pad(f.no);
    if (all.some((g) => g.no === no && g.no !== group?.no)) return `Nomor ${no} sudah dipakai.`;
    if (!f.name.trim()) return 'Nama grup wajib diisi.';
    if (all.some((g) => g.name.trim().toLowerCase() === f.name.trim().toLowerCase() && g.no !== group?.no)) return `Nama “${f.name.trim()}” sudah dipakai.`;
    const min = Number(f.min_size), max = Number(f.max_size);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1) return 'Batas anggota harus angka bulat.';
    if (max < min) return 'Maksimal anggota tidak boleh lebih kecil dari minimal.';
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const bad = problems();
    if (bad) return setErr(bad);
    setBusy(true); setErr(null);
    const row = { no: pad(f.no), name: f.name.trim(), color: f.color, min_size: Number(f.min_size), max_size: Number(f.max_size) };
    try {
      if (editing) await updateGroup(group.no, row); else await createGroup(row);
      // Captains: point checked staff at this group; un-point staff that were unchecked.
      // (A renumber already moved the old captains with it.)
      const changes = [];
      staff.forEach((p) => {
        const was = p.group_no === (editing ? group.no : row.no);
        const now = captains.has(p.id);
        if (now && (p.group_no !== row.no)) changes.push([p.id, { group_no: row.no }]);
        else if (!now && was) changes.push([p.id, { group_no: null }]);
      });
      if (changes.length) await updateMany(changes);
      // A renumber moved members in the DB too; refresh so the board shows them in place.
      if (editing && row.no !== group.no) await reloadMembers();
      onSaved(editing ? `Grup ${row.no} ${row.name} disimpan.` : `Grup ${row.no} ${row.name} dibuat. Tambahkan member atau jalankan Auto-assign.`);
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setErr(null);
    try { await deleteGroup(group.no); await reloadMembers(); onSaved(`Grup ${group.no} ${group.name} dihapus. ${group.members.length} member pindah ke “Belum ada grup”.`); }
    catch (x) { setErr(x.message); setBusy(false); setConfirmDel(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={editing ? 'Edit grup' : 'Grup baru'} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} noValidate
        style={{ width: 540, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#FFFDF8', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: f.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 15px 'Bricolage Grotesque'", flex: 'none' }}>{(f.name.trim() || '?')[0].toUpperCase()}</span>
          <div className="col" style={{ gap: 2 }}>
            <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#1F4D3A' }}>{editing ? `Edit grup ${group.no}` : 'Grup baru'}</span>
            <span className="muted" style={{ fontSize: 13 }}>{editing ? `${group.members.length} anggota · ${group.leaders.length ? 'Leader ' + group.leaders.map((p) => p.full_name).join(', ') : 'belum ada Group Leader'}` : 'Grup kosong; isi lewat drag, “+ Tambah member”, atau Auto-assign.'}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10 }}>
          <label style={field}>Nomor<input inputMode="numeric" value={f.no} onChange={set('no')} onBlur={() => /^\d+$/.test(f.no) && setF((x) => ({ ...x, no: pad(x.no) }))} style={input} /></label>
          <label style={field}>Nama grup *<input autoFocus value={f.name} onChange={set('name')} placeholder="mis. Cypress" style={input} /></label>
        </div>

        <div style={field}>Warna
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {PALETTE.map((c) => {
              const usedBy = all.find((g) => g.color.toLowerCase() === c.toLowerCase() && g.no !== group?.no);
              return (
                <button type="button" key={c} onClick={() => setF((x) => ({ ...x, color: c }))} title={usedBy ? `Dipakai ${usedBy.no} ${usedBy.name}` : c} aria-label={`Warna ${c}`} aria-pressed={f.color === c}
                  style={{ width: 28, height: 28, borderRadius: 8, background: c, boxShadow: f.color === c ? '0 0 0 2px #FFFDF8, 0 0 0 4px #1F4D3A' : 'none', opacity: usedBy ? 0.45 : 1 }} />
              );
            })}
            <label className="row muted" style={{ gap: 6, fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
              lainnya<input type="color" value={f.color} onChange={set('color')} style={{ width: 34, height: 28, border: 'none', background: 'none', padding: 0 }} />
            </label>
          </div>
          <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>Warna pudar = sudah dipakai grup lain.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={field}>Minimal anggota<input type="number" min="0" value={f.min_size} onChange={set('min_size')} style={input} /></label>
          <label style={field}>Maksimal anggota<input type="number" min="1" value={f.max_size} onChange={set('max_size')} style={input} /></label>
        </div>

        <div style={field}>Captain
          <div style={{ border: '1px solid #E9E0CC', borderRadius: 12, maxHeight: 180, overflowY: 'auto' }}>
            {!staff.length && <span className="muted" style={{ display: 'block', padding: 10, fontSize: 12, fontWeight: 500 }}>Belum ada staf (Captain / PIC) aktif.</span>}
            {staff.map((p, i) => {
              const elsewhere = p.group_no && p.group_no !== group?.no && all.find((g) => g.no === p.group_no);
              return (
                <label key={p.id} className="row" style={{ gap: 8, padding: '8px 10px', borderTop: i ? '1px solid #F0E9DA' : 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  <input type="checkbox" checked={captains.has(p.id)} onChange={(e) => setCaptains((c) => { const n = new Set(c); e.target.checked ? n.add(p.id) : n.delete(p.id); return n; })} />
                  <span style={{ flex: 1 }}>{p.full_name}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{roleName(p.role_id)}{elsewhere ? ` · sekarang ${elsewhere.no} ${elsewhere.name}` : ''}</span>
                </label>
              );
            })}
          </div>
          <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>Satu staf hanya bisa jadi captain satu grup; memilihnya di sini memindahkan dari grup lamanya.</span>
        </div>

        {err && <div role="alert" style={{ background: '#FBE4E0', color: '#9A2A1E', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{err}</div>}

        {confirmDel ? (
          <div className="col" style={{ gap: 10, padding: 12, borderRadius: 12, background: '#FBE4E0' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#9A2A1E' }}>Hapus grup {group.no} {group.name}?</span>
            <span style={{ fontSize: 13, color: '#7A1F16', lineHeight: 1.45 }}>{group.members.length} anggota dan captain-nya pindah ke “Belum ada grup”. Undian riddle & notifikasi grup ini ikut terhapus.</span>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDel(false)}>Batal</button>
              <button type="button" className="btn" disabled={busy} style={{ background: '#9A2A1E', color: '#fff' }} onClick={remove}>{busy ? 'Menghapus…' : 'Hapus grup'}</button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            {editing && (
              <button type="button" className="btn" disabled={subCount !== 0} onClick={() => setConfirmDel(true)} style={{ color: '#9A2A1E', paddingLeft: 0 }}
                title={subCount ? `Grup ini punya ${subCount} submission, jadi tidak bisa dihapus` : undefined}>
                {subCount == null ? 'Memeriksa…' : subCount ? `Tidak bisa dihapus · ${subCount} submission` : 'Hapus grup'}
              </button>
            )}
            <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : editing ? 'Simpan' : 'Buat grup'}</button>
          </div>
        )}
      </form>
    </div>
  );
}
