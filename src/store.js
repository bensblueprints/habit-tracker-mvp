/**
 * Streakly — local JSON store. Pure Node (no Electron imports) so it is
 * testable and reusable. The Electron main process passes in the userData path.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

function defaultData() {
  return {
    schema: SCHEMA_VERSION,
    app: 'streakly',
    habits: [],    // see src/streaks.js for the habit shape (+ order, reminders[], archived)
    entries: {},   // { habitId: { 'YYYY-MM-DD': { count, note? } } }
    skipDays: [],  // ['YYYY-MM-DD']
    settings: { weekStartsMonday: true, remindersEnabled: true },
  };
}

function dataFile(dir) {
  return path.join(dir, 'streakly-data.json');
}

function load(dir) {
  const file = dataFile(dir);
  if (!fs.existsSync(file)) return defaultData();
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return normalize(JSON.parse(raw));
  } catch (err) {
    // Corrupt file: keep it aside instead of silently destroying data.
    try { fs.copyFileSync(file, file + '.corrupt-' + Date.now()); } catch (_) {}
    return defaultData();
  }
}

function save(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  const file = dataFile(dir);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file); // atomic-ish swap
  return file;
}

/** Coerce arbitrary parsed JSON into a valid store shape. Throws if hopeless. */
function normalize(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Not a Streakly data object');
  const d = defaultData();
  if (Array.isArray(obj.habits)) {
    d.habits = obj.habits.filter(h => h && h.id && h.name).map((h, i) => ({
      id: String(h.id),
      name: String(h.name),
      icon: h.icon || '⭐',
      color: h.color || '#22c55e',
      schedule: normalizeSchedule(h.schedule),
      goal: (h.goal && h.goal.target > 0)
        ? { target: Math.floor(h.goal.target), unit: String(h.goal.unit || '') }
        : null,
      reminders: Array.isArray(h.reminders) ? h.reminders.filter(t => /^\d{2}:\d{2}$/.test(t)) : [],
      createdAt: /^\d{4}-\d{2}-\d{2}$/.test(h.createdAt || '') ? h.createdAt : todayStr(),
      archived: !!h.archived,
      order: Number.isFinite(h.order) ? h.order : i,
    }));
  }
  if (obj.entries && typeof obj.entries === 'object') {
    for (const [hid, days] of Object.entries(obj.entries)) {
      if (!days || typeof days !== 'object') continue;
      d.entries[hid] = {};
      for (const [ds, e] of Object.entries(days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ds) || !e) continue;
        const rec = { count: Math.max(0, Math.floor(e.count || 0)) };
        if (e.note) rec.note = String(e.note);
        if (rec.count > 0 || rec.note) d.entries[hid][ds] = rec;
      }
    }
  }
  if (Array.isArray(obj.skipDays)) {
    d.skipDays = [...new Set(obj.skipDays.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)))].sort();
  }
  if (obj.settings && typeof obj.settings === 'object') {
    d.settings = { ...d.settings, ...obj.settings };
  }
  return d;
}

function normalizeSchedule(s) {
  if (!s || typeof s !== 'object') return { type: 'daily' };
  if (s.type === 'weekdays') {
    const days = [...new Set((s.days || []).map(Number).filter(n => n >= 0 && n <= 6))].sort();
    return { type: 'weekdays', days: days.length ? days : [1, 2, 3, 4, 5] };
  }
  if (s.type === 'timesPerWeek') {
    return { type: 'timesPerWeek', times: Math.min(7, Math.max(1, Math.floor(s.times || 3))) };
  }
  return { type: 'daily' };
}

function todayStr() {
  const d = new Date();
  const p = n => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// ---------- export / import ----------

function exportJSON(data) {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

/** Parse an exported JSON string back into a valid store. Throws on bad input. */
function importJSON(str) {
  const parsed = JSON.parse(str);
  if (parsed.app !== 'streakly') throw new Error('Not a Streakly export file');
  return normalize(parsed);
}

function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Flat CSV: one row per habit-day entry. */
function exportCSV(data) {
  const rows = [['date', 'habit', 'icon', 'count', 'target', 'completed', 'note']];
  const byId = Object.fromEntries(data.habits.map(h => [h.id, h]));
  for (const [hid, days] of Object.entries(data.entries)) {
    const h = byId[hid];
    if (!h) continue;
    const tgt = (h.goal && h.goal.target) || 1;
    for (const ds of Object.keys(days).sort()) {
      const e = days[ds];
      rows.push([ds, h.name, h.icon, e.count || 0, tgt, (e.count || 0) >= tgt ? 'yes' : 'no', e.note || '']);
    }
  }
  return rows.map(r => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

module.exports = { defaultData, dataFile, load, save, normalize, exportJSON, importJSON, exportCSV, SCHEMA_VERSION };
