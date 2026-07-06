# 🔥 Streakly

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**The desktop habit tracker you buy once and own forever.** Streaks, GitHub-style heatmaps, smart schedules, reminders and stats — 100% local, zero subscription, zero cloud, zero telemetry.

Habitify charges **$5/month, forever**, to store your checkmarks on their servers. Streakly is **$15 once**. Your habits are not a subscription.

![Streakly screenshot](docs/screenshot.png)

## ☕ Skip the setup — get the 1-click installer

Don't want to touch a terminal? Grab the packaged Windows installer (and support development):

**→ [Get Streakly on Whop](https://whop.com/onetime-suite)** — pay once, own it forever.

## Features

- ✅ **Habits your way** — icon, color, and a schedule that matches real life: every day, specific weekdays, or *N times per week*
- 🔢 **Numeric goals** — "8 glasses of water", "50 pushups": increment through the day, partial counts tracked, only hitting the goal completes the day
- 🔥 **A streak engine that's actually fair**
  - Weekday-only habits **survive the weekend** — off-days never break a streak
  - N-per-week habits count **weekly quotas** across week boundaries
  - **Skip days (vacation mode)** freeze your streaks instead of killing them
  - Today doesn't break your streak just because it isn't done *yet*
- 🗓️ **GitHub-style year heatmap** per habit + an all-habits month view with per-day dots
- ⏰ **Reminders** — native OS notifications at the times you choose
- 📝 **Notes per day** — journal a sentence next to any check-in
- 📊 **Stats** — current & best streak, total completions, completion % over 30/90/365 days
- ↕️ **Drag to reorder** your today list
- 💾 **Your data is a JSON file** in your user folder — JSON export/import for backup & sync, CSV export for spreadsheets
- 🌑 Premium dark UI, keyboard-friendly, fast

## Quick start

```bash
git clone https://github.com/bensblueprints/streakly
cd streakly
npm i
npm start
```

Run the tests (streak engine + store round-trip + export/import fidelity):

```bash
npm test
```

Build the Windows installer:

```bash
npm run dist
```

## Streakly vs Habitify

| | **Streakly** | Habitify |
|---|---|---|
| Price | **$15 once** | $5/mo ($60/yr, forever) |
| Cost after 3 years | **$15** | $180 |
| Your data lives | **On your machine** | Their cloud |
| Works offline | **Always** | Partially |
| Account required | **No** | Yes |
| Telemetry | **None** | Analytics SDKs |
| Streak freeze / vacation mode | **Yes** | Premium feature |
| Weekday schedules that don't break streaks on weekends | **Yes** | Yes |
| N-times-per-week quotas | **Yes** | Yes |
| Export your data | **JSON + CSV, one click** | Limited |
| Source code | **MIT, right here** | Closed |

## Tech stack

- **Electron** — main + preload (context-isolated, sandboxed) + plain HTML/CSS/JS renderer. No framework, no build step.
- **Pure streak engine** (`src/streaks.js`) — zero dependencies, runs identically in the renderer and under Node for tests.
- **JSON store** (`src/store.js`) — atomic writes, corrupt-file recovery, schema normalization. Data lives in Electron `userData` as `streakly-data.json`.
- **electron-builder** — Windows NSIS one-click installer.

## Data & privacy

Everything stays on your machine. Streakly makes **no network calls at all**. Your entire history is one human-readable JSON file — export it, version it, `rsync` it, own it.

## License

[MIT](LICENSE) © 2026 Ben (bensblueprints)
