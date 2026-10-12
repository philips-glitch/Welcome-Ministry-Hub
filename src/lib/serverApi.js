// Client for the app's own server API (Vercel Functions in /api → server/rpc.js).
// Same methods and results as the demo store, so every screen works unchanged. Login is a session cookie.
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

async function call(method, args = {}) {
  let res;
  try {
    res = await fetch('/api/rpc', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) });
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Cek koneksi internet kamu.');
  }
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || body?.error) {
    if (res.status === 401) setTimeout(emit, 0); // session expired → back to the login page
    throw new Error(body?.error || `Server bermasalah (${res.status}). Coba lagi.`);
  }
  return body.data;
}

async function toBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const serverApi = {
  mode: 'server',
  getSessionUserId: () => call('session'),
  onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async signInPassword(username, password) { await call('signInPassword', { username, password }); emit(); },
  async signOut() { await call('signOut'); emit(); },

  getProfile: (id) => call('getProfile', { id }),
  listProfiles: () => call('listProfiles'),
  updateProfile: (id, patch) => call('updateProfile', { id, patch }),
  updateMany: (list) => call('updateMany', { list }),
  createMember: (fields) => call('createMember', fields),
  setPassword: (id, password) => call('setPassword', { id, password }),
  setUsername: (id, username) => call('setUsername', { id, username }),
  getGtkm: (ids) => call('getGtkm', { ids }),
  saveGtkm: (id, data) => call('saveGtkm', { id, data }),
  getGrants: () => call('getGrants'),
  setGrant: (role, perm, on) => call('setGrant', { role, perm, on }),

  listGroups: () => call('listGroups'),
  createGroup: (g) => call('createGroup', { g }),
  updateGroup: (no, patch) => call('updateGroup', { no, patch }),
  deleteGroup: (no) => call('deleteGroup', { no }),
  setGroupsLocked: (locked) => call('setGroupsLocked', { locked }),

  listChallenges: () => call('listChallenges'),
  saveChallenge: (c) => call('saveChallenge', { c }),
  deleteChallenge: (id) => call('deleteChallenge', { id }),
  listRiddles: (challengeId) => call('listRiddles', { challengeId }),
  saveRiddle: (r) => call('saveRiddle', { r }),
  deleteRiddle: (id) => call('deleteRiddle', { id }),
  getDraw: (challengeId) => call('getDraw', { challengeId }),
  saveDraw: (challengeId, rows, seed) => call('saveDraw', { challengeId, rows, seed }),

  listSubmissions: (opts = {}) => call('listSubmissions', opts),
  async createSubmission({ file, ...sub }) {
    const media = file ? { name: file.name, type: file.type || 'image/jpeg', data: await toBase64(file) } : null;
    return call('createSubmission', { sub, media });
  },
  reviewSubmission: (id, patch) => call('reviewSubmission', { id, patch }),
  async mediaUrl(path) { return path ? `/api/media?path=${encodeURIComponent(path)}` : null; },
  groupScores: () => call('groupScores'),

  listNotifications: () => call('listNotifications'),
  markNotificationsRead: (ids) => (ids?.length ? call('markNotificationsRead', { ids }) : Promise.resolve()),

  async importRoster({ groups, accounts }, onProgress = () => {}) {
    onProgress(0, accounts.length);
    const res = await call('importRoster', { groups, accounts });
    onProgress(accounts.length, accounts.length);
    return res;
  },
};
