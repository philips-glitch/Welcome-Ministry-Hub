// Group composition over real member profiles (Supabase or demo store).
import { GROUPS, TEAMS, rng } from '../data.js';

export const GROUP_MIN = 13;
export const GROUP_MAX = 14;
const PLAYER_ROLES = ['member', 'group_leader'];

// Players are the people who get sorted into groups: active, not panitia, member/leader role.
export const isPlayer = (p) => p.active && !p.is_committee && PLAYER_ROLES.includes(p.role_id);
// Captains/PICs attached to a group (shown on the card, not counted in its size).
export const isStaffOf = (p, no) => p.active && p.group_no === no && !PLAYER_ROLES.includes(p.role_id);

export function groupView(profiles) {
  const players = profiles.filter(isPlayer);
  const groups = GROUPS.map(([no, name, color]) => {
    const members = players.filter((p) => p.group_no === no);
    return {
      no, name, color, members,
      leaders: members.filter((p) => p.role_id === 'group_leader'),
      staff: profiles.filter((p) => isStaffOf(p, no)),
    };
  });
  const unassigned = players.filter((p) => !p.group_no);
  return { groups, unassigned, players };
}

export const leaderName = (profiles, no) =>
  profiles.find((p) => isPlayer(p) && p.group_no === no && p.role_id === 'group_leader')?.full_name || '—';

export function validate({ groups }) {
  const violations = [];
  const badGroups = new Set();
  const badMembers = new Set();
  groups.forEach((g) => {
    const nm = `${g.no} ${g.name}`;
    const n = g.members.length;
    if (n > GROUP_MAX) { violations.push(`Grup ${nm}: ${n} anggota (maks ${GROUP_MAX})`); badGroups.add(g.no); }
    if (n < GROUP_MIN) { violations.push(`Grup ${nm}: ${n} anggota (min ${GROUP_MIN})`); badGroups.add(g.no); }
    if (!g.members.some((p) => p.is_ministry_tl)) { violations.push(`Grup ${nm}: belum ada Ministry TL`); badGroups.add(g.no); }
    if (!g.leaders.length) { violations.push(`Grup ${nm}: belum ada Group Leader`); badGroups.add(g.no); }
    if (g.leaders.length > 1) {
      violations.push(`Grup ${nm}: ${g.leaders.length} Group Leader (${g.leaders.map((p) => p.full_name).join(', ')})`);
      g.leaders.forEach((p) => badMembers.add(p.id)); badGroups.add(g.no);
    }
    g.leaders.filter((p) => p.is_ministry_tl).forEach((p) => {
      violations.push(`Grup ${nm}: Group Leader ${p.full_name} adalah Ministry TL`); badMembers.add(p.id); badGroups.add(g.no);
    });
    const byTeam = {};
    g.members.forEach((p) => { if (p.service_team) (byTeam[p.service_team] ||= []).push(p); });
    Object.entries(byTeam).forEach(([t, arr]) => {
      if (arr.length > 1) {
        violations.push(`Grup ${nm}: ${arr.map((p) => p.full_name).join(' & ')} sama-sama tim ${t}`);
        arr.forEach((p) => badMembers.add(p.id)); badGroups.add(g.no);
      }
    });
  });
  return { violations, badGroups, badMembers, ok: violations.length === 0 };
}

// Seeded shuffle of all players into 10 groups: TLs spread first, then others by team so no
// group gets two people from the same service team. Optionally re-picks one non-TL leader per group.
// Returns [[id, patch], …] for only the profiles that change.
export function autoAssign(players, seed, { pickLeaders = true } = {}) {
  const r = rng(seed);
  const g = GROUPS.map(() => []);
  const tls = players.filter((p) => p.is_ministry_tl).map((p) => [p, r()]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  tls.forEach((p, i) => g[i % g.length].push(p));
  const teamIdx = (p) => (p.service_team ? TEAMS.indexOf(p.service_team) : 99);
  const rest = players.filter((p) => !p.is_ministry_tl).map((p) => [p, r()])
    .sort((a, b) => teamIdx(a[0]) - teamIdx(b[0]) || a[1] - b[1]).map((x) => x[0]);
  const hasTeam = (gi, t) => t && g[gi].some((p) => p.service_team === t);
  rest.forEach((p) => {
    const all = [...g.keys()];
    const opts = all.filter((i) => g[i].length < GROUP_MAX && !hasTeam(i, p.service_team));
    const pool = opts.length ? opts : all;
    pool.sort((a, b) => g[a].length - g[b].length || r() - 0.5);
    g[pool[0]].push(p);
  });

  const changes = [];
  g.forEach((ids, gi) => {
    const no = GROUPS[gi][0];
    const leader = pickLeaders ? ids.find((p) => !p.is_ministry_tl) : null;
    ids.forEach((p) => {
      const patch = {};
      if (p.group_no !== no) patch.group_no = no;
      if (pickLeaders) {
        const role = p === leader ? 'group_leader' : 'member';
        if (p.role_id !== role) patch.role_id = role;
      }
      if (Object.keys(patch).length) changes.push([p.id, patch]);
    });
  });
  return changes;
}
