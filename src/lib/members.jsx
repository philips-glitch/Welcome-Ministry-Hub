import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useAuth } from '../auth/AuthContext.jsx';

// One shared member list for the admin (Groups, Members, Overview, Queue), so an edit
// on one page shows up everywhere without refetching.
const Ctx = createContext(null);
export const useMembers = () => useContext(Ctx);

const byName = (a, b) => (a.full_name || '').localeCompare(b.full_name || '');

export function MembersProvider({ children }) {
  const { profile, refresh } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(() => api.listProfiles().then((r) => { setRows(r); setError(null); }).catch((e) => setError(e.message)), []);
  useEffect(() => { reload(); }, [reload]);

  const merge = useCallback((changed) => {
    const m = new Map(changed.map((r) => [r.id, r]));
    setRows((rs) => {
      const next = (rs || []).map((r) => m.get(r.id) || r);
      changed.forEach((r) => { if (!next.some((x) => x.id === r.id)) next.push(r); });
      return next.sort(byName);
    });
    if (m.has(profile.id)) refresh();
  }, [profile.id, refresh]);

  const value = useMemo(() => ({
    rows, error, reload,
    update: async (id, patch) => { const r = await api.updateProfile(id, patch); merge([r]); return r; },
    updateMany: async (list) => { const out = await api.updateMany(list); merge(out); return out; },
    create: async (fields) => { const r = await api.createMember(fields); merge([r]); return r; },
    setPassword: (id, pw) => api.setPassword(id, pw),
  }), [rows, error, reload, merge]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
