import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Overview from './pages/Overview.jsx';
import ValidationQueue from './pages/ValidationQueue.jsx';
import GroupForming from './pages/GroupForming.jsx';
import ChallengeBuilder from './pages/ChallengeBuilder.jsx';
import Scoring from './pages/Scoring.jsx';
import Members from './pages/Members.jsx';
import Roles from './pages/Roles.jsx';
import PortalApp from './portal/PortalApp.jsx';
import Login from './auth/Login.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import { MembersProvider } from './lib/members.jsx';
import { GameProvider, useGame } from './lib/gameStore.jsx';

// Admin pages: slug, label, permission required to see it.
export const ADMIN_NAV = [
  ['overview', 'Overview', 'dashboard.view'],
  ['groups', 'Groups', 'groups.manage'],
  ['challenges', 'Challenges', 'challenges.manage'],
  ['queue', 'Validation Queue', 'submissions.validate'],
  ['scoring', 'Scoring & Leaderboard', 'scores.view'],
  ['members', 'Members', 'members.view'],
  ['roles', 'Roles & Access', 'roles.manage'],
];

// '#/portal/<route>' → portal, '#/<slug>' → admin page, '#/login' or empty → pick a home.
function parseHash() {
  const h = window.location.hash;
  const m = h.match(/^#\/portal(?:\/([\w-]+))?/);
  if (m) return { app: 'portal', route: m[1] || 'home' };
  const slug = h.replace(/^#\//, '');
  return ADMIN_NAV.some(([s]) => s === slug) ? { app: 'admin', route: slug } : { app: null, route: null };
}

export default function App() {
  const auth = useAuth();
  const [loc, setLoc] = useState(parseHash);

  useEffect(() => {
    const onHash = () => setLoc(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const { loading, profile, can, error } = auth;
  const home = can('dashboard.view') ? '/overview' : '/portal/home';

  // Send signed-in users without a concrete route (or on a page they can't open) to their home.
  useEffect(() => {
    if (loading || !profile?.active) return;
    const deniedAdmin = loc.app === 'admin' && !can(ADMIN_NAV.find(([s]) => s === loc.route)[2]);
    if (!loc.app || deniedAdmin) window.location.replace('#' + (deniedAdmin && !can('dashboard.view') ? '/portal/home' : home));
  }, [loading, profile, loc, home]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = !profile ? 'Masuk · Flourish Hub' : loc.app === 'portal' ? 'Flourish Hub — Game Portal' : 'Flourish Hub Admin';
  }, [profile, loc.app]);

  if (loading) return <Splash />;
  if (!profile) return <Login notice={error} />;
  if (!profile.active) return <Blocked onSignOut={auth.signOut} text="Akun kamu sedang nonaktif. Hubungi panitia kalau ini keliru." />;

  if (loc.app === 'portal') {
    if (!can('portal.view')) return <Blocked onSignOut={auth.signOut} text="Role kamu belum punya akses ke Game Portal." />;
    return <GameProvider><PortalApp route={loc.route} /></GameProvider>;
  }
  if (loc.app !== 'admin') return <Splash />;

  return (
    <GameProvider>
      <MembersProvider>
        <AdminShell route={loc.route} can={can} />
      </MembersProvider>
    </GameProvider>
  );
}

function AdminShell({ route: r, can }) {
  const { pending } = useGame();
  const navigate = (slug) => { window.location.hash = '/' + slug; };
  const nav = ADMIN_NAV.filter(([, , perm]) => can(perm));
  const badges = { queue: pending ? String(pending) : '' };

  let content = null;
  if (r === 'overview') content = <Overview onNavigate={navigate} />;
  else if (r === 'groups') content = <GroupForming />;
  else if (r === 'challenges') content = <ChallengeBuilder />;
  else if (r === 'queue') content = <ValidationQueue />;
  else if (r === 'scoring') content = <Scoring />;
  else if (r === 'members') content = <Members />;
  else if (r === 'roles') content = <Roles />;

  return (
    <div className="shell">
      <Sidebar items={nav} active={r} onNavigate={navigate} badges={badges} />
      <main className="main">{content}</main>
    </div>
  );
}

function Splash() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#56655C', fontSize: 14 }}>Memuat Flourish Hub…</div>;
}

function Blocked({ text, onSignOut }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
        <span style={{ font: "800 22px 'Bricolage Grotesque'", color: '#1F4D3A' }}>Akses dibatasi</span>
        <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{text}</span>
        <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={onSignOut}>Keluar</button>
      </div>
    </div>
  );
}
