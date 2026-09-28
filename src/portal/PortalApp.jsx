import { useState } from 'react';
import './portal.css';
import { ME } from './portalData.js';
import Home from './Home.jsx';
import ChallengeDetail from './ChallengeDetail.jsx';
import Submit from './Submit.jsx';
import Leaderboard from './Leaderboard.jsx';

const ICONS = {
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7.5M18 15c2.5.6 4 2.6 4 6',
  trophy: 'M8 4h8v6a4 4 0 0 1-8 0zM8 6H4c0 3 2 5 4 5M16 6h4c0 3-2 5-4 5M12 14v4M8 21h8',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.5-6 8-6s8 2 8 6',
};
export const Icon = ({ name, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name]} /></svg>
);
export const Leaf = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 21v-9M12 12c0-4 3-7 7-7 0 4-3 7-7 7zM12 14c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z" /></svg>
);

// route → tab it belongs to
const TABS = [['home', 'Home', 'home'], ['challenge', 'Challenges', 'flag'], ['group', 'Group', 'users'], ['leaderboard', 'Leaderboard', 'trophy'], ['me', 'Me', 'me']];
const TAB_OF = { home: 'home', challenge: 'challenge', submit: 'challenge', group: 'group', leaderboard: 'leaderboard', me: 'me' };

export default function PortalApp({ route }) {
  const go = (r) => { window.location.hash = '/portal/' + r; window.scrollTo(0, 0); };
  const page = TAB_OF[route] ? route : 'home';
  const activeTab = TAB_OF[page];
  // Submission draft lives here so it survives switching between Detail and Submit.
  const [submitted, setSubmitted] = useState(false);

  let content;
  if (page === 'home') content = <Home go={go} />;
  else if (page === 'challenge') content = <ChallengeDetail go={go} submitted={submitted} />;
  else if (page === 'submit') content = <Submit go={go} submitted={submitted} setSubmitted={setSubmitted} />;
  else if (page === 'leaderboard') content = <Leaderboard />;
  else content = <Soon title={page === 'group' ? 'My Group' : 'Me'} go={go} />;

  return (
    <div className="p-shell">
      <aside className="p-side">
        <div className="p-side-brand">
          <div style={{ width: 40, height: 40, borderRadius: 13, background: '#1F4D3A', color: '#E3A92B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Leaf size={22} /></div>
          <div className="col"><span style={{ font: "800 16px 'Bricolage Grotesque'", color: '#1F4D3A' }}>Flourish Hub</span><span className="muted" style={{ fontSize: 11 }}>#flourishdeeperWM2026</span></div>
        </div>
        {TABS.map(([r, label, icon]) => (
          <button key={r} className={'p-side-item' + (activeTab === r ? ' active' : '')} onClick={() => go(r)}><Icon name={icon} />{label}</button>
        ))}
        <a href="#/overview" className="p-side-item" style={{ marginTop: 'auto', textDecoration: 'none', fontSize: 12 }}>Admin Dashboard →</a>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="p-top">
          <div className="p-avatar" style={{ background: ME.color }}>V</div>
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <span className="muted" style={{ fontSize: 13 }}>Halo, {ME.name}</span>
            <span style={{ font: "700 19px 'Bricolage Grotesque'" }}>{ME.group} · Grup {ME.groupNo}</span>
          </div>
          <button className="p-icon-btn" aria-label="Notifikasi (3)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></svg>
            <span className="p-badge">3</span>
          </button>
        </header>
        <main className="p-main">{content}</main>
      </div>

      <nav className="p-tabbar">
        {TABS.map(([r, label, icon]) => (
          <button key={r} className={'p-tab' + (activeTab === r ? ' active' : '')} onClick={() => go(r)}>
            <span className="pill"><Icon name={icon} /></span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Soon({ title, go }) {
  return (
    <div className="p-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: 32 }}>
      <div style={{ width: 64, height: 64, borderRadius: 22, background: '#E3EFE6', color: '#2F7A55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Leaf size={30} /></div>
      <span style={{ font: "700 20px 'Bricolage Grotesque'" }}>{title}</span>
      <span className="muted" style={{ fontSize: 14, lineHeight: 1.5, maxWidth: 420 }}>Layar ini belum ada di design. Sementara itu, cek challenge yang sedang live.</span>
      <button onClick={() => go('challenge')} style={{ height: 44, padding: '0 18px', borderRadius: 14, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>Buka Photo Challenge</button>
    </div>
  );
}
