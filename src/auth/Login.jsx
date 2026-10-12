import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../lib/demoStore.js';
import { roleName } from '../lib/permissions.js';
import './login.css';
import { LogoMark } from '../components/Logo.jsx';

const DEMO_LABELS = {
  'u-angel': ['Angel', 'super_admin', 'Tim Acara', 'angel'],
  'u-cindy': ['Cindy', 'challenge_pic', 'PIC Get to Know Me', 'cindy'],
  'u-yohan': ['Yohan', 'captain', 'Captain Olive', 'yohan'],
  'u-nadia': ['Nadia', 'group_leader', 'Vine · 04', 'nadia.p'],
  'u-grace': ['Grace', 'member', 'Vine · 04', 'grace.l'],
};

export default function Login({ notice }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(notice || null);
  const demo = api.mode === 'demo';
  // One-click sample logins only in local development, or when VITE_DEMO_LOGIN=true is set on purpose.
  // The deployed site shows a plain login form, without sample accounts or the demo password.
  const demoPanel = demo && (import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === 'true');
  // After a roster import most sample accounts are gone; show only the cards that still work.
  const [cards, setCards] = useState(DEMO_ACCOUNTS);
  useEffect(() => { if (demoPanel) api.demoAccountsPresent(DEMO_ACCOUNTS).then(setCards).catch(() => {}); }, [demoPanel]);

  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return setMsg('Isi username dan password dulu ya.');
    run(() => api.signInPassword(username, password));
  };

  return (
    <div className="login">
      <section className="login-brand">
        <div className="login-logo">
          <LogoMark size={64} gap="#0F4530" />
          <h1>Flourish Hub</h1>
        </div>
        <p>Welcome UR Outing 2026 · #flourishdeeperWM2026</p>
        <ul className="login-points">
          <li>Challenge mingguan bareng grup kamu</li>
          <li>Submit, validasi & leaderboard di satu tempat</li>
          <li>Satu login untuk member dan panitia</li>
        </ul>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit} noValidate>
          <div className="col" style={{ gap: 4 }}>
            <span className="login-title">Masuk</span>
            <span className="muted" style={{ fontSize: 14 }}>Member dan panitia masuk dari sini. Akses menyesuaikan role kamu.</span>
          </div>

          <label className="login-field">
            <span>Username</span>
            <input type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="mis. nadia.putri" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="login-field">
            <span>Password</span>
            <div className="login-pw">
              <input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>{show ? 'Sembunyikan' : 'Tampilkan'}</button>
            </div>
          </label>

          <button type="submit" className="login-submit" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
          {msg && <div role="alert" className="login-msg bad">{msg}</div>}

          <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Akun dibuat oleh panitia. Lupa password atau belum punya akun? Hubungi captain grup kamu.
          </span>

          {demoPanel && (
            <div className="login-demo">
              <span className="login-demo-title">Mode demo · Supabase belum dikonfigurasi</span>
              <span className="muted" style={{ fontSize: 12 }}>Klik untuk masuk langsung, atau ketik username{cards.length < DEMO_ACCOUNTS.length ? ' (mis. dari daftar login hasil import)' : ' di kartu'} dengan password <b className="mono">{DEMO_PASSWORD}</b>.</span>
              <div className="login-demo-grid">
                {cards.map((id) => {
                  const [name, role, sub, user] = DEMO_LABELS[id];
                  return (
                    <button type="button" key={id} onClick={() => run(() => api.signInDemo(id))}>
                      <b>{name}</b><span>{roleName(role)}</span><span className="muted">{sub}</span><span className="mono" style={{ fontSize: 11, color: '#1F4D3A' }}>@{user}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
