// Sample data for the member portal, ported from design/Flourish Hub Portal.dc.html.
// The signed-in user comes from the auth profile (see PortalApp).

export const ROSTER = [
  ['Nadia P.', '#8A4FA3'], ['Kevin S.', '#2A8C82'], ['Grace L.', '#C4533F'], ['Yosua H.', '#3E86C9'], ['Michelle T.', '#C98A12'],
  ['Andre W.', '#4E9A55'], ['Clara M.', '#D0577E'], ['Daniel K.', '#5C63B8'], ['Febe A.', '#9A6435'], ['Ivan R.', '#7F8F24'],
  ['Jessica N.', '#2A8C82'], ['Timothy G.', '#8A4FA3'], ['Priska D.', '#3E86C9'], ['Samuel B.', '#C4533F'],
];
export const initials = (n) => n.split(' ').map((x) => x[0]).join('').replace('.', '');

export const SUB_CHIP = {
  Validated: ['#E3EFE6', '#1F4D3A'], Submitted: ['#E3ECF8', '#244F8F'], Draft: ['#F8E9C4', '#7A5410'],
  'Not Started': ['#EDE6D6', '#56655C'], Rejected: ['#FBE4E0', '#9A2A1E'],
};

export const MY_RIDDLES = [
  ['3', 'Validated', 'Anak-anak berlari ke sini, orang tua melepas dengan lambaian.', 'Tervalidasi · 8/10 pts · 8 orang ditag'],
  ['7', 'Submitted', 'Kartu kecil berisi harapan berakhir di kotak ini.', 'Dikirim Jum 18:05 oleh Nadia · 12 orang'],
  ['2', 'Draft', 'Di sini kopi dan cerita bertemu setelah ibadah.', '3 foto di draft grup (Grace, Ivan, Febe)'],
  ['9', 'Not Started', 'Mobil berhenti, senyum pertama dimulai dari sini.', 'Belum ada foto'],
];

// Portal leaderboard tabs → standings column.
export const LB_TABS = [['Total', 'total'], ['Photo', 'r1'], ['Video', 'r2'], ['Side Q', 'sq']];

export const submitRules = (me) => [
  `Semua orang di foto adalah anggota ${me.group?.name || 'grup kamu'}`,
  'IG Story sudah tag akun event',
  'Tidak menyebut nama gereja & tidak ada wajah jemaat tanpa izin',
  `Deklarasi No-AI: foto ini asli, diambil hari ini, tanpa AI atau editing lokasi. — ${me.first} (${me.roleName})`,
];
