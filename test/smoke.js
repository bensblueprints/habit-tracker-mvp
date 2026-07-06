'use strict';

/**
 * Streakly smoke test — pure Node, no Electron.
 *   1. Streak engine unit tests (the core product logic).
 *   2. Store round-trip (save → load fidelity, atomic write).
 *   3. Export / import fidelity (JSON) + CSV shape.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const E = require('../src/streaks');
const store = require('../src/store');

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  console.log('  ✔ ' + msg);
}
function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, `${msg} (expected ${expected}, got ${actual})`);
  passed++;
  console.log('  ✔ ' + msg);
}

// Fixed "today" for determinism: Wednesday 2026-06-17.
const TODAY = '2026-06-17';
eq(E.dayOfWeek(TODAY), 3, 'sanity: 2026-06-17 is a Wednesday');

function habit(over = {}) {
  return {
    id: 'h1', name: 'Test', icon: '⭐', color: '#22c55e',
    schedule: { type: 'daily' }, goal: null, reminders: [],
    createdAt: '2026-01-01', archived: false, order: 0,
    ...over,
  };
}
function entriesFor(id, days) { // days: { ds: count }
  const m = {};
  for (const [ds, count] of Object.entries(days)) m[ds] = { count };
  return { [id]: m };
}

console.log('\n— Streak engine: daily habits —');
{
  // 5-day run up to today
  const h = habit();
  const ent = entriesFor('h1', {
    '2026-06-13': 1, '2026-06-14': 1, '2026-06-15': 1, '2026-06-16': 1, '2026-06-17': 1,
  });
  eq(E.currentStreak(h, ent, [], TODAY), 5, 'daily: 5 consecutive days = streak 5');

  // gap breaks the streak
  const gap = entriesFor('h1', {
    '2026-06-12': 1, '2026-06-13': 1, /* 14th missed */ '2026-06-15': 1, '2026-06-16': 1, '2026-06-17': 1,
  });
  eq(E.currentStreak(h, gap, [], TODAY), 3, 'daily: a gap breaks the streak (only 3 since gap)');
  eq(E.bestStreak(h, gap, [], TODAY), 3, 'daily: best streak across history = 3');

  // today not done yet does NOT break the streak
  const pending = entriesFor('h1', { '2026-06-15': 1, '2026-06-16': 1 });
  eq(E.currentStreak(h, pending, [], TODAY), 2, 'daily: unfinished today keeps yesterday\'s streak alive');

  // but yesterday missed does break it
  const broke = entriesFor('h1', { '2026-06-14': 1, '2026-06-15': 1 });
  eq(E.currentStreak(h, broke, [], TODAY), 0, 'daily: missed yesterday = streak 0');
}

console.log('\n— Streak engine: weekday-only habits over a weekend —');
{
  // Mon-Fri habit. Completed Thu 11th, Fri 12th, Mon 15th, Tue 16th, Wed 17th.
  // Weekend 13th/14th untouched — streak must survive.
  const h = habit({ schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] } });
  const ent = entriesFor('h1', {
    '2026-06-11': 1, '2026-06-12': 1, '2026-06-15': 1, '2026-06-16': 1, '2026-06-17': 1,
  });
  eq(E.currentStreak(h, ent, [], TODAY), 5, 'weekday habit: streak survives the weekend (5)');

  // missing Monday DOES break it
  const missMon = entriesFor('h1', {
    '2026-06-11': 1, '2026-06-12': 1, '2026-06-16': 1, '2026-06-17': 1,
  });
  eq(E.currentStreak(h, missMon, [], TODAY), 2, 'weekday habit: missing a scheduled Monday breaks it');
  ok(!E.isScheduledOn(h, '2026-06-13'), 'weekday habit: Saturday is not a scheduled day');
}

console.log('\n— Streak engine: N-times-per-week habits —');
{
  // 3×/week. Week of Jun 8-14: hit Mon/Wed/Fri (quota met).
  // Current week (Jun 15-21): hit Mon/Tue — only 2 so far, but week isn't over.
  const h = habit({ schedule: { type: 'timesPerWeek', times: 3 } });
  const ent = entriesFor('h1', {
    '2026-06-08': 1, '2026-06-10': 1, '2026-06-12': 1,      // last week: 3/3
    '2026-06-15': 1, '2026-06-16': 1,                        // this week: 2 so far
  });
  eq(E.streakUnit(h), 'weeks', '3x/week habit streaks are measured in weeks');
  eq(E.currentStreak(h, ent, [], TODAY), 1, '3x/week: last week met quota, this week pending → streak 1');

  // Complete a 3rd day this week → streak becomes 2
  const ent2 = entriesFor('h1', {
    '2026-06-08': 1, '2026-06-10': 1, '2026-06-12': 1,
    '2026-06-15': 1, '2026-06-16': 1, '2026-06-17': 1,
  });
  eq(E.currentStreak(h, ent2, [], TODAY), 2, '3x/week: quota met this week too → streak 2');

  // Missed quota LAST week (only 2/3) → chain broken even if this week is going well
  const missed = entriesFor('h1', {
    '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1,       // week before: 3/3
    '2026-06-08': 1, '2026-06-10': 1,                        // last week: 2/3 MISS
    '2026-06-15': 1, '2026-06-16': 1, '2026-06-17': 1,       // this week: 3/3
  });
  eq(E.currentStreak(h, missed, [], TODAY), 1, '3x/week: a missed week breaks the chain (only this week counts)');
  eq(E.bestStreak(h, missed, [], TODAY), 1, '3x/week: best streak is 1 week');
}

console.log('\n— Streak engine: skip days (vacation freeze) —');
{
  // Daily habit: done 13th & 14th, on vacation 15th & 16th, done 17th.
  const h = habit();
  const ent = entriesFor('h1', { '2026-06-13': 1, '2026-06-14': 1, '2026-06-17': 1 });
  const skips = ['2026-06-15', '2026-06-16'];
  eq(E.currentStreak(h, ent, skips, TODAY), 3, 'daily: skip days freeze the streak (3, not broken)');
  eq(E.currentStreak(h, ent, [], TODAY), 1, 'daily: same data WITHOUT skip days = broken (1)');

  // Weekly habit: 3×/week, week fully on vacation → quota drops, week auto-passes
  const hw = habit({ schedule: { type: 'timesPerWeek', times: 3 } });
  const entW = entriesFor('h1', {
    '2026-06-01': 1, '2026-06-03': 1, '2026-06-05': 1,       // week 1: 3/3
    // week of Jun 8-14: nothing done, but 6 skip days → quota 0 → passes
    '2026-06-15': 1, '2026-06-16': 1, '2026-06-17': 1,       // this week: 3/3
  });
  const wSkips = ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13'];
  eq(E.currentStreak(hw, entW, wSkips, TODAY), 3, '3x/week: vacation week shrinks quota → streak survives (3 weeks)');
}

console.log('\n— Streak engine: numeric goals (partial vs complete) —');
{
  const h = habit({ goal: { target: 8, unit: 'glasses' } });
  const ent = entriesFor('h1', { '2026-06-16': 8, '2026-06-17': 5 });
  ok(E.isCompleteOn(h, ent, '2026-06-16'), 'goal 8: count 8 = complete');
  ok(!E.isCompleteOn(h, ent, '2026-06-17'), 'goal 8: count 5 = partial, NOT complete');
  eq(E.currentStreak(h, ent, [], TODAY), 1, 'goal habit: partial today doesn\'t extend streak (1 from yesterday)');
  eq(E.totalCompletions(h, ent), 1, 'goal habit: only full-goal days count as completions');
}

console.log('\n— Streak engine: completion rate —');
{
  const h = habit({ createdAt: '2026-06-08' }); // 10 days of existence in window
  const ent = entriesFor('h1', {
    '2026-06-08': 1, '2026-06-09': 1, '2026-06-10': 1, '2026-06-11': 1, '2026-06-12': 1,
  });
  eq(E.completionRate(h, ent, [], 30, TODAY), 50, 'completion rate clips to createdAt (5/10 days = 50%)');
}

console.log('\n— Store: round-trip —');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'streakly-test-'));
  const data = store.defaultData();
  data.habits.push({
    id: 'abc', name: 'Water', icon: '💧', color: '#38bdf8',
    schedule: { type: 'timesPerWeek', times: 3 },
    goal: { target: 8, unit: 'glasses' },
    reminders: ['08:00', '14:30'],
    createdAt: '2026-06-01', archived: false, order: 0,
  });
  data.entries.abc = { '2026-06-16': { count: 8, note: 'felt great, "hydrated"' } };
  data.skipDays = ['2026-06-10'];

  const file = store.save(dir, data);
  ok(fs.existsSync(file), 'store: save writes the data file');
  const loaded = store.load(dir);
  assert.deepStrictEqual(loaded.habits, data.habits);
  passed++; console.log('  ✔ store: habits survive round-trip byte-for-byte');
  assert.deepStrictEqual(loaded.entries, data.entries);
  passed++; console.log('  ✔ store: entries (incl. note) survive round-trip');
  assert.deepStrictEqual(loaded.skipDays, data.skipDays);
  passed++; console.log('  ✔ store: skip days survive round-trip');

  // corrupt file → safe default + .corrupt backup
  fs.writeFileSync(store.dataFile(dir), '{not json', 'utf8');
  const recovered = store.load(dir);
  eq(recovered.habits.length, 0, 'store: corrupt file recovers to safe defaults');
  ok(fs.readdirSync(dir).some(f => f.includes('.corrupt-')), 'store: corrupt file preserved as backup');

  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('\n— Export / import fidelity —');
{
  const data = store.defaultData();
  data.habits.push({
    id: 'x1', name: 'Read, "daily"', icon: '📖', color: '#a78bfa',
    schedule: { type: 'weekdays', days: [1, 3, 5] }, goal: null,
    reminders: ['21:00'], createdAt: '2026-05-01', archived: false, order: 0,
  });
  data.entries.x1 = {
    '2026-06-15': { count: 1 },
    '2026-06-16': { count: 1, note: 'chapter 4,\nwith a "quote"' },
  };
  data.skipDays = ['2026-06-01'];

  const json = store.exportJSON(data);
  const back = store.importJSON(json);
  assert.deepStrictEqual(back.habits, data.habits);
  passed++; console.log('  ✔ export→import: habits identical');
  assert.deepStrictEqual(back.entries, data.entries);
  passed++; console.log('  ✔ export→import: entries + notes identical');
  assert.deepStrictEqual(back.skipDays, data.skipDays);
  passed++; console.log('  ✔ export→import: skip days identical');

  let threw = false;
  try { store.importJSON('{"app":"something-else"}'); } catch (_) { threw = true; }
  ok(threw, 'import: rejects non-Streakly JSON');

  const csv = store.exportCSV(data);
  const lines = csv.trim().split('\r\n');
  eq(lines[0], 'date,habit,icon,count,target,completed,note', 'csv: header row correct');
  eq(lines.length, 3, 'csv: one row per habit-day entry');
  ok(lines[2].includes('"chapter 4,\nwith a ""quote"""') || csv.includes('""quote""'),
     'csv: commas/quotes/newlines properly escaped');
  ok(lines[1].includes(',yes,'), 'csv: completed flag computed against target');
}

console.log(`\nAll good — ${passed} assertions passed.\n`);
