import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { PERMISSIONS, ROLES, LOCKED_ROLE } from '../lib/permissions.js';
import { useAuth } from '../auth/AuthContext.jsx';

const CATS = [...new Set(PERMISSIONS.map((p) => p.category))];
const COLS = `minmax(240px,1.4fr) repeat(${ROLES.length}, minmax(110px,1fr))`;

export default function Roles() {
  const { can, profile, refresh } = useAuth();
  const editable = can('roles.manage');
  const [grants, setGrants] = useState(null);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { api.getGrants().then(setGrants).catch((e) => setToast(['bad', e.message])); }, []);

  const has = (role, perm) => (grants?.[role] || []).includes(perm);
  const toggle = async (role, perm) => {
    const on = !has(role, perm);
    const key = role + perm;
    setBusy(key);
    try {
      await api.setGrant(role, perm, on);
      setGrants((g) => ({ ...g, [role]: on ? [...(g[role] || []), perm] : (g[role] || []).filter((x) => x !== perm) }));
      const p = PERMISSIONS.find((x) => x.id === perm);
      setToast(['ok', `${ROLES.find((r) => r.id === role).name}: ${on ? 'diberi' : 'dicabut'} “${p.label}”`]);
      if (role === profile.role_id) refresh();
    } catch (e) { setToast(['bad', e.message]); }
    finally { setBusy(null); }
  };

  return (
    <div className="page">
      <div className="col" style={{ gap: 2 }}>
        <span className="muted" style={{ fontSize: 13 }}>Perubahan langsung berlaku untuk semua member dengan role tersebut</span>
        <span className="h1">Roles & Access</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, background: '#F6F0E2', borderBottom: '1px solid #E9E0CC' }}>
          <span className="muted" style={{ padding: '14px 18px', fontSize: 12, fontWeight: 700, alignSelf: 'end' }}>Hak akses</span>
          {ROLES.map((r) => (
            <div key={r.id} className="col" style={{ padding: '14px 10px', gap: 3, textAlign: 'center', alignItems: 'center' }}>
              <span style={{ font: "700 14px 'Bricolage Grotesque'" }}>{r.name}</span>
              <span className="muted" style={{ fontSize: 11, lineHeight: 1.35 }}>{r.description}</span>
              {r.id === profile.role_id && <span className="chip" style={{ background: '#E3EFE6', color: '#1F4D3A' }}>ROLE KAMU</span>}
            </div>
          ))}
        </div>
        {!grants && <div className="muted" style={{ padding: 18, fontSize: 13 }}>Memuat hak akses…</div>}
        {grants && CATS.map((cat) => (
          <div key={cat}>
            <div className="muted" style={{ padding: '10px 18px 6px', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' }}>{cat}</div>
            {PERMISSIONS.filter((p) => p.category === cat).map((p) => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: COLS, alignItems: 'center', borderTop: '1px solid #F0E9DA' }}>
                <div className="col" style={{ padding: '10px 18px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                  <span className="mono muted" style={{ fontSize: 11 }}>{p.id}</span>
                </div>
                {ROLES.map((r) => {
                  const on = has(r.id, p.id);
                  const locked = !editable || r.id === LOCKED_ROLE;
                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        role="switch"
                        aria-checked={on}
                        aria-label={`${r.name}: ${p.label}`}
                        disabled={locked || busy === r.id + p.id}
                        onClick={() => toggle(r.id, p.id)}
                        title={r.id === LOCKED_ROLE ? 'Super Admin selalu punya semua akses' : undefined}
                        style={{ width: 26, height: 26, borderRadius: 7, border: `2px solid ${locked ? '#CFC4AA' : '#1F4D3A'}`, background: on ? (locked ? '#8FA89A' : '#1F4D3A') : 'transparent', color: '#FBF6EA', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: locked ? 'not-allowed' : 'pointer' }}
                      >{on ? '✓' : ''}</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Super Admin dikunci agar event tidak bisa terkunci. Role member diubah di <a href="#/members">Member Management</a>.
        {!editable && ' Kamu hanya bisa melihat matriks ini.'}
      </span>
      {toast && (
        <div role="status" onClick={() => setToast(null)} style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 30, maxWidth: 420, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 600, boxShadow: '0 12px 30px -12px rgba(20,40,31,.35)', background: toast[0] === 'ok' ? '#E3EFE6' : '#FBE4E0', color: toast[0] === 'ok' ? '#1F4D3A' : '#9A2A1E' }}>{toast[1]}</div>
      )}
    </div>
  );
}
