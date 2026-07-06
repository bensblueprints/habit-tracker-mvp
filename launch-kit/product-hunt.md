# Product Hunt Launch — Streakly

## Name
Streakly

## Tagline (60 chars)
The habit tracker you buy once and own forever. No cloud.

## Description (260 chars)
Streakly is a local-first desktop habit tracker: streaks that respect your schedule, GitHub-style heatmaps, numeric goals, reminders, vacation freeze, notes, and full JSON/CSV export. $15 once instead of $5/month forever. Your habits are not a subscription.

## Full description

Streakly is a desktop habit tracker for people who are tired of renting their own checkmarks.

**Why another habit tracker?** Because the popular ones (Habitify, Streaks, HabitBull…) are subscriptions with your data in someone else's cloud. Streakly is $15 once, MIT-licensed, and everything lives in a single human-readable JSON file on your machine.

**The streak engine is the star:**
- Weekday-only habits survive the weekend — off-days never break a streak
- "3× per week" habits count weekly quotas, not arbitrary daily chains
- Vacation mode freezes streaks instead of murdering them
- Numeric goals ("8 glasses of water") track partial progress; only hitting the goal completes the day
- Today doesn't break your streak just because it isn't done yet

Plus: GitHub-style year heatmaps per habit, an all-habits month view, native OS reminders, notes per day, drag-to-reorder, completion stats over 30/90/365 days, and one-click JSON/CSV export.

No account. No telemetry. No network calls. Pay once. Own it forever.

## Maker first comment

Hey PH 👋

I built Streakly because I did the math on my habit tracker subscription: $5/month, every month, to store *checkmarks*. Three years in, that's $180 for data I don't even control — and if I stop paying, my 2-year streak history is hostage.

So I built the tracker I wanted: fully local, one JSON file I can back up myself, and a streak engine that's actually fair. The thing that drove me craziest about other apps was streak logic — miss a Saturday on a Mon–Fri habit and your streak dies, or go on vacation and come back to zeros. Streakly's engine respects your schedule: off-days pass through, N-per-week habits count weekly quotas, and skip days freeze everything.

The whole engine is a pure, dependency-free module with a hard unit-test suite (weekend survival, week-boundary quotas, vacation freeze, partial numeric goals) — the source is MIT on GitHub if you want to check my streak math.

$15 once. That's it. Would love feedback — especially on streak edge cases I haven't thought of.

## Gallery shots (5)

1. **Hero — Today view**: dark UI, five colorful habits with flame streak chips, one numeric habit mid-count (5/8 glasses), drag handle visible. Caption: "Check off your day in seconds."
2. **Year heatmap**: a habit's GitHub-style 12-month grid glowing green, streak/best numbers above. Caption: "365 days of proof."
3. **Month view**: calendar with per-habit colored dots, a dashed skip-day cell. Caption: "Every habit, one month, one glance."
4. **Stats grid**: cards with current/best streak, totals, 30/90/365 completion bars. Caption: "Numbers that keep you honest."
5. **Price comparison card**: "Habitify: $180 over 3 years vs Streakly: $15 once" with the export dialog open showing the JSON file. Caption: "Your habits are not a subscription."
