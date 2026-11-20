// Cloud save. GET ?id&token returns the saved state; POST {id, token, state, schedule} stores it.
import { redis, P, hash, okId, okTok, auth, send, body, wrap } from './_lib.js';

export default wrap(async (req, res) => {
  if (req.method === 'GET') {
    const { id, token } = req.query || {};
    const ok = await auth(id, token);
    if (!ok) return send(res, ok === null ? 404 : 403, { error: ok === null ? 'No save found for that code' : 'Wrong sync code' });
    const raw = await redis('GET', P + 'save:' + id);
    return send(res, 200, raw ? JSON.parse(raw) : {});
  }
  if (req.method === 'POST') {
    const { id, token, state, schedule } = body(req);
    if (!okId(id) || !okTok(token) || !state || typeof state !== 'object') return send(res, 400, { error: 'Bad request' });
    const str = JSON.stringify(state);
    if (str.length > 400000) return send(res, 413, { error: 'Save too large' });
    const h = await redis('GET', P + 'auth:' + id);
    if (h && h !== hash(token)) return send(res, 403, { error: 'Wrong sync code' });
    if (!h) await redis('SET', P + 'auth:' + id, hash(token), 'NX');
    const updated = Number(state.updated) || Date.now();
    await redis('SET', P + 'save:' + id, JSON.stringify({ updated, state }));
    if (Array.isArray(schedule)) {
      const clean = schedule.slice(0, 20).filter(x => x && Number(x.at) && x.tag).map(x => ({
        at: Number(x.at), tag: String(x.tag).slice(0, 60), title: String(x.title || 'Ascend').slice(0, 60), body: String(x.body || '').slice(0, 200)
      }));
      await redis('SET', P + 'sched:' + id, JSON.stringify(clean), 'EX', 172800);
    }
    return send(res, 200, { ok: true, updated });
  }
  send(res, 405, { error: 'Method not allowed' });
});
