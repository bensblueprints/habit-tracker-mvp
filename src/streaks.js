/**
 * Streakly — pure streak engine.
 * No Electron, no I/O. Everything takes plain data in and returns plain data out,
 * so it can be unit-tested hard from Node.
 *
 * Data shapes:
 *   habit = {
 *     id, name, icon, color,
 *     schedule: { type: 'daily' }
 *             | { type: 'weekdays', days: [0..6] }        // 0 = Sunday
 *             | { type: 'timesPerWeek', times: n },
 *     goal: null | { target: n, unit: 'glasses' },
 *     createdAt: 'YYYY-MM-DD'
 *   }
 *   entries = { [habitId]: { [dateStr]: { count, note? } } }
 *   skipDays = ['YYYY-MM-DD', ...]   // vacation days — streaks freeze, quotas shrink
 */

'use strict';

// ---------- date helpers (local-time, string based) ----------

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function toDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function fromDateStr(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(ds, n) {
  const d = fromDateStr(ds);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function dayOfWeek(ds) { // 0 = Sunday .. 6 = Saturday
  return fromDateStr(ds).getDay();
}

/** Monday-based week start for a date string. */
function weekStart(ds) {
  const dow = dayOfWeek(ds); // 0=Sun
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(ds, -back);
}

function daysBetween(a, b) { // b - a in days
  return Math.round((fromDateStr(b) - fromDateStr(a)) / 86400000);
}

// ---------- core predicates ----------

function target(habit) {
  return (habit.goal && habit.goal.target > 0) ? habit.goal.target : 1;
}

function getCount(entries, habitId, ds) {
  const e = entries[habitId] && entries[habitId][ds];
  return e ? (e.count || 0) : 0;
}

/** Did the habit hit its goal on this day? Partial counts don't count. */
function isCompleteOn(habit, entries, ds) {
  return getCount(entries, habit.id, ds) >= target(habit);
}

/** Is this date one the habit is expected on? (timesPerWeek: any day is fair game) */
function isScheduledOn(habit, ds) {
  const s = habit.schedule || { type: 'daily' };
  if (s.type === 'daily') return true;
  if (s.type === 'weekdays') return (s.days || []).includes(dayOfWeek(ds));
  if (s.type === 'timesPerWeek') return true;
  return true;
}

function isSkip(skipDays, ds) {
  return skipDays.indexOf(ds) !== -1;
}

/** Unit the streak is measured in. */
function streakUnit(habit) {
  return (habit.schedule && habit.schedule.type === 'timesPerWeek') ? 'weeks' : 'days';
}

// ---------- weekly quota habits ----------

/**
 * For an N-times-per-week habit: completions and effective quota for the week
 * containing `ds`. Skip days shrink the quota (a week on vacation asks less of you).
 */
function weekStats(habit, entries, skipDays, ds) {
  const start = weekStart(ds);
  let completions = 0, skips = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    if (isSkip(skipDays, day)) skips++;
    else if (isCompleteOn(habit, entries, day)) completions++;
  }
  const quota = Math.max(0, (habit.schedule.times || 1) - skips);
  return { start, completions, quota };
}

function weeklyCurrentStreak(habit, entries, skipDays, today) {
  let streak = 0;
  let ws = weekStart(today);
  const thisWeek = ws;
  const floor = weekStart(habit.createdAt || addDays(today, -3660));
  for (let guard = 0; guard < 550; guard++) {
    const { completions, quota } = weekStats(habit, entries, skipDays, ws);
    if (completions >= quota) {
      streak++;
    } else if (ws === thisWeek) {
      // Current week still in progress — pending, not broken. Look further back.
    } else {
      break;
    }
    if (ws <= floor) break;
    ws = addDays(ws, -7);
  }
  return streak;
}

function weeklyBestStreak(habit, entries, skipDays, today) {
  let best = 0, run = 0;
  let ws = weekStart(habit.createdAt || today);
  const thisWeek = weekStart(today);
  for (let guard = 0; guard < 550 && ws <= thisWeek; guard++) {
    const { completions, quota } = weekStats(habit, entries, skipDays, ws);
    if (completions >= quota) {
      run++;
      if (run > best) best = run;
    } else if (ws === thisWeek) {
      // pending week — doesn't break the run, doesn't extend it
    } else {
      run = 0;
    }
    ws = addDays(ws, 7);
  }
  return Math.max(best, weeklyCurrentStreak(habit, entries, skipDays, today));
}

// ---------- daily / weekday habits ----------

function dailyCurrentStreak(habit, entries, skipDays, today) {
  let streak = 0;
  let ds = today;
  const floor = habit.createdAt || addDays(today, -3660);

  // Today doesn't break the streak just because it isn't done *yet*.
  if (isScheduledOn(habit, ds) && !isSkip(skipDays, ds) && !isCompleteOn(habit, entries, ds)) {
    ds = addDays(ds, -1);
  }

  for (let guard = 0; guard < 3700; guard++) {
    if (ds < floor) break;
    if (isSkip(skipDays, ds) || !isScheduledOn(habit, ds)) {
      ds = addDays(ds, -1); // frozen / off-day: pass through
      continue;
    }
    if (isCompleteOn(habit, entries, ds)) {
      streak++;
      ds = addDays(ds, -1);
    } else break;
  }
  return streak;
}

function dailyBestStreak(habit, entries, skipDays, today) {
  let best = 0, run = 0;
  let ds = habit.createdAt || today;
  for (let guard = 0; guard < 3700 && ds <= today; guard++) {
    if (isSkip(skipDays, ds) || !isScheduledOn(habit, ds)) {
      // frozen / off-day: run survives untouched
    } else if (isCompleteOn(habit, entries, ds)) {
      run++;
      if (run > best) best = run;
    } else if (ds === today) {
      // today pending — don't break
    } else {
      run = 0;
    }
    ds = addDays(ds, 1);
  }
  return Math.max(best, dailyCurrentStreak(habit, entries, skipDays, today));
}

// ---------- public API ----------

function currentStreak(habit, entries, skipDays, today) {
  skipDays = skipDays || [];
  return streakUnit(habit) === 'weeks'
    ? weeklyCurrentStreak(habit, entries, skipDays, today)
    : dailyCurrentStreak(habit, entries, skipDays, today);
}

function bestStreak(habit, entries, skipDays, today) {
  skipDays = skipDays || [];
  return streakUnit(habit) === 'weeks'
    ? weeklyBestStreak(habit, entries, skipDays, today)
    : dailyBestStreak(habit, entries, skipDays, today);
}

/**
 * Completion % over the trailing `days` window (including today).
 * Daily/weekday: completed scheduled days ÷ scheduled days (skips excluded).
 * timesPerWeek: total completions ÷ summed weekly quotas overlapping the window.
 */
function completionRate(habit, entries, skipDays, days, today) {
  skipDays = skipDays || [];
  const from = addDays(today, -(days - 1));
  const start = habit.createdAt && habit.createdAt > from ? habit.createdAt : from;

  if (streakUnit(habit) === 'weeks') {
    let done = 0, quota = 0;
    let ws = weekStart(start);
    const lastWs = weekStart(today);
    for (let guard = 0; guard < 550 && ws <= lastWs; guard++) {
      const st = weekStats(habit, entries, skipDays, ws);
      quota += st.quota;
      done += Math.min(st.completions, st.quota);
      ws = addDays(ws, 7);
    }
    return quota === 0 ? 100 : Math.round((done / quota) * 100);
  }

  let scheduled = 0, done = 0;
  let ds = start;
  for (let guard = 0; guard < 3700 && ds <= today; guard++) {
    if (!isSkip(skipDays, ds) && isScheduledOn(habit, ds)) {
      scheduled++;
      if (isCompleteOn(habit, entries, ds)) done++;
    }
    ds = addDays(ds, 1);
  }
  return scheduled === 0 ? 100 : Math.round((done / scheduled) * 100);
}

/** Total number of days the habit hit its goal, ever. */
function totalCompletions(habit, entries) {
  const map = entries[habit.id] || {};
  let n = 0;
  for (const ds of Object.keys(map)) {
    if ((map[ds].count || 0) >= target(habit)) n++;
  }
  return n;
}

const StreaklyEngine = {
  // date utils (reused by renderer + store)
  toDateStr, fromDateStr, addDays, dayOfWeek, weekStart, daysBetween,
  // predicates
  target, getCount, isCompleteOn, isScheduledOn, isSkip, streakUnit, weekStats,
  // engine
  currentStreak, bestStreak, completionRate, totalCompletions,
};

/* Works as a CommonJS module (main process, tests) and as a plain
   <script> in the sandboxed renderer (attaches to window). */
if (typeof module !== 'undefined' && module.exports) module.exports = StreaklyEngine;
if (typeof window !== 'undefined') window.StreaklyEngine = StreaklyEngine;
