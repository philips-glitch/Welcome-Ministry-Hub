import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useMembers } from '../lib/members.jsx';
import { useGame } from '../lib/gameStore.jsx';
import { randomPassword, credentialsSheet } from '../lib/roster.js';
import { downloadXlsx } from '../lib/xlsxWrite.js';
import { readSheets } from '../lib/xlsx.js';
import { roleName } from '../lib/permissions.js';

const ROLES = ['captain', 'group_leader', 'challenge_pic'];

// Members → Buat password: a new 8-character alphanumeric password for every active account in the chosen
// roles — or the passwords from an existing login list — set on the accounts right away, plus an Excel
// login list (username, role, password) to hand out.
export default function PasswordBatchDialog({ onClose, onDone }) {
  const { rows, setPassword } = useMembers();
  const { groupOf } = useGame();
  const [pick, setPick] = useState(() => new Set(ROLES));
  const [sure, setSure] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const locked = !!progress; // running or showing the passwords: only the buttons close it

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !locked && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, locked]);

  // 'new' = random passwords per role · 'file' = the passwords listed in an Excel login list (Username + Password).
  const [mode, setMode] = useState('new');
  const [fromFile, setFromFile] = useState(null); // { name, map: Map<id, password>, unknown: [], weak: [] }
  const [fileErr, setFileErr] = useState(null);
  const readList = async (file) => {
    setFileErr(null); setFromFile(null);
    if (!file) return;
    try {
      for (const { rows: cells } of await readSheets(file)) {
        const hi = cells.findIndex((r) => r.some((c) => /^username/i.test(c.trim())) && r.some((c) => /^password/i.test(c.trim())));
        if (hi < 0) continue;
        const ui = cells[hi].findIndex((c) => /^username/i.test(c.trim())), pi = cells[hi].findIndex((c) => /^password/i.test(c.trim()));
        const map = new Map(), unknown = [], weak = [];
        cells.slice(hi + 1).forEach((r) => {
          const u = (r[ui] || '').trim().toLowerCase().replace(/^@/, ''), pw = (r[pi] || '').trim();
          if (!u) return;
          const acc = (rows || []).find((p) => p.username === u && p.active && p.role_id !== 'super_admin');
          if (!acc) unknown.push(u); else if (pw.length < 8) weak.push(u); else map.set(acc.id, pw);
        });
        return setFromFile({ name: file.name, map, unknown, weak });
      }
      setFileErr('Tidak ketemu kolom “Username” dan “Password” di file ini.');
    } catch (e) { setFileErr(e.message); }
  };

  const order = (a, b) => ROLES.indexOf(a.role_id) - ROLES.indexOf(b.role_id) || (a.group_no || 'zz').localeCompare(b.group_no || 'zz') || (a.full_name || '').localeCompare(b.full_name || '');
  const targets = (rows || []).filter((p) => (mode === 'file' ? fromFile?.map.has(p.id) : p.active && pick.has(p.role_id))).sort(order);
  const count = (role) => (rows || []).filter((p) => p.active && p.role_id === role).length;

  const run = async () => {
    setProgress([0, targets.length]);
    const done = [], failed = [];
    for (const p of targets) {
      const password = mode === 'file' ? fromFile.map.get(p.id) : randomPassword(8);
      try { await setPassword(p.id, password); done.push({ ...p, password }); }
      catch (e) { failed.push({ ...p, error: e.message }); }
      setProgress([done.length + failed.length, targets.length]);
    }
    setResult({ done, failed });
  };
  const download = () => downloadXlsx(`password-flourish-hub-${new Date().toISOString().slice(0, 10)}.xlsx`,
    credentialsSheet(result.done, roleName, (no) => (groupOf(no) ? `${no} ${groupOf(no).name}` : no)));

  return (
    <div role="dialog" aria-modal="true" aria-label="Buat password" onClick={() => !locked && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#FFFDF8', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#1F4D3A' }}>Buat password</span>
          <span className="muted" style={{ fontSize: 13 }}>Password 8 karakter (huruf & angka) untuk akun di role yang dipilih — atau dari daftar login Excel yang sudah ada — langsung berlaku. Hasilnya bisa diunduh sebagai Excel.</span>
        </div>

        {result ? (
          <>
            <div style={{ background: '#E3EFE6', color: '#1F4D3A', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 700 }}>
              ✓ {result.done.length} password baru aktif{result.failed.length ? ` · ${result.failed.length} gagal` : ''}
            </div>
            {result.failed.length > 0 && (
              <div style={{ background: '#FBE4E0', color: '#9A2A1E', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{result.failed.map((f) => <li key={f.id}>{f.full_name} (@{f.username}): {f.error}</li>)}</ul>
              </div>
            )}
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Unduh Excel-nya sekarang: password tidak bisa dilihat lagi setelah dialog ini ditutup (bisa dibuat ulang).
              {api.mode === 'demo' ? ' Mode demo: password ini hanya berlaku di browser ini.' : ''}
            </span>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={download} disabled={!result.done.length}>Unduh Excel</button>
              <button className="btn btn-primary" onClick={() => onDone(`${result.done.length} password baru aktif.`)}>Selesai</button>
            </div>
          </>
        ) : (
          <>
            <div role="radiogroup" aria-label="Sumber password" style={{ display: 'flex', background: '#EDE6D6', borderRadius: 10, padding: 3, gap: 2, alignSelf: 'flex-start' }}>
              {[['new', 'Buat password baru'], ['file', 'Pakai dari file Excel']].map(([k, l]) => (
                <button key={k} role="radio" aria-checked={mode === k} disabled={locked} onClick={() => setMode(k)} style={{ fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 8, background: mode === k ? '#1F4D3A' : 'transparent', color: mode === k ? '#FBF6EA' : '#56655C' }}>{l}</button>
              ))}
            </div>
            {mode === 'new' ? (
              <div className="col" style={{ gap: 8 }}>
                {ROLES.map((r) => (
                  <label key={r} className="row" style={{ gap: 8, fontSize: 14, fontWeight: 600 }}>
                    <input type="checkbox" checked={pick.has(r)} disabled={locked} onChange={(e) => setPick((s) => { const n = new Set(s); e.target.checked ? n.add(r) : n.delete(r); return n; })} />
                    {roleName(r)} <span className="muted" style={{ fontWeight: 500 }}>· {count(r)} akun</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="col" style={{ gap: 8 }}>
                <label className="col" style={{ gap: 6, fontSize: 12, fontWeight: 700 }}>Daftar login (.xlsx / .csv) dengan kolom “Username” dan “Password”
                  <input type="file" accept=".xlsx,.csv" disabled={locked} onChange={(e) => readList(e.target.files?.[0])} />
                </label>
                {fileErr && <span role="alert" style={{ color: '#9A2A1E', fontSize: 13, fontWeight: 600 }}>{fileErr}</span>}
                {fromFile && (
                  <span style={{ fontSize: 13 }}>
                    <b>{fromFile.map.size} akun cocok</b>
                    {fromFile.unknown.length > 0 && <span style={{ color: '#9A2A1E' }}> · tidak ditemukan / nonaktif / Super Admin: {fromFile.unknown.map((u) => '@' + u).join(', ')}</span>}
                    {fromFile.weak.length > 0 && <span style={{ color: '#9A2A1E' }}> · password kurang dari 8 karakter (dilewati): {fromFile.weak.map((u) => '@' + u).join(', ')}</span>}
                  </span>
                )}
              </div>
            )}
            {targets.length > 0 && (
              <div className="card" style={{ padding: '8px 12px', fontSize: 12, lineHeight: 1.6, maxHeight: 150, overflowY: 'auto' }}>
                {targets.map((p) => <span key={p.id} style={{ display: 'inline-block', marginRight: 10 }}>@{p.username}</span>)}
              </div>
            )}
            {mode === 'new' && !count('group_leader') && pick.has('group_leader') && <span className="muted" style={{ fontSize: 12 }}>Belum ada Group Leader — pilih dulu di Groups, lalu jalankan lagi untuk role ini.</span>}
            <label className="row" style={{ gap: 8, fontSize: 13, fontWeight: 600, background: '#FBE4E0', color: '#9A2A1E', borderRadius: 10, padding: '10px 12px' }}>
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} disabled={locked} />
              Password lama {targets.length} akun ini langsung tidak berlaku.
            </label>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              {progress && <span className="muted" style={{ marginRight: 'auto', fontSize: 13 }}>Membuat password… {progress[0]}/{progress[1]}</span>}
              <button className="btn btn-ghost" onClick={onClose} disabled={locked}>Batal</button>
              <button className="btn btn-primary" onClick={run} disabled={!sure || !targets.length || locked}>{mode === 'file' ? `Pakai ${targets.length} password` : `Buat ${targets.length} password`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
