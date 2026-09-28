// In-browser stand-in for Supabase, used when VITE_SUPABASE_URL is not set.
// Persists to localStorage (per browser only) — for demos and local dev, not security.
import { MEMBERS, TEAMS, GROUPS, CAPTAINS, initialGroups } from '../data.js';
import { DEFAULT_GRANTS } from './permissions.js';
import { seedGame, gameMethods } from './demoGame.js';

const KEY = 'flourish-demo-v3';
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
  return state;
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
  async signInPassword(email, password) {
    const s = load();
    const p = s.profiles.find((x) => x.email === email.trim().toLowerCase());
    if (!p || password !== (s.passwords[p.id] ?? DEMO_PASSWORD)) return fail('Email atau password salah.');
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
    const email = String(fields.email || '').trim().toLowerCase();
    const bad = checkPassword(password);
    if (bad) return fail(bad);
    if (s.profiles.some((p) => p.email === email)) return fail('Email sudah terdaftar.');
    const row = {
      id: 'x-' + Date.now(), role_id: 'member', group_no: null, service_team: null, is_ministry_tl: false,
      is_committee: false, ig_handle: null, active: true, created_at: new Date().toISOString(), ...fields, email,
    };
    s.profiles.push(row);
    s.passwords[row.id] = password;
    save();
    return delay(row);
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
  resetDemo() { state = seed(); save(); emit(); },
  ...gameMethods({ load, save, delay, fail }),
};
