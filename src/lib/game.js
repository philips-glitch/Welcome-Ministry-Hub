// Challenge rules shared by admin and portal: statuses, scoring, draws, standings.
import { GROUPS, rng, rank } from '../data.js';

export const STATUSES = [
  ['draft', 'Draft', '#EDE6D6', '#56655C'],
  ['scheduled', 'Scheduled', '#E3ECF8', '#244F8F'],
  ['live', 'Live', '#E3A92B', '#1B2620'],
  ['closed', 'Closed', '#3C4A42', '#FBF6EA'],
  ['published', 'Results Published', '#1F4D3A', '#FBF6EA'],
];
export const statusMeta = (s) => STATUSES.find((x) => x[0] === s) || STATUSES[0];

export const SECTIONS = [
  ['game_idea', 'Game Idea'], ['how_to_play', 'How to Play'], ['connection', 'The Connection'],
  ['points_rewards', 'Points & Rewards'], ['flourish_hub', 'Flourish Hub'], ['what_we_need', 'What We Need'],
  ['make_it_flourish', 'Make It Flourish'], ['duration', 'Duration'],
];

export const SCORING_TYPES = [
  ['riddle', 'Riddle foto', 'Lokasi benar + partisipasi (tier jumlah orang)'],
  ['flat', 'Poin tetap', 'Tervalidasi = poin penuh'],
  ['manual', 'Nilai manual', 'Validator mengisi skor 0–maks'],
];
export const DEFAULT_SCORING = {
  type: 'riddle', max: 10, location_weight: 50, participation_weight: 50,
  tiers: [{ min: 10, pts: 10 }, { min: 7, pts: 6 }, { min: 0, pts: 2 }],
};

// Tier points for a headcount (tiers sorted by min desc; first match wins).
export function tierPoints(tiers, n) {
  const t = [...(tiers || [])].sort((a, b) => b.min - a.min).find((x) => n >= x.min);
  return t ? t.pts : 0;
}
const round1 = (x) => Math.round(x * 10) / 10;

// Points for one submission under a challenge's scoring rules.
export function computeScore(scoring, { location_correct, participant_count, manual }) {
  const s = { ...DEFAULT_SCORING, ...scoring };
  if (s.type === 'flat') return s.max;
  if (s.type === 'manual') return Math.max(0, Math.min(s.max, Number(manual) || 0));
  const tierMax = Math.max(1, ...s.tiers.map((t) => t.pts));
  const loc = location_correct ? s.max * (s.location_weight / 100) : 0;
  const part = (tierPoints(s.tiers, participant_count) / tierMax) * s.max * (s.participation_weight / 100);
  return round1(loc + part);
}
export function scoreParts(scoring, sub) {
  const s = { ...DEFAULT_SCORING, ...scoring };
  const tierMax = Math.max(1, ...s.tiers.map((t) => t.pts));
  const tier = tierPoints(s.tiers, sub.participant_count);
  return {
    tier,
    loc: round1(sub.location_correct ? s.max * (s.location_weight / 100) : 0),
    part: round1((tier / tierMax) * s.max * (s.participation_weight / 100)),
  };
}

// Seeded draw: `n` distinct riddles per group out of the bank. Returns [{group_no, slot, riddle_id}].
export function drawRiddles(riddleIds, n, seed) {
  const r = rng(seed);
  return GROUPS.flatMap(([no]) => {
    const a = [...riddleIds];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n).map((riddle_id, i) => ({ group_no: no, slot: i + 1, riddle_id }));
  });
}

// Scoreboard columns: every non-draft main challenge by round, then all side quests as one "SQ" column.
export function scoreColumns(challenges) {
  const main = challenges.filter((c) => c.kind === 'main').sort((a, b) => (a.round ?? 99) - (b.round ?? 99));
  const side = challenges.filter((c) => c.kind === 'side');
  const cols = main.map((c) => ({ key: c.id, short: c.code, label: c.name, ids: [c.id], max: c.scoring?.max, open: c.status !== 'draft' }));
  if (side.length) cols.push({ key: 'sq', short: 'SQ', label: 'Side Quests', ids: side.map((c) => c.id), open: side.some((c) => c.status !== 'draft') });
  return cols;
}

// Standings rows from group_scores() output: [{group_no, challenge_id, points, validated}].
export function buildStandings(scores, challenges, captains = {}) {
  const cols = scoreColumns(challenges);
  const rows = GROUPS.map(([no, name, color], gi) => {
    const mine = scores.filter((s) => s.group_no === no);
    const row = { gi, no, name, color, captain: captains[no] || '—', validated: mine.reduce((a, s) => a + s.validated, 0) };
    cols.forEach((c) => { row[c.key] = round1(mine.filter((s) => c.ids.includes(s.challenge_id)).reduce((a, s) => a + Number(s.points), 0)); });
    row.total = round1(cols.reduce((a, c) => a + row[c.key], 0));
    return row;
  });
  return { cols, rows: rank(rows, 'total') };
}

export const fmtWIB = (iso, opts = {}) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...opts }).replace(/\./g, ':') + ' WIB';
};
// <input type="datetime-local"> works in local time; we store UTC ISO and show WIB (UTC+7).
export const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 16) : '');
export const fromLocalInput = (v) => (v ? new Date(v + ':00+07:00').toISOString() : null);
