// Sends due notifications. Called every ~10 minutes by the GitHub Actions workflow, plus a daily Vercel cron.
import webpush from 'web-push';
import { redis, P, send, vapid, wrap, subject } from './_lib.js';

const WINDOW = 45 * 60e3; // notifications more than 45 min late are dropped

export default wrap(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.authorization || '').replace('Bearer ', '') || (req.query || {}).key;
  if (secret && given !== secret) return send(res, 401, { error: 'Unauthorized' });
  const keys = await vapid();
  webpush.setVapidDetails(subject(req), keys.publicKey, keys.privateKey);
  const now = Date.now();
  await redis('SET', P + 'lastTick', String(now));
  let cursor = '0', sent = 0, checked = 0;
  do {
    const [next, found] = await redis('SCAN', cursor, 'MATCH', P + 'sub:*', 'COUNT', 200);
    cursor = next;
    for (const key of found) {
      const id = key.slice((P + 'sub:').length);
      checked++;
      const [subRaw, schedRaw] = await Promise.all([redis('GET', key), redis('GET', P + 'sched:' + id)]);
      if (!subRaw || !schedRaw) continue;
      const due = JSON.parse(schedRaw).filter(n => n.at <= now && n.at > now - WINDOW);
      for (const n of due) {
        const sentKey = `${P}sent:${id}:${n.tag}`;
        const fresh = await redis('SET', sentKey, '1', 'NX', 'EX', 172800);
        if (fresh !== 'OK') continue;
        try {
          await webpush.sendNotification(JSON.parse(subRaw), JSON.stringify({ title: n.title, body: n.body, tag: n.tag, url: './' }), { TTL: 1800, urgency: 'high' });
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) { await redis('DEL', key); break; }
          await redis('DEL', sentKey); // temporary failure: try again next run
        }
      }
    }
  } while (cursor !== '0');
  send(res, 200, { ok: true, checked, sent });
});
