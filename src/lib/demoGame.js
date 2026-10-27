// Demo-mode game data, mirroring server/schema.js + server/rpc.js (same tables, same seed, same rules).
import { GROUPS, RIDDLES, rng } from '../data.js';
import { PLAYBOOK } from './playbook.js';
import { isConnect, marksScore, unitKey, groupPoints, withDefaults, drawRiddles, itemMax, revalidateWindow, computeScore, giveGrowParts } from './game.js';
import { isPlayer, isGamePlayer, validatesOnly, playsWithoutPoints } from './groups.js';
import { notifyReview, notifyReopen, notifyAdjust, notifyChallenge, syncReminders, seedNotifications, demoNow } from './demoNotify.js';
import { putMedia, mediaObjectUrl } from './demoMedia.js';

// A submission plus who reviewed it (name + role), like the server returns it.
const withReviewer = (s, x) => {
  const r = x.reviewed_by && s.profiles.find((p) => p.id === x.reviewed_by);
  return { ...x, reviewed_by_name: r ? r.full_name || r.username : null, reviewed_by_role: r?.role_id ?? null };
};
// Same as assertRevalidateOpen() on the server: a message once the next mini event has opened, else null.
const revalidateClosed = (s, id) => {
  const c = s.challenges.find((x) => x.id === s.submissions.find((y) => y.id === id)?.challenge_id);
  const w = revalidateWindow(c, s.challenges, demoNow());
  return w.closed ? `Re-validasi ${c.code} sudah ditutup sejak ${w.next.code} dibuka.` : null;
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(16).slice(2));
const wib = (s) => (s ? new Date(s + ':00+07:00').toISOString() : null);
// has_permission() for the signed-in demo user.
const canDemo = (s, perm) => {
  const me = s.profiles.find((p) => p.id === s.sessionId);
  return !!me?.active && (s.grants?.[me.role_id] || []).includes(perm);
};
const EMPTY_REVIEW = { reviewed_by: null, reviewed_at: null, checks: null, location_correct: null, participant_count: null, score: null, override_note: null, reject_reason: null, marks: null };

// Sample Member Form answers (Get to Know Me) for the demo roster.
const WORDS = ['Ceria, jujur, spontan', 'Kalem, teliti, setia', 'Ramah, kreatif, ambisius', 'Lucu, peduli, berisik', 'Tenang, sabar, detail', 'Energik, optimis, ramah', 'Pemalu, hangat, rajin', 'Santai, humoris, loyal'];
const ENJOY = ['Hiking', 'Masak pasta', 'Main badminton', 'Nonton drakor', 'Ngopi sambil baca', 'Fotografi jalanan', 'Bersepeda pagi', 'Main board game', 'Berkebun', 'Karaoke'];
const TALENT = ['Main piano', 'Sulap kartu', 'Gambar karikatur', 'Hafal jalan Jakarta', 'Beatbox', 'Masak rendang', 'Main gitar', 'Bisa 4 bahasa', 'Origami', 'Menari salsa'];
const FOUND = ['Pernah tinggal di Jepang 2 tahun waktu kuliah', 'Jago main catur sejak SD, pernah juara kecamatan', 'Pernah ikut lomba paduan suara nasional', 'Bangun jam 4 pagi buat lari 5 km', 'Dulu pemain basket kampus', 'Lagi belajar bahasa Korea buat liburan', 'Pernah mendaki Rinjani sampai puncak', 'Punya 3 kucing yang namanya dari tokoh film'];

export function seedGame(profiles) {
  const pic = (name) => profiles.find((p) => p.full_name === name)?.id ?? null;
  const PICS = { R1: 'Cindy', R2: 'Cindy', R3: 'Danny', R5: 'Rocky' };
  const ch = (code, kind, round, name, status, [announce, open, deadline, validate], extra = {}) => ({
    id: 'c-' + code.toLowerCase(), code, kind, round, name, pic_id: null, status,
    announce_at: wib(announce), open_at: wib(open), deadline_at: wib(deadline), validate_by: wib(validate),
    sections: {}, scoring: { type: 'manual', max: 20 }, form: {}, riddles_per_group: 0, draw_seed: null, draw_locked: false,
    sort: 0, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z', ...extra,
  });
  const challenges = [
    ...PLAYBOOK.map(({ code, kind, round, name, status, schedule, ...rest }) => ch(code, kind, round, name, status, schedule, { ...rest, pic_id: pic(PICS[code]) })),
    // Mini Event #4 is unchanged from before, only renumbered (was R3).
    ch('R4', 'main', 4, 'Spice It Up', 'draft', ['2026-11-04T20:00', '2026-11-06T20:00', '2026-11-08T23:55', null], { pic_id: pic('Maya'), sort: 4 }),
  ].sort((a, b) => a.sort - b.sort);
  // Guess, Find, Snap! keeps the riddle bank; the draw happens when it goes live.
  const riddles = RIDDLES.map(([prompt, answer], i) => ({ id: `r-${i + 1}`, challenge_id: 'c-r2', no: i + 1, prompt, answer }));
  const draws = [];

  const players = profiles.filter(isGamePlayer);
  const gtkm = Object.fromEntries(players.map((p, i) => [p.id, { words: WORDS[i % WORDS.length], enjoy: ENJOY[(i * 3) % ENJOY.length], talent: TALENT[(i * 7) % TALENT.length] }]));

  // Get to Know Me (live on the demo clock): some members already sent 1–2 people; the first ~60% are validated.
  // The demo login accounts (u-…) haven't submitted, so they can try it.
  const r = rng(2026);
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  const c1 = challenges.find((c) => c.code === 'R1');
  const submissions = [];
  const answer = (t, mark, k) => {
    const g = gtkm[t.id];
    if (k === 'q4') return mark === 4 ? pick(FOUND) : mark === 2 ? 'Orangnya asik dan gampang diajak ngobrol' : '';
    const v = g[{ q1: 'words', q2: 'enjoy', q3: 'talent' }[k]];
    return mark === 2 ? v : mark === 1 ? v.split(/[ ,]/)[0] + '…' : pick(['Lupa', 'Musik', 'Olahraga', '']);
  };
  GROUPS.forEach(([no], gi) => {
    const roster = players.filter((p) => p.group_no === no);
    const n = roster.length;
    const takers = roster.filter((p) => !p.id.startsWith('u-')).slice(0, [9, 11, 6, 10, 5, 8, 12, 7, 4, 3][gi]);
    takers.forEach((p, i) => {
      const at = roster.indexOf(p);
      const targets = [roster[(at + 1) % n], roster[(at + 3) % n]].slice(0, i % 4 === 3 ? 1 : 2);
      const validated = i < Math.ceil(takers.length * 0.6);
      targets.forEach((t, k) => {
        const marks = { q1: pick([2, 2, 1, 0]), q2: pick([2, 2, 1, 2]), q3: pick([2, 1, 0, 2]), q4: pick([4, 4, 2, 0]) };
        const photo = r() < 0.5;
        if (photo) marks.photo = r() < 0.85;
        const submitted = new Date(new Date(wib('2026-10-12T20:00')).getTime() + (gi * 37 + i * 61 + k * 13) * 60e3 * 1.2).toISOString();
        submissions.push({
          id: uid(), challenge_id: c1.id, group_no: no, riddle_id: null, target_id: t.id, version: 1, submitted_by: p.id, submitted_at: submitted,
          answers: Object.fromEntries(['q1', 'q2', 'q3', 'q4'].map((q) => [q, answer(t, marks[q], q)])),
          media_path: null, media_name: photo ? 'foto-bareng.jpg' : null, ig_url: null, tagged_ids: [], declaration: true, ...EMPTY_REVIEW,
          ...(validated ? { status: 'validated', marks, score: marksScore(c1.scoring, marks), checks: [true, true, true], reviewed_at: wib('2026-10-16T10:00') } : { status: 'submitted' }),
        });
      });
    });
  });

  const groups = GROUPS.map(([no, name, color], i) => ({ no, name, color, min_size: 13, max_size: 14, sort: i + 1, locked_at: null, locked_by: null }));
  return { groups, challenges, riddles, draws, submissions, gtkm };
}

// Game methods over the demo state. `ctx` = { load, save, delay, fail }.
export function gameMethods({ load, save, delay, fail }) {
  const sortBy = (k) => (a, b) => (a[k] ?? 0) - (b[k] ?? 0);
  // Older saved demo states predate notifications: backfill once.
  const notifs = (s) => { if (!s.notifications) seedNotifications(s); return s.notifications; };
  // Same as openDue() on the server: scheduled events go Live at their open time (with a draw if none yet).
  const openDue = (s) => {
    let changed = false;
    s.challenges.filter((c) => c.status === 'scheduled' && c.open_at && new Date(c.open_at).getTime() <= demoNow()).forEach((c) => {
      c.status = 'live'; c.updated_at = new Date().toISOString(); changed = true;
      const ids = s.riddles.filter((r) => r.challenge_id === c.id).sort(sortBy('no')).map((r) => r.id);
      if (c.riddles_per_group > 0 && !s.draws.some((d) => d.challenge_id === c.id) && ids.length >= c.riddles_per_group) {
        c.draw_seed = Math.floor(Math.random() * 9000) + 1000;
        s.draws.push(...drawRiddles(ids, c.riddles_per_group, c.draw_seed, s.groups || GROUPS.map(([no]) => ({ no }))).map((d) => ({ ...d, challenge_id: c.id })));
      }
      notifs(s); notifyChallenge(s, c);
    });
    if (changed) save();
  };
  return {
    async listNotifications() {
      const s = load();
      openDue(s);
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
    // Until an event opens its text stays "Coming soon" for everyone but the challenge managers.
    async listChallenges() {
      const s = load();
      openDue(s);
      const all = canDemo(s, 'challenges.manage');
      return delay(structuredClone(s.challenges).map((c) => (all || c.status !== 'scheduled' ? c : { ...c, sections: {} })).sort(sortBy('sort')));
    },
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
    // Same as the server: managers see the bank; validators once it's open; members only their group's draw, no answers.
    async listRiddles(challengeId) {
      const s = load();
      const c = s.challenges.find((x) => x.id === challengeId);
      const opened = ['live', 'closed', 'published'].includes(c?.status);
      const me = s.profiles.find((p) => p.id === s.sessionId);
      const mine = new Set(s.draws.filter((d) => d.challenge_id === challengeId && d.group_no === me?.group_no).map((d) => d.riddle_id));
      const rows = s.riddles.filter((r) => r.challenge_id === challengeId).sort(sortBy('no'));
      if (canDemo(s, 'challenges.manage')) return delay(structuredClone(rows));
      if (!opened) return delay([]);
      if (canDemo(s, 'submissions.validate')) return delay(structuredClone(rows));
      return delay(rows.filter((r) => mine.has(r.id)).map((r) => ({ ...r, answer: null })));
    },
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
    async getDraw(challengeId) {
      const s = load();
      const c = s.challenges.find((x) => x.id === challengeId);
      const me = s.profiles.find((p) => p.id === s.sessionId);
      const rows = s.draws.filter((d) => d.challenge_id === challengeId);
      if (canDemo(s, 'challenges.manage')) return delay(structuredClone(rows));
      if (!['live', 'closed', 'published'].includes(c?.status)) return delay([]);
      return delay(structuredClone(canDemo(s, 'submissions.validate') ? rows : rows.filter((d) => d.group_no === me?.group_no)));
    },
    async saveDraw(challengeId, rows, seed) {
      const s = load();
      s.draws = [...s.draws.filter((d) => d.challenge_id !== challengeId), ...rows.map((r) => ({ ...r, challenge_id: challengeId }))];
      save();
      return this.saveChallenge({ id: challengeId, draw_seed: seed });
    },
    // Members only see their own entries in connect challenges (so answers can't be copied); staff see all,
    // except captains, who see (and validate) their own group only.
    async listSubmissions({ challengeId, groupNo } = {}) {
      const s = load();
      const staff = canDemo(s, 'submissions.validate') || canDemo(s, 'scores.view');
      const only = validatesOnly(s.profiles.find((p) => p.id === s.sessionId));
      const connect = new Set(s.challenges.filter(isConnect).map((c) => c.id));
      return delay(structuredClone(s.submissions.filter((x) => (!challengeId || x.challenge_id === challengeId) && (!groupNo || x.group_no === groupNo)
        && (staff ? only === null || x.group_no === only : !connect.has(x.challenge_id) || x.submitted_by === s.sessionId)))
        .map((x) => withReviewer(s, x))
        .sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)));
    },
    // Same checks as prepare_submission() in SQL.
    // Same rules as the server: an entry can be re-sent until the deadline unless it's validated; a pending
    // previous version is replaced (and a pending Get to Know Me entry can be switched to someone else).
    async createSubmission({ file, replaces, keep_media, reel, ...sub }) {
      const s = load();
      const c = s.challenges.find((x) => x.id === sub.challenge_id);
      if (!c) return fail('Challenge ini sedang tidak menerima submission.');
      const me = s.profiles.find((p) => p.id === s.sessionId);
      if (!me?.active || me.group_no !== sub.group_no) return fail('Hanya bisa submit untuk grup sendiri.');
      const isReel = withDefaults(c.scoring).type === 'give_grow' && reel === true;
      const row0 = { riddle_id: null, target_id: null, ...sub, ...(isReel ? { target_id: s.sessionId, riddle_id: null, tagged_ids: [], answers: null } : {}), submitted_by: s.sessionId };
      const unit = s.submissions.filter((x) => x.challenge_id === sub.challenge_id && x.group_no === sub.group_no);
      const lastOf = (key) => unit.filter((x) => unitKey(x) === key).sort((a, b) => b.version - a.version)[0];
      const last = lastOf(unitKey(row0));
      // Live and before the deadline: open. Otherwise only a submission an admin reopened can still be changed.
      const onTime = c.status === 'live' && !(c.deadline_at && demoNow() > new Date(c.deadline_at).getTime());
      const reopened = !!last?.reopened_at && last.status !== 'validated' && ['live', 'closed'].includes(c.status);
      if (!onTime && !reopened) return fail('Challenge ini sedang tidak menerima submission.');
      if (!onTime && replaces && replaces !== last?.id) return fail('Setelah deadline, hanya submission yang dibuka lagi yang bisa diubah (orang yang sama).');
      const superseded = last ? [last] : [];
      if (isConnect(c)) {
        if (!isGamePlayer(me)) return fail('Challenge ini untuk peserta grup.');
        const t = s.profiles.find((p) => p.id === sub.target_id);
        if (!t || t.id === me.id || t.group_no !== me.group_no || !isGamePlayer(t)) return fail('Pilih anggota grup kamu sendiri (bukan diri sendiri).');
        if (last?.status === 'validated') return fail(`${t.full_name} sudah divalidasi — tidak bisa diganti lagi.`);
        const mine = unit.filter((x) => x.submitted_by === me.id && x.target_id);
        let swap = null;
        if (replaces && replaces !== last?.id) {
          swap = mine.find((x) => x.id === replaces);
          if (!swap || lastOf(unitKey(swap)).id !== swap.id || swap.status === 'validated') return fail('Submission yang mau diganti sudah tidak bisa diubah.');
          superseded.push(swap);
        }
        const active = new Set(mine.map((x) => x.target_id)
          .filter((tid) => tid !== t.id && tid !== swap?.target_id && ['submitted', 'validated'].includes(lastOf(`${me.id}>${tid}`).status)));
        if (active.size >= withDefaults(c.scoring).people) return fail(`Maksimal ${withDefaults(c.scoring).people} orang per member.`);
      } else if (isReel) {
        if (!isGamePlayer(me)) return fail('Reels hanya untuk peserta grup.');
        if (!sub.ig_url) return fail('Tempel link Reels kamu.');
        if (last?.status === 'validated') return fail('Reels kamu sudah divalidasi — tidak bisa dikirim ulang.');
      } else {
        if (!canDemo(s, 'portal.submit')) return fail('Hanya Group Leader yang bisa submit challenge ini.');
        if (last?.status === 'validated') return fail('Submission ini sudah divalidasi — tidak bisa dikirim ulang.');
      }
      // Same path layout as the server: <group>/<id>-<name>.
      let media_path = null;
      let media_name = null;
      if (file) {
        media_path = `${sub.group_no}/${uid()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
        media_name = file.name;
        try { await putMedia(media_path, file); } catch { return fail('Foto gagal disimpan di browser ini.'); }
      } else if (keep_media && last?.media_path) { media_path = last.media_path; media_name = last.media_name; }
      const row = {
        id: uid(), ig_url: null, tagged_ids: [], declaration: false, answers: null, ...row0, media_path, media_name,
        version: (last?.version || 0) + 1, status: 'submitted', submitted_at: new Date(demoNow()).toISOString(), ...EMPTY_REVIEW,
        reopened_at: reopened ? last.reopened_at : null,
      };
      const gone = new Set(superseded.filter((x) => x.status === 'submitted').map((x) => x.id));
      s.submissions = s.submissions.filter((x) => !gone.has(x.id));
      s.submissions.push(row);
      save(); return delay(structuredClone(row));
    },
    // Get to Know Me answers from the Member Form; only staff read them (answer key for R1).
    async getGtkm(ids) {
      const s = load();
      if (!canDemo(s, 'submissions.validate') && !canDemo(s, 'members.manage')) return delay({});
      // Captains get the answer key of their own group only (the group they validate).
      const only = validatesOnly(s.profiles.find((p) => p.id === s.sessionId));
      const hidden = (id) => only !== null && s.profiles.find((p) => p.id === id)?.group_no !== only;
      return delay(Object.fromEntries(ids.filter((id) => s.gtkm?.[id] && !hidden(id)).map((id) => [id, { ...s.gtkm[id] }])));
    },
    async saveGtkm(id, data) {
      const s = load();
      if (!canDemo(s, 'members.manage')) return fail('Butuh hak “Daftarkan, ubah & nonaktifkan member”.');
      s.gtkm ||= {};
      s.gtkm[id] = { ...s.gtkm[id], ...data };
      save(); return delay({ ...s.gtkm[id] });
    },
    async reviewSubmission(id, patch) {
      const s = load();
      const i = s.submissions.findIndex((x) => x.id === id);
      if (i < 0) return fail('Submission ini sudah diganti pengirimnya dengan versi baru. Muat ulang antrean.');
      const only = validatesOnly(s.profiles.find((p) => p.id === s.sessionId));
      if (only !== null && s.submissions[i].group_no !== only) return fail('Captain hanya bisa memvalidasi submission dari grupnya sendiri.');
      const prevStatus = s.submissions[i].status;
      // A captain's own entries are validated like anyone's but always score 0.
      const sub0 = s.submissions[i];
      const sc = s.challenges.find((c) => c.id === sub0.challenge_id)?.scoring;
      if (playsWithoutPoints(s.profiles.find((p) => p.id === sub0.submitted_by))) patch = { ...patch, score: 0 };
      else if (withDefaults(sc).type === 'give_grow' && sub0.target_id && patch.status === 'validated') patch = { ...patch, score: 0, marks: null };
      else if (withDefaults(sc).type === 'give_grow' && patch.status === 'validated') {
        if (patch.override_note) patch = { ...patch, score: Math.max(0, Math.min(itemMax(withDefaults(sc)), Number(patch.score) || 0)) };
        else {
          const team = s.profiles.filter((p) => isPlayer(p) && p.group_no === sub0.group_no).map((p) => p.id);
          const reels = s.submissions.filter((x) => x.challenge_id === sub0.challenge_id && x.group_no === sub0.group_no && x.target_id && x.status === 'validated').map((x) => x.submitted_by);
          const p = giveGrowParts(sc, { marks: patch.marks || {}, team_ids: team, online_ids: reels });
          patch = { ...patch, participant_count: p.participants, score: p.total };
        }
      }
      else if (withDefaults(sc).type === 'proportional' && patch.status === 'validated') {
        if (patch.marks?.riddle != null && !String(patch.override_note || '').trim()) return fail('Skor manual riddle wajib pakai alasan.');
        const team = s.profiles.filter((p) => isPlayer(p) && p.group_no === sub0.group_no).map((p) => p.id);
        const count = new Set((sub0.tagged_ids || []).filter((id) => team.includes(id))).size;
        patch = { ...patch, participant_count: count, score: computeScore(sc, { location_correct: !!patch.location_correct, participant_count: count, team_size: team.length, answer_score: patch.marks?.riddle ?? null }) };
      }
      s.submissions[i] = { ...s.submissions[i], ...patch, reviewed_by: s.sessionId, reviewed_at: new Date().toISOString() };
      if (s.submissions[i].status !== prevStatus) { notifs(s); notifyReview(s, s.submissions[i]); }
      save(); return delay(structuredClone(withReviewer(s, s.submissions[i])));
    },
    // Super Admin / PIC: a validated submission goes back to pending (score removed) so its sender can change it.
    async reopenSubmission(id) {
      const s = load();
      if (!canDemo(s, 'challenges.manage')) return fail('Hanya Super Admin dan Challenge PIC yang bisa membuka lagi submission.');
      const closedMsg = revalidateClosed(s, id);
      if (closedMsg) return fail(closedMsg);
      const i = s.submissions.findIndex((x) => x.id === id && x.status === 'validated');
      if (i < 0) return fail('Hanya submission yang sudah tervalidasi yang bisa dibuka lagi.');
      s.submissions[i] = { ...s.submissions[i], status: 'submitted', score: null, reviewed_by: null, reviewed_at: null, override_note: null, reject_reason: null, reopened_at: new Date(demoNow()).toISOString() };
      notifs(s); notifyReopen(s, s.submissions[i]);
      save(); return delay(structuredClone(s.submissions[i]));
    },
    // Same as adjustScore() on the server.
    async adjustScore(id, score, note) {
      const s = load();
      if (!canDemo(s, 'challenges.manage')) return fail('Hanya Super Admin dan Challenge PIC yang bisa mengubah poin.');
      const why = String(note || '').trim();
      if (why.length < 3) return fail('Tulis alasan perubahan poin.');
      const closedMsg = revalidateClosed(s, id);
      if (closedMsg) return fail(closedMsg);
      const i = s.submissions.findIndex((x) => x.id === id && x.status === 'validated');
      if (i < 0) return fail('Poin hanya bisa diubah untuk submission yang sudah tervalidasi.');
      const sub = s.submissions[i];
      if (playsWithoutPoints(s.profiles.find((p) => p.id === sub.submitted_by))) return fail('Submission captain selalu 0 poin (captain main tanpa poin).');
      const max = itemMax(withDefaults(s.challenges.find((c) => c.id === sub.challenge_id)?.scoring));
      const n = Math.round(Number(score) * 100) / 100;
      if (score === '' || score == null || !Number.isFinite(n) || n < 0 || n > max) return fail(`Poin harus antara 0 dan ${max}.`);
      const me = s.profiles.find((p) => p.id === s.sessionId);
      const e = { from: sub.score ?? null, to: n, note: why.slice(0, 500), by: me?.id, by_name: me?.full_name || me?.username, by_role: me?.role_id, at: new Date().toISOString() };
      s.submissions[i] = { ...sub, score: n, adjustments: [...(sub.adjustments || []), e] };
      notifs(s); notifyAdjust(s, s.submissions[i], e);
      save(); return delay(structuredClone(withReviewer(s, s.submissions[i])));
    },
    async mediaUrl(path) { return mediaObjectUrl(path); },
    // Same rules as group_scores() in SQL (see groupPoints in game.js).
    async groupScores() {
      const s = load();
      // Captains play without points: not in the roster count, and their entries/tags are skipped.
      const roster = {};
      s.profiles.filter((p) => isPlayer(p) && p.group_no).forEach((p) => { roster[p.group_no] = (roster[p.group_no] || 0) + 1; });
      const noPoints = new Set(s.profiles.filter(playsWithoutPoints).map((p) => p.id));
      const out = [];
      s.challenges.filter((c) => c.status !== 'draft').forEach((c) => {
        const valid = s.submissions.filter((x) => x.challenge_id === c.id && x.status === 'validated');
        [...new Set(valid.map((x) => x.group_no))].forEach((no) => {
          const mine = valid.filter((x) => x.group_no === no);
          out.push({ group_no: no, challenge_id: c.id, points: groupPoints(c, mine, roster[no] || 0, noPoints), validated: mine.length });
        });
      });
      return delay(out);
    },
  };
}
