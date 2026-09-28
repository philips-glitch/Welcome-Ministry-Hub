// Sample data + pure helpers, ported from design/Flourish Hub Admin.dc.html.

export const GROUPS = [
  ['01', 'Olive', '#7F8F24'], ['02', 'Cedar', '#2A8C82'], ['03', 'Fig', '#C4533F'], ['04', 'Vine', '#8A4FA3'],
  ['05', 'Mustard Seed', '#C98A12'], ['06', 'Lily', '#D0577E'], ['07', 'Palm', '#3E86C9'], ['08', 'Oak', '#9A6435'],
  ['09', 'Willow', '#4E9A55'], ['10', 'Hyssop', '#5C63B8'],
];
export const CAPTAINS = ['Yohan', 'Lidya', 'Marco', 'Stefanus', 'Cindy', 'Danny', 'Cherien', 'Maya', 'Rocky', 'Philips'];
export const TEAMS = ['LA', 'LB', 'LC', 'MH1', 'MH2', 'MH3', 'INF', 'NEW', 'PK1', 'PK2', 'KID', 'CC', 'DSA', 'DS1', 'DS2', 'LFT'];
const FIRST = ['Adit', 'Bella', 'Cahya', 'Dewi', 'Evan', 'Felix', 'Gita', 'Hana', 'Irene', 'Joshua', 'Karin', 'Lukas', 'Maria', 'Nico', 'Olivia', 'Paulus', 'Rachel', 'Sarah', 'Tasya', 'Vania', 'Wilson', 'Yuki', 'Albert', 'Bryan', 'Citra', 'Dimas', 'Elisa', 'Frans', 'Glory', 'Hendra', 'Indah', 'Jonathan', 'Kezia', 'Lina', 'Mikha', 'Natalia', 'Oscar', 'Putri', 'Ruth', 'Stevan', 'Theo', 'Vivi', 'Welly', 'Yemima', 'Agnes', 'Benny', 'Christy', 'Edo'];
const LAST = ['A.', 'B.', 'C.', 'D.', 'G.', 'H.', 'K.', 'L.', 'M.', 'N.', 'P.', 'R.', 'S.', 'T.', 'W.', 'Y.', 'F.', 'J.', 'O.', 'E.'];

export const RIDDLES = [
  ['Aku menyambut semua orang, tapi tak pernah bicara. Dorong aku, maka kamu masuk.', 'Pintu kaca utama lobby'],
  ['Di sini kopi dan cerita bertemu setelah ibadah.', 'Area cafe lantai 1'],
  ['Anak-anak berlari ke sini, orang tua melepas dengan lambaian.', 'Kids check-in counter'],
  ['Aku tinggi, penuh nama, tapi hanya dibaca saat menunggu.', 'Papan pengumuman dekat lift'],
  ['Tangga yang paling sering dipakai tapi paling jarang difoto.', 'Tangga sisi timur'],
  ['Aku menyimpan ribuan suara, tapi selalu diam di belakang.', 'Sound booth (FOH)'],
  ['Kartu kecil berisi harapan berakhir di kotak ini.', 'Kotak connect card'],
  ['Di atas semua kursi, aku menatap ke depan.', 'Balkon baris depan'],
  ['Mobil berhenti, senyum pertama dimulai dari sini.', 'Drop-off area depan lobby'],
  ['Tempat paling tenang untuk berdoa sebelum melayani.', 'Prayer room volunteer'],
];

export const DRAW0 = [[1, 5, 8, 10], [4, 6, 2, 9], [7, 3, 10, 1], [3, 7, 2, 9], [5, 8, 6, 4], [10, 2, 1, 7], [9, 4, 5, 3], [6, 1, 9, 8], [2, 10, 4, 6], [8, 9, 7, 5]];
// Per group, per riddle: V validated · S submitted/pending · D draft · N not started · X rejected
export const R1STAT = ['VVSS', 'VVVS', 'VSSD', 'VSDN', 'VVSN', 'VXSD', 'SSDN', 'VSNN', 'SDNN', 'XDNN'];

export const NAV = ['Overview', 'Groups', 'Challenges', 'Validation Queue', 'Scoring & Leaderboard', 'IG Ops', 'Members', 'Audit Log'];

// Demo clock: Jum, 16 Okt 2026 · 19:12 WIB (UTC+7)
export const DEMO_NOW = Date.UTC(2026, 9, 16, 12, 12, 0);
export const R1_DEADLINE = Date.UTC(2026, 9, 18, 16, 55, 0);

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMembers() {
  const sizes = TEAMS.map((_, i) => (i < 9 ? 9 : 8));
  const ms = [];
  let id = 0;
  sizes.forEach((n, t) => {
    for (let k = 0; k < n; k++) {
      ms.push({ id, name: FIRST[id % 48] + ' ' + LAST[(id * 7) % 20], team: t, tl: k === 0 && t < 13 });
      id++;
    }
  });
  return ms;
}
export const MEMBERS = buildMembers();

export function autoAssign(seed) {
  const r = rng(seed);
  const g = Array.from({ length: 10 }, () => []);
  const tls = MEMBERS.filter((m) => m.tl).sort(() => r() - 0.5);
  tls.forEach((m, i) => g[i % 10].push(m.id));
  const rest = MEMBERS.filter((m) => !m.tl)
    .map((m) => [m, r()])
    .sort((a, b) => a[0].team - b[0].team || a[1] - b[1])
    .map((x) => x[0]);
  const hasTeam = (gi, t) => g[gi].some((id) => MEMBERS[id].team === t);
  rest.forEach((m) => {
    const opts = [...Array(10).keys()].filter((i) => g[i].length < 14 && !hasTeam(i, m.team));
    opts.sort((a, b) => g[a].length - g[b].length || r() - 0.5);
    g[opts.length ? opts[0] : 0].push(m.id);
  });
  const leaders = g.map((ids) => ids.find((id) => !MEMBERS[id].tl));
  return { g, leaders };
}

export function drawRiddles(seed) {
  const r = rng(seed);
  return GROUPS.map(() => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = 9; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, 4);
  });
}

// Initial demo state: seed 412, then two members moved into Lily to show rule violations.
export function initialGroups() {
  const a = autoAssign(412);
  const g = a.g.map((x) => [...x]);
  const clashIdx = g[8].findIndex((id) => g[5].some((o) => MEMBERS[o].team === MEMBERS[id].team) && id !== a.leaders[8]);
  g[5].push(g[8].splice(clashIdx, 1)[0]);
  const m2i = g[8].findIndex((id) => id !== a.leaders[8] && !MEMBERS[id].tl);
  g[5].push(g[8].splice(m2i, 1)[0]);
  return { seed: 412, assign: g, leaders: a.leaders };
}

export function initialQueue() {
  const queue = [];
  R1STAT.forEach((st, gi) =>
    [...st].forEach((c, k) => {
      if (c === 'S') {
        queue.push({ gi, rno: DRAW0[gi][k], status: 'pending', count: [12, 9, 11, 13, 8, 10, 14, 7][queue.length % 8], min: 5 + queue.length * 7 });
      }
    })
  );
  return queue;
}

// Participation tier: 10–14 org → 10, 7–9 → 6, ≤6 → 2
export const tier = (n) => (n >= 10 ? 10 : n >= 7 ? 6 : 2);

export const pad = (n) => String(n).padStart(2, '0');
export const memberName = (id) => (id != null ? MEMBERS[id].name : '—');

export function validateGroups(assign, leaders) {
  const violations = [];
  const badGroups = new Set();
  const badMembers = new Set();
  assign.forEach((ids, gi) => {
    const nm = GROUPS[gi][0] + ' ' + GROUPS[gi][1];
    if (ids.length > 14) { violations.push(`Grup ${nm}: ${ids.length} anggota (maks 14)`); badGroups.add(gi); }
    if (ids.length < 13) { violations.push(`Grup ${nm}: ${ids.length} anggota (min 13)`); badGroups.add(gi); }
    if (!ids.some((id) => MEMBERS[id].tl)) { violations.push(`Grup ${nm}: belum ada Ministry TL`); badGroups.add(gi); }
    const ld = leaders[gi];
    if (ld == null || !ids.includes(ld)) { violations.push(`Grup ${nm}: belum ada Group Leader`); badGroups.add(gi); }
    else if (MEMBERS[ld].tl) { violations.push(`Grup ${nm}: Group Leader ${MEMBERS[ld].name} adalah Ministry TL`); badMembers.add(ld); badGroups.add(gi); }
    const byTeam = {};
    ids.forEach((id) => { const t = MEMBERS[id].team; (byTeam[t] = byTeam[t] || []).push(id); });
    Object.entries(byTeam).forEach(([t, arr]) => {
      if (arr.length > 1) {
        violations.push(`Grup ${nm}: ${arr.map((id) => MEMBERS[id].name).join(' & ')} sama-sama tim ${TEAMS[t]}`);
        arr.forEach((id) => badMembers.add(id));
        badGroups.add(gi);
      }
    });
  });
  return { violations, badGroups, badMembers, ok: violations.length === 0 };
}
