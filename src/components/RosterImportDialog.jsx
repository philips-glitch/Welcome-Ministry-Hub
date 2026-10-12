import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useMembers } from '../lib/members.jsx';
import { useGame } from '../lib/gameStore.jsx';
import { readSheets } from '../lib/xlsx.js';
import { parseRoster, buildAccounts, groupRows, credentialsSheet } from '../lib/roster.js';
import { downloadXlsx } from '../lib/xlsxWrite.js';
import { roleName } from '../lib/permissions.js';

const area = { font: 'inherit', fontSize: 13, lineHeight: 1.5, border: '1px solid #DCD2BC', borderRadius: 10, padding: '8px 10px', background: '#FFFDF8', resize: 'vertical', width: '100%' };
const lines = (t) => t.split('\n').map((x) => x.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
const first = (n) => (n || '').trim().split(/\s+/)[0].toLowerCase();

// Members → Import Excel (Super Admin): replaces the whole roster from a spreadsheet with one row per member
// and an assigned group. The file is read in the browser only. Old accounts (except Super Admins), groups,
// submissions, scores and notifications are removed first.
export default function RosterImportDialog({ onClose, onDone }) {
  const members = useMembers();
  const game = useGame();
  const [file, setFile] = useState(null);
  const [roster, setRoster] = useState(null);
  const [err, setErr] = useState(null);
  const [captains, setCaptains] = useState('');
  const [pics, setPics] = useState('');
  const [sure, setSure] = useState(false);
  const [subCount, setSubCount] = useState(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const running = progress && !result;
  // While importing, and on the result screen (the only place the new passwords are shown), only the buttons close it.
  const locked = running || !!result;

  useEffect(() => { api.listSubmissions().then((s) => setSubCount(s.length)).catch(() => {}); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !locked && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, locked]);

  const rows = members.rows || [];
  const keep = rows.filter((p) => p.role_id === 'super_admin');
  const capList = lines(captains);
  const picList = lines(pics);
  const accounts = useMemo(() => (roster ? buildAccounts(roster, capList, picList, keep.map((p) => p.username)) : []), [roster, captains, pics, keep.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (f) => {
    setErr(null); setRoster(null); setFile(f || null);
    if (!f) return;
    try { setRoster(parseRoster(await readSheets(f))); } catch (e) { setErr(e.message); }
  };

  const run = async () => {
    // Remember who was PIC of each challenge, to re-link by first name to the new PIC accounts.
    const picOf = Object.fromEntries((game.challenges || []).map((c) => [c.id, first(rows.find((p) => p.id === c.pic_id)?.full_name)]));
    setProgress([0, accounts.length]);
    try {
      const res = await api.importRoster({ groups: groupRows(roster.groups), accounts }, (d, t) => setProgress([d, t]));
      const newPics = res.created.filter((a) => a.role_id === 'challenge_pic');
      for (const [id, name] of Object.entries(picOf)) {
        const match = name && newPics.find((a) => first(a.full_name) === name);
        if (match) await game.saveChallenge({ id, pic_id: match.id }).catch(() => {});
      }
      await Promise.all([members.reload(), game.reloadGroups(), game.reloadScores(), game.reloadChallenges()]);
      setResult(res);
    } catch (e) { setErr(e.message); setProgress(null); }
  };

  const download = () => {
    const name = Object.fromEntries(groupRows(roster.groups).map((g) => [g.no, g.name]));
    downloadXlsx(`login-flourish-hub-${new Date().toISOString().slice(0, 10)}.xlsx`, credentialsSheet(result.created, roleName, (no) => name[no] || no));
  };

  const groups = roster?.groups || [];
  const capWarn = roster && capList.length !== groups.length ? `${capList.length} captain untuk ${groups.length} grup — baris ke-n jadi captain grup ke-n.` : null;
  const demo = api.mode === 'demo';

  return (
    <div role="dialog" aria-modal="true" aria-label="Import roster" onClick={() => !locked && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,40,31,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 760, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#FFFDF8', borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#1F4D3A' }}>Import roster dari Excel</span>
          <span className="muted" style={{ fontSize: 13 }}>Satu baris per member, dengan kolom “Assigned Group” dan “Name” (opsional: Team, Role, Positions). File hanya dibaca di browser ini.</span>
        </div>

        {result ? (
          <>
            <div style={{ background: '#E3EFE6', color: '#1F4D3A', borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 700 }}>
              ✓ {result.created.length} akun dibuat · {result.removed} akun lama dihapus · {groups.length} grup{result.failed.length ? ` · ${result.failed.length} gagal` : ''}
            </div>
            {result.failed.length > 0 && (
              <div style={{ background: '#FBE4E0', color: '#9A2A1E', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
                <b>Gagal dibuat (daftarkan manual di Members):</b>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.failed.map((f) => <li key={f.username}>{f.full_name} (@{f.username}): {f.error}</li>)}</ul>
              </div>
            )}
            <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              {demo ? `Mode demo: semua akun masuk dengan password demo1234, dan data ini hanya ada di browser ini.` : 'Setiap akun punya password awal acak. Unduh daftarnya sekarang — password tidak bisa dilihat lagi setelah dialog ini ditutup (bisa direset per member).'}
              {' '}Langkah berikutnya: pilih 1 Group Leader per grup di <b>Groups</b>.
            </span>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={download}>Unduh daftar login (Excel)</button>
              <button className="btn btn-primary" onClick={() => onDone(`Roster diimport: ${result.created.length} akun, ${groups.length} grup.`)}>Selesai</button>
            </div>
          </>
        ) : (
          <>
            <label className="col" style={{ gap: 6, fontSize: 12, fontWeight: 700 }}>File Excel (.xlsx) atau CSV
              <input type="file" accept=".xlsx,.csv" disabled={running} onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {err && <div role="alert" style={{ background: '#FBE4E0', color: '#9A2A1E', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{err}</div>}

            {roster && (
              <>
                <span style={{ fontSize: 13 }}><b>{file?.name}</b> · sheet “{roster.sheet}” · <b>{roster.people.length} member</b> · <b>{groups.length} grup</b></span>
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div className="muted" style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 100px 80px 1fr', gap: 8, fontSize: 12, fontWeight: 700, padding: '8px 12px', background: '#F6F0E2' }}>
                    <span>No</span><span>Grup</span><span>Member</span><span>Team Leader</span><span>Inactive</span><span>Captain</span>
                  </div>
                  {groups.map((g, i) => (
                    <div key={g.no} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 100px 80px 1fr', gap: 8, fontSize: 13, padding: '7px 12px', borderTop: '1px solid #F0E9DA' }}>
                      <span className="mono">{g.no}</span><span style={{ fontWeight: 700 }}>{g.name}</span><span className="num">{g.size}</span><span className="num">{g.tl}</span><span className="num">{g.inactive}</span>
                      <span style={{ color: capList[i] ? '#1B2620' : '#9A2A1E' }}>{capList[i] || '— belum ada'}</span>
                    </div>
                  ))}
                </div>
                {roster.warnings.length > 0 && (
                  <div style={{ background: '#F8E9C4', color: '#7A5410', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>{roster.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="col" style={{ gap: 6, fontSize: 12, fontWeight: 700 }}>Team Captain · 1 baris per grup, urut sesuai grup
                    <textarea rows={6} value={captains} onChange={(e) => setCaptains(e.target.value)} placeholder={'1. Nama captain grup pertama\n2. …'} style={area} disabled={running} />
                    {capWarn && <span style={{ color: '#7A5410', fontWeight: 500 }}>{capWarn}</span>}
                  </label>
                  <label className="col" style={{ gap: 6, fontSize: 12, fontWeight: 700 }}>Challenge PIC · 1 baris per orang
                    <textarea rows={6} value={pics} onChange={(e) => setPics(e.target.value)} placeholder={'1. Nama PIC\n2. …'} style={area} disabled={running} />
                    <span className="muted" style={{ fontWeight: 500 }}>Challenge yang PIC-nya bernama sama akan ditautkan ke akun baru.</span>
                  </label>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>
                  Akan dibuat {accounts.length} akun: {roster.people.length} member · {capList.length} captain · {picList.length} PIC. Username dari nama depan (mis. @{accounts[0]?.username}).
                  Group Leader belum ditentukan — pilih di Groups setelah import. {demo ? 'Mode demo: password semua akun demo1234.' : 'Password awal acak per akun; daftar login bisa diunduh setelah selesai.'}
                </span>

                <div style={{ background: '#FBE4E0', color: '#9A2A1E', borderRadius: 12, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
                  <b>Data lama dihapus permanen:</b> {rows.length - keep.length} akun (semua kecuali Super Admin: {keep.map((p) => p.full_name).join(', ') || '—'}), {(game.groups || []).length} grup, {subCount ?? '…'} submission beserta foto & skornya, semua notifikasi, undian riddle, dan jawaban Get to Know Me. Challenge & riddle bank tetap.
                  <label className="row" style={{ gap: 8, marginTop: 8, fontWeight: 700 }}>
                    <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} disabled={running} /> Saya paham, hapus data lama dan import roster ini.
                  </label>
                </div>
              </>
            )}

            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              {running && <span className="muted" style={{ marginRight: 'auto', fontSize: 13 }}>Mengimport… {progress[0]}/{progress[1]} akun</span>}
              <button className="btn btn-ghost" onClick={onClose} disabled={running}>Batal</button>
              <button className="btn" disabled={!roster || !sure || running} onClick={run} style={{ background: roster && sure ? '#9A2A1E' : '#E2DACA', color: roster && sure ? '#fff' : '#6B665A' }}>
                {running ? 'Mengimport…' : `Hapus data lama & import ${accounts.length || ''} akun`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
