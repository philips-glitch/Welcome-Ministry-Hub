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

// Sort by `key` desc and assign competition ranks (1, 2, 2, 4).
export function rank(rows, key) {
  const sorted = [...rows].sort((a, b) => b[key] - a[key] || a.no.localeCompare(b.no));
  return sorted.map((r, i) => ({ ...r, rank: i > 0 && sorted[i - 1][key] === r[key] ? null : i + 1 }))
    .map((r, i, arr) => ({ ...r, rank: r.rank ?? arr.slice(0, i).reverse().find((x) => x.rank)?.rank }));
}

// Demo clock: Jum, 16 Okt 2026 · 19:12 WIB (UTC+7)
export const DEMO_NOW = Date.UTC(2026, 9, 16, 12, 12, 0);
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

export const pad = (n) => String(n).padStart(2, '0');

