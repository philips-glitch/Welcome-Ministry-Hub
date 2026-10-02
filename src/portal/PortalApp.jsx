import { useCallback, useEffect, useMemo, useState } from 'react';
import './portal.css';
import { useAuth } from '../auth/AuthContext.jsx';
import Logo from '../components/Logo.jsx';
import { roleName } from '../lib/permissions.js';
import { api } from '../lib/api.js';
import { useGame } from '../lib/gameStore.jsx';
import { buildStandings } from '../lib/game.js';
import { isPlayer } from '../lib/groups.js';
import Home from './Home.jsx';
import ChallengeDetail from './ChallengeDetail.jsx';
import ChallengeList from './ChallengeList.jsx';
import Submit from './Submit.jsx';
import Leaderboard from './Leaderboard.jsx';
import Notifications from './Notifications.jsx';
import useNotifications from './useNotifications.js';

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
const TABS = [['home', 'Home', 'home'], ['challenges', 'Challenges', 'flag'], ['group', 'Group', 'users'], ['leaderboard', 'Leaderboard', 'trophy'], ['me', 'Me', 'me']];
const TAB_OF = { home: 'home', challenges: 'challenges', challenge: 'challenges', submit: 'challenges', group: 'group', leaderboard: 'leaderboard', me: 'me', notifications: null };

export default function PortalApp({ route }) {
  const { profile, can, signOut } = useAuth();
  const game = useGame();
  const go = (r) => { window.location.hash = '/portal/' + r; window.scrollTo(0, 0); };
  const page = route in TAB_OF ? route : 'home';
  const activeTab = TAB_OF[page];
  const standings = useMemo(() => buildStandings(game.scores, game.challenges || [], {}, game.groups || []), [game.scores, game.challenges, game.groups]);

  // Challenge in view (Detail/Submit); defaults to the focus challenge.
  const visible = (game.challenges || []).filter((c) => c.status !== 'draft');
  const [chId, setChId] = useState(null);
  const challenge = visible.find((c) => c.id === chId) || game.focus || visible[0] || null;
  const openChallenge = (id) => { setChId(id); go('challenge'); };
  const [riddleId, setRiddleId] = useState(null);

  const gr = game.groupOf(profile.group_no);
  const g = gr && [gr.no, gr.name, gr.color];
  const me = {
    first: (profile.full_name || profile.email).split(' ')[0],
    roleName: roleName(profile.role_id),
    group: g && { no: g[0], name: g[1], color: g[2] },
    canSubmit: can('portal.submit') && !!g,
  };
  const data = useGroupChallenge(challenge, me.group?.no);
  const notif = useNotifications();
  const onSubmitted = () => { data.reload(); game.reloadScores(); notif.reload(); };

  let content;
  if (!game.challenges) content = <div className="muted" style={{ padding: 16 }}>Memuat…</div>;
  else if (page === 'home') content = <Home go={go} me={me} standings={standings.rows} focus={game.focus} challenges={visible} data={game.focus && challenge?.id === game.focus.id ? data : null} openChallenge={openChallenge} />;
  else if (page === 'challenges') content = <ChallengeList me={me} challenges={visible} openChallenge={openChallenge} />;
  else if (page === 'challenge') content = <ChallengeDetail go={go} me={me} challenge={challenge} data={data} pickRiddle={(id) => { setRiddleId(id); go('submit'); }} />;
  else if (page === 'submit') content = me.canSubmit ? <Submit go={go} me={me} challenge={challenge} data={data} riddleId={riddleId} onSubmitted={onSubmitted} /> : <NoSubmit go={go} />;
  else if (page === 'leaderboard') content = <Leaderboard me={me} standings={standings} />;
  else if (page === 'notifications') content = <Notifications notif={notif} openChallenge={openChallenge} />;
  else if (page === 'me') content = <Me profile={profile} me={me} signOut={signOut} admin={can('dashboard.view')} />;
  else content = <Soon title="My Group" go={go} />;

  return (
    <div className="p-shell">
      <aside className="p-side">
        <div className="p-side-brand">
          <Logo size={38} gap="#FFFDF8" color="#1F4D3A" sub="#flourishdeeperWM2026" subColor="#56655C" />
        </div>
        {TABS.map(([r, label, icon]) => (
          <button key={r} className={'p-side-item' + (activeTab === r ? ' active' : '')} onClick={() => go(r)}><Icon name={icon} />{label}</button>
        ))}
        <div style={{ marginTop: 'auto' }} />
        {can('dashboard.view') && <a href="#/overview" className="p-side-item" style={{ textDecoration: 'none', fontSize: 12 }}>Admin Dashboard →</a>}
        <button className="p-side-item" style={{ fontSize: 12 }} onClick={signOut}>Keluar</button>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="p-top">
          <div className="p-avatar" style={{ background: me.group?.color || '#1F4D3A' }}>{(me.group?.name || me.first)[0]}</div>
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <span className="muted" style={{ fontSize: 13 }}>Halo, {me.first}</span>
            <span style={{ font: "700 19px 'Bricolage Grotesque'" }}>{me.group ? `${me.group.name} · Grup ${me.group.no}` : 'Belum ada grup'}</span>
          </div>
          <button className="p-icon-btn" aria-label={`Notifikasi${notif.unread ? ` (${notif.unread} belum dibaca)` : ''}`} onClick={() => go('notifications')}
            style={page === 'notifications' ? { background: '#E3EFE6', borderColor: '#1F4D3A' } : undefined}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></svg>
            {notif.unread > 0 && <span className="p-badge">{notif.unread > 9 ? '9+' : notif.unread}</span>}
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

// My group's view of one challenge: drawn riddles, submissions (latest per riddle) and roster for tagging.
function useGroupChallenge(challenge, groupNo) {
  const [state, setState] = useState({ riddles: [], draw: [], subs: [], roster: [], loading: true });
  const id = challenge?.id;
  const reload = useCallback(async () => {
    if (!id || !groupNo) return setState((s) => ({ ...s, loading: false }));
    const [riddles, draw, subs, profiles] = await Promise.all([
      api.listRiddles(id), api.getDraw(id), api.listSubmissions({ challengeId: id, groupNo }), api.listProfiles(),
    ]);
    const mine = draw.filter((d) => d.group_no === groupNo).sort((a, b) => a.slot - b.slot);
    const ids = new Set(mine.map((d) => d.riddle_id));
    setState({ riddles: riddles.filter((r) => ids.has(r.id)), draw: mine, subs, roster: profiles.filter((p) => isPlayer(p) && p.group_no === groupNo), loading: false });
  }, [id, groupNo]);
  useEffect(() => { setState((s) => ({ ...s, loading: true })); reload().catch(() => setState((s) => ({ ...s, loading: false }))); }, [reload]);
  const latest = (riddleId) => state.subs.filter((x) => (x.riddle_id ?? null) === (riddleId ?? null)).sort((a, b) => b.version - a.version)[0] || null;
  return { ...state, reload, latest };
}

function NoSubmit({ go }) {
  return (
    <div className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 24 }}>
      <span style={{ font: "700 20px 'Bricolage Grotesque'" }}>Hanya Group Leader yang bisa submit</span>
      <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Kamu tetap bisa bantu: kirim foto ke Group Leader atau upload ke draft grup.</span>
      <button onClick={() => go('challenge')} style={{ alignSelf: 'flex-start', height: 44, padding: '0 18px', borderRadius: 14, background: '#1F4D3A', color: '#FBF6EA', fontWeight: 700, fontSize: 13 }}>Kembali ke challenge</button>
    </div>
  );
}

function Me({ profile, me, signOut, admin }) {
  const rows = [
    ['Nama', profile.full_name || '—'], ['Email', profile.email], ['Role', me.roleName],
    ['Grup', me.group ? `${me.group.no} ${me.group.name}` : '—'], ['Tim pelayanan', profile.service_team || '—'], ['Instagram', profile.ig_handle || '—'],
  ];
  return (
    <div className="p-cols">
      <div className="p-stack">
        <span className="p-title">Profil saya</span>
        <div className="p-card" style={{ padding: 0 }}>
          {rows.map(([k, v], i) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid #F0E9DA' : 'none', fontSize: 14 }}>
              <span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-sticky">
        {admin && <a href="#/overview" className="p-btn-lg" style={{ background: '#E3EFE6', color: '#1F4D3A', textDecoration: 'none' }}>Buka Admin Dashboard</a>}
        <button className="p-btn-lg" onClick={signOut} style={{ background: '#FFFDF8', border: '1px solid #E9E0CC', color: '#9A2A1E' }}>Keluar</button>
        <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Data grup & role diatur panitia. Ada yang salah? Hubungi captain kamu.</span>
      </div>
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
