// Backend check against an in-memory Postgres (PGlite): node server/test.js
// Exercises login, roles, roster import, submissions, reviews, scores, notifications and photos with made-up people.
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setDb, getDb, fromPglite } from './db.js';
import { handleRpc, handleMedia } from './rpc.js';
import { resetSecretCache } from './auth.js';
import { connectBreakdown, computeScore, groupPoints, giveGrowParts } from '../src/lib/game.js';

process.env.ADMIN_SETUP_PASSWORD = ' "setup-pass-123"\n';   // pasted with quotes + spaces: forgiven
const lite = new PGlite();
// Same roles a Supabase-hosted database exposes through its web API; they must get nothing.
await lite.exec('create role anon nologin; create role authenticated nologin; grant usage on schema public to anon, authenticated;');
setDb(fromPglite(lite));
resetSecretCache();
const db = await getDb();

function fakeRes() {
  return { statusCode: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
}
// A tiny client with its own cookie jar.
function client() {
  let cookie = '';
  const call = async (method, args = {}) => {
    const res = fakeRes();
    await handleRpc({ method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost:3600', cookie }, body: { method, args } }, res, db);
    const set = res.headers['set-cookie'];
    if (set) cookie = [].concat(set).map((c) => c.split(';')[0]).join('; ');
    const j = JSON.parse(res.body);
    if (res.statusCode !== 200) { const e = new Error(j.error); e.status = res.statusCode; throw e; }
    return j.data;
  };
  const media = async (path) => { const res = fakeRes(); await handleMedia({ method: 'GET', url: `/api/media?path=${encodeURIComponent(path)}`, headers: { host: 'localhost:3600', cookie } }, res, db); return res; };
  return { call, media, login: (u, p) => call('signInPassword', { username: u, password: p }) };
}
const rejects = async (p, re) => assert.rejects(p, (e) => { assert.match(e.message, re); return true; });
let n = 0; const ok = (msg) => console.log(`✓ ${++n}. ${msg}`);

// 0 · participation = (unique people who submitted + unique people interviewed) ÷ team size × ½
{
  const v = (by, to, score) => ({ status: 'validated', submitted_by: by, target_id: to, score });
  const sc = { type: 'connect', people: 2, photo_bonus: 2, individual_weight: 70, participation_weight: 30 };
  // A and C both talk to B (12 pts each); team of 4 → (2 submitted + 1 interviewed) ÷ 4 × ½ = 0.375 → 11.25 → 11.3; 12/24×70 = 35
  const b = connectBreakdown(sc, [v('A', 'B', 12), v('C', 'B', 12)], 4);
  assert.deepEqual([b.participants, b.interviewed, b.rate, b.part, b.points], [2, 1, 0.375, 11.3, 46.3]);
  // A captain who was interviewed doesn't count
  assert.equal(connectBreakdown(sc, [v('A', 'B', 12), v('A', 'CAP', 12)], 4, new Set(['CAP'])).interviewed, 1);
  // Everyone submitted and everyone was interviewed → full 30
  assert.equal(connectBreakdown(sc, [v('A', 'B', 12), v('B', 'A', 12)], 2).part, 30);
}
ok('participation formula: (unique people who submitted + unique people interviewed) ÷ team size × ½');

// 0b · riddle Skenario 1 (PDF example): 12 members; 12, 9, 10, 6 in the photos; 3 of 4 answers right → 76.0
{
  const sc = { type: 'proportional', answer_pts: 12.5, participation_pts: 12.5 };
  const per = [[12, true], [9, true], [10, true], [6, false]].map(([count, ok]) => computeScore(sc, { location_correct: ok, participant_count: count, team_size: 12 }));
  assert.deepEqual(per, [25, 21.875, 22.917, 6.25]);
  const subs = per.map((score, i) => ({ status: 'validated', submitted_by: 'L', riddle_id: 'r' + i, version: 1, score }));
  assert.equal(groupPoints({ scoring: sc, riddles_per_group: 4 }, subs, 12), 76);
  assert.equal(computeScore(sc, { location_correct: true, participant_count: 15, team_size: 12 }), 25);   // capped at the team size
}
ok('riddle Skenario 1: per riddle 12.5 answer + headcount ÷ team × 12.5 (PDF example = 76)');

// 0c · R3 Give and Grow (rules doc): video rubric 50 + participation 50
{
  const sc = { type: 'give_grow' };
  const team = Array.from({ length: 12 }, (_, i) => 'm' + i);
  // video 42; 6 offline + 3 online (+1 who did both, counted once) = 9 of 12 → 30; offline +5; BTS video 5 → 82
  const p = giveGrowParts(sc, { marks: { fit: 18, useful: 12, clear: 8, team: 4, offline: team.slice(0, 6), online: [...team.slice(6, 9), 'm0'], bts: 'video' }, team_ids: team });
  assert.deepEqual([p.video, p.participants, p.overall, p.offlineBonus, p.bts, p.total], [42, 9, 30, 5, 5, 82]);
  // online only (no offline bonus), BTS photos = 2, someone outside the team (e.g. a captain) doesn't count
  const q = giveGrowParts(sc, { marks: { fit: 20, useful: 15, clear: 10, team: 5, online: ['m1', 'CAP'], bts: 'photos' }, team_ids: team });
  assert.deepEqual([q.participants, q.offlineBonus, q.bts, q.total], [1, 0, 2, 55.333]);
}
ok('R3 Give and Grow: video 50 + unique participants ÷ team × 40 + offline 5 + BTS (doc example = 82)');

// 1 · bootstrap + login
const admin = client();
await rejects(admin.login('angel', 'wrong-password'), /salah/);
await admin.login('angel', 'setup-pass-123');
const adminId = await admin.call('session');
assert.ok(adminId); ok('Super Admin angel created from ADMIN_SETUP_PASSWORD and can log in');
const grants = await admin.call('getGrants');
assert.ok(grants.super_admin.includes('roles.manage')); ok('grants loaded');
const ch = await admin.call('listChallenges');
assert.deepEqual(ch.map((c) => c.code).sort(), ['R1', 'R2', 'R3', 'R4', 'R5']);
assert.equal((await admin.call('listRiddles', { challengeId: ch.find((c) => c.code === 'R2').id })).length, 10); ok('playbook challenges + R2 riddle bank seeded');

// 2 · roster import
const groups = [{ no: '01', name: 'Group 1', color: '#7F8F24', min_size: 3, max_size: 3, sort: 1 }, { no: '02', name: 'Group 2', color: '#2A8C82', min_size: 3, max_size: 3, sort: 2 }];
const accounts = [
  ...['Ana Satu', 'Budi Dua', 'Cici Tiga'].map((f, i) => ({ full_name: f, username: f.split(' ')[0].toLowerCase(), role_id: 'member', group_no: '01', service_team: 'Tim ' + i, is_ministry_tl: i === 0 })),
  ...['Dodi Empat', 'Eka Lima', 'Fani Enam'].map((f, i) => ({ full_name: f, username: f.split(' ')[0].toLowerCase(), role_id: 'member', group_no: '02', service_team: 'Tim ' + i })),
  { full_name: 'Kapten', username: 'kapten', role_id: 'captain', group_no: '01' },
  { full_name: 'Kapten Dua', username: 'kaptendua', role_id: 'captain', group_no: '02' },
  { full_name: 'Pici', username: 'pici', role_id: 'challenge_pic', group_no: null },
];
const outsider = client();
await rejects(outsider.call('importRoster', { groups, accounts }), /Sesi berakhir/);
const imp = await admin.call('importRoster', { groups, accounts });
assert.equal(imp.created.length, 9);
assert.ok(imp.created.every((a) => /^[A-Za-z0-9]{8}$/.test(a.password))); ok('roster import: 9 accounts, 8-char passwords, outsiders refused');
const pw = Object.fromEntries(imp.created.map((a) => [a.username, a.password]));
assert.deepEqual((await admin.call('listGroups')).map((g) => g.name), ['Group 1', 'Group 2']); ok('groups replaced');

// 3 · roles
const ana = client(); await ana.login('ana', pw.ana);
await rejects(ana.call('importRoster', { groups, accounts }), /Super Admin/);
await rejects(ana.call('updateProfile', { id: (await ana.call('session')), patch: { role_id: 'super_admin' } }), /izin|role/);
const anaSees = await ana.call('listProfiles');
assert.deepEqual(anaSees.map((p) => p.username).sort(), ['ana', 'budi', 'cici', 'kapten']); ok('member sees only own group; cannot import or change roles');
assert.ok(!JSON.stringify(anaSees).includes('scrypt')); ok('password hashes never leave the server');
assert.equal((await ana.call('listChallenges')).some((c) => c.status === 'draft'), false); ok('members do not see drafts');
const DAY = 864e5;
const sched = await admin.call('saveChallenge', { c: { code: 'SQ9', kind: 'side', name: 'Later', status: 'scheduled', open_at: new Date(Date.now() + DAY).toISOString(), sections: { game_idea: 'secret' } } });
const later = (await ana.call('listChallenges')).find((c) => c.id === sched.id);
assert.equal(later.status, 'scheduled'); assert.deepEqual(later.sections, {}); ok('scheduled events reach members without their text ("Coming soon") until they open');

// 4 · Get to Know Me (connect) submission rules
const r1 = ch.find((c) => c.code === 'R1');
// Keep R1 open whatever today's date is (its real deadline is in the playbook).
await admin.call('saveChallenge', { c: { id: r1.id, status: 'live', deadline_at: new Date(Date.now() + 7 * 864e5).toISOString() } });
// …and R2 not open yet (re-validating R1 is allowed until R2 opens).
const r2open = new Date(Date.now() + 7 * 864e5).toISOString();
await admin.call('saveChallenge', { c: { id: ch.find((c) => c.code === 'R2').id, status: 'scheduled', open_at: r2open } });
const ids = Object.fromEntries((await admin.call('listProfiles')).map((p) => [p.username, p.id]));
const sub = (t) => ({ sub: { challenge_id: r1.id, group_no: '01', target_id: t, answers: { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }, declaration: true } });
await rejects(ana.call('createSubmission', sub(ids.ana)), /bukan diri sendiri/);
await rejects(ana.call('createSubmission', sub(ids.dodi)), /grup kamu sendiri/);
const s1first = await ana.call('createSubmission', sub(ids.budi));
const s1 = await ana.call('createSubmission', sub(ids.budi));   // re-sent while pending → replaces it
await ana.call('createSubmission', sub(ids.cici));
assert.equal(s1first.version, 1); assert.equal(s1.version, 2);
assert.equal((await admin.call('listSubmissions', { challengeId: r1.id })).filter((x) => x.submitted_by === ids.ana && x.target_id === ids.budi).length, 1);
ok('connect rules: not self, own group only; re-sending a pending entry replaces it');
const kapten = client(); await kapten.login('kapten', pw.kapten);
const kapten2 = client(); await kapten2.login('kaptendua', pw.kaptendua);
await kapten.call('createSubmission', sub(ids.budi));
const cici = client(); await cici.login('cici', pw.cici);
await cici.call('createSubmission', sub(ids.kapten)); ok('captains play Get to Know Me like members, both ways');
const k1sees = await kapten.call('listSubmissions', { challengeId: r1.id });
assert.equal(k1sees.length, 4); assert.ok(k1sees.every((x) => x.group_no === '01'));
assert.equal((await kapten2.call('listSubmissions', { challengeId: r1.id })).length, 0);
await admin.call('saveGtkm', { id: ids.budi, data: { words: 'w', enjoy: 'e', talent: 't' } });
await admin.call('saveGtkm', { id: ids.pici, data: { words: 'w', enjoy: 'e', talent: 't' } });
assert.ok((await kapten.call('getGtkm', { ids: [ids.budi] }))[ids.budi]);
assert.deepEqual(await kapten2.call('getGtkm', { ids: [ids.budi] }), {});
assert.ok((await admin.call('getGtkm', { ids: [ids.budi, ids.pici] }))[ids.pici]);
ok("a captain sees all of their own group's entries + answer key, nothing from other groups");
const budi = client(); await budi.login('budi', pw.budi);
assert.equal((await budi.call('listSubmissions', { challengeId: r1.id, groupNo: '01' })).length, 0); ok("members can't see group-mates' answers");
const r2 = ch.find((c) => c.code === 'R2');
await rejects(ana.call('createSubmission', { sub: { challenge_id: r2.id, group_no: '01' } }), /tidak menerima|Group Leader/); ok('non-connect challenge needs Group Leader (and live)');

// 5 · validation + scores + notifications
await rejects(ana.call('reviewSubmission', { id: s1.id, patch: { status: 'validated', score: 12 } }), /izin/);
await rejects(kapten2.call('reviewSubmission', { id: s1.id, patch: { status: 'validated', score: 12 } }), /grupnya sendiri/);
const rev = await kapten.call('reviewSubmission', { id: s1.id, patch: { status: 'validated', marks: { q1: 2, q2: 2, q3: 2, q4: 4, photo: true }, score: 12, checks: [true, true, true] } });
assert.equal(rev.score, 12);
// Who validated it travels with the submission: name + role (for the queue and the member's view).
assert.deepEqual([rev.reviewed_by_name, rev.reviewed_by_role], ['Kapten', 'captain']);
const anaView = (await ana.call('listSubmissions', { challengeId: r1.id, groupNo: '01' })).find((x) => x.id === s1.id);
assert.deepEqual([anaView.reviewed_by_name, anaView.reviewed_by_role], ['Kapten', 'captain']);
const scores = await ana.call('groupScores');
const g1 = scores.find((s) => s.group_no === '01' && s.challenge_id === r1.id);
// 1 member took part with 12/24 → 12/24×70 = 35; participation (1 submitted + 1 interviewed) ÷ 3 players × ½ → 0.333×30 = 10 → 45
assert.equal(g1.points, 45); ok("captains validate their own group only; the review → team score 45 (= playbook formula)");
// If an entry ever has two validated versions, only the latest one counts.
await db.query(`insert into submissions (challenge_id, group_no, submitted_by, target_id, version, status, score) values ($1, '01', $2, $3, 99, 'validated', 4)`, [r1.id, ids.ana, ids.budi]);
// 4/24×70 = 11.7; (1 submitted + 1 interviewed) ÷ 3 × ½ × 30 = 10 → 21.7
assert.equal((await ana.call('groupScores')).find((x) => x.group_no === '01' && x.challenge_id === r1.id).points, 21.7);
await db.query('delete from submissions where version = 99');
ok('team score counts only the latest validated version of an entry');
const kSub = (await kapten.call('listSubmissions', { challengeId: r1.id })).find((x) => x.submitted_by === ids.kapten);
const kRev = await kapten.call('reviewSubmission', { id: kSub.id, patch: { status: 'validated', marks: { q1: 2, q2: 2, q3: 2, q4: 4, photo: true }, score: 12, checks: [true, true, true] } });
assert.equal(Number(kRev.score), 0);
assert.equal((await ana.call('groupScores')).find((x) => x.group_no === '01' && x.challenge_id === r1.id).points, 45);
ok("a captain's entry is validated but scores 0 and doesn't change the team score");
await rejects(ana.call('createSubmission', sub(ids.budi)), /sudah divalidasi/);
await rejects(ana.call('createSubmission', sub(ids.kapten)), /Maksimal 2/);
const ciciEntry = (await ana.call('listSubmissions', { challengeId: r1.id, groupNo: '01' })).find((x) => x.target_id === ids.cici);
await ana.call('createSubmission', { sub: { ...sub(ids.kapten).sub, replaces: ciciEntry.id } });
const anaNow = await ana.call('listSubmissions', { challengeId: r1.id, groupNo: '01' });
assert.deepEqual(anaNow.map((x) => x.target_id).sort(), [ids.budi, ids.kapten].sort());
ok('validated entries are locked; a pending one can be switched to someone else (still max 2)');

// 5b · reopen: Super Admin / PIC turns a validated entry back to pending; editable even after the deadline
const pts01 = async () => (await ana.call('groupScores')).find((x) => x.group_no === '01' && x.challenge_id === r1.id)?.points ?? 0;
await rejects(kapten.call('reopenSubmission', { id: s1.id }), /Super Admin dan Challenge PIC/);
const reo = await admin.call('reopenSubmission', { id: s1.id });
assert.equal(reo.status, 'submitted'); assert.equal(reo.score, null); assert.ok(reo.reopened_at);
assert.equal(await pts01(), 0);
assert.ok((await ana.call('listNotifications')).some((x) => x.title === 'Submission dibuka lagi' && /Ana → Budi/.test(x.body)));
const r1deadline = (await admin.call('listChallenges')).find((x) => x.id === r1.id).deadline_at;
await admin.call('saveChallenge', { c: { id: r1.id, deadline_at: new Date(Date.now() - 60e3).toISOString() } });
const edited = await ana.call('createSubmission', sub(ids.budi));   // past the deadline, but reopened
assert.equal(edited.version, 3); assert.ok(edited.reopened_at);
await rejects(ana.call('createSubmission', sub(ids.kapten)), /tidak menerima/);   // not reopened → closed
await kapten.call('reviewSubmission', { id: edited.id, patch: { status: 'validated', marks: { q1: 2, q2: 2, q3: 2, q4: 4, photo: true }, score: 12, checks: [true, true, true] } });
assert.equal(await pts01(), 45);
await rejects(ana.call('createSubmission', sub(ids.budi)), /tidak menerima/);   // validated again → locked
ok('Super Admin/PIC can reopen a validated entry: score off, group notified, editable past the deadline until re-validated');

// 5c · point change after validation (here: past the deadline) — admin/PIC only, reason required, kept as history
await rejects(kapten.call('adjustScore', { id: edited.id, score: 6, note: 'alasan' }), /Super Admin dan Challenge PIC/);
await rejects(admin.call('adjustScore', { id: edited.id, score: 6, note: '' }), /alasan/);
await rejects(admin.call('adjustScore', { id: edited.id, score: 99, note: 'terlalu tinggi' }), /antara 0 dan 12/);
await rejects(admin.call('adjustScore', { id: kSub.id, score: 5, note: 'coba captain' }), /captain/);
const adj = await admin.call('adjustScore', { id: edited.id, score: 6, note: 'Foto ternyata bukan berdua' });
assert.equal(adj.score, 6);
assert.equal(adj.adjustments.length, 1);
assert.deepEqual([adj.adjustments[0].from, adj.adjustments[0].to, adj.adjustments[0].note], [12, 6, 'Foto ternyata bukan berdua']);
assert.deepEqual([adj.adjustments[0].by_name, adj.adjustments[0].by_role], ['Angel', 'super_admin']);
assert.deepEqual([adj.reviewed_by_name, adj.reviewed_by_role], ['Kapten', 'captain']);
// Once R2 opens, R1 can't be re-validated or re-scored any more.
const r2id = ch.find((c) => c.code === 'R2').id;
await admin.call('saveChallenge', { c: { id: r2id, open_at: new Date(Date.now() - 60e3).toISOString() } });
await rejects(admin.call('adjustScore', { id: edited.id, score: 7, note: 'terlambat' }), /sudah ditutup sejak R2 dibuka/);
await rejects(admin.call('reopenSubmission', { id: edited.id }), /sudah ditutup sejak R2 dibuka/);
await admin.call('saveChallenge', { c: { id: r2id, open_at: r2open } });
// 1 member with 6/24 → 6/24×70 = 17.5; 1 of 3 players → 10 → 27.5
assert.equal(await pts01(), 27.5);
assert.ok((await ana.call('listNotifications')).some((x) => x.title === 'Poin diubah panitia' && /12 → 6 poin\. Alasan: Foto ternyata bukan berdua/.test(x.body)));
await admin.call('saveChallenge', { c: { id: r1.id, deadline_at: r1deadline } });
ok('after validation (even past the deadline) admin/PIC can change points with a reason — until the next mini event opens; history kept, group notified, team score updated');
const notes = await ana.call('listNotifications');
assert.ok(notes.some((x) => /disetujui/.test(x.title) && /Ana → Budi/.test(x.body))); ok('group notified of the review');
await ana.call('markNotificationsRead', { ids: notes.map((x) => x.id) });
assert.ok((await ana.call('listNotifications')).every((x) => x.read)); ok('mark as read');

// 6 · challenge status → notification; draw → riddles visible to the group
const rows = [{ group_no: '01', slot: 1, riddle_id: (await admin.call('listRiddles', { challengeId: r2.id }))[0].id }];
await admin.call('saveDraw', { challengeId: r2.id, rows, seed: 42 });
for (const who of [kapten2, ana]) {
  assert.deepEqual(await who.call('listRiddles', { challengeId: r2.id }), []);
  assert.deepEqual(await who.call('getDraw', { challengeId: r2.id }), []);
}
ok('before it opens, captains and members get no riddles or draw ("Coming soon")');
await admin.call('saveChallenge', { c: { id: r2.id, status: 'live', deadline_at: new Date(Date.now() + 7 * 864e5).toISOString() } });
assert.equal((await kapten2.call('listRiddles', { challengeId: r2.id })).length, 10);
assert.ok((await ana.call('listNotifications')).some((x) => /Guess, Find, Snap! sudah dibuka/.test(x.title)));
const seen = await ana.call('listRiddles', { challengeId: r2.id });
assert.equal(seen.length, 1); assert.equal(seen[0].answer, null); ok('live challenge notifies everyone; members see only their drawn riddle, never the answer');

// 6b · auto-open: past its open time, a scheduled event goes Live by itself (with a riddle draw + notification)
const auto = await admin.call('saveChallenge', { c: { code: 'SQ1', kind: 'side', name: 'Auto Open', status: 'draft', riddles_per_group: 1, sections: { game_idea: 'hello' } } });
await admin.call('saveRiddle', { r: { challenge_id: auto.id, no: 1, prompt: 'p', answer: 'a' } });
await admin.call('saveChallenge', { c: { id: auto.id, status: 'scheduled', open_at: new Date(Date.now() - 60e3).toISOString() } });
const opened = (await ana.call('listChallenges')).find((c) => c.id === auto.id);
assert.equal(opened.status, 'live'); assert.equal(opened.sections.game_idea, 'hello');
assert.equal((await admin.call('getDraw', { challengeId: auto.id })).length, 2);
assert.ok((await ana.call('listNotifications')).some((x) => x.title === 'Auto Open sudah dibuka!'));
assert.equal((await ana.call('listChallenges')).find((c) => c.id === sched.id).status, 'scheduled');
ok('scheduled events open by themselves at their open time: Live, riddles drawn, everyone notified');

// 7 · photos
await admin.call('updateProfile', { id: ids.ana, patch: { role_id: 'group_leader' } });
const leader = client(); await leader.login('ana', pw.ana);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const s2 = await leader.call('createSubmission', { sub: { challenge_id: r2.id, group_no: '01', riddle_id: rows[0].riddle_id, ig_url: 'https://x', tagged_ids: [ids.budi], declaration: true }, media: { name: 'foto.png', type: 'image/png', data: png.toString('base64') } });
assert.equal((await leader.media(s2.media_path)).statusCode, 200);
const dodi = client(); await dodi.login('dodi', pw.dodi);
assert.equal((await dodi.media(s2.media_path)).statusCode, 403);
assert.equal((await kapten.media(s2.media_path)).statusCode, 200);
assert.equal((await kapten2.media(s2.media_path)).statusCode, 403);
assert.equal((await admin.media(s2.media_path)).statusCode, 200);
const s2b = await leader.call('createSubmission', { sub: { challenge_id: r2.id, group_no: '01', riddle_id: rows[0].riddle_id, ig_url: 'https://y', tagged_ids: [ids.budi], declaration: true, keep_media: true } });
assert.equal(s2b.version, 2); assert.equal(s2b.media_path, s2.media_path);
assert.equal((await leader.media(s2b.media_path)).statusCode, 200);
assert.equal((await kapten.call('listSubmissions', { challengeId: r2.id })).length, 1);
// R2 uses Skenario 1: the server scores it from the real team size (group 01 = 3 players; captains don't count).
assert.equal(r2.scoring.type, 'proportional');
const r2rev = await kapten.call('reviewSubmission', { id: s2b.id, patch: { status: 'validated', location_correct: true, participant_count: 2, score: 999, checks: [true, true, true] } });
// Participation comes from the leader's selection (Budi = 1 of 3), not from a number the validator sends.
assert.equal(r2rev.participant_count, 1);
assert.equal(r2rev.score, 16.667);   // 12.5 + 1/3 × 12.5
assert.equal((await ana.call('groupScores')).find((x) => x.group_no === '01' && x.challenge_id === r2.id).points, 16.7);
// Riddle validation: "Skor penuh riddle" = 12.5, or a manual riddle score with a reason — participation (Budi = 1/3 → 4.167) stays automatic.
assert.equal((await kapten.call('reviewSubmission', { id: s2b.id, patch: { status: 'validated', location_correct: true, score: 999 } })).score, 16.667);
assert.equal((await kapten.call('reviewSubmission', { id: s2b.id, patch: { status: 'validated', marks: { riddle: 6 }, override_note: 'Foto kurang jelas' } })).score, 10.167);
assert.equal((await kapten.call('reviewSubmission', { id: s2b.id, patch: { status: 'validated', marks: { riddle: 99 }, override_note: 'salah ketik' } })).score, 16.667);
await rejects(kapten.call('reviewSubmission', { id: s2b.id, patch: { status: 'validated', marks: { riddle: 6 } } }), /wajib pakai alasan/);
await kapten.call('reviewSubmission', { id: s2b.id, patch: { status: 'validated', location_correct: true, score: 0, checks: [true, true, true] } });
// R3: the Group Leader submits the official video + BTS + offline names; members submit their own Reels.
const r3 = ch.find((c) => c.code === 'R3');
await admin.call('saveChallenge', { c: { id: r3.id, status: 'live', open_at: new Date(Date.now() - 60e3).toISOString(), deadline_at: new Date(Date.now() + 7 * 864e5).toISOString() } });
await rejects(budi.call('createSubmission', { sub: { challenge_id: r3.id, group_no: '01', ig_url: 'https://video', declaration: true } }), /Group Leader/);
const s3 = await leader.call('createSubmission', { sub: { challenge_id: r3.id, group_no: '01', ig_url: 'https://video', tagged_ids: [ids.ana], declaration: true, answers: { answer: 'https://drive/bts' } } });
const reelBudi = await budi.call('createSubmission', { sub: { challenge_id: r3.id, group_no: '01', ig_url: 'https://instagram.com/reel/budi', declaration: true, reel: true } });
assert.equal(reelBudi.target_id, ids.budi);
const reelKapten = await kapten.call('createSubmission', { sub: { challenge_id: r3.id, group_no: '01', ig_url: 'https://instagram.com/reel/kapten', declaration: true, reel: true } });
await rejects(budi.call('createSubmission', { sub: { challenge_id: r3.id, group_no: '01', ig_url: '', declaration: true, reel: true } }), /link Reels/);
const marks = { fit: 20, useful: 15, clear: 10, team: 5, offline: [ids.ana], bts: 'photos' };
// Official first: only Ana (offline) so far → 50 + 1/3 × 40 + 5 + 2 = 70.333
assert.equal((await kapten.call('reviewSubmission', { id: s3.id, patch: { status: 'validated', score: 999, checks: [true, true, true], marks } })).score, 70.333);
// Budi's and the captain's Reels approved later: no points of their own; Budi now counts online, the captain never does
assert.equal((await kapten.call('reviewSubmission', { id: reelBudi.id, patch: { status: 'validated', score: 12, checks: [true] } })).score, 0);
await kapten.call('reviewSubmission', { id: reelKapten.id, patch: { status: 'validated', checks: [true] } });
// team: 50 + (Ana offline + Budi online = 2 of 3) × 40 = 26.667 + 5 + 2 = 83.667 → 83.7
assert.equal((await ana.call('groupScores')).find((x) => x.group_no === '01' && x.challenge_id === r3.id).points, 83.7);
ok('R3: leader submits video + BTS + offline; members submit own Reels; approved Reels count online (captains never)');
ok("photo stored; visible to its group, that group's captain and admins/PICs — not other groups or their captains");

// 7b · the Vercel setting resets the Super Admins only when it changes
assert.deepEqual(await outsider.call('setupStatus'), { setup: 'ok', superAdmins: ['angel', 'philips'] });
await admin.call('setPassword', { id: adminId, password: 'Changed-in-app1' });
const restart = async () => { setDb(fromPglite(lite)); await getDb(); };
await restart();
await admin.login('angel', 'Changed-in-app1'); ok('setupStatus reports the setting + admins; a restart keeps passwords changed in the app');
process.env.ADMIN_SETUP_PASSWORD = 'brand-new-pass9';
await restart();
await rejects(admin.call('session').then((id) => { if (!id) throw new Error('Sesi berakhir'); }), /Sesi berakhir/);
await admin.login('angel', 'brand-new-pass9');
await client().login('philips', 'brand-new-pass9'); ok('changing ADMIN_SETUP_PASSWORD resets angel + philips (and signs them out)');
process.env.ADMIN_SETUP_PASSWORD = 'setup-pass-123';
await restart(); await admin.login('angel', 'setup-pass-123');
// The live R1 text written before the participation change is updated on start — unless an admin edited that line.
const OLD_P = '- Team score = (average member score ÷ 24 × 70) + (participation rate × 30), max 100. The average counts members who took part; participation rate = members who submitted ÷ team size.';
const r1now = (await admin.call('listChallenges')).find((x) => x.code === 'R1');
await admin.call('saveChallenge', { c: { id: r1now.id, sections: { ...r1now.sections, points_rewards: 'Intro\n' + OLD_P } } });
await restart(); await admin.login('angel', 'setup-pass-123');
const pr = (await admin.call('listChallenges')).find((x) => x.code === 'R1').sections.points_rewards;
assert.ok(pr.startsWith('Intro\n') && pr.includes('(members who submitted + members who were interviewed) ÷ team size × ½') && !pr.includes(OLD_P));
ok('R1 points text in the database follows the new participation formula');
// A database seeded before Skenario 1 (R2 still on the rubric, nothing validated) switches R2 once on start.
const r2now = (await admin.call('listChallenges')).find((x) => x.code === 'R2');
await db.query(`update challenges set scoring = '{"type":"rubric","criteria":[]}' where code = 'R2'`);
await db.query(`update submissions set status = 'submitted' where challenge_id = $1`, [r2now.id]);
await db.query(`delete from app_meta where key = 'r2_proportional'`);
await restart(); await admin.login('angel', 'setup-pass-123');
const r2after = (await admin.call('listChallenges')).find((x) => x.code === 'R2');
assert.equal(r2after.scoring.type, 'proportional'); assert.ok(r2after.sections.points_rewards.includes('÷ team size × 12.5'));
ok('the live R2 switches to Skenario 1 once (only while nothing in R2 is validated)');
// A database seeded before the R3 update (old rubric, nothing validated) gets the new R3 rules once.
const r3id = (await admin.call('listChallenges')).find((x) => x.code === 'R3').id;
await db.query(`update challenges set scoring = '{"type":"rubric","criteria":[]}' where code = 'R3'`);
await db.query(`update submissions set status = 'submitted' where challenge_id = $1`, [r3id]);
await db.query(`delete from app_meta where key = 'r3_give_grow'`);
await restart(); await admin.login('angel', 'setup-pass-123');
const r3after = (await admin.call('listChallenges')).find((x) => x.code === 'R3');
assert.equal(r3after.scoring.type, 'give_grow'); assert.equal(new Date(r3after.deadline_at).toISOString(), '2026-11-08T16:59:00.000Z');
assert.ok(r3after.sections.rules.includes('One member, one participation credit'));
assert.deepEqual(r3after.form.reel_confirm, ['Satu video resmi tim, maksimal 60 detik', 'IG tidak diprivate dan sudah ditag ke akun IG flourishtogether.ur']);
assert.equal(r3after.form.confirm.length, 2); assert.ok(r3after.sections.flourish_hub.includes('Reels kamu'));
ok('the live R3 gets the updated rules, scoring and 8 Nov deadline once (only while nothing in R3 is validated)');

// 8 · passwords: reset signs the person out; super admin protected
await admin.call('setPassword', { id: ids.budi, password: 'NewPass88' });
await rejects(budi.call('listProfiles'), /Sesi berakhir/);
await budi.login('budi', 'NewPass88'); ok('password reset signs out old sessions');
await rejects(kapten.call('setPassword', { id: adminId, password: 'hacked123' }), /izin|Super Admin/); ok('non-admins cannot change Super Admin passwords');
for (let i = 0; i < 10; i++) await rejects(outsider.login('angel', 'nope'), /salah/);
await rejects(outsider.login('angel', 'setup-pass-123'), /Terlalu banyak/); ok('login rate limit after 10 failures');

// 9 · lockdown: the web API roles of hosted Postgres can't read or write anything
const rls = (await db.query(`select count(*)::int as n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity`)).rows[0].n;
assert.ok(rls >= 15);
for (const role of ['anon', 'authenticated']) {
  await lite.exec(`set role ${role}`);
  await rejects(lite.query('select username, password_hash from profiles'), /permission denied/);
  await rejects(lite.query(`insert into app_meta values ('x', 'y')`), /permission denied/);
  await lite.exec('reset role');
}
ok('tables locked: row-level security on, anon/authenticated have no access');

console.log(`\nAll ${n} checks passed.`);
