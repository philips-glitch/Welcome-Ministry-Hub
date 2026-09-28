import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { useMembers } from '../lib/members.jsx';
import { useGame } from '../lib/gameStore.jsx';
import { groupView, validate, autoAssign, GROUP_MIN, GROUP_MAX } from '../lib/groups.js';
import MemberDialog from '../components/MemberDialog.jsx';

const RULES = [
  [`10 grup, ${GROUP_MIN}–${GROUP_MAX} anggota`, (v) => /anggota/.test(v)],
  ['Tiap grup ≥ 1 Ministry TL', (v) => /Ministry TL$/.test(v)],
  ['Tepat 1 Group Leader, bukan Ministry TL', (v) => /Group Leader/.test(v)],
  ['Tidak ada 2 orang dari tim pelayanan yang sama', (v) => /sama-sama/.test(v)],
];

export default function GroupForming() {
  const { can } = useAuth();
  const { rows, error, update, updateMany } = useMembers();
  const canEdit = can('members.manage');
  const { groups: groupRows, setLocked: persistLock } = useGame();
  // Lock & Publish is stored on the groups table; any edit re-opens it.
  const locked = !!groupRows?.length && groupRows.every((g) => g.locked_at);
  const setLocked = (v) => { if (v !== locked) persistLock(v).catch((e) => say('bad', e.message)); };
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const [dialog, setDialog] = useState(null); // { member } | { defaults }
  const [confirmAuto, setConfirmAuto] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const view = useMemo(() => groupView(rows || []), [rows]);
  const { violations, badGroups, badMembers, ok } = useMemo(() => validate(view), [view]);
  const excluded = (rows || []).filter((p) => p.active && p.is_committee);

  if (error) return <div className="page"><span className="h2">Group Forming</span><div className="card pad" style={{ color: '#9A2A1E' }}>Gagal memuat member: {error}</div></div>;
  if (!rows) return <div className="page"><span className="h2">Group Forming</span><span className="muted">Memuat member…</span></div>;

  const say = (kind, msg) => { setToast([kind, msg]); setTimeout(() => setToast((t) => (t && t[1] === msg ? null : t)), 4000); };

  const moveTo = async (groupNo, id) => {
    setOver(null); setDragId(null);
    const p = rows.find((x) => x.id === id);
    if (!p || (p.group_no || null) === groupNo) return;
    try {
      await update(id, { group_no: groupNo });
      setLocked(false);
      say('ok', `${p.full_name} → ${groupNo ? 'grup ' + groupNo : 'belum ada grup'}`);
    } catch (e) { say('bad', e.message); }
  };
  const dropProps = (groupNo) => canEdit ? {
    onDragOver: (e) => { e.preventDefault(); setOver(groupNo ?? 'none'); },
    onDragLeave: () => setOver((g) => (g === (groupNo ?? 'none') ? null : g)),
    onDrop: (e) => { e.preventDefault(); moveTo(groupNo, dragId ?? e.dataTransfer.getData('text/plain')); },
  } : {};

  const runAuto = async () => {
    const { seed, pickLeaders } = confirmAuto;
    const changes = autoAssign(view.players, seed, { pickLeaders });
    setConfirmAuto(null);
    if (!changes.length) return say('ok', 'Tidak ada perubahan.');
    setBusy(true);
    try { await updateMany(changes); setLocked(false); say('ok', `Auto-assign seed ${seed}: ${changes.length} member diperbarui.`); }
    catch (e) { say('bad', 'Sebagian gagal disimpan: ' + e.message); }
    finally { setBusy(false); }
  };

  const chip = (p, groupNo) => {
    const isL = p.role_id === 'group_leader';
    const bad = badMembers.has(p.id);
    return (
      <div
        key={p.id}
        draggable={canEdit}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setDragId(p.id); }}
        onDragEnd={() => { setDragId(null); setOver(null); }}
        onClick={() => canEdit && setDialog({ member: p })}
        title={canEdit ? 'Klik untuk edit · seret untuk pindah grup' : p.full_name}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 7, background: bad ? '#FBE4E0' : isL ? '#E3EFE6' : p.is_ministry_tl ? '#FBF1D8' : '#FBF8F0', border: `1px solid ${bad ? '#D9695A' : '#EFE7D6'}`, cursor: canEdit ? 'grab' : 'default', fontSize: 11, opacity: dragId === p.id ? 0.4 : 1 }}
      >
        <span style={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.full_name || p.email}</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: isL ? '#1F4D3A' : '#7A5410' }}>{isL ? '★ GL' : p.is_ministry_tl ? 'TL' : ''}</span>
        {groupNo !== undefined && <span className="mono muted" style={{ fontSize: 9, fontWeight: 700 }}>{p.service_team || ''}</span>}
      </div>
    );
  };

  const tls = view.players.filter((p) => p.is_ministry_tl).length;

  return (
    <div className="page" style={{ padding: '22px 26px', gap: 16 }}>
      <div className="row">
        <div className="col">
          <span className="h2">Group Forming</span>
          <span className="muted" style={{ fontSize: 13 }}>{view.players.length} peserta · {view.unassigned.length} belum ada grup · {tls} Ministry TL · {excluded.length} panitia dikecualikan</span>
        </div>
        {canEdit && (
          <>
            <button className="btn btn-ghost" style={{ marginLeft: 'auto', height: 38 }} onClick={() => setDialog({ defaults: {} })}>+ Daftarkan member</button>
            <button className="btn btn-outline" style={{ height: 38 }} disabled={busy} onClick={() => setConfirmAuto({ seed: Math.floor(Math.random() * 9000) + 1000, pickLeaders: true })}>{busy ? 'Menyimpan…' : 'Auto-assign'}</button>
          </>
        )}
        <button className="btn" disabled={!ok && !locked} onClick={() => (locked ? setLocked(false) : ok && setLocked(true))} title={locked ? 'Klik untuk membuka kunci' : undefined}
          style={{ marginLeft: canEdit ? 0 : 'auto', height: 38, fontWeight: 800, background: locked ? '#2F7A55' : ok ? '#1F4D3A' : '#E2DACA', color: ok || locked ? '#FBF6EA' : '#6B665A' }}>
          {locked ? '✓ Terkunci & dipublikasikan' : 'Lock & Publish Groups'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 10 }}>
          {view.groups.map((g) => {
            const n = g.members.length;
            const sizeBad = n < GROUP_MIN || n > GROUP_MAX;
            const isOver = over === g.no;
            return (
              <div key={g.no} {...dropProps(g.no)}
                style={{ background: isOver ? '#F3F8F4' : '#FFFDF8', border: `1.5px solid ${isOver ? '#2F7A55' : badGroups.has(g.no) ? '#E7A79C' : '#E9E0CC'}`, borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 420 }}>
                <div className="row" style={{ gap: 6, paddingBottom: 6, borderBottom: `3px solid ${g.color}` }}>
                  <span style={{ font: "800 13px 'Bricolage Grotesque'" }}>{g.no} {g.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: sizeBad ? '#B3261E' : '#E3EFE6', color: sizeBad ? '#fff' : '#1F4D3A' }}>{n}/{GROUP_MAX}</span>
                </div>
                <span className="muted" style={{ fontSize: 10 }}>Captain: {g.staff.map((p) => p.full_name).join(', ') || '—'} · TL {g.members.filter((p) => p.is_ministry_tl).length}</span>
                {g.members.map((p) => chip(p, g.no))}
                {canEdit && (
                  <button onClick={() => setDialog({ defaults: { group_no: g.no } })} style={{ marginTop: 'auto', padding: '5px 6px', borderRadius: 7, border: '1px dashed #CFC4AA', fontSize: 11, fontWeight: 700, color: '#1F4D3A' }}>+ Tambah member</button>
                )}
              </div>
            );
          })}
        </div>

        <div className="col" style={{ gap: 12 }}>
          <div {...dropProps(null)} style={{ background: over === 'none' ? '#F3F8F4' : '#FFFDF8', border: `1.5px ${view.unassigned.length ? 'solid #E3C987' : 'dashed #DCD2BC'}`, borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 280, overflowY: 'auto' }}>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ font: "700 14px 'Bricolage Grotesque'" }}>Belum ada grup</span>
              <span className="chip" style={{ marginLeft: 'auto', background: view.unassigned.length ? '#F8E9C4' : '#E3EFE6', color: view.unassigned.length ? '#7A5410' : '#1F4D3A' }}>{view.unassigned.length}</span>
            </div>
            {view.unassigned.length ? view.unassigned.map((p) => chip(p)) : <span className="muted" style={{ fontSize: 11 }}>Semua peserta sudah punya grup. Seret nama ke sini untuk mengeluarkan dari grup.</span>}
          </div>

          <div style={{ background: '#FFFDF8', border: `1.5px solid ${ok ? '#C9DECF' : '#E7A79C'}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ font: "700 15px 'Bricolage Grotesque'" }}>Cek aturan</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: ok ? '#E3EFE6' : '#FBE4E0', color: ok ? '#1F4D3A' : '#9A2A1E' }}>{ok ? 'SEMUA OK' : violations.length + ' MASALAH'}</span>
            </div>
            <div className="col" style={{ gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {violations.map((v) => (
                <div key={v} style={{ display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 10, background: '#FBE4E0', fontSize: 12, lineHeight: 1.4, color: '#7A1F16' }}><span style={{ fontWeight: 900 }}>!</span><span>{v}</span></div>
              ))}
            </div>
            {[...RULES.map(([label, f]) => [label, violations.some(f)]), ['Panitia & staf dikecualikan dari hitungan', false]].map(([label, bad]) => (
              <div key={label} style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.4 }}>
                <span style={{ fontWeight: 900, color: bad ? '#B3261E' : '#2F7A55' }}>{bad ? '✕' : '✓'}</span><span style={{ color: '#3C4A42' }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: "700 14px 'Bricolage Grotesque'" }}>Dikecualikan · panitia ({excluded.length})</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {excluded.map((p) => <span key={p.id} className="muted" style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 7, background: '#EDE6D6' }}>{p.full_name}</span>)}
            </div>
          </div>
          <div className="card" style={{ borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#3C4A42' }}>
            <span style={{ font: "700 14px 'Bricolage Grotesque'", color: '#1B2620' }}>Legenda</span>
            <span><b style={{ color: '#7A5410' }}>TL</b> Ministry TL (peran di tim pelayanan)</span>
            <span><b style={{ color: '#1F4D3A' }}>★ GL</b> Group Leader (tidak boleh TL)</span>
            <span><b className="mono">LB</b> kode tim pelayanan</span>
            <span>Garis merah = melanggar aturan</span>
            {canEdit && <span>Klik nama untuk edit · seret untuk pindah</span>}
          </div>
        </div>
      </div>

      {dialog && <MemberDialog member={dialog.member} defaults={dialog.defaults} onClose={() => setDialog(null)} onSaved={(msg) => { setDialog(null); setLocked(false); say('ok', msg); }} />}
      {confirmAuto && (
        <div role="dialog" aria-modal="true" aria-label="Konfirmasi auto-assign" onClick={() => setConfirmAuto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, background: '#FFFDF8', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ font: "800 20px 'Bricolage Grotesque'", color: '#1F4D3A' }}>Undi ulang semua grup?</span>
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {view.players.length} peserta akan disebar ulang ke 10 grup (seed <b className="mono">{confirmAuto.seed}</b>). Grup yang sudah diatur manual akan tertimpa.
            </span>
            <label className="row" style={{ gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={confirmAuto.pickLeaders} onChange={(e) => setConfirmAuto((c) => ({ ...c, pickLeaders: e.target.checked }))} />
              Pilih ulang Group Leader otomatis (1 per grup, bukan TL)
            </label>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmAuto(null)}>Batal</button>
              <button className="btn btn-primary" onClick={runAuto}>Undi & simpan</button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div role="status" onClick={() => setToast(null)} style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 30, maxWidth: 420, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 30px -12px rgba(20,40,31,.35)', background: toast[0] === 'ok' ? '#E3EFE6' : '#FBE4E0', color: toast[0] === 'ok' ? '#1F4D3A' : '#9A2A1E' }}>{toast[1]}</div>
      )}
    </div>
  );
}
