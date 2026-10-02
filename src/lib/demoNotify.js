// Demo-mode notifications, mirroring supabase/migrations/0003_notifications.sql:
// same three automatic kinds, same dedupe keys, same wording. Times follow the demo clock.
import { DEMO_NOW } from '../data.js';

const T0 = Date.now();
export const demoNow = () => DEMO_NOW + (Date.now() - T0);
const iso = (ms) => new Date(ms).toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'n-' + Date.now() + Math.random().toString(16).slice(2));
const wibShort = (v) => new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');

function push(s, n, at = demoNow()) {
  s.notifications ||= [];
  if (s.notifications.some((x) => x.dedupe_key === n.dedupe_key)) return;
  s.notifications.push({ id: uid(), body: null, challenge_id: null, group_no: null, tone: 'info', created_at: iso(at), ...n });
}

export function notifyReview(s, sub, at) {
  const c = s.challenges.find((x) => x.id === sub.challenge_id);
  if (!c) return;
  const r = s.riddles.find((x) => x.id === sub.riddle_id);
  const label = `${c.code} · ${c.name}${r ? ` · Riddle ${r.no}` : ''}`;
  const base = { kind: 'review', challenge_id: c.id, group_no: sub.group_no };
  if (sub.status === 'validated') push(s, { ...base, title: 'Submission disetujui 🎉', body: `${label} tervalidasi: +${sub.score ?? 0} poin.`, tone: 'good', dedupe_key: `review:${sub.id}:validated` }, at);
  else if (sub.status === 'rejected') push(s, { ...base, title: 'Submission ditolak', body: `${label}: ${sub.reject_reason || 'lihat detail'}. Kirim ulang sebelum deadline.`, tone: 'bad', dedupe_key: `review:${sub.id}:rejected` }, at);
  else if (sub.status === 'resubmit') push(s, { ...base, title: 'Diminta kirim ulang', body: `${label}: ${sub.reject_reason || 'lihat detail'}.`, tone: 'warn', dedupe_key: `review:${sub.id}:resubmit` }, at);
}

export function notifyChallenge(s, c, at) {
  if (c.status === 'scheduled') {
    push(s, { kind: 'challenge', challenge_id: c.id, title: `Challenge baru: ${c.name}`, body: `${c.code}${c.open_at ? ` dibuka ${wibShort(c.open_at)} WIB` : ' segera dibuka'}.`, dedupe_key: `challenge:${c.id}:scheduled` }, at);
  } else if (c.status === 'live') {
    push(s, { kind: 'challenge', challenge_id: c.id, title: `${c.name} sudah dibuka!`, body: `${c.code} live${c.deadline_at ? ` s/d ${wibShort(c.deadline_at)} WIB` : ''}. Yuk mulai!`, tone: 'good', dedupe_key: `challenge:${c.id}:live` }, at);
  }
}

// What `send_deadline_reminders()` does on a schedule, run on read in demo mode.
export function syncReminders(s, now = demoNow()) {
  const H = 3600e3;
  s.challenges.filter((c) => c.status === 'live' && c.deadline_at).forEach((c) => {
    const dl = new Date(c.deadline_at).getTime();
    if (dl <= now || dl > now + 24 * H) return;
    const label = dl <= now + 3 * H ? '3' : '24';
    s.groups.forEach(({ no }) => {
      const active = (riddleId) => s.submissions.some((x) => x.challenge_id === c.id && x.group_no === no && (x.riddle_id ?? null) === riddleId && ['submitted', 'validated'].includes(x.status));
      const left = c.riddles_per_group > 0
        ? s.draws.filter((d) => d.challenge_id === c.id && d.group_no === no && !active(d.riddle_id)).length
        : (s.submissions.some((x) => x.challenge_id === c.id && x.group_no === no && ['submitted', 'validated'].includes(x.status)) ? 0 : 1);
      if (!left) return;
      push(s, {
        kind: 'reminder', challenge_id: c.id, group_no: no, tone: 'warn', title: `Deadline ${label} jam lagi ⏰`,
        body: `${c.name}: ${c.riddles_per_group > 0 ? `${left} riddle belum dikirim` : 'grup kamu belum submit'}. Tutup ${wibShort(c.deadline_at)} WIB.`,
        dedupe_key: `reminder${label}:${c.id}:${no}`,
      }, now);
    });
  });
}

// Backfill what the triggers would already have sent for the seeded history (never in the future).
export function seedNotifications(s) {
  s.notifications = [];
  s.notificationReads = {};
  const past = (ms) => Math.min(ms, demoNow() - 3600e3);
  const t = (v) => new Date(v || '2026-10-08T13:00:00Z').getTime();
  s.challenges.forEach((c) => {
    if (['scheduled', 'live', 'closed', 'published'].includes(c.status)) notifyChallenge(s, { ...c, status: 'scheduled' }, past(t(c.announce_at) - 24 * 3600e3));
    if (['live', 'closed', 'published'].includes(c.status)) notifyChallenge(s, { ...c, status: 'live' }, past(t(c.open_at || c.announce_at)));
  });
  s.submissions.filter((x) => x.status !== 'submitted' && x.reviewed_at).forEach((x) => notifyReview(s, x, past(t(x.reviewed_at))));
}
