// Parties. POST {id, token, action:create|join|leave, code?, name?}; GET ?code&id&token returns member summaries.
import crypto from 'node:crypto';
import { redis, P, auth, send, body, wrap } from './_lib.js';

const MAX = 8;
const newCode = () => Array.from(crypto.randomBytes(6), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
const okCode = c => typeof c === 'string' && /^[A-Z2-9]{6}$/.test(c);

function summary(mid, raw) {
  if (!raw) return null;
  const s = JSON.parse(raw).state || {};
  const g = s.gate || {};
  return {
    id: mid, name: String(s.name || 'Player').slice(0, 24), char: s.avatar && s.avatar.char, rank: s.rankIdx || 0, level: s.level || 1,
    streak: s.streak || 0, day: s.today && s.today.date, cleared: !!(s.today && s.today.complete),
    gateWeek: g.week, gateDmg: g.max ? g.max - g.hp : 0, title: s.title || ''
  };
}

export default wrap(async (req, res) => {
  const src = req.method === 'GET' ? (req.query || {}) : body(req);
  const { id, token } = src;
  if (!(await auth(id, token))) return send(res, 403, { error: 'Turn on cloud save first' });

  if (req.method === 'GET') {
    if (!okCode(src.code)) return send(res, 400, { error: 'Bad party code' });
    const raw = await redis('GET', P + 'party:' + src.code);
    if (!raw) return send(res, 404, { error: 'Party not found' });
    const party = JSON.parse(raw);
    if (!party.members.includes(id)) return send(res, 403, { error: 'Not in this party' });
    const saves = await Promise.all(party.members.map(m => redis('GET', P + 'save:' + m)));
    const members = party.members.map((m, i) => summary(m, saves[i])).filter(Boolean).map(m => ({ ...m, me: m.id === id, id: undefined }));
    return send(res, 200, { code: src.code, name: party.name, members });
  }

  if (req.method === 'POST') {
    const { action } = src;
    if (action === 'create') {
      let code;
      for (let i = 0; i < 5; i++) {
        code = newCode();
        const ok = await redis('SET', P + 'party:' + code, JSON.stringify({ name: String(src.name || 'My Party').slice(0, 30), owner: id, members: [id] }), 'NX');
        if (ok === 'OK') return send(res, 200, { code });
      }
      return send(res, 500, { error: 'Try again' });
    }
    if (!okCode(src.code)) return send(res, 400, { error: 'Bad party code' });
    const key = P + 'party:' + src.code, raw = await redis('GET', key);
    if (!raw) return send(res, 404, { error: 'No party with that code' });
    const party = JSON.parse(raw);
    if (action === 'join') {
      if (!party.members.includes(id)) {
        if (party.members.length >= MAX) return send(res, 409, { error: 'That party is full' });
        party.members.push(id);
        await redis('SET', key, JSON.stringify(party));
      }
      return send(res, 200, { code: src.code, name: party.name });
    }
    if (action === 'leave') {
      party.members = party.members.filter(m => m !== id);
      if (party.members.length) await redis('SET', key, JSON.stringify(party)); else await redis('DEL', key);
      return send(res, 200, { ok: true });
    }
    return send(res, 400, { error: 'Unknown action' });
  }
  send(res, 405, { error: 'Method not allowed' });
});
