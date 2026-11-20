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
Character art goes in `assets/` as 1024×1024 transparent PNGs:

- `assets/characters/player01_neutral.png`, `player01_happy.png`, `player01_fierce.png` … through `player12_*`
- `assets/coaches/coach_kaida_smile.png`, `_happy`, `_fierce`, `_surprised` (same for `rei` and `bolt`)

## Run
Open `index.html`, or host it on GitHub Pages or Vercel.
