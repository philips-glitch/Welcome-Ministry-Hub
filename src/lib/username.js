// Usernames: 3–24 chars, lowercase letters, digits, "." and "_", starting with a letter or digit.
// Each account also gets a hidden email derived from the username (profiles.email). Members never see or type it.
export const AUTH_EMAIL_DOMAIN = 'users.flourish.local';

export const normalizeUsername = (u) => String(u || '').trim().toLowerCase().replace(/^@/, '');

export function usernameError(u) {
  const v = normalizeUsername(u);
  if (!v) return 'Username wajib diisi.';
  if (v.length < 3) return 'Username minimal 3 karakter.';
  if (v.length > 24) return 'Username maksimal 24 karakter.';
  if (!/^[a-z0-9][a-z0-9._]*$/.test(v)) return 'Username hanya boleh huruf kecil, angka, titik dan garis bawah (tanpa spasi).';
  return null;
}

export const authEmail = (u) => `${normalizeUsername(u)}@${AUTH_EMAIL_DOMAIN}`;

// Suggest a username from a full name: "Nadia Putri" → "nadia.putri".
export const suggestUsername = (name) => normalizeUsername(name).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 24);
