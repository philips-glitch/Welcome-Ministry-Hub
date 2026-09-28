import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, profile: null, grants: {}, error: null });

  const load = useCallback(async () => {
    try {
      const uid = await api.getSessionUserId();
      if (!uid) return setState({ loading: false, profile: null, grants: {}, error: null });
      const [profile, grants] = await Promise.all([api.getProfile(uid), api.getGrants()]);
      setState({ loading: false, profile, grants, error: profile ? null : 'Akun ini belum punya profil. Hubungi panitia.' });
    } catch (e) {
      setState({ loading: false, profile: null, grants: {}, error: e.message });
    }
  }, []);

  useEffect(() => {
    load();
    return api.onAuthChange(load);
  }, [load]);

  const value = useMemo(() => {
    const { profile, grants } = state;
    const perms = new Set(profile?.active ? grants[profile.role_id] || [] : []);
    return { ...state, perms, can: (p) => perms.has(p), refresh: load, signOut: () => api.signOut() };
  }, [state, load]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
