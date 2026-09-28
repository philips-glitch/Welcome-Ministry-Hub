// Single source of truth for roles & permissions on the client.
// Must stay in sync with the seed in supabase/migrations/0001_auth_roles.sql.

export const PERMISSIONS = [
  { id: 'dashboard.view', label: 'Buka Admin Dashboard', category: 'Admin' },
  { id: 'groups.manage', label: 'Bentuk & kunci grup', category: 'Admin' },
  { id: 'challenges.manage', label: 'Kelola challenge & riddle', category: 'Admin' },
  { id: 'submissions.validate', label: 'Validasi submission', category: 'Admin' },
  { id: 'scores.view', label: 'Lihat Scoring & Leaderboard', category: 'Admin' },
  { id: 'members.view', label: 'Lihat daftar member', category: 'Member' },
  { id: 'members.manage', label: 'Daftarkan, ubah & nonaktifkan member', category: 'Member' },
  { id: 'roles.manage', label: 'Ubah role & hak akses', category: 'Member' },
  { id: 'portal.view', label: 'Buka Game Portal', category: 'Portal' },
  { id: 'portal.submit', label: 'Submit challenge untuk grup', category: 'Portal' },
];

export const ROLES = [
  { id: 'super_admin', name: 'Super Admin', description: 'Tim Acara. Akses penuh, termasuk hak akses.' },
  { id: 'challenge_pic', name: 'Challenge PIC', description: 'Penanggung jawab satu challenge.' },
  { id: 'captain', name: 'Captain', description: 'Pendamping grup, validasi submission.' },
  { id: 'group_leader', name: 'Group Leader', description: 'Satu per grup. Bisa submit.' },
  { id: 'member', name: 'Member', description: 'Peserta. Lihat challenge & leaderboard.' },
];

const ALL = PERMISSIONS.map((p) => p.id);
export const DEFAULT_GRANTS = {
  super_admin: ALL,
  challenge_pic: ['dashboard.view', 'challenges.manage', 'submissions.validate', 'scores.view', 'members.view', 'portal.view'],
  captain: ['dashboard.view', 'submissions.validate', 'scores.view', 'members.view', 'portal.view'],
  group_leader: ['portal.view', 'portal.submit'],
  member: ['portal.view'],
};

// Super Admin always keeps every permission, so nobody can lock the event out.
export const LOCKED_ROLE = 'super_admin';

export const roleName = (id) => ROLES.find((r) => r.id === id)?.name || id;
