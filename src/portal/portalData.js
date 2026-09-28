// Sample data for the member portal, ported from design/Flourish Hub Portal.dc.html.
// Demo user: Nadia, Group Leader of Vine (04).

export const ME = { name: 'Nadia', group: 'Vine', groupNo: '04', color: '#8A4FA3', role: 'Group Leader' };

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

export const GROUP_COLOR = {
  Olive: '#7F8F24', Cedar: '#2A8C82', Fig: '#C4533F', Vine: '#8A4FA3', 'Mustard Seed': '#C98A12',
  Lily: '#D0577E', Palm: '#3E86C9', Oak: '#9A6435', Willow: '#4E9A55', Hyssop: '#5C63B8',
};

const TOTAL = [['Cedar', 34], ['Olive', 30], ['Vine', 28], ['Mustard Seed', 26], ['Fig', 24], ['Lily', 22], ['Palm', 20], ['Oak', 18], ['Willow', 16], ['Hyssop', 12]];
export const LB_TABS = [
  ['Total', TOTAL],
  ['Photo', TOTAL],
  ['Video', [['Vine', 0], ['Cedar', 0], ['Olive', 0], ['Fig', 0], ['Lily', 0], ['Mustard Seed', 0], ['Palm', 0], ['Oak', 0], ['Willow', 0], ['Hyssop', 0]]],
  ['Side Q', [['Cedar', 15], ['Olive', 15], ['Vine', 15], ['Fig', 10], ['Mustard Seed', 10], ['Lily', 10], ['Palm', 10], ['Oak', 0], ['Willow', 0], ['Hyssop', 0]]],
];

export const BREAKDOWN = [
  { label: 'Photo (R1)', val: '18/40', pct: '45%', color: '#1F4D3A' },
  { label: 'Side Quest', val: '+10', pct: '33%', color: '#E3A92B' },
  { label: 'Video (R2)', val: '—', pct: '0%', color: '#1F4D3A' },
  { label: 'Scrapbook', val: '—', pct: '0%', color: '#1F4D3A' },
];

export const SUBMIT_RULES = [
  'Semua orang di foto adalah anggota Vine',
  'IG Story sudah tag akun event',
  'Tidak menyebut nama gereja & tidak ada wajah jemaat tanpa izin',
  'Deklarasi No-AI: foto ini asli, diambil hari ini, tanpa AI atau editing lokasi. — Nadia (Group Leader)',
];
