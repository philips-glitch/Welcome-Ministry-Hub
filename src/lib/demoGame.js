// Demo-mode game data, mirroring supabase/migrations/0002_game.sql (same tables, same seed).
import { GROUPS, RIDDLES, DRAW0, R1STAT } from '../data.js';
import { DEFAULT_SCORING } from './game.js';
import { notifyReview, notifyChallenge, syncReminders, seedNotifications } from './demoNotify.js';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(16).slice(2));
const wib = (s) => (s ? new Date(s + ':00+07:00').toISOString() : null);

const R1_SECTIONS = {
  game_idea: 'Riddle berburu lokasi di area gereja. Tiap grup dapat 4 riddle acak dari bank 10.',
  how_to_play: 'Pecahkan riddle → datang ke lokasi → selfie satu grup → post IG Story tag akun event → Leader submit di portal.',
  connection: 'Memaksa grup bergerak bareng dan ngobrol di luar jam pelayanan biasa.',
  points_rewards: 'Maks 10/riddle: 50% lokasi benar + 50% partisipasi. “First correct” direpost Rabu.',
  flourish_hub: 'Submit: foto grup + link/screenshot IG Story + tag anggota + deklarasi No-AI. Verifikasi oleh captain.',
  what_we_need: 'Venue: seluruh area gedung · Material: riddle card digital.',
  make_it_flourish: 'Repost foto terbaik; captain kasih shout-out di grup WA.',
  duration: 'Kam 15 Okt 20:00 – Min 18 Okt 23:55 WIB',
};

export function seedGame(profiles) {
  const pic = (name) => profiles.find((p) => p.full_name === name)?.id ?? null;
  const ch = (code, kind, round, name, status, [announce, open, deadline, validate], extra = {}) => ({
    id: 'c-' + code.toLowerCase(), code, kind, round, name, pic_id: null, status,
    announce_at: wib(announce), open_at: wib(open), deadline_at: wib(deadline), validate_by: wib(validate),
    sections: {}, scoring: { type: 'manual', max: 20 }, riddles_per_group: 0, draw_seed: null, draw_locked: false,
    sort: 0, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', ...extra,
  });
  const challenges = [
    ch('R1', 'main', 1, 'Photo Challenge', 'live', ['2026-10-15T20:00', '2026-10-15T20:00', '2026-10-18T23:55', '2026-10-20T23:59'],
      { pic_id: pic('Cindy'), sections: R1_SECTIONS, scoring: DEFAULT_SCORING, riddles_per_group: 4, draw_seed: 7731, draw_locked: true, sort: 1 }),
    ch('R4', 'main', 4, 'Scrapbook / Poster', 'scheduled', ['2026-10-15T20:00', '2026-10-15T20:00', '2026-11-19T23:55', null], { pic_id: pic('Rocky'), scoring: { type: 'manual', max: 30 }, sort: 4 }),
    ch('R2', 'main', 2, 'Video Challenge', 'draft', ['2026-10-22T20:00', '2026-10-25T00:00', '2026-11-01T23:55', null], { pic_id: pic('Danny'), sort: 2 }),
    ch('R3', 'main', 3, 'Spice It Up', 'draft', ['2026-11-04T20:00', '2026-11-06T20:00', '2026-11-08T23:55', null], { pic_id: pic('Maya'), sort: 3 }),
    ch('R5', 'main', 5, 'Beyond UR', 'draft', [null, null, null, null], { sort: 5 }),
    ch('R6', 'main', 6, 'The Legacy Challenge', 'draft', [null, null, null, null], { sort: 6 }),
    ch('SQ1', 'side', null, 'Get To Know Me', 'live', ['2026-10-08T20:00', '2026-10-08T20:00', '2026-11-19T23:55', null], { scoring: { type: 'flat', max: 10 }, sort: 7 }),
    ch('SQ2', 'side', null, 'Find Your Match', 'live', ['2026-10-08T20:00', '2026-10-08T20:00', '2026-11-19T23:55', null], { scoring: { type: 'flat', max: 15 }, sort: 8 }),
    ch('SQ3', 'side', null, 'Connect 10', 'scheduled', ['2026-10-22T20:00', '2026-10-22T20:00', '2026-11-19T23:55', null], { scoring: { type: 'flat', max: 30 }, sort: 9 }),
  ];
  const riddles = RIDDLES.map(([prompt, answer], i) => ({ id: `r-${i + 1}`, challenge_id: 'c-r1', no: i + 1, prompt, answer }));
  const draws = DRAW0.flatMap((nos, gi) => nos.map((n, k) => ({ challenge_id: 'c-r1', group_no: GROUPS[gi][0], slot: k + 1, riddle_id: `r-${n}` })));

  // Submissions matching the Overview snapshot: V validated · S waiting · X rejected (D/N = nothing yet).
  const roster = (no) => profiles.filter((p) => p.group_no === no && ['member', 'group_leader'].includes(p.role_id));
  const leader = (no) => roster(no).find((p) => p.role_id === 'group_leader')?.id ?? null;
  const VALID = [[true, 12, 10], [true, 8, 8], [true, 5, 6]]; // location, headcount → score
  const submissions = [];
  let q = 0;
  R1STAT.forEach((st, gi) => {
    const no = GROUPS[gi][0];
    [...st].forEach((c, k) => {
      if (c === 'D' || c === 'N') return;
      const base = {
        id: uid(), challenge_id: 'c-r1', group_no: no, riddle_id: `r-${DRAW0[gi][k]}`, version: 1, submitted_by: leader(no),
        media_path: null, media_name: 'IMG_2041.jpg', ig_url: `instagram.com/stories/${GROUPS[gi][1].toLowerCase().replace(/\s/g, '')}.wm${no}/3219`,
        declaration: true, reviewed_by: null, reviewed_at: null, checks: null, location_correct: null, participant_count: null, score: null, override_note: null, reject_reason: null,
      };
      if (c === 'S') {
        const n = [12, 9, 11, 13, 8, 10, 14, 7][q % 8];
        const t = new Date(new Date(wib('2026-10-16T09:05')).getTime() + q * 21 * 60e3).toISOString();
        q++;
        submissions.push({ ...base, status: 'submitted', submitted_at: t, tagged_ids: roster(no).slice(0, n).map((p) => p.id) });
      } else {
        const [loc, n, score] = VALID[(gi + k) % 3];
        submissions.push({
          ...base, status: c === 'V' ? 'validated' : 'rejected', submitted_at: wib('2026-10-15T22:30'), tagged_ids: roster(no).slice(0, n).map((p) => p.id),
          reviewed_at: wib('2026-10-16T08:00'), location_correct: loc, participant_count: n, score: c === 'V' ? score : null,
          checks: [c === 'V', true, true, true, true], reject_reason: c === 'X' ? 'IG tag tidak ada' : null,
        });
      }
    });
  });
  // Side quests already validated before R1.
  GROUPS.slice(0, 7).forEach(([no], gi) => {
    const sq = gi < 2 ? ['c-sq2', 15] : ['c-sq1', 10];
    submissions.push({
      id: uid(), challenge_id: sq[0], group_no: no, riddle_id: null, version: 1, status: 'validated', submitted_by: leader(no),
      submitted_at: wib('2026-10-11T19:00'), media_path: null, media_name: 'sidequest.jpg', ig_url: null, tagged_ids: [], declaration: true,
      reviewed_by: null, reviewed_at: wib('2026-10-13T20:00'), checks: null, location_correct: null, participant_count: null, score: sq[1], override_note: null, reject_reason: null,
    });
  });

  const groups = GROUPS.map(([no, name, color], i) => ({ no, name, color, min_size: 13, max_size: 14, sort: i + 1, locked_at: null, locked_by: null }));
  return { groups, challenges, riddles, draws, submissions };
}

// Game methods over the demo state. `ctx` = { load, save, delay, fail }.
export function gameMethods({ load, save, delay, fail }) {
  const sortBy = (k) => (a, b) => (a[k] ?? 0) - (b[k] ?? 0);
  // Older saved demo states predate notifications: backfill once.
  const notifs = (s) => { if (!s.notifications) seedNotifications(s); return s.notifications; };
  return {
    async listNotifications() {
      const s = load();
      notifs(s);
      syncReminders(s);
      save();
      const me = s.profiles.find((p) => p.id === s.sessionId);
      const myGroup = me?.active ? me.group_no : null;
      const read = new Set(s.notificationReads?.[s.sessionId] || []);
      return delay(s.notifications
        .filter((n) => n.group_no == null || n.group_no === myGroup)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50)
        .map((n) => ({ ...n, read: read.has(n.id) })));
    },
    async markNotificationsRead(ids) {
      const s = load();
      s.notificationReads ||= {};
      s.notificationReads[s.sessionId] = [...new Set([...(s.notificationReads[s.sessionId] || []), ...ids])];
      save(); return delay();
    },
    async listGroups() {
      // Older saved states predate size limits / sort.
      return delay(structuredClone(load().groups).map((g, i) => ({ min_size: 13, max_size: 14, sort: i + 1, ...g })).sort((a, b) => a.sort - b.sort || a.no.localeCompare(b.no)));
    },
    async createGroup(g) {
      const s = load();
      if (s.groups.some((x) => x.no === g.no)) return fail(`Nomor grup ${g.no} sudah dipakai.`);
      const row = { min_size: 13, max_size: 14, sort: Math.max(0, ...s.groups.map((x) => x.sort || 0)) + 1, locked_at: null, locked_by: null, ...g };
      s.groups.push(row);
      save(); return delay(structuredClone(row));
    },
    async updateGroup(no, patch) {
      const s = load();
      const i = s.groups.findIndex((x) => x.no === no);
      if (i < 0) return fail('Grup tidak ditemukan.');
      const to = patch.no ?? no;
      if (to !== no) {
        if (s.groups.some((x) => x.no === to)) return fail(`Nomor grup ${to} sudah dipakai.`);
        // Same cascade as the FK "on update cascade" in 0004_groups_crud.sql.
        const move = (x) => { if (x.group_no === no) x.group_no = to; };
        s.profiles.forEach(move); s.draws.forEach(move); s.submissions.forEach(move); (s.notifications || []).forEach(move);
      }
      s.groups[i] = { ...s.groups[i], ...patch };
      save(); return delay(structuredClone(s.groups[i]));
    },
    async deleteGroup(no) {
      const s = load();
      const n = s.submissions.filter((x) => x.group_no === no).length;
      if (n) return fail(`Grup ${no} punya ${n} submission dan tidak bisa dihapus. Ganti nama grup kalau perlu.`);
      s.groups = s.groups.filter((x) => x.no !== no);
      s.profiles.forEach((p) => { if (p.group_no === no) p.group_no = null; });
      s.draws = s.draws.filter((d) => d.group_no !== no);
      s.notifications = (s.notifications || []).filter((x) => x.group_no !== no);
      save(); return delay();
    },
    async setGroupsLocked(locked) {
      const s = load();
      s.groups = s.groups.map((g) => ({ ...g, locked_at: locked ? new Date().toISOString() : null, locked_by: locked ? s.sessionId : null }));
      save(); return delay();
    },
    async listChallenges() { return delay(structuredClone(load().challenges).sort(sortBy('sort'))); },
    async saveChallenge(c) {
      const s = load();
      if (c.code && s.challenges.some((x) => x.code === c.code && x.id !== c.id)) return fail(`Kode ${c.code} sudah dipakai.`);
      const now = new Date().toISOString();
      const i = c.id ? s.challenges.findIndex((x) => x.id === c.id) : -1;
      const prevStatus = i >= 0 ? s.challenges[i].status : null;
      const row = i >= 0 ? { ...s.challenges[i], ...c, updated_at: now } : { draw_seed: null, draw_locked: false, sort: s.challenges.length + 1, ...c, id: uid(), created_at: now, updated_at: now };
      if (i >= 0) s.challenges[i] = row; else s.challenges.push(row);
      if (row.status !== prevStatus) { notifs(s); notifyChallenge(s, row); }
      save(); return delay(structuredClone(row));
    },
    async deleteChallenge(id) {
      const s = load();
      s.challenges = s.challenges.filter((c) => c.id !== id);
      s.riddles = s.riddles.filter((r) => r.challenge_id !== id);
      s.draws = s.draws.filter((d) => d.challenge_id !== id);
      s.submissions = s.submissions.filter((x) => x.challenge_id !== id);
      save(); return delay();
    },
    async listRiddles(challengeId) { return delay(structuredClone(load().riddles.filter((r) => r.challenge_id === challengeId)).sort(sortBy('no'))); },
    async saveRiddle(r) {
      const s = load();
      if (s.riddles.some((x) => x.challenge_id === r.challenge_id && x.no === r.no && x.id !== r.id)) return fail(`Riddle #${r.no} sudah ada.`);
      const i = r.id ? s.riddles.findIndex((x) => x.id === r.id) : -1;
      const row = i >= 0 ? { ...s.riddles[i], ...r } : { ...r, id: uid() };
      if (i >= 0) s.riddles[i] = row; else s.riddles.push(row);
      save(); return delay(structuredClone(row));
    },
    async deleteRiddle(id) {
      const s = load();
      s.riddles = s.riddles.filter((r) => r.id !== id);
      s.draws = s.draws.filter((d) => d.riddle_id !== id);
      save(); return delay();
    },
    async getDraw(challengeId) { return delay(structuredClone(load().draws.filter((d) => d.challenge_id === challengeId))); },
    async saveDraw(challengeId, rows, seed) {
      const s = load();
      s.draws = [...s.draws.filter((d) => d.challenge_id !== challengeId), ...rows.map((r) => ({ ...r, challenge_id: challengeId }))];
      save();
      return this.saveChallenge({ id: challengeId, draw_seed: seed });
    },
    async listSubmissions({ challengeId, groupNo } = {}) {
      return delay(structuredClone(load().submissions.filter((x) => (!challengeId || x.challenge_id === challengeId) && (!groupNo || x.group_no === groupNo)))
        .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)));
    },
    async createSubmission({ file, ...sub }) {
      const s = load();
      const c = s.challenges.find((x) => x.id === sub.challenge_id);
      if (!c || c.status !== 'live') return fail('Challenge ini sedang tidak menerima submission.');
      const prev = s.submissions.filter((x) => x.challenge_id === sub.challenge_id && x.group_no === sub.group_no && x.riddle_id === (sub.riddle_id ?? null));
      const row = {
        id: uid(), riddle_id: null, media_path: null, ig_url: null, tagged_ids: [], declaration: false, ...sub, media_name: file?.name ?? sub.media_name ?? null,
        version: prev.length + 1, status: 'submitted', submitted_by: s.sessionId, submitted_at: new Date().toISOString(),
        reviewed_by: null, reviewed_at: null, checks: null, location_correct: null, participant_count: null, score: null, override_note: null, reject_reason: null,
      };
      s.submissions.push(row);
      save(); return delay(structuredClone(row));
    },
    async reviewSubmission(id, patch) {
      const s = load();
      const i = s.submissions.findIndex((x) => x.id === id);
      if (i < 0) return fail('Submission tidak ditemukan.');
      const prevStatus = s.submissions[i].status;
      s.submissions[i] = { ...s.submissions[i], ...patch, reviewed_by: s.sessionId, reviewed_at: new Date().toISOString() };
      if (s.submissions[i].status !== prevStatus) { notifs(s); notifyReview(s, s.submissions[i]); }
      save(); return delay(structuredClone(s.submissions[i]));
    },
    async mediaUrl() { return null; },
    async groupScores() {
      const s = load();
      const open = new Set(s.challenges.filter((c) => c.status !== 'draft').map((c) => c.id));
      const acc = {};
      s.submissions.filter((x) => x.status === 'validated' && open.has(x.challenge_id)).forEach((x) => {
        const k = x.group_no + '|' + x.challenge_id;
        acc[k] ||= { group_no: x.group_no, challenge_id: x.challenge_id, points: 0, validated: 0 };
        acc[k].points += Number(x.score) || 0; acc[k].validated++;
      });
      return delay(Object.values(acc));
    },
  };
}
