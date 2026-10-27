// Challenge rules shared by admin and portal: statuses, scoring, draws, standings.
import { rng, rank } from '../data.js';

export const STATUSES = [
  ['draft', 'Draft', '#EDE6D6', '#56655C'],
  ['scheduled', 'Scheduled', '#E3ECF8', '#244F8F'],
  ['live', 'Live', '#E3A92B', '#1B2620'],
  ['closed', 'Closed', '#3C4A42', '#FBF6EA'],
  ['published', 'Results Published', '#1F4D3A', '#FBF6EA'],
];
export const statusMeta = (s) => STATUSES.find((x) => x[0] === s) || STATUSES[0];

// Text sections members read on the challenge page (challenges.sections). Multi-line; "- " lines are bullets.
export const SECTIONS = [
  ['game_idea', 'Game Idea'], ['how_to_play', 'How to Play'], ['rules', 'Rules'], ['connection', 'The Connection'],
  ['points_rewards', 'Points & Rewards'], ['flourish_hub', 'Flourish Hub'], ['what_we_need', 'What We Need'],
  ['make_it_flourish', 'Make It Flourish'], ['duration', 'Duration'],
];

export const SCORING_TYPES = [
  ['riddle', 'Riddle foto', 'Lokasi benar + partisipasi (tier jumlah orang)'],
  ['give_grow', 'Video + partisipasi (Give and Grow)', 'Rubrik video 50 + partisipasi offline/online, bonus offline & BTS 50'],
  ['proportional', 'Riddle proporsional (Skenario 1)', 'Per riddle: jawaban benar + anggota yang dipilih leader ÷ anggota grup'],
  ['rubric', 'Rubrik + partisipasi tim', 'Nilai per kriteria tiap submission + poin partisipasi tim'],
  ['connect', 'Kenalan (individu)', 'Tiap anggota submit sendiri · rata-rata individu + tingkat partisipasi'],
  ['flat', 'Poin tetap', 'Tervalidasi = poin penuh'],
  ['manual', 'Nilai manual', 'Validator mengisi skor 0–maks'],
];
export const DEFAULT_SCORING = {
  type: 'riddle', max: 10, location_weight: 50, participation_weight: 50,
  tiers: [{ min: 10, pts: 10 }, { min: 7, pts: 6 }, { min: 0, pts: 2 }],
};
// Each submission scored on criteria; the team also gets one participation score from everyone
// tagged across its validated submissions.
export const DEFAULT_RUBRIC = {
  type: 'rubric',
  criteria: [{ key: 'correct', label: 'Jawaban benar & foto membuktikan', max: 10, binary: true }],
  participation: { tiers: [{ min: 10, pts: 10 }, { min: 7, pts: 6 }, { min: 0, pts: 2 }] },
};
// Every member submits for themselves about `people` group-mates. Team score =
// average member score (of those who took part) × individual_weight + participation rate × participation_weight,
// participation rate = (members who submitted + members who were interviewed) ÷ team size × ½.
export const DEFAULT_CONNECT = {
  type: 'connect', people: 2, photo_bonus: 2, individual_weight: 70, participation_weight: 30,
  questions: [
    { key: 'q1', text: 'What are 3 words they used to describe themselves?', max: 2, ref: 'words' },
    { key: 'q2', text: "What's something they really enjoy doing?", max: 2, ref: 'enjoy' },
    { key: 'q3', text: "What's their hidden talent?", max: 2, ref: 'talent' },
    { key: 'q4', text: "What's ONE thing you discovered about them that you didn't know before?", max: 4 },
  ],
};
// Get to Know Me answers from the Member Form: the key validators compare Q1–Q3 against.
export const GTKM_FIELDS = [['words', '3 kata tentang dirinya'], ['enjoy', 'Hal yang paling disukai'], ['talent', 'Hidden talent']];

// Riddle scoring "Skenario 1 — Proportional": per riddle, a correct answer earns answer_pts and the photo earns
// participation_pts × (members in the photo ÷ team size). 4 riddles × (12.5 + 12.5) = 100.
export const DEFAULT_PROPORTIONAL = { type: 'proportional', answer_pts: 12.5, participation_pts: 12.5 };
// Give and Grow: official team video (rubric) + participation = unique verified participants (offline ∪ online)
// ÷ team × overall_pts, + offline_pts if anyone took part offline, + BTS (photos ≥3 / video ≥15 s).
export const DEFAULT_GIVE_GROW = {"type":"give_grow","criteria":[{"key":"fit","label":"Challenge & fit","max":20,"hint":"Follows Give and Grow and one clear theme."},{"key":"useful","label":"Useful / meaningful content","max":15,"hint":"Gives viewers a meaningful lesson or practical insight."},{"key":"clear","label":"Clarity (easy to understand)","max":10,"hint":"Easy to follow and within 60 seconds."},{"key":"team","label":"Team involvement / execution","max":5,"hint":"Shows genuine team involvement in the making."}],"overall_pts":40,"offline_pts":5,"bts_photo_pts":2,"bts_video_pts":5};
export const withDefaults = (scoring) => ({
  ...({ riddle: DEFAULT_SCORING, rubric: DEFAULT_RUBRIC, connect: DEFAULT_CONNECT, proportional: DEFAULT_PROPORTIONAL, give_grow: DEFAULT_GIVE_GROW }[scoring?.type] || {}),
  ...scoring,
});
export const isConnect = (c) => c?.scoring?.type === 'connect';

// Tier points for a headcount (tiers sorted by min desc; first match wins).
export function tierPoints(tiers, n) {
  const t = [...(tiers || [])].sort((a, b) => b.min - a.min).find((x) => n >= x.min);
  return t ? t.pts : 0;
}
const round1 = (x) => Math.round(x * 10) / 10;
const sum = (xs) => xs.reduce((a, x) => a + (Number(x) || 0), 0);
const tierMaxPts = (tiers) => Math.max(0, ...(tiers || []).map((t) => Number(t.pts) || 0));

// Max points one submission can earn.
export function itemMax(scoring) {
  const s = withDefaults(scoring);
  if (s.type === 'connect') return sum(s.questions.map((q) => q.max)) + (Number(s.photo_bonus) || 0);
  if (s.type === 'rubric') return sum(s.criteria.map((c) => c.max));
  if (s.type === 'proportional') return (Number(s.answer_pts) || 0) + (Number(s.participation_pts) || 0);
  if (s.type === 'give_grow') return sum(s.criteria.map((c) => c.max)) + (Number(s.overall_pts) || 0) + (Number(s.offline_pts) || 0) + Math.max(Number(s.bts_photo_pts) || 0, Number(s.bts_video_pts) || 0);
  return Number(s.max) || 0;
}
// Max points one team can earn in a challenge.
export function teamMax(c) {
  const s = withDefaults(c.scoring);
  if (s.type === 'connect') return (Number(s.individual_weight) || 0) + (Number(s.participation_weight) || 0);
  const items = c.riddles_per_group > 0 ? c.riddles_per_group : 1;
  return round1(itemMax(s) * items + (s.type === 'rubric' ? tierMaxPts(s.participation?.tiers) : 0));
}

// The thing a submission's version counts up on: a riddle, a member's chosen person (connect), or the single entry.
export const unitKey = (x) => (x.target_id ? `${x.submitted_by}>${x.target_id}` : x.riddle_id ?? '-');
export function latestPerUnit(subs) {
  const m = new Map();
  subs.forEach((x) => { const k = unitKey(x); if (!m.has(k) || x.version > m.get(k).version) m.set(k, x); });
  return [...m.values()];
}

// Connect challenges: per-member totals (best `people` validated entries), average over the members who took
// part, and participation = (unique people who submitted + unique people interviewed) ÷ team size × ½.
// noPoints: people who play without points (captains) — they don't count as interviewed either.
export function connectBreakdown(scoring, subs, rosterSize, noPoints = new Set()) {
  const s = withDefaults(scoring);
  const byMember = {};
  const valid = subs.filter((x) => x.status === 'validated');
  valid.forEach((x) => { (byMember[x.submitted_by] ||= []).push(Number(x.score) || 0); });
  const totals = Object.values(byMember).map((xs) => sum(xs.sort((a, b) => b - a).slice(0, s.people)));
  const interviewed = new Set(valid.map((x) => x.target_id).filter((id) => id && !noPoints.has(id))).size;
  const memberMax = s.people * itemMax(s);
  const avg = totals.length ? sum(totals) / totals.length : 0;
  const rate = rosterSize ? Math.min(1, (totals.length + interviewed) / rosterSize / 2) : 0;
  // Each part rounded to 0.1 before adding, like the playbook's worked examples (64.2 + 18.5 = 82.7).
  const indiv = round1(memberMax ? (avg / memberMax) * s.individual_weight : 0);
  const part = round1(rate * s.participation_weight);
  return { participants: totals.length, interviewed, memberMax, avg: round1(avg), rate, indiv, part, points: totals.length ? round1(indiv + part) : 0 };
}

// Super Admin / PIC can re-validate (reopen) and change points of a mini event's submissions until the next mini
// event opens (R1 until R2 starts). Draft events don't count; the last one has no limit.
export function revalidateWindow(c, challenges, now = Date.now()) {
  if (!c || c.kind !== 'main' || c.round == null) return { next: null, at: null, closed: false };
  const next = (challenges || []).filter((x) => x.kind === 'main' && x.round > c.round && x.status !== 'draft').sort((a, b) => a.round - b.round)[0] || null;
  if (!next) return { next: null, at: null, closed: false };
  const closed = ['live', 'closed', 'published'].includes(next.status) || (!!next.open_at && now >= new Date(next.open_at).getTime());
  return { next, at: next.open_at || null, closed };
}

// One group's points for one challenge from that group's submissions. Mirrors group_scores() in SQL.
// noPoints: ids of people who play without points (captains) — their entries and photo tags don't count.
export function groupPoints(c, subs, rosterSize, noPoints = new Set()) {
  const s = withDefaults(c.scoring);
  // Only the latest validated version of each entry counts.
  const valid = latestPerUnit(subs.filter((x) => x.status === 'validated' && !noPoints.has(x.submitted_by)));
  if (!valid.length) return 0;
  if (s.type === 'connect') return connectBreakdown(s, valid, rosterSize, noPoints).points;
  // Give and Grow: the official team video (+ its BTS / offline) and the members' validated Reels together.
  if (s.type === 'give_grow') {
    const official = valid.find((x) => !x.target_id);
    const reels = valid.filter((x) => x.target_id).map((x) => x.submitted_by);
    if (official?.marks && official.override_note == null) return round1(giveGrowParts(s, { marks: official.marks, team_size: rosterSize, online_ids: reels, exclude: noPoints }).total);
    return round1((official ? Number(official.score) || 0 : 0) + (official ? 0 : giveGrowParts(s, { team_size: rosterSize, online_ids: reels, exclude: noPoints }).total));
  }
  const base = sum(valid.map((x) => x.score));
  if (s.type !== 'rubric') return round1(base);
  return round1(base + tierPoints(s.participation?.tiers, new Set(valid.flatMap((x) => (x.tagged_ids || []).filter((id) => !noPoints.has(id)))).size));
}

// Points from a validator's marks: connect = answers + photo bonus, rubric = sum of criteria.
export function marksScore(scoring, marks = {}) {
  const s = withDefaults(scoring);
  if (s.type === 'connect') return round1(sum(s.questions.map((q) => Math.min(q.max, Number(marks[q.key]) || 0))) + (marks.photo ? Number(s.photo_bonus) || 0 : 0));
  if (s.type === 'rubric') return round1(sum(s.criteria.map((c) => Math.min(c.max, Number(marks[c.key]) || 0))));
  if (s.type === 'give_grow') return giveGrowParts(s, { marks, team_ids: [] }).video;
  return 0;
}
export const marksMissing = (scoring, marks = {}) => {
  const s = withDefaults(scoring);
  const missing = (s.type === 'connect' ? s.questions : ['rubric', 'give_grow'].includes(s.type) ? s.criteria : []).filter((x) => marks[x.key] == null || marks[x.key] === '');
  if (s.type === 'give_grow' && !marks.bts) missing.push({ key: 'bts', label: 'BTS' });
  return missing;
};

// How a challenge is submitted and reviewed (challenges.form). Missing keys fall back by scoring type.
//   photo / link: 'required' | 'optional' | 'none' · answer_label: free-text answer per riddle
//   confirm: rules the submitter ticks · checks / reasons: validator checklist and reject reasons
export function formOf(c) {
  const t = c?.scoring?.type;
  const base = t === 'connect' ? { photo: 'optional', link: 'none', tags: false } : { photo: 'required', link: t === 'riddle' ? 'required' : 'optional', tags: true };
  return { link_label: 'Link Image', answer_label: null, tag_label: 'Siapa aja di foto?', confirm: null, checks: null, reasons: null, ...base, ...c?.form };
}

// Give and Grow parts for the team's official submission. marks: rubric criteria + offline / online (verified
// member ids) + bts ('none' | 'photos' | 'video'). team_ids: the team (members + Group Leaders, no captains).
// online_ids: members whose own Reels submission is validated. Either team_ids (who counts) or team_size +
// exclude (people who don't count, i.e. captains) describe the team.
export function giveGrowParts(scoring, { marks = {}, team_ids = null, team_size = 0, online_ids = [], exclude = new Set() }) {
  const s = withDefaults(scoring);
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const video = sum(s.criteria.map((c) => Math.min(c.max, Math.max(0, Number(marks[c.key]) || 0))));
  const team = team_ids ? new Set(team_ids) : null;
  const counts = (id) => (team ? team.has(id) : !exclude.has(id));
  const size = team ? team.size : Number(team_size) || 0;
  const offline = [...new Set(marks.offline || [])].filter(counts);
  const online = [...new Set([...(marks.online || []), ...online_ids])].filter(counts);
  const participants = new Set([...offline, ...online]).size;
  const overall = size ? r3(Math.min(1, participants / size) * (Number(s.overall_pts) || 0)) : 0;
  const offlineBonus = offline.length ? Number(s.offline_pts) || 0 : 0;
  const bts = marks.bts === 'video' ? Number(s.bts_video_pts) || 0 : marks.bts === 'photos' ? Number(s.bts_photo_pts) || 0 : 0;
  return { video, participants, offline: offline.length, online: online.length, overall, offlineBonus, bts, total: r3(video + overall + offlineBonus + bts) };
}

// Points for one submission under a challenge's scoring rules.
export function computeScore(scoring, { location_correct, participant_count, manual, marks, team_size, answer_score }) {
  if (['connect', 'rubric'].includes(scoring?.type)) return marksScore(scoring, marks);
  if (scoring?.type === 'proportional') {
    const p = proportionalParts(scoring, { location_correct, participant_count, team_size, answer_score });
    return Math.round((p.answer + p.part) * 1000) / 1000;
  }
  const s = { ...DEFAULT_SCORING, ...scoring };
  if (s.type === 'flat') return s.max;
  if (s.type === 'manual') return Math.max(0, Math.min(s.max, Number(manual) || 0));
  const tierMax = Math.max(1, ...s.tiers.map((t) => t.pts));
  const loc = location_correct ? s.max * (s.location_weight / 100) : 0;
  const part = (tierPoints(s.tiers, participant_count) / tierMax) * s.max * (s.participation_weight / 100);
  return round1(loc + part);
}
// Skenario 1 parts for one riddle: answer points + participation points (members in photo ÷ team size, max 1).
// answer_score: a manual riddle score (0–answer_pts) instead of full/zero; participation stays automatic.
export function proportionalParts(scoring, { location_correct, participant_count, team_size, answer_score }) {
  const s = withDefaults(scoring);
  const n = Number(team_size) || 0;
  const full = Number(s.answer_pts) || 0;
  const rate = n ? Math.min(1, Math.max(0, Number(participant_count) || 0) / n) : 0;
  const answer = answer_score != null && answer_score !== '' ? Math.max(0, Math.min(full, Number(answer_score) || 0)) : location_correct ? full : 0;
  return { answer, rate, part: Math.round(rate * (Number(s.participation_pts) || 0) * 1000) / 1000 };
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
export function drawRiddles(riddleIds, n, seed, groups) {
  const r = rng(seed);
  return groups.flatMap(({ no }) => {
    const a = [...riddleIds];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n).map((riddle_id, i) => ({ group_no: no, slot: i + 1, riddle_id }));
  });
}

// Scoreboard columns: every non-draft main challenge by round, then all side quests as one "SQ" column.
export function scoreColumns(challenges) {
  const main = challenges.filter((c) => c.kind === 'main').sort((a, b) => (a.round ?? 99) - (b.round ?? 99));
  const side = challenges.filter((c) => c.kind === 'side');
  const cols = main.map((c) => ({ key: c.id, short: c.code, label: c.name, ids: [c.id], max: teamMax(c), open: c.status !== 'draft' }));
  if (side.length) cols.push({ key: 'sq', short: 'SQ', label: 'Side Quests', ids: side.map((c) => c.id), open: side.some((c) => c.status !== 'draft') });
  return cols;
}

// Standings rows from group_scores() output: [{group_no, challenge_id, points, validated}].
export function buildStandings(scores, challenges, captains = {}, groups = []) {
  const cols = scoreColumns(challenges);
  const rows = groups.map(({ no, name, color }, gi) => {
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
