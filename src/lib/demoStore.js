// In-browser stand-in for Supabase, used when VITE_SUPABASE_URL is not set.
// Persists to localStorage (per browser only) — for demos and local dev, not security.
import { MEMBERS, TEAMS, GROUPS, CAPTAINS, initialGroups } from '../data.js';
import { DEFAULT_GRANTS } from './permissions.js';

const KEY = 'flourish-demo-v1';
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
  // Portal demo users from the design (Vine · 04).
  const portal = [
    p('u-nadia', 'Nadia P.', 'group_leader', { group_no: '04', service_team: 'MH2', ig_handle: '@nadia.p' }),
    p('u-grace', 'Grace L.', 'member', { group_no: '04', service_team: 'LB', ig_handle: '@gracel' }),
  ];
  return { profiles: [...staff, ...portal, ...members], grants: structuredClone(DEFAULT_GRANTS), sessionId: null };
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

export const DEMO_ACCOUNTS = ['u-angel', 'u-cindy', 'u-yohan', 'u-nadia', 'u-grace'];

export const demoApi = {
  mode: 'demo',
  async getSessionUserId() { return load().sessionId; },
  onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async signInDemo(id) { load().sessionId = id; save(); emit(); },
  signInPassword: () => fail('Mode demo: pilih salah satu akun demo di bawah.'),
  signInMagicLink: () => fail('Mode demo: magic link butuh Supabase. Pilih akun demo di bawah.'),
  signInGoogle: () => fail('Mode demo: Google login butuh Supabase. Pilih akun demo di bawah.'),
  async signOut() { load().sessionId = null; save(); emit(); },
  async getProfile(id) { return delay(load().profiles.find((p) => p.id === id) || null); },
  async listProfiles() { return delay([...load().profiles].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))); },
  async updateProfile(id, patch) {
    const s = load();
    const i = s.profiles.findIndex((p) => p.id === id);
    if (i < 0) return fail('Member tidak ditemukan');
    if (patch.role_id && id === s.sessionId && patch.role_id !== s.profiles[i].role_id) return fail('Tidak bisa mengubah role sendiri');
    s.profiles[i] = { ...s.profiles[i], ...patch };
    save(); emit();
    return delay(s.profiles[i]);
  },
  async inviteMember(fields) {
    const s = load();
    const email = fields.email.trim().toLowerCase();
    if (s.profiles.some((p) => p.email === email)) return fail('Email sudah terdaftar');
    const row = { id: 'x-' + Date.now(), email, full_name: fields.full_name || email.split('@')[0], role_id: 'member', group_no: null, service_team: null, is_ministry_tl: false, is_committee: false, ig_handle: null, active: true, created_at: new Date().toISOString(), ...fields, email };
    s.profiles.push(row);
    save(); emit();
    return delay(row);
  },
  async getGrants() { return delay(structuredClone(load().grants)); },
  async setGrant(role, perm, on) {
    const s = load();
    const set = new Set(s.grants[role] || []);
    on ? set.add(perm) : set.delete(perm);
    s.grants[role] = [...set];
    save(); emit();
  },
  resetDemo() { state = seed(); save(); emit(); },
};
