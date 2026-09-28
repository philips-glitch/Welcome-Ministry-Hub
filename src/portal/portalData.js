// Portal display helpers. Game data comes from the database (see lib/gameStore.jsx and PortalApp).

export const initials = (n) => (n || '?').split(' ').map((x) => x[0]).join('').replace('.', '').slice(0, 2).toUpperCase();

export const SUB_CHIP = {
  Validated: ['#E3EFE6', '#1F4D3A'], Submitted: ['#E3ECF8', '#244F8F'], Draft: ['#F8E9C4', '#7A5410'],
  'Not Started': ['#EDE6D6', '#56655C'], Rejected: ['#FBE4E0', '#9A2A1E'],
};

// Stable avatar colour per person.
const AVATAR = ['#8A4FA3', '#2A8C82', '#C4533F', '#3E86C9', '#C98A12', '#4E9A55', '#D0577E', '#5C63B8', '#9A6435', '#7F8F24'];
export const avatarColor = (id) => AVATAR[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR.length];

export const submitRules = (me) => [
  `Semua orang di foto adalah anggota ${me.group?.name || 'grup kamu'}`,
  'IG Story sudah tag akun event',
  'Tidak menyebut nama gereja & tidak ada wajah jemaat tanpa izin',
  `Deklarasi No-AI: foto ini asli, diambil hari ini, tanpa AI atau editing lokasi. — ${me.first} (${me.roleName})`,
];
