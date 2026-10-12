// Roster import: turn a spreadsheet (one row per member, with an assigned group) into groups + accounts.
// Columns are found by header name, so the order in the file doesn't matter.
import { suggestUsername, usernameError } from './username.js';

const HEADERS = {
  group: ['assigned group', 'group', 'grup', 'kelompok'],
  name: ['name', 'nama', 'full name', 'nama lengkap'],
  team: ['team', 'tim', 'original team'],
  role: ['role', 'ministry role'],
  position: ['positions', 'position', 'posisi'],
};
// Group colours, in group order (same palette as the original 10 groups).
export const PALETTE = ['#7F8F24', '#2A8C82', '#C4533F', '#8A4FA3', '#C98A12', '#D0577E', '#3E86C9', '#9A6435', '#4E9A55', '#5C63B8', '#1F4D3A', '#B5532E'];

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// "budi santoso" → "Budi Santoso"; names that already have capitals stay as typed.
const nameCase = (s) => (s === s.toLowerCase() ? s.replace(/(^|[\s'-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : s);

// → { sheet, groups: [{ no, name, size, tl, inactive }], people: [...], warnings: [] } or throws with a readable message.
export function parseRoster(sheets) {
  for (const { name: sheet, rows } of sheets) {
    const hi = rows.findIndex((r) => r.some((c) => HEADERS.group.includes(clean(c).toLowerCase())) && r.some((c) => HEADERS.name.includes(clean(c).toLowerCase())));
    if (hi < 0) continue;
    const head = rows[hi].map((c) => clean(c).toLowerCase());
    const at = Object.fromEntries(Object.entries(HEADERS).map(([k, names]) => [k, head.findIndex((h) => names.includes(h))]));
    const warnings = [];
    const people = [];
    const labels = [];
    rows.slice(hi + 1).forEach((r, i) => {
      const name = nameCase(clean(r[at.name]));
      const label = clean(r[at.group]);
      if (!name && !label) return;
      if (!name) return warnings.push(`Baris ${hi + i + 2}: nama kosong, dilewati.`);
      if (!label) return warnings.push(`${name}: belum ada grup, dilewati.`);
      if (!labels.includes(label)) labels.push(label);
      const role = at.role >= 0 ? clean(r[at.role]) : '';
      people.push({
        full_name: name, label,
        service_team: at.team >= 0 ? clean(r[at.team]) || null : null,
        position: at.position >= 0 ? clean(r[at.position]) || null : null,
        ministry_role: role || null,
        is_ministry_tl: /^team leader$/i.test(role),
      });
    });
    if (!people.length) throw new Error(`Sheet “${sheet}” tidak punya baris member.`);

    // "Group 7" → 07; labels without a number get the next free one, in order of appearance.
    const nums = labels.map((l) => Number((l.match(/\d+/) || [])[0]) || null);
    const used = new Set(nums.filter(Boolean));
    let next = 1;
    const noOf = Object.fromEntries(labels.map((l, i) => {
      let n = nums[i];
      if (!n || nums.indexOf(n) !== i) { while (used.has(next)) next++; n = next; used.add(n); }
      return [l, String(n).padStart(2, '0')];
    }));
    if (Object.values(noOf).some((no) => no.length > 3)) throw new Error('Nomor grup maksimal 3 digit.');
    const groups = labels.map((l) => {
      const mine = people.filter((p) => p.label === l);
      return { no: noOf[l], name: l, size: mine.length, tl: mine.filter((p) => p.is_ministry_tl).length, inactive: mine.filter((p) => /inactive/i.test(p.ministry_role || '')).length };
    }).sort((a, b) => Number(a.no) - Number(b.no));
    people.forEach((p) => { p.group_no = noOf[p.label]; });

    const seen = {};
    people.forEach((p) => { const k = p.full_name.toLowerCase(); seen[k] = (seen[k] || 0) + 1; });
    Object.entries(seen).filter(([, n]) => n > 1).forEach(([k]) => warnings.push(`Nama dobel: ${people.find((p) => p.full_name.toLowerCase() === k).full_name} (${seen[k]}×) — tetap dibuat sebagai akun terpisah.`));
    groups.filter((g) => !g.tl).forEach((g) => warnings.push(`${g.name} belum punya Ministry Team Leader.`));
    return { sheet, groups, people, warnings };
  }
  throw new Error('Tidak ketemu kolom grup + nama. Baris judul harus punya “Assigned Group” (atau “Group”) dan “Name”.');
}

// Full account list: members, then one captain per group (in group order), then Challenge PICs.
// Usernames are short to type: first name, else first.last, else the full name, else a number suffix —
// unique against `taken` (accounts that stay).
export function buildAccounts({ groups, people }, captains, pics, taken = []) {
  const used = new Set(taken);
  const username = (name) => {
    const p = suggestUsername(name).split('.').filter(Boolean);
    const tries = [p[0], p.length > 1 && `${p[0]}.${p[p.length - 1]}`, p.join('.')].filter(Boolean).map((u) => u.slice(0, 24));
    const free = tries.find((u) => !usernameError(u) && !used.has(u));
    let u = free;
    if (!u) {
      const base = (tries.find((x) => !usernameError(x)) || 'member').slice(0, 21);
      let n = 2;
      while (used.has((u = base + n))) n++;
    }
    used.add(u);
    return u;
  };
  // Staff pick usernames first, so a captain/PIC gets the plain first name (they're listed by first name).
  const staff = [
    ...captains.slice(0, groups.length).map((name, i) => ({ full_name: name, username: username(name), role_id: 'captain', group_no: groups[i].no })),
    ...pics.map((name) => ({ full_name: name, username: username(name), role_id: 'challenge_pic', group_no: null })),
  ];
  const members = people.map((p) => ({
    full_name: p.full_name, username: username(p.full_name), role_id: 'member', group_no: p.group_no,
    service_team: p.service_team, position: p.position, ministry_role: p.ministry_role, is_ministry_tl: p.is_ministry_tl,
  }));
  return [...members, ...staff];
}

// Random password: 8 alphanumeric characters (upper, lower, digits) without look-alikes (0/O/o, 1/l/I),
// always with at least one letter and one digit.
const ALNUM = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export function randomPassword(length = 8) {
  for (;;) {
    const pw = Array.from(crypto.getRandomValues(new Uint32Array(length)), (x) => ALNUM[x % ALNUM.length]).join('');
    if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) return pw;
  }
}

export const groupRows = (groups) => groups.map((g, i) => ({ no: g.no, name: g.name, color: PALETTE[i % PALETTE.length], min_size: g.size, max_size: g.size, sort: i + 1 }));

// Login list as an Excel sheet (see xlsxWrite.js): username, role, password, name, group — by role, group, name.
const ROLE_ORDER = ['super_admin', 'challenge_pic', 'captain', 'group_leader', 'member'];
export function credentialsSheet(rows, roleName, groupName = (no) => no) {
  const sorted = [...rows].sort((a, b) => ROLE_ORDER.indexOf(a.role_id) - ROLE_ORDER.indexOf(b.role_id)
    || (a.group_no || 'zz').localeCompare(b.group_no || 'zz') || a.full_name.localeCompare(b.full_name));
  return {
    sheet: 'Login',
    header: ['Username', 'Role', 'Password', 'Nama', 'Grup'],
    rows: sorted.map((r) => [r.username, roleName(r.role_id), r.password, r.full_name, r.group_no ? groupName(r.group_no) : '']),
    widths: [22, 16, 14, 30, 14],
  };
}
