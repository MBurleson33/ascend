// Shared helpers for Ascend's serverless functions. Files starting with _ are not routes on Vercel.
import crypto from 'node:crypto';

const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const P = 'ascend:'; // key prefix, so Ascend can share an existing Upstash database

export async function redis(...cmd) {
  if (!DB_URL || !DB_TOKEN) throw Object.assign(new Error('Database not configured'), { status: 503 });
  const r = await fetch(DB_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
export const okId = s => typeof s === 'string' && /^[A-Z0-9]{8}$/.test(s);
export const okTok = s => typeof s === 'string' && /^[A-Za-z0-9]{20,64}$/.test(s);

// true = valid, false = wrong token, null = unknown player
export async function auth(id, token) {
  if (!okId(id) || !okTok(token)) return false;
  const h = await redis('GET', P + 'auth:' + id);
  if (!h) return null;
  return h === hash(token);
}

export function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

// VAPID keys: use env vars if set, otherwise generate once and keep them in the database
export async function vapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  const have = await redis('GET', P + 'vapid');
  if (have) return JSON.parse(have);
  const webpush = (await import('web-push')).default;
  await redis('SET', P + 'vapid', JSON.stringify(webpush.generateVAPIDKeys()), 'NX');
  return JSON.parse(await redis('GET', P + 'vapid'));
}

export const wrap = fn => async (req, res) => {
  try { await fn(req, res); } catch (e) { send(res, e.status || 500, { error: e.message || 'Server error' }); }
};

// Apple's push service rejects VAPID subjects it can't verify, so default to this site's own https URL
export const subject = req => process.env.VAPID_SUBJECT || `https://${req.headers['x-forwarded-host'] || req.headers.host || 'ascend.app'}`;
