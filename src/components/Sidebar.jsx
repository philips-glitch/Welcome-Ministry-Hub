import { useAuth } from '../auth/AuthContext.jsx';
import { roleName } from '../lib/permissions.js';
import Logo from './Logo.jsx';

export default function Sidebar({ items, active, onNavigate, badges }) {
  const { profile, can, signOut } = useAuth();
  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo size={36} gap="#14281F" sub="Admin · WM 2026" />
      </div>
      {items.map(([slug, label]) => (
        <button key={slug} className={'nav-item' + (slug === active ? ' active' : '')} onClick={() => onNavigate(slug)}>
          <span>{label}</span>
          <span className="nav-badge">{badges[slug] || ''}</span>
        </button>
      ))}
      {can('portal.view') && (
        <a href="#/portal/home" className="nav-item" style={{ marginTop: 'auto', textDecoration: 'none', fontSize: 12 }}>← User Game Portal</a>
      )}
      <div className="whoami" style={{ marginTop: can('portal.view') ? 8 : 'auto' }}>
        Masuk sebagai <b>{profile.full_name || profile.email}</b>
        <br />
        {roleName(profile.role_id)}
        <button onClick={signOut} style={{ display: 'block', marginTop: 8, fontSize: 12, fontWeight: 700, color: '#E3A92B' }}>Keluar</button>
      </div>
    </aside>
  );
}
