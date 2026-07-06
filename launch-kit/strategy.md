# Launch Strategy — Streakly

## Positioning
"Pay once. Own it forever. No subscription." Target the self-improvement / quantified-self crowd who already track everything and resent renting their own data. Named competitor: **Habitify ($5/mo)**; secondary: Streaks, HabitBull, Habitica premium.

## Target communities

| Community | Angle (rules-aware) |
|---|---|
| r/getdisciplined | Share a "what finally worked for me" post about schedule-fair streaks (weekly quotas beat daily guilt); mention the tool only in comments per self-promo rules. Weekly threads allow tool mentions. |
| r/QuantifiedSelf | Data-ownership angle: "my entire habit history is one JSON file + CSV export." This sub loves local-first + export; show a heatmap screenshot. |
| r/selfhosted | "Local-first" resonates even though it's a desktop app — no cloud, no account, MIT source. Post as Show-off Saturday if required. |
| r/productivity | Ask-first culture: comment helpfully on "habit app recommendations?" threads; only link when someone asks for no-subscription options. |
| r/opensource + r/SideProject | Straight "I built this" posts are welcome; lead with the MIT repo, not the paid installer. |
| Hacker News | Show HN (draft below) — HN hates subscriptions for simple tools and loves fair streak-logic discussions. |

## Show HN draft

**Title:** Show HN: Streakly – a local-first desktop habit tracker you buy once

**Body:**
I did the math on my habit tracker: $5/month to store checkmarks in someone else's cloud. So I built Streakly — an Electron desktop app where everything lives in one JSON file under your user folder. No account, no telemetry, no network calls.

The interesting part is the streak engine (pure, dependency-free module with a hard test suite): weekday-only habits survive weekends, "N times per week" habits count weekly quotas across week boundaries, vacation days freeze streaks instead of breaking them, and numeric goals (8 glasses of water) distinguish partial from complete. Getting "fair" streak semantics right was 80% of the design work — happy to discuss edge cases.

Source is MIT on GitHub. There's a $15 packaged installer for people who don't want to `npm i`, which is the business model: pay once, own it forever.

## SEO keywords (10)
1. habit tracker no subscription
2. habitify alternative
3. one time purchase habit tracker
4. habit tracker windows desktop
5. local habit tracker app
6. habit streak tracker offline
7. open source habit tracker
8. habit tracker with heatmap
9. streak freeze habit app
10. quantified self habit tracking

## AppSumo / PitchGround pitch

Streakly is the anti-subscription habit tracker: a polished, dark-mode desktop app with a genuinely fair streak engine (weekend-proof weekday habits, weekly quotas, vacation freeze), GitHub-style year heatmaps, numeric goals, native reminders and one-click JSON/CSV export — with every byte of data stored locally in a file the user owns. The habit-app category prints subscription revenue ($5–8/mo) on commodity features, which makes a lifetime deal irresistible to your audience: they instantly understand "Habitify costs $180 over 3 years; this is $15 once." MIT-licensed source doubles as trust and community moat. Zero infrastructure cost per user means deep discount headroom for a launch campaign.

## Pricing math

- **Price: $15 one-time** (launch: $9)
- Habitify Premium: $5/mo → Streakly **pays for itself in 3 months**
- 1-year Habitify: $60 (4× Streakly) · 3-year: $180 (12× Streakly)
- Anchor line for all copy: "Cheaper than 3 months of Habitify. Yours for life."
