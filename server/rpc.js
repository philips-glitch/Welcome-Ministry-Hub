// The app's data API: POST /api/rpc { method, args } → { data } | { error }.
// Method names and results match src/lib/demoStore.js / demoGame.js, so the screens work the same in both modes.
// Every method checks the caller's permissions here (role → permissions in role_permissions).
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword, sessionSecret, signSession, readSession, parseCookies, sessionCookie, clearCookie, COOKIE } from './auth.js';
import { notifyReview, notifyChallenge, syncReminders } from './notify.js';
import { normalizeUsername, usernameError, authEmail } from '../src/lib/username.js';
import { isConnect, unitKey, groupPoints, withDefaults } from '../src/lib/game.js';
import { isPlayer } from '../src/lib/groups.js';
import { randomPassword } from '../src/lib/roster.js';

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const deny = (msg = 'Tidak punya izin untuk ini.') => { throw new HttpError(403, msg); };
const bad = (msg) => { throw new HttpError(400, msg); };

const PCOLS = 'id, username, email, contact_email, full_name, role_id, group_no, service_team, position, ministry_role, is_ministry_tl, is_committee, ig_handle, active, created_at';
const MEMBERSHIP = ['role_id', 'group_no', 'service_team', 'position', 'ministry_role', 'is_ministry_tl', 'is_committee', 'active'];
const OWN = ['full_name', 'ig_handle', 'contact_email'];
const CHALLENGE_COLS = ['code', 'kind', 'round', 'name', 'pic_id', 'status', 'announce_at', 'open_at', 'deadline_at', 'validate_by', 'sections', 'scoring', 'form', 'riddles_per_group', 'draw_seed', 'draw_locked', 'sort'];
const JSONB = new Set(['sections', 'scoring', 'form', 'tagged_ids', 'answers', 'checks', 'marks']);
const REVIEW = ['status', 'checks', 'marks', 'location_correct', 'participant_count', 'score', 'override_note', 'reject_reason'];
const MAX_PHOTO = 4 * 1024 * 1024;

const val = (k, v) => (JSONB.has(k) && v != null ? JSON.stringify(v) : v);
const subRow = (r) => r && ({ ...r, score: r.score == null ? null : Number(r.score) });

// UPDATE helper: only whitelisted keys that are present in patch.
async function update(db, table, keyCol, key, patch, allowed, returning = '*') {
  const keys = allowed.filter((k) => k in patch);
  if (!keys.length) return (await db.query(`select ${returning} from ${table} where ${keyCol} = $1`, [key])).rows[0];
  const sets = keys.map((k, i) => `${k} = $${i + 2}`);
  if (['profiles', 'challenges'].includes(table)) sets.push('updated_at = now()');
  const { rows } = await db.query(`update ${table} set ${sets.join(', ')} where ${keyCol} = $1 returning ${returning}`, [key, ...keys.map((k) => val(k, patch[k]))]);
  return rows[0];
}

// ── Session ──────────────────────────────────────────────────────────────────
export async function loadCaller(db, req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const s = readSession(token, await sessionSecret(db));
  if (!s) return null;
  const { rows: [me] } = await db.query(`select ${PCOLS}, session_epoch from profiles where id = $1`, [s.uid]);
  if (!me || new Date(me.session_epoch).getTime() > s.iat) return null; // password changed since
  const perms = me.active ? (await db.query('select permission_id from role_permissions where role_id = $1', [me.role_id])).rows.map((r) => r.permission_id) : [];
  delete me.session_epoch;
  return { ...me, perms: new Set(perms) };
}

const can = (me, p) => !!me?.perms.has(p);
const staff = (me) => can(me, 'submissions.validate') || can(me, 'scores.view');
const needUser = (me) => { if (!me) throw new HttpError(401, 'Sesi berakhir. Silakan masuk lagi.'); };

// ── Methods ──────────────────────────────────────────────────────────────────
// Each: async (ctx, args) → data. ctx = { db, me, req, setCookie }.
const methods = {
  async session({ me }) { return me?.id ?? null; },

  async signInPassword({ db, req, setCookie }, { username, password }) {
    const u = normalizeUsername(username);
    const recent = (await db.query(`select count(*)::int as n from login_attempts where username = $1 and at > now() - interval '10 minutes'`, [u])).rows[0].n;
    if (recent >= 10) bad('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
    const { rows: [p] } = await db.query('select id, password_hash from profiles where username = $1', [u]);
    if (!p || !(await verifyPassword(password, p.password_hash))) {
      await db.query('insert into login_attempts (username) values ($1)', [u]);
      bad('Username atau password salah.');
    }
    await db.query('delete from login_attempts where username = $1 or at < now() - interval \'1 day\'', [u]);
    setCookie(sessionCookie(req, signSession(p.id, await sessionSecret(db))));
    return { ok: true };
  },
  async signOut({ req, setCookie }) { setCookie(clearCookie(req)); return { ok: true }; },

  // ── Profiles ──
  async getProfile({ db, me }, { id }) {
    needUser(me);
    const { rows: [p] } = await db.query(`select ${PCOLS} from profiles where id = $1`, [id]);
    if (!p) return null;
    if (p.id === me.id || can(me, 'members.view') || (me.group_no && p.group_no === me.group_no)) return p;
    return null;
  },
  async listProfiles({ db, me }) {
    needUser(me);
    if (can(me, 'members.view')) return (await db.query(`select ${PCOLS} from profiles order by full_name nulls last, username`)).rows;
    return (await db.query(`select ${PCOLS} from profiles where id = $1 or ($2::text is not null and group_no = $2) order by full_name`, [me.id, me.group_no])).rows;
  },
  async updateProfile(ctx, { id, patch }) {
    const { db, me } = ctx;
    needUser(me);
    const { rows: [t] } = await db.query(`select ${PCOLS} from profiles where id = $1`, [id]);
    if (!t) bad('Member tidak ditemukan.');
    const keys = Object.keys(patch || {});
    const manage = can(me, 'members.manage');
    if (id !== me.id && !manage) deny();
    if (keys.some((k) => MEMBERSHIP.includes(k)) && !manage) deny('Tidak punya izin mengubah data keanggotaan.');
    if ('role_id' in patch && patch.role_id !== t.role_id) {
      if (id === me.id) deny('Tidak bisa mengubah role sendiri.');
      if ([patch.role_id, t.role_id].includes('super_admin') && !can(me, 'roles.manage')) deny('Hanya pemegang hak "roles.manage" yang bisa memberi / mencabut Super Admin.');
    }
    if (t.role_id === 'super_admin' && id !== me.id && !can(me, 'roles.manage')) deny('Tidak bisa mengubah akun Super Admin.');
    if (patch.group_no && !(await db.query('select 1 from groups where no = $1', [patch.group_no])).rows.length) bad(`Grup ${patch.group_no} tidak ada.`);
    return update(db, 'profiles', 'id', id, patch, [...OWN, ...MEMBERSHIP], PCOLS);
  },
  async updateMany(ctx, { list }) {
    const out = [];
    for (const [id, patch] of list || []) out.push(await methods.updateProfile(ctx, { id, patch }));
    return out;
  },
  async createMember({ db, me }, { password, ...f }) {
    needUser(me);
    if (!can(me, 'members.manage')) deny('Tidak punya izin mengelola member.');
    if (f.role_id === 'super_admin' && !can(me, 'roles.manage')) deny('Tidak bisa membuat Super Admin.');
    const username = normalizeUsername(f.username);
    const err = usernameError(username) || (String(password || '').length < 8 ? 'Password minimal 8 karakter.' : null);
    if (err) bad(err);
    if ((await db.query('select 1 from profiles where username = $1', [username])).rows.length) bad(`Username “${username}” sudah dipakai.`);
    if (f.group_no && !(await db.query('select 1 from groups where no = $1', [f.group_no])).rows.length) bad(`Grup ${f.group_no} tidak ada.`);
    const fields = [...OWN, ...MEMBERSHIP.filter((k) => k !== 'active')].filter((k) => k in f);
    const cols = ['username', 'email', 'password_hash', ...fields];
    const vals = [username, authEmail(username), await hashPassword(password), ...fields.map((k) => f[k])];
    const { rows: [row] } = await db.query(`insert into profiles (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning ${PCOLS}`, vals);
    return row;
  },
  async setPassword({ db, me, req, setCookie }, { id, password }) {
    needUser(me);
    if (String(password || '').length < 8) bad('Password minimal 8 karakter.');
    if (id !== me.id && !can(me, 'members.manage')) deny('Tidak punya izin mengelola member.');
    const { rows: [t] } = await db.query('select role_id from profiles where id = $1', [id]);
    if (!t) bad('Member tidak ditemukan.');
    if (t.role_id === 'super_admin' && id !== me.id && !can(me, 'roles.manage')) deny('Tidak bisa mengubah akun Super Admin.');
    // A new password signs that person out everywhere (their old sessions predate session_epoch).
    await db.query('update profiles set password_hash = $2, session_epoch = now(), updated_at = now() where id = $1', [id, await hashPassword(password)]);
    if (id === me.id) setCookie(sessionCookie(req, signSession(id, await sessionSecret(db))));
    return { ok: true };
  },
  async setUsername({ db, me }, { id, username }) {
    needUser(me);
    if (!can(me, 'members.manage')) deny('Tidak punya izin mengelola member.');
    const u = normalizeUsername(username);
    const err = usernameError(u);
    if (err) bad(err);
    if ((await db.query('select 1 from profiles where username = $1 and id <> $2', [u, id])).rows.length) bad(`Username “${u}” sudah dipakai.`);
    const { rows: [row] } = await db.query(`update profiles set username = $2, email = $3, updated_at = now() where id = $1 returning ${PCOLS}`, [id, u, authEmail(u)]);
    if (!row) bad('Member tidak ditemukan.');
    return row;
  },
  async getGtkm({ db, me }, { ids }) {
    needUser(me);
    if (!can(me, 'submissions.validate') && !can(me, 'members.manage')) return {};
    if (!ids?.length) return {};
    const { rows } = await db.query('select profile_id, words, enjoy, talent from profile_gtkm where profile_id = any($1::uuid[])', [ids]);
    return Object.fromEntries(rows.map(({ profile_id, ...g }) => [profile_id, g]));
  },
  async saveGtkm({ db, me }, { id, data }) {
    needUser(me);
    if (!can(me, 'members.manage')) deny('Butuh hak “Daftarkan, ubah & nonaktifkan member”.');
    const { rows: [row] } = await db.query(`insert into profile_gtkm (profile_id, words, enjoy, talent) values ($1,$2,$3,$4)
      on conflict (profile_id) do update set words = excluded.words, enjoy = excluded.enjoy, talent = excluded.talent, updated_at = now()
      returning words, enjoy, talent`, [id, data?.words ?? null, data?.enjoy ?? null, data?.talent ?? null]);
    return row;
  },

  // ── Roles & access ──
  async getGrants({ db, me }) {
    needUser(me);
    const { rows } = await db.query('select role_id, permission_id from role_permissions');
    return rows.reduce((acc, r) => ((acc[r.role_id] ||= []).push(r.permission_id), acc), {});
  },
  async setGrant({ db, me }, { role, perm, on }) {
    needUser(me);
    if (!can(me, 'roles.manage') || role === 'super_admin') deny();
    if (on) await db.query('insert into role_permissions values ($1,$2) on conflict do nothing', [role, perm]);
    else await db.query('delete from role_permissions where role_id = $1 and permission_id = $2', [role, perm]);
    return { ok: true };
  },

  // ── Groups ──
  async listGroups({ db, me }) { needUser(me); return (await db.query('select * from groups order by sort, no')).rows; },
  async createGroup({ db, me }, { g }) {
    needUser(me);
    if (!can(me, 'groups.manage')) deny();
    if ((await db.query('select 1 from groups where no = $1', [g.no])).rows.length) bad(`Nomor grup ${g.no} sudah dipakai.`);
    const sort = (await db.query('select coalesce(max(sort), 0) + 1 as s from groups')).rows[0].s;
    const { rows: [row] } = await db.query('insert into groups (no, name, color, min_size, max_size, sort) values ($1,$2,$3,$4,$5,$6) returning *',
      [g.no, g.name, g.color, g.min_size ?? 12, g.max_size ?? 14, g.sort ?? sort]);
    return row;
  },
  async updateGroup({ db, me }, { no, patch }) {
    needUser(me);
    if (!can(me, 'groups.manage')) deny();
    if (patch.no && patch.no !== no && (await db.query('select 1 from groups where no = $1', [patch.no])).rows.length) bad(`Nomor grup ${patch.no} sudah dipakai.`);
    const row = await update(db, 'groups', 'no', no, patch, ['no', 'name', 'color', 'min_size', 'max_size', 'sort', 'locked_at', 'locked_by']);
    if (!row) bad('Grup tidak ditemukan.');
    return row;
  },
  async deleteGroup({ db, me }, { no }) {
    needUser(me);
    if (!can(me, 'groups.manage')) deny();
    const n = (await db.query('select count(*)::int as n from submissions where group_no = $1', [no])).rows[0].n;
    if (n) bad(`Grup ${no} punya ${n} submission dan tidak bisa dihapus. Ganti nama grup kalau perlu.`);
    await db.query('delete from groups where no = $1', [no]);
    return { ok: true };
  },
  async setGroupsLocked({ db, me }, { locked }) {
    needUser(me);
    if (!can(me, 'groups.manage')) deny();
    await db.query('update groups set locked_at = $1, locked_by = $2', locked ? [new Date().toISOString(), me.id] : [null, null]);
    return { ok: true };
  },

  // ── Challenges & riddles ──
  async listChallenges({ db, me }) {
    needUser(me);
    const all = can(me, 'challenges.manage');
    return (await db.query(`select * from challenges ${all ? '' : "where status <> 'draft'"} order by sort, code`)).rows;
  },
  async saveChallenge({ db, me }, { c }) {
    needUser(me);
    if (!can(me, 'challenges.manage')) deny();
    const { id, created_at, updated_at, ...rest } = c;
    if (rest.code && (await db.query('select 1 from challenges where code = $1 and id is distinct from $2', [rest.code, id || null])).rows.length) bad(`Kode ${rest.code} sudah dipakai.`);
    let row, prev = null;
    if (id) {
      prev = (await db.query('select status from challenges where id = $1', [id])).rows[0]?.status;
      row = await update(db, 'challenges', 'id', id, rest, CHALLENGE_COLS);
      if (!row) bad('Challenge tidak ditemukan.');
    } else {
      const keys = CHALLENGE_COLS.filter((k) => k in rest);
      row = (await db.query(`insert into challenges (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, keys.map((k) => val(k, rest[k])))).rows[0];
    }
    if (row.status !== prev) await notifyChallenge(db, row);
    return row;
  },
  async deleteChallenge({ db, me }, { id }) {
    needUser(me);
    if (!can(me, 'challenges.manage')) deny();
    await db.query('delete from media where path in (select media_path from submissions where challenge_id = $1)', [id]);
    await db.query('delete from challenges where id = $1', [id]);
    return { ok: true };
  },
  async listRiddles({ db, me }, { challengeId }) {
    needUser(me);
    if (can(me, 'challenges.manage') || can(me, 'submissions.validate')) {
      return (await db.query('select id, challenge_id, no, prompt, answer from riddles where challenge_id = $1 order by no', [challengeId])).rows;
    }
    // Members: only the riddles drawn for their group, once the challenge is open — never the answers.
    return (await db.query(`select r.id, r.challenge_id, r.no, r.prompt, null as answer from riddles r
      join riddle_draws d on d.riddle_id = r.id and d.group_no = $2
      join challenges c on c.id = r.challenge_id and c.status in ('live', 'closed', 'published')
      where r.challenge_id = $1 order by r.no`, [challengeId, me.group_no])).rows;
  },
  async saveRiddle({ db, me }, { r }) {
    needUser(me);
    if (!can(me, 'challenges.manage')) deny();
    if ((await db.query('select 1 from riddles where challenge_id = $1 and no = $2 and id is distinct from $3', [r.challenge_id, r.no, r.id || null])).rows.length) bad(`Riddle #${r.no} sudah ada.`);
    const { rows: [row] } = r.id
      ? await db.query('update riddles set no = $2, prompt = $3, answer = $4 where id = $1 returning *', [r.id, r.no, r.prompt, r.answer || ''])
      : await db.query('insert into riddles (challenge_id, no, prompt, answer) values ($1,$2,$3,$4) returning *', [r.challenge_id, r.no, r.prompt, r.answer || '']);
    return row;
  },
  async deleteRiddle({ db, me }, { id }) {
    needUser(me);
    if (!can(me, 'challenges.manage')) deny();
    await db.query('delete from riddles where id = $1', [id]);
    return { ok: true };
  },
  async getDraw({ db, me }, { challengeId }) {
    needUser(me);
    if (can(me, 'challenges.manage') || can(me, 'submissions.validate')) {
      return (await db.query('select group_no, slot, riddle_id from riddle_draws where challenge_id = $1', [challengeId])).rows;
    }
    return (await db.query(`select d.group_no, d.slot, d.riddle_id from riddle_draws d join challenges c on c.id = d.challenge_id
      where d.challenge_id = $1 and d.group_no = $2 and c.status in ('live', 'closed', 'published')`, [challengeId, me.group_no])).rows;
  },
  async saveDraw({ db, me }, { challengeId, rows, seed }) {
    needUser(me);
    if (!can(me, 'challenges.manage')) deny();
    return db.tx(async (t) => {
      await t.query('delete from riddle_draws where challenge_id = $1', [challengeId]);
      for (const r of rows || []) await t.query('insert into riddle_draws (challenge_id, group_no, slot, riddle_id) values ($1,$2,$3,$4)', [challengeId, r.group_no, r.slot, r.riddle_id]);
      return (await t.query('update challenges set draw_seed = $2, updated_at = now() where id = $1 returning *', [challengeId, seed])).rows[0];
    });
  },

  // ── Submissions ──
  async listSubmissions({ db, me }, { challengeId, groupNo } = {}) {
    needUser(me);
    const where = [], p = [];
    if (challengeId) { p.push(challengeId); where.push(`s.challenge_id = $${p.length}`); }
    if (groupNo) { p.push(groupNo); where.push(`s.group_no = $${p.length}`); }
    if (!staff(me)) {
      // Own group only; in connect challenges only one's own entries (so answers can't be copied).
      p.push(me.group_no); where.push(`s.group_no = $${p.length}`);
      p.push(me.id); where.push(`(coalesce(c.scoring->>'type', '') <> 'connect' or s.submitted_by = $${p.length})`);
    }
    const { rows } = await db.query(`select s.* from submissions s join challenges c on c.id = s.challenge_id
      ${where.length ? 'where ' + where.join(' and ') : ''} order by s.submitted_at`, p);
    return rows.map(subRow);
  },
  async createSubmission({ db, me }, { sub, media }) {
    needUser(me);
    const { rows: [c] } = await db.query('select * from challenges where id = $1', [sub.challenge_id]);
    if (!c || c.status !== 'live' || (c.deadline_at && Date.now() > new Date(c.deadline_at).getTime())) bad('Challenge ini sedang tidak menerima submission.');
    if (!me.active || !me.group_no || me.group_no !== sub.group_no) bad('Hanya bisa submit untuk grup sendiri.');
    const connect = isConnect(c);
    const row = {
      challenge_id: c.id, group_no: me.group_no, submitted_by: me.id,
      riddle_id: connect ? null : sub.riddle_id || null, target_id: connect ? sub.target_id || null : null,
      ig_url: sub.ig_url || null, tagged_ids: Array.isArray(sub.tagged_ids) ? sub.tagged_ids : [],
      answers: sub.answers || null, declaration: !!sub.declaration,
    };
    if (connect) {
      if (!isPlayer(me)) bad('Challenge ini untuk peserta grup.');
      const { rows: [t] } = await db.query(`select ${PCOLS} from profiles where id = $1`, [row.target_id]);
      if (!t || t.id === me.id || t.group_no !== me.group_no || !isPlayer(t)) bad('Pilih anggota grup kamu sendiri (bukan diri sendiri).');
      const mine = (await db.query('select target_id, status, version from submissions where challenge_id = $1 and submitted_by = $2 and target_id is not null', [c.id, me.id])).rows;
      const latest = (tid) => mine.filter((x) => x.target_id === tid).sort((a, b) => b.version - a.version)[0];
      const cur = latest(t.id);
      if (cur && !['rejected', 'resubmit'].includes(cur.status)) bad(`${t.full_name} sudah kamu submit.`);
      const active = new Set(mine.map((x) => x.target_id).filter((tid) => tid !== t.id && ['submitted', 'validated'].includes(latest(tid).status)));
      const people = withDefaults(c.scoring).people;
      if (active.size >= people) bad(`Maksimal ${people} orang per member.`);
    } else if (!can(me, 'portal.submit')) bad('Hanya Group Leader yang bisa submit challenge ini.');
    if (row.riddle_id && !(await db.query('select 1 from riddle_draws where challenge_id = $1 and group_no = $2 and riddle_id = $3', [c.id, me.group_no, row.riddle_id])).rows.length) bad('Riddle ini bukan untuk grup kamu.');

    let media_path = null, media_name = null;
    if (media?.data) {
      const bytes = Buffer.from(media.data, 'base64');
      if (bytes.length > MAX_PHOTO) bad('Foto terlalu besar (maks 4 MB setelah diperkecil).');
      if (!/^image\//.test(media.type || '')) bad('File harus berupa foto.');
      media_name = String(media.name || 'foto.jpg').slice(0, 120);
      media_path = `${me.group_no}/${randomUUID()}-${media_name.replace(/[^\w.-]+/g, '_')}`;
      await db.query('insert into media (path, group_no, mime, bytes) values ($1,$2,$3,$4)', [media_path, me.group_no, media.type, bytes]);
    }
    const prev = (await db.query('select challenge_id, group_no, riddle_id, target_id, submitted_by from submissions where challenge_id = $1 and group_no = $2', [c.id, me.group_no])).rows;
    const version = prev.filter((x) => unitKey(x) === unitKey(row)).length + 1;
    const cols = ['challenge_id', 'group_no', 'submitted_by', 'riddle_id', 'target_id', 'ig_url', 'tagged_ids', 'answers', 'declaration', 'media_path', 'media_name', 'version'];
    const data = { ...row, media_path, media_name, version };
    const { rows: [out] } = await db.query(`insert into submissions (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, cols.map((k) => val(k, data[k])));
    return subRow(out);
  },
  async reviewSubmission({ db, me }, { id, patch }) {
    needUser(me);
    if (!can(me, 'submissions.validate')) deny();
    const { rows: [before] } = await db.query('select status from submissions where id = $1', [id]);
    if (!before) bad('Submission tidak ditemukan.');
    const keys = REVIEW.filter((k) => k in patch);
    const { rows: [row] } = await db.query(`update submissions set ${[...keys.map((k, i) => `${k} = $${i + 2}`), `reviewed_by = $${keys.length + 2}`, 'reviewed_at = now()'].join(', ')}
      where id = $1 returning *`, [id, ...keys.map((k) => val(k, patch[k])), me.id]);
    if (row.status !== before.status) await notifyReview(db, row);
    return subRow(row);
  },
  async groupScores({ db, me }) {
    needUser(me);
    const challenges = (await db.query(`select * from challenges where status <> 'draft'`)).rows;
    const valid = (await db.query(`select status, challenge_id, group_no, submitted_by, target_id, riddle_id, tagged_ids, score from submissions where status = 'validated'`)).rows.map(subRow);
    const roster = {};
    (await db.query(`select group_no, count(*)::int as n from profiles where active and not is_committee and role_id in ('member', 'group_leader') and group_no is not null group by group_no`)).rows
      .forEach((r) => { roster[r.group_no] = r.n; });
    const out = [];
    for (const c of challenges) {
      const mine = valid.filter((x) => x.challenge_id === c.id);
      for (const no of [...new Set(mine.map((x) => x.group_no))]) {
        const g = mine.filter((x) => x.group_no === no);
        out.push({ group_no: no, challenge_id: c.id, points: groupPoints(c, g, roster[no] || 0), validated: g.length });
      }
    }
    return out;
  },

  // ── Notifications ──
  async listNotifications({ db, me }) {
    needUser(me);
    await syncReminders(db);
    const { rows } = await db.query(`select n.*, (r.user_id is not null) as read from notifications n
      left join notification_reads r on r.notification_id = n.id and r.user_id = $1
      where n.group_no is null or n.group_no = $2 order by n.created_at desc limit 50`, [me.id, me.active ? me.group_no : null]);
    return rows;
  },
  async markNotificationsRead({ db, me }, { ids }) {
    needUser(me);
    for (const id of ids || []) await db.query('insert into notification_reads (user_id, notification_id) values ($1,$2) on conflict do nothing', [me.id, id]);
    return { ok: true };
  },

  // ── Roster import (Members → Import Excel, Super Admin) ──
  // Removes every account except Super Admins and all game data tied to them, replaces the groups, then
  // creates the accounts with random starting passwords (returned once, for the login list).
  async importRoster({ db, me }, { groups, accounts }) {
    needUser(me);
    if (!can(me, 'roles.manage')) deny('Hanya Super Admin yang bisa import roster.');
    if (!groups?.length || groups.some((g) => !/^[0-9]{2,3}$/.test(String(g.no)) || !String(g.name || '').trim())) bad('Daftar grup tidak valid.');
    const keep = (await db.query(`select username from profiles where role_id = 'super_admin'`)).rows.map((r) => r.username);
    const seen = new Set(keep);
    for (const a of accounts || []) {
      const u = normalizeUsername(a.username);
      const err = usernameError(u);
      if (err) bad(`${a.full_name}: ${err}`);
      if (seen.has(u)) bad(`Username “${u}” dobel.`);
      if (!groups.some((g) => g.no === a.group_no) && a.group_no) bad(`${a.full_name}: grup ${a.group_no} tidak ada di file.`);
      seen.add(u);
    }
    // Hash first (slow part), outside the transaction.
    const prepared = await Promise.all(accounts.map(async (a) => {
      const password = randomPassword(8);
      return { ...a, username: normalizeUsername(a.username), password, hash: await hashPassword(password) };
    }));
    return db.tx(async (t) => {
      for (const sql of ['delete from submissions', 'delete from notifications', 'delete from riddle_draws', 'delete from media', 'delete from profile_gtkm', 'delete from login_attempts',
        `update challenges set draw_seed = null, draw_locked = false, pic_id = case when pic_id in (select id from profiles where role_id = 'super_admin') then pic_id else null end`,
        `update profiles set group_no = null where role_id = 'super_admin'`]) await t.query(sql);
      const removed = (await t.query(`delete from profiles where role_id <> 'super_admin' returning id`)).rows.length;
      const nos = groups.map((g) => String(g.no));
      await t.query('delete from groups where not (no = any($1::text[]))', [nos]);
      for (const [i, g] of groups.entries()) {
        await t.query(`insert into groups (no, name, color, min_size, max_size, sort, locked_at, locked_by) values ($1,$2,$3,$4,$5,$6,null,null)
          on conflict (no) do update set name = excluded.name, color = excluded.color, min_size = excluded.min_size, max_size = excluded.max_size, sort = excluded.sort, locked_at = null, locked_by = null`,
        [String(g.no), String(g.name).trim(), g.color || '#1F4D3A', Number(g.min_size) || 0, Math.max(Number(g.max_size) || 0, Number(g.min_size) || 0), Number(g.sort) || i + 1]);
      }
      const created = [];
      for (const a of prepared) {
        const { rows: [row] } = await t.query(`insert into profiles (username, email, password_hash, full_name, role_id, group_no, service_team, position, ministry_role, is_ministry_tl)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [a.username, authEmail(a.username), a.hash, a.full_name, a.role_id || 'member', a.group_no || null, a.service_team || null, a.position || null, a.ministry_role || null, !!a.is_ministry_tl]);
        const { hash, ...rest } = a;
        created.push({ ...rest, id: row.id });
      }
      return { removed, created, failed: [] };
    });
  },
};

// ── HTTP ─────────────────────────────────────────────────────────────────────
export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export async function handleRpc(req, res, db) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  try {
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
    // JSON only: a cross-site form can't send it without a CORS preflight (CSRF guard with SameSite=Lax cookies).
    if (!/^application\/json/i.test(req.headers['content-type'] || '')) return send(415, { error: 'JSON only' });
    const { method, args } = await readJson(req);
    const fn = Object.hasOwn(methods, method) ? methods[method] : null;
    if (!fn) return send(400, { error: `Unknown method ${method}` });
    const cookies = [];
    const me = await loadCaller(db, req);
    const data = await fn({ db, me, req, setCookie: (c) => cookies.push(c) }, args || {});
    if (cookies.length) res.setHeader('Set-Cookie', cookies);
    return send(200, { data: data ?? null });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error('[rpc]', e);
    return send(status, { error: status >= 500 ? 'Terjadi kesalahan di server. Coba lagi.' : e.message });
  }
}

// GET /api/media?path=… — a submission photo, for the group that sent it and for validators.
export async function handleMedia(req, res, db) {
  try {
    const me = await loadCaller(db, req);
    if (!me) { res.statusCode = 401; return res.end(); }
    const path = new URL(req.url, 'http://x').searchParams.get('path');
    const { rows: [m] } = await db.query('select group_no, mime, bytes from media where path = $1', [path]);
    if (!m) { res.statusCode = 404; return res.end(); }
    if (!(can(me, 'submissions.validate') || (me.group_no && me.group_no === m.group_no))) { res.statusCode = 403; return res.end(); }
    res.statusCode = 200;
    res.setHeader('Content-Type', m.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.end(Buffer.from(m.bytes));
  } catch (e) {
    console.error('[media]', e);
    res.statusCode = 500; return res.end();
  }
}
