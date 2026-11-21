// Push subscriptions. GET returns the VAPID public key and when the scheduler last ran.
// POST stores a subscription (or sends a test with {test:true}); DELETE removes it.
import webpush from 'web-push';
import { redis, P, auth, send, body, vapid, wrap, subject } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method === 'GET') {
    const [keys, lastTick] = await Promise.all([vapid(), redis('GET', P + 'lastTick')]);
    return send(res, 200, { publicKey: keys.publicKey, lastTick: lastTick ? Number(lastTick) : null, now: Date.now() });
  }
  const { id, token, sub, test } = body(req);
  if (!(await auth(id, token))) return send(res, 403, { error: 'Turn on cloud save first' });
  if (req.method === 'POST' && test) {
    const raw = await redis('GET', P + 'sub:' + id);
    if (!raw) return send(res, 200, { ok: false, step: 'subscription', detail: 'The server has no subscription for this device.' });
    const keys = await vapid();
    webpush.setVapidDetails(subject(req), keys.publicKey, keys.privateKey);
    try {
      await webpush.sendNotification(JSON.parse(raw), JSON.stringify({ title: 'Ascend', body: 'Test notification. If you can see this, notifications work!', tag: 'test-' + Date.now(), url: './' }), { TTL: 600, urgency: 'high' });
      return send(res, 200, { ok: true });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await redis('DEL', P + 'sub:' + id);
      return send(res, 200, { ok: false, step: 'delivery', status: e.statusCode || null, detail: String(e.body || e.message || '').slice(0, 300) });
    }
  }
  if (req.method === 'POST') {
    if (!sub || typeof sub.endpoint !== 'string' || !sub.keys) return send(res, 400, { error: 'Bad subscription' });
    await redis('SET', P + 'sub:' + id, JSON.stringify(sub));
    return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') { await redis('DEL', P + 'sub:' + id); return send(res, 200, { ok: true }); }
  send(res, 405, { error: 'Method not allowed' });
});
