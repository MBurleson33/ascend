# Ascend

A gamified fitness app in the style of an anime "System." Clear Daily Quests, earn XP, level up, raise your stats and rank up from E to S, with a coach character cheering you on.

Single-file PWA: vanilla HTML/JS, saved in localStorage. No build step.

## Features
- Daily Quests (push-ups, squats, cardio) that scale with your rank, with streaks and Penalty Quests
- XP and levels (`100 × level^1.5`), ranks E → S, STR/AGI/VIT/SEN stats, unlockable titles
- Train tab: rotating bodyweight workouts, an 8-week run plan with an interval timer, and walk logging
- Character creator and three coaches (Kaida, Rei, Bolt) with visual-novel dialogue
- Save code export/import for backups

## Assets
Character art goes in `assets/` as transparent images. Source PNGs from ChatGPT are converted to 640×640 WebP:

- `assets/characters/player01_neutral.webp`, `player01_happy.webp`, `player01_fierce.webp` … through `player12_*`. Add each new Hunter to the `PLAYERS` list in `index.html`.
- `assets/coaches/coach_kaida_smile.webp`, `_happy`, `_fierce`, `_surprised` (same for `rei` and `bolt`)

## Run
Open `index.html`, or host it on GitHub Pages or Vercel. It's an installable PWA: manifest, icons and an offline service worker.

After changing `index.html` or any asset, regenerate the service worker so phones pick up the update:

```
python3 tools/build_sw.py
```

Installed copies show an "Update ready" prompt the next time they open.

## Cloud features (Vercel)

Cloud save, push notifications and party mode run as serverless functions in `api/`, backed by Upstash Redis. GitHub Pages can't run them, so deploy the repo on Vercel and use the Vercel URL.

1. **Import the repo on Vercel** (Add New → Project → `MBurleson33/ascend`). No build settings needed.
2. **Connect the database:** Storage → connect your existing Upstash Redis database to this project. Vercel adds the connection env vars automatically (`KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`; both work). All keys are prefixed `ascend:`, so it can share a database with other projects.
3. **Add env vars** (Settings → Environment Variables):
   - `CRON_SECRET`: any long random string
   - `VAPID_SUBJECT`: `mailto:you@example.com` (optional)
   - VAPID keys are generated automatically on first use and stored in the database. To manage them yourself, set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
4. **Redeploy**, then open the Vercel URL and add it to your Home Screen.
5. **Turn on frequent notification checks:** Vercel's free cron only runs once a day, so `.github/workflows/notify.yml` pings `/api/tick` every 10 minutes. In GitHub → Settings → Secrets and variables → Actions, add:
   - Variable `ASCEND_URL` = your Vercel URL (no trailing slash)
   - Secret `CRON_SECRET` = same value as in Vercel

### Endpoints
- `GET/POST /api/save`: cloud save, authenticated by an 8-character ID and a random token (stored hashed)
- `GET/POST/DELETE /api/push`: VAPID public key and push subscriptions
- `GET /api/tick`: sends due notifications (protected by `CRON_SECRET`)
- `GET/POST /api/party`: create, join, leave, and view a party (up to 8 players)
