// Passwords (scrypt) and sessions (HMAC-signed token in an HttpOnly cookie). Node built-ins only.
import { scrypt, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const scryptKey = (pw, salt) => new Promise((resolve, reject) =>
  scrypt(String(pw), salt, 32, { N: 16384, r: 8, p: 1 }, (e, key) => (e ? reject(e) : resolve(key))));

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await scryptKey(pw, salt)).toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, key] = stored.split('$');
  const want = Buffer.from(key, 'base64');
  const got = await scryptKey(pw, Buffer.from(salt, 'base64'));
  return want.length === got.length && timingSafeEqual(want, got);
}

// The signing secret is generated once and kept in the database, so no one has to create or paste one.
let cached = null;
export async function sessionSecret(db) {
  if (cached) return cached;
  const read = async () => (await db.query(`select value from app_meta where key = 'session_secret'`)).rows[0]?.value;
  let v = await read();
  if (!v) {
    await db.query(`insert into app_meta values ('session_secret', $1) on conflict (key) do nothing`, [randomBytes(32).toString('base64url')]);
    v = await read();
  }
  return (cached = v);
}
export const resetSecretCache = () => { cached = null; };

const DAYS = 30;
const mac = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url');

export function signSession(uid, secret) {
  const now = Date.now();
  const body = Buffer.from(JSON.stringify({ uid, iat: now, exp: now + DAYS * 864e5 })).toString('base64url');
  return `${body}.${mac(body, secret)}`;
}
export function readSession(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const want = Buffer.from(mac(body, secret)), got = Buffer.from(sig || '');
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString());
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

export const COOKIE = 'fh_session';
export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => c.trim()).filter(Boolean).map((c) => {
    const i = c.indexOf('=');
    return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
  }));
}
// Secure everywhere except plain-http localhost (local dev).
const secureFor = (req) => !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') || req.headers['x-forwarded-proto'] === 'https';
export const sessionCookie = (req, token) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secureFor(req) ? '; Secure' : ''}`;
export const clearCookie = (req) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFor(req) ? '; Secure' : ''}`;
