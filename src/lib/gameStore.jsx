import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

// Challenges, groups and group scores, shared by admin and portal. Per-challenge detail
// (riddles, draws, submissions) is loaded by the pages that need it.
const Ctx = createContext(null);
export const useGame = () => useContext(Ctx);

export function GameProvider({ children }) {
  const [challenges, setChallenges] = useState(null);
  const [groups, setGroups] = useState(null);
  const [scores, setScores] = useState([]);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState(null);

  const reloadChallenges = useCallback(() => api.listChallenges().then(setChallenges), []);
  const reloadGroups = useCallback(() => api.listGroups().then(setGroups), []);
  // Scores + the "waiting for validation" count move together: both change when a submission is reviewed.
  const reloadScores = useCallback(() => Promise.all([
    api.groupScores().then(setScores),
    api.listSubmissions().then((rows) => setPending(rows.filter((r) => r.status === 'submitted').length)),
  ]), []);

  useEffect(() => {
    Promise.all([reloadChallenges(), reloadGroups(), reloadScores()]).catch((e) => setError(e.message));
  }, [reloadChallenges, reloadGroups, reloadScores]);

  const value = useMemo(() => ({
    challenges, groups, scores, pending, error, reloadChallenges, reloadGroups, reloadScores,
    saveChallenge: async (c) => {
      const row = await api.saveChallenge(c);
      setChallenges((cs) => (cs.some((x) => x.id === row.id) ? cs.map((x) => (x.id === row.id ? row : x)) : [...cs, row]).sort((a, b) => a.sort - b.sort));
      return row;
    },
    deleteChallenge: async (id) => { await api.deleteChallenge(id); setChallenges((cs) => cs.filter((c) => c.id !== id)); reloadScores(); },
    setLocked: async (locked) => { await api.setGroupsLocked(locked); await reloadGroups(); },
    // The challenge the Overview / portal hero focuses on: first live main round, else next scheduled one.
    focus: challenges && (challenges.find((c) => c.kind === 'main' && c.status === 'live') || challenges.find((c) => c.kind === 'main' && c.status === 'scheduled') || null),
  }), [challenges, groups, scores, pending, error, reloadChallenges, reloadGroups, reloadScores]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
