// In-browser stand-in for Supabase, used when VITE_SUPABASE_URL is not set.
// Persists to localStorage (per browser only) — for demos and local dev, not security.
import { MEMBERS, TEAMS, GROUPS, CAPTAINS, initialGroups } from '../data.js';
import { DEFAULT_GRANTS } from './permissions.js';
import { seedGame, gameMethods } from './demoGame.js';
import { normalizeUsername, usernameError, authEmail } from './username.js';

const KEY = 'flourish-demo-v4';
export const DEMO_PASSWORD = 'demo1234';
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

function seed() {
  const p = (id, full_name, role_id, extra = {}) => ({
    id, email: `${slug(full_name)}@demo.flourish`, full_name, role_id, group_no: null, service_team: null,
    is_ministry_tl: false, is_committee: false, ig_handle: null, active: true, created_at: '2026-10-01T10:00:00Z', ...extra,
  });
  const PICS = { Cindy: 'Photo Challenge', Rocky: 'Scrapbook', Maya: 'Spice It Up', Danny: 'Video Challenge' };
  const committee = ['Angel', 'Philips', 'Stefanus', 'Yohan', 'Lidya', 'Marco'];
  const staff = [p('u-angel', 'Angel', 'super_admin', { is_committee: true })];
  CAPTAINS.forEach((name, gi) => {
    const role = name === 'Philips' ? 'super_admin' : PICS[name] ? 'challenge_pic' : 'captain';
    staff.push(p('u-' + slug(name), name, role, { group_no: GROUPS[gi][0], is_committee: committee.includes(name) }));
  });
  const { assign, leaders } = initialGroups();
  const members = MEMBERS.map((m) => {
    const gi = assign.findIndex((ids) => ids.includes(m.id));
    return p('m-' + m.id, m.name, leaders.includes(m.id) ? 'group_leader' : 'member', {
      email: `${slug(m.name)}${m.id}@demo.flourish`, group_no: gi >= 0 ? GROUPS[gi][0] : null,
      service_team: TEAMS[m.team], is_ministry_tl: m.tl, ig_handle: '@' + slug(m.name).replace('.', '_'),
    });
  });
  // Portal demo users from the design join Vine (04): Nadia takes over as Group Leader, and two
  // sample members move to "belum ada grup" so Vine stays at 14 and the pool isn't empty.
  const vine = members.filter((m) => m.group_no === '04');
  vine.forEach((m) => { if (m.role_id === 'group_leader') m.role_id = 'member'; });
  vine.filter((m) => !m.is_ministry_tl).slice(0, 2).forEach((m) => { m.group_no = null; });
  const taken = new Set(vine.filter((m) => m.group_no === '04').map((m) => m.service_team));
  const [t1, t2] = TEAMS.filter((t) => !taken.has(t));
  const portal = [
    p('u-nadia', 'Nadia P.', 'group_leader', { group_no: '04', service_team: t1 ?? null, ig_handle: '@nadia.p' }),
    p('u-grace', 'Grace L.', 'member', { group_no: '04', service_team: t2 ?? null, ig_handle: '@gracel' }),
  ];
  const profiles = [...staff, ...portal, ...members];
  return { profiles, passwords: {}, grants: structuredClone(DEFAULT_GRANTS), sessionId: null, ...seedGame(profiles) };
}

let state;
function load() {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { state = seed(); }
  ensureUsernames(state);
  return state;
}
// Every profile gets a username (from its email's local part, de-duplicated) — also upgrades
// demo data saved before usernames existed. Mirrors the backfill in 0005_usernames.sql.
function ensureUsernames(s) {
  const used = new Set(s.profiles.map((p) => p.username).filter(Boolean));
  s.profiles.forEach((p) => {
    if (p.username) return;
    let base = normalizeUsername(String(p.email || '').split('@')[0]).replace(/[^a-z0-9._]/g, '');
    if (usernameError(base)) base = 'user' + String(p.id).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
    let u = base, n = 2;
    while (used.has(u)) u = base + n++;
    used.add(u);
    p.username = u;
  });
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ } }

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const delay = (v) => new Promise((r) => setTimeout(() => r(v), 120));
const fail = (msg) => Promise.reject(new Error(msg));
const checkPassword = (pw) => (String(pw || '').length < 8 ? 'Password minimal 8 karakter.' : null);

export const DEMO_ACCOUNTS = ['u-angel', 'u-cindy', 'u-yohan', 'u-nadia', 'u-grace'];

export const demoApi = {
  mode: 'demo',
  async getSessionUserId() { return load().sessionId; },
  onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async signInDemo(id) { load().sessionId = id; save(); emit(); },
  async signInPassword(username, password) {
    const s = load();
    const p = s.profiles.find((x) => x.username === normalizeUsername(username));
    if (!p || password !== (s.passwords[p.id] ?? DEMO_PASSWORD)) return fail('Username atau password salah.');
    s.sessionId = p.id; save(); emit();
  },
  async signOut() { load().sessionId = null; save(); emit(); },
  async getProfile(id) { return delay(load().profiles.find((p) => p.id === id) || null); },
  async listProfiles() { return delay([...load().profiles].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))); },
  async updateProfile(id, patch) {
    const s = load();
    const i = s.profiles.findIndex((p) => p.id === id);
    if (i < 0) return fail('Member tidak ditemukan');
    if (patch.role_id && id === s.sessionId && patch.role_id !== s.profiles[i].role_id) return fail('Tidak bisa mengubah role sendiri');
    s.profiles[i] = { ...s.profiles[i], ...patch };
    save();
    return delay(s.profiles[i]);
  },
  async updateMany(list) {
    const s = load();
    const out = list.map(([id, patch]) => {
      const i = s.profiles.findIndex((p) => p.id === id);
      if (i < 0) throw new Error('Member tidak ditemukan');
      return (s.profiles[i] = { ...s.profiles[i], ...patch });
    });
    save();
    return delay(out);
  },
  async createMember({ password, ...fields }) {
    const s = load();
    const username = normalizeUsername(fields.username);
    const bad = usernameError(username) || checkPassword(password);
    if (bad) return fail(bad);
    if (s.profiles.some((p) => p.username === username)) return fail(`Username “${username}” sudah dipakai.`);
    const row = {
      id: 'x-' + Date.now(), role_id: 'member', group_no: null, service_team: null, is_ministry_tl: false,
      is_committee: false, ig_handle: null, contact_email: null, active: true, created_at: new Date().toISOString(),
      ...fields, username, email: authEmail(username),
    };
    s.profiles.push(row);
    s.passwords[row.id] = password;
    save();
    return delay(row);
  },
  async setUsername(id, username) {
    const s = load();
    const u = normalizeUsername(username);
    const bad = usernameError(u);
    if (bad) return fail(bad);
    if (s.profiles.some((p) => p.username === u && p.id !== id)) return fail(`Username “${u}” sudah dipakai.`);
    const i = s.profiles.findIndex((p) => p.id === id);
    if (i < 0) return fail('Member tidak ditemukan');
    s.profiles[i] = { ...s.profiles[i], username: u, email: authEmail(u) };
    save();
    return delay(s.profiles[i]);
  },
  async setPassword(id, password) {
    const bad = checkPassword(password);
    if (bad) return fail(bad);
    load().passwords[id] = password;
    save();
    return delay();
  },
  async getGrants() { return delay(structuredClone(load().grants)); },
  async setGrant(role, perm, on) {
    const s = load();
    const set = new Set(s.grants[role] || []);
    on ? set.add(perm) : set.delete(perm);
    s.grants[role] = [...set];
    save();
  },
  // Roster import, same effect as reset_roster + create in Supabase: every account except Super Admins,
  // every submission, draw, notification and Get to Know Me answer goes; groups are replaced.
  // Demo accounts all log in with DEMO_PASSWORD.
  async importRoster({ groups, accounts }, onProgress = () => {}) {
    const s = load();
    if (s.profiles.find((p) => p.id === s.sessionId)?.role_id !== 'super_admin') return fail('Hanya Super Admin yang bisa import roster.');
    const keep = s.profiles.filter((p) => p.role_id === 'super_admin');
    const keepIds = new Set(keep.map((p) => p.id));
    const removed = s.profiles.length - keep.length;
    keep.forEach((p) => { p.group_no = null; });
    s.profiles = keep;
    s.passwords = Object.fromEntries(Object.entries(s.passwords).filter(([id]) => keepIds.has(id)));
    s.groups = groups.map((g) => ({ locked_at: null, locked_by: null, ...g }));
    s.submissions = []; s.draws = []; s.notifications = []; s.notificationReads = {}; s.gtkm = {};
    s.challenges.forEach((c) => { c.draw_seed = null; c.draw_locked = false; if (!keepIds.has(c.pic_id)) c.pic_id = null; });
    const now = new Date().toISOString();
    const stamp = Date.now().toString(36);
    const created = accounts.map((a, i) => ({
      id: `m-${stamp}-${i}`, contact_email: null, ig_handle: null, is_committee: false, is_ministry_tl: false, active: true,
      service_team: null, position: null, ministry_role: null, group_no: null, created_at: now, ...a, email: authEmail(a.username),
    }));
    s.profiles.push(...created);
    // No emit(): the signed-in Super Admin stays, and an auth event would remount the admin (and this dialog).
    save();
    onProgress(accounts.length, accounts.length);
    return delay({ removed, created: created.map((r) => ({ ...r, password: DEMO_PASSWORD })), failed: [] });
  },
  // Which of the demo login cards still exist (an import removes them).
  async demoAccountsPresent(ids) { const s = load(); return ids.filter((id) => s.profiles.some((p) => p.id === id && p.active)); },
  resetDemo() { state = seed(); save(); emit(); },
  ...gameMethods({ load, save, delay, fail }),
};
