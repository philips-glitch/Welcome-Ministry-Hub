// Automatic notifications, same kinds and wording as demo mode (src/lib/demoNotify.js):
// review results → the group, Scheduled/Live → everyone, deadline reminders (24 h / 3 h) → groups with work left.
// Reminders are created when someone opens their notifications (no scheduled job needed).

const wibShort = (v) => new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

async function push(q, n) {
  await q(`insert into notifications (kind, title, body, challenge_id, group_no, tone, dedupe_key)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict (dedupe_key) do nothing`,
  [n.kind, n.title, n.body ?? null, n.challenge_id ?? null, n.group_no ?? null, n.tone || 'info', n.dedupe_key]);
}

export async function notifyReview(db, sub) {
  if (!['validated', 'rejected', 'resubmit'].includes(sub.status)) return;
  const q = (t, p) => db.query(t, p);
  const c = (await q('select id, code, name from challenges where id = $1', [sub.challenge_id])).rows[0];
  if (!c) return;
  const r = sub.riddle_id ? (await q('select no from riddles where id = $1', [sub.riddle_id])).rows[0] : null;
  const first = async (id) => ((await q('select full_name from profiles where id = $1', [id])).rows[0]?.full_name || '?').split(' ')[0];
  const label = `${c.code} · ${c.name}${r ? ` · Riddle ${r.no}` : ''}${sub.target_id ? ` · ${await first(sub.submitted_by)} → ${await first(sub.target_id)}` : ''}`;
  const base = { kind: 'review', challenge_id: c.id, group_no: sub.group_no };
  if (sub.status === 'validated') await push(q, { ...base, title: 'Submission disetujui 🎉', body: `${label} tervalidasi: +${Number(sub.score ?? 0)} poin.`, tone: 'good', dedupe_key: `review:${sub.id}:validated` });
  else if (sub.status === 'rejected') await push(q, { ...base, title: 'Submission ditolak', body: `${label}: ${sub.reject_reason || 'lihat detail'}. Kirim ulang sebelum deadline.`, tone: 'bad', dedupe_key: `review:${sub.id}:rejected` });
  else await push(q, { ...base, title: 'Diminta kirim ulang', body: `${label}: ${sub.reject_reason || 'lihat detail'}.`, tone: 'warn', dedupe_key: `review:${sub.id}:resubmit` });
}

export async function notifyChallenge(db, c) {
  const q = (t, p) => db.query(t, p);
  if (c.status === 'scheduled') {
    await push(q, { kind: 'challenge', challenge_id: c.id, title: `Challenge baru: ${c.name}`, body: `${c.code}${c.open_at ? ` dibuka ${wibShort(c.open_at)} WIB` : ' segera dibuka'}.`, dedupe_key: `challenge:${c.id}:scheduled` });
  } else if (c.status === 'live') {
    await push(q, { kind: 'challenge', challenge_id: c.id, title: `${c.name} sudah dibuka!`, body: `${c.code} live${c.deadline_at ? ` s/d ${wibShort(c.deadline_at)} WIB` : ''}. Yuk mulai!`, tone: 'good', dedupe_key: `challenge:${c.id}:live` });
  }
}

export async function syncReminders(db, now = Date.now()) {
  const q = (t, p) => db.query(t, p);
  const H = 3600e3;
  const { rows: live } = await q(`select * from challenges where status = 'live' and deadline_at > $1 and deadline_at <= $2`,
    [new Date(now).toISOString(), new Date(now + 24 * H).toISOString()]);
  if (!live.length) return;
  const { rows: groups } = await q('select no from groups');
  for (const c of live) {
    const label = new Date(c.deadline_at).getTime() <= now + 3 * H ? '3' : '24';
    const connect = c.scoring?.type === 'connect';
    const people = c.scoring?.people || 2;
    for (const { no } of groups) {
      let left;
      if (connect) {
        left = Number((await q(`select count(*)::int as n from profiles p
          where p.group_no = $1 and p.active and not p.is_committee and p.role_id in ('member', 'group_leader')
            and (select count(distinct s.target_id) from submissions s
                 where s.challenge_id = $2 and s.submitted_by = p.id and s.status in ('submitted', 'validated')) < $3`, [no, c.id, people])).rows[0].n);
      } else if (c.riddles_per_group > 0) {
        left = Number((await q(`select count(*)::int as n from riddle_draws d
          where d.challenge_id = $1 and d.group_no = $2 and not exists (
            select 1 from submissions s where s.challenge_id = $1 and s.group_no = $2 and s.riddle_id = d.riddle_id and s.status in ('submitted', 'validated'))`, [c.id, no])).rows[0].n);
      } else {
        left = (await q(`select 1 from submissions where challenge_id = $1 and group_no = $2 and status in ('submitted', 'validated') limit 1`, [c.id, no])).rows.length ? 0 : 1;
      }
      if (!left) continue;
      await push(q, {
        kind: 'reminder', challenge_id: c.id, group_no: no, tone: 'warn', title: `Deadline ${label} jam lagi ⏰`,
        body: `${c.name}: ${connect ? `${left} anggota belum submit ${people} orang` : c.riddles_per_group > 0 ? `${left} riddle belum dikirim` : 'grup kamu belum submit'}. Tutup ${wibShort(c.deadline_at)} WIB.`,
        dedupe_key: `reminder${label}:${c.id}:${no}`,
      });
    }
  }
}
