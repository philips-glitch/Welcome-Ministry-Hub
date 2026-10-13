// Backend check against an in-memory Postgres (PGlite): node server/test.js
// Exercises login, roles, roster import, submissions, reviews, scores, notifications and photos with made-up people.
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { setDb, getDb, fromPglite } from './db.js';
import { handleRpc, handleMedia } from './rpc.js';
import { resetSecretCache } from './auth.js';

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
const ids = Object.fromEntries((await admin.call('listProfiles')).map((p) => [p.username, p.id]));
const sub = (t) => ({ sub: { challenge_id: r1.id, group_no: '01', target_id: t, answers: { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }, declaration: true } });
await rejects(ana.call('createSubmission', sub(ids.ana)), /bukan diri sendiri/);
await rejects(ana.call('createSubmission', sub(ids.dodi)), /grup kamu sendiri/);
const s1 = await ana.call('createSubmission', sub(ids.budi));
await rejects(ana.call('createSubmission', sub(ids.budi)), /sudah kamu submit/);
await ana.call('createSubmission', sub(ids.cici));
assert.equal(s1.version, 1); ok('connect rules: not self, own group only, once per person');
const kapten = client(); await kapten.login('kapten', pw.kapten);
const kapten2 = client(); await kapten2.login('kaptendua', pw.kaptendua);
await kapten.call('createSubmission', sub(ids.budi));
const cici = client(); await cici.login('cici', pw.cici);
await cici.call('createSubmission', sub(ids.kapten)); ok('captains play Get to Know Me like members, both ways');
const k1sees = await kapten.call('listSubmissions', { challengeId: r1.id });
assert.deepEqual([...new Set(k1sees.map((x) => x.submitted_by))], [ids.kapten]);
assert.equal((await kapten2.call('listSubmissions', { challengeId: r1.id })).length, 4);
await admin.call('saveGtkm', { id: ids.budi, data: { words: 'w', enjoy: 'e', talent: 't' } });
await admin.call('saveGtkm', { id: ids.pici, data: { words: 'w', enjoy: 'e', talent: 't' } });
assert.deepEqual(await kapten.call('getGtkm', { ids: [ids.budi] }), {});
assert.ok((await kapten2.call('getGtkm', { ids: [ids.budi] }))[ids.budi]);
assert.ok((await admin.call('getGtkm', { ids: [ids.budi, ids.pici] }))[ids.pici]);
ok("a captain sees their own group like a member: no group-mates' answers, no answer key");
const budi = client(); await budi.login('budi', pw.budi);
assert.equal((await budi.call('listSubmissions', { challengeId: r1.id, groupNo: '01' })).length, 0); ok("members can't see group-mates' answers");
const r2 = ch.find((c) => c.code === 'R2');
await rejects(ana.call('createSubmission', { sub: { challenge_id: r2.id, group_no: '01' } }), /tidak menerima|Group Leader/); ok('non-connect challenge needs Group Leader (and live)');

// 5 · validation + scores + notifications
await rejects(ana.call('reviewSubmission', { id: s1.id, patch: { status: 'validated', score: 12 } }), /izin/);
await rejects(kapten.call('reviewSubmission', { id: s1.id, patch: { status: 'validated', score: 12 } }), /captain\/PIC lain/);
const rev = await kapten2.call('reviewSubmission', { id: s1.id, patch: { status: 'validated', marks: { q1: 2, q2: 2, q3: 2, q4: 4, photo: true }, score: 12, checks: [true, true, true] } });
assert.equal(rev.score, 12);
const scores = await ana.call('groupScores');
const g1 = scores.find((s) => s.group_no === '01' && s.challenge_id === r1.id);
// 1 member took part with 12/24 → 12/24×70 = 35; 1 of 4 players (3 members + captain) → 0.25×30 = 7.5 → 42.5
assert.equal(g1.points, 42.5); ok("captain can't validate own group; another captain's review → team score 42.5 (captain counts in the team)");
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
await admin.call('saveChallenge', { c: { id: r2.id, status: 'live' } });
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
assert.equal((await kapten.media(s2.media_path)).statusCode, 200); ok('photo stored; visible to own group and validators, not other groups');

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
