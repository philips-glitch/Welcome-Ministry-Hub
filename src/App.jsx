import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Overview from './pages/Overview.jsx';
import ValidationQueue from './pages/ValidationQueue.jsx';
import GroupForming from './pages/GroupForming.jsx';
import ChallengeBuilder from './pages/ChallengeBuilder.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import { NAV, initialGroups, initialQueue } from './data.js';

import PortalApp from './portal/PortalApp.jsx';

const SLUGS = ['overview', 'groups', 'challenges', 'queue', 'scoring', 'ig-ops', 'members', 'audit-log'];
const fromHash = () => Math.max(0, SLUGS.indexOf(window.location.hash.replace('#/', '')));
// '#/portal/<route>' → member portal; everything else → admin.
const portalRoute = () => { const m = window.location.hash.match(/^#\/portal(?:\/([\w-]+))?/); return m ? m[1] || 'home' : null; };

export default function App() {
  const [portal, setPortal] = useState(portalRoute);
  const [page, setPage] = useState(fromHash);
  // Shared state: group assignment feeds Overview + Queue; queue drives the nav badge.
  const [groups, setGroups] = useState(initialGroups);
  const [queue, setQueue] = useState(initialQueue);

  useEffect(() => {
    const onHash = () => { setPortal(portalRoute()); setPage(fromHash()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { document.title = portal ? 'Flourish Hub — Game Portal' : 'Flourish Hub Admin'; }, [portal]);

  const navigate = (i) => { window.location.hash = '/' + SLUGS[i]; };
  const pending = queue.filter((q) => q.status === 'pending').length;
  const badges = { 3: pending ? String(pending) : '' };

  if (portal) return <PortalApp route={portal} />;

  let content;
  if (page === 0) content = <Overview groups={groups} pending={pending} onNavigate={navigate} />;
  else if (page === 1) content = <GroupForming groups={groups} setGroups={setGroups} />;
  else if (page === 2) content = <ChallengeBuilder />;
  else if (page === 3) content = <ValidationQueue queue={queue} setQueue={setQueue} groups={groups} />;
  else content = <ComingSoon title={NAV[page]} />;

  return (
    <div className="shell">
      <Sidebar active={page} onNavigate={navigate} badges={badges} />
      <main className="main">{content}</main>
    </div>
  );
}
