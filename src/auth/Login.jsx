import { useState } from 'react';
import { api } from '../lib/api.js';
import { DEMO_ACCOUNTS } from '../lib/demoStore.js';
import { roleName } from '../lib/permissions.js';
import './login.css';

const DEMO_LABELS = {
  'u-angel': ['Angel', 'super_admin', 'Tim Acara'],
  'u-cindy': ['Cindy', 'challenge_pic', 'PIC Photo Challenge'],
  'u-yohan': ['Yohan', 'captain', 'Captain Olive'],
  'u-nadia': ['Nadia', 'group_leader', 'Vine · 04'],
  'u-grace': ['Grace', 'member', 'Vine · 04'],
};

export default function Login({ notice }) {
  const [method, setMethod] = useState('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(notice ? ['bad', notice] : null);
  const demo = api.mode === 'demo';

  const run = async (fn, okMsg) => {
    setBusy(true); setMsg(null);
    try { await fn(); if (okMsg) setMsg(['ok', okMsg]); }
    catch (e) { setMsg(['bad', e.message]); }
    finally { setBusy(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim()) return setMsg(['bad', 'Isi email dulu ya.']);
    if (method === 'magic') run(() => api.signInMagicLink(email.trim()), `Link masuk dikirim ke ${email.trim()}. Buka dari perangkat ini.`);
    else run(() => api.signInPassword(email.trim(), password));
  };

  return (
    <div className="login">
      <section className="login-brand">
        <div className="login-mark">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 21v-9M12 12c0-4 3-7 7-7 0 4-3 7-7 7zM12 14c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z" /></svg>
        </div>
        <h1>Flourish Hub</h1>
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

          <button type="button" className="login-google" disabled={busy} onClick={() => run(() => api.signInGoogle())}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
            Masuk dengan Google
          </button>

          <div className="login-or"><span>atau pakai email</span></div>

          <div className="login-seg" role="tablist">
            {[['magic', 'Magic link'], ['password', 'Password']].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={method === k} className={method === k ? 'on' : ''} onClick={() => { setMethod(k); setMsg(null); }}>{l}</button>
            ))}
          </div>

          <label className="login-field">
            <span>Email</span>
            <input type="email" autoComplete="email" inputMode="email" placeholder="nama@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {method === 'password' && (
            <label className="login-field">
              <span>Password</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? 'Memproses…' : method === 'magic' ? 'Kirim link masuk' : 'Masuk'}
          </button>

          {msg && <div role="status" className={'login-msg ' + msg[0]}>{msg[1]}</div>}

          <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Belum bisa masuk? Akun dibuat lewat undangan panitia. Hubungi captain grup kamu.
          </span>

          {demo && (
            <div className="login-demo">
              <span className="login-demo-title">Mode demo · Supabase belum dikonfigurasi</span>
              <span className="muted" style={{ fontSize: 12 }}>Masuk sebagai:</span>
              <div className="login-demo-grid">
                {DEMO_ACCOUNTS.map((id) => {
                  const [name, role, sub] = DEMO_LABELS[id];
                  return (
                    <button type="button" key={id} onClick={() => run(() => api.signInDemo(id))}>
                      <b>{name}</b><span>{roleName(role)}</span><span className="muted">{sub}</span>
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
