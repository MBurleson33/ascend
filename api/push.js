// Push subscriptions. GET returns the VAPID public key; POST stores a subscription; DELETE removes it.
import { redis, P, auth, send, body, vapid, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method === 'GET') return send(res, 200, { publicKey: (await vapid()).publicKey });
  const { id, token, sub } = body(req);
  if (!(await auth(id, token))) return send(res, 403, { error: 'Turn on cloud save first' });
  if (req.method === 'POST') {
    if (!sub || typeof sub.endpoint !== 'string' || !sub.keys) return send(res, 400, { error: 'Bad subscription' });
    await redis('SET', P + 'sub:' + id, JSON.stringify(sub));
    return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') { await redis('DEL', P + 'sub:' + id); return send(res, 200, { ok: true }); }
  send(res, 405, { error: 'Method not allowed' });
});
