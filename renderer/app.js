'use strict';

/* Streakly renderer. Uses window.StreaklyEngine (pure engine) and
   window.streakly (IPC bridge from preload). */

const E = window.StreaklyEngine;
const api = window.streakly;

const ICONS = ['💧','🏃','📖','🧘','💪','🥗','😴','🦷','✍️','🎸',
               '🚭','💊','🌅','🧹','💻','🎯','🚴','🏊','☀️','🙏',
               '📵','💰','🗣️','🎨','🌱','🍎','🚶','🧠','❤️','⭐'];
const COLORS = ['#22c55e','#38bdf8','#a78bfa','#f472b6','#fbbf24','#fb923c','#ef4444','#2dd4bf','#84cc16','#e879f9'];
const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

let data = null;
let view = 'today';
let calHabitId = null;
let calMonth = null;           // 'YYYY-MM'
let editingId = null;          // habit being edited in modal
let openNoteId = null;         // habit whose note editor is open in Today

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const today = () => E.toDateStr(new Date());

// ---------- persistence ----------

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.saveData(data), 150);
  pushReminders();
}

function pushReminders() {
  api.updateReminders({
    enabled: data.settings.remindersEnabled !== false,
    habits: data.habits
      .filter(h => !h.archived && h.reminders.length)
      .map(h => ({ name: h.name, icon: h.icon, times: h.reminders })),
  });
}

// ---------- helpers ----------

function activeHabits() {
  return data.habits.filter(h => !h.archived).sort((a, b) => a.order - b.order);
}

function entryFor(hid, ds) {
  return (data.entries[hid] && data.entries[hid][ds]) || { count: 0 };
}

function setEntry(hid, ds, patch) {
  if (!data.entries[hid]) data.entries[hid] = {};
  const cur = data.entries[hid][ds] || { count: 0 };
  const next = { ...cur, ...patch };
  if ((next.count || 0) <= 0 && !next.note) delete data.entries[hid][ds];
  else data.entries[hid][ds] = next;
  persist();
}

function scheduleLabel(h) {
  const s = h.schedule;
  if (s.type === 'daily') return 'Every day';
  if (s.type === 'weekdays') return s.days.map(d => DOW_SHORT[d]).join(' · ');
  return `${s.times}× per week`;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), 2600);
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- render root ----------

function render() {
  const root = $('#view');
  root.innerHTML = '';
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  if (!activeHabits().length && view !== 'stats') {
    if (!data.habits.length) return renderEmpty(root);
  }
  if (view === 'today') renderToday(root);
  else if (view === 'calendar') renderCalendar(root);
  else renderStats(root);
}

function renderEmpty(root) {
  const e = el('div', 'empty');
  e.append(el('div', 'big', '🔥'));
  e.append(el('h2', null, 'Build your first streak'));
  e.append(el('p', null, 'Add a habit — Streakly tracks streaks, heatmaps and stats. All local, forever yours.'));
  const b = el('button', 'btn primary', '+ New Habit');
  b.style.marginTop = '18px';
  b.onclick = () => openModal(null);
  e.append(b);
  root.append(e);
}

// ---------- TODAY ----------

function renderToday(root) {
  const ds = today();
  const isSkipDay = E.isSkip(data.skipDays, ds);

  const head = el('div', 'today-head');
  head.append(el('h2', null, 'Today'));
  head.append(el('span', 'date', new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })));
  const skipBtn = el('button', 'skip-toggle' + (isSkipDay ? ' on' : ''),
    isSkipDay ? '🏖️ Skip day — streaks frozen' : '🏖️ Mark today as skip day');
  skipBtn.onclick = () => {
    if (isSkipDay) data.skipDays = data.skipDays.filter(d => d !== ds);
    else data.skipDays.push(ds);
    persist(); render();
  };
  head.append(skipBtn);
  root.append(head);

  if (isSkipDay) {
    root.append(el('div', 'skip-banner',
      'Today is a skip day. Nothing is required — your streaks are frozen, not broken. Enjoy the break.'));
  }

  const habits = activeHabits();
  const dueToday = habits.filter(h => E.isScheduledOn(h, ds));
  const offToday = habits.filter(h => !E.isScheduledOn(h, ds));

  const list = el('div', 'habit-list');
  list.id = 'today-list';
  dueToday.forEach(h => list.append(habitCard(h, ds, true)));
  root.append(list);

  if (offToday.length) {
    root.append(el('div', 'section-label', 'Not scheduled today'));
    const off = el('div', 'habit-list');
    offToday.forEach(h => off.append(habitCard(h, ds, false)));
    root.append(off);
  }
}

function habitCard(h, ds, draggable) {
  const entry = entryFor(h.id, ds);
  const tgt = E.target(h);
  const done = entry.count >= tgt;
  const streak = E.currentStreak(h, data.entries, data.skipDays, ds);
  const unit = E.streakUnit(h) === 'weeks' ? 'wk' : 'd';

  const wrap = el('div');
  const card = el('div', 'habit-card' + (done ? ' done-card' : ''));
  card.dataset.id = h.id;

  const icon = el('div', 'habit-icon', h.icon);
  icon.style.background = hexAlpha(h.color, 0.18);
  card.append(icon);

  const main = el('div', 'habit-main');
  main.append(el('div', 'habit-name', h.name));
  const meta = el('div', 'habit-meta');
  meta.append(el('span', null, scheduleLabel(h)));
  meta.append(el('span', 'streak-chip', `🔥 ${streak}${unit}`));
  if (h.schedule.type === 'timesPerWeek') {
    const ws = E.weekStats(h, data.entries, data.skipDays, ds);
    meta.append(el('span', null, `this week: ${ws.completions}/${ws.quota}`));
  }
  main.append(meta);
  card.append(main);

  const actions = el('div', 'habit-actions');

  // note button
  const noteBtn = el('button', 'icon-btn' + (entry.note ? ' has-note' : ''), '📝');
  noteBtn.title = 'Note for today';
  noteBtn.onclick = () => { openNoteId = openNoteId === h.id ? null : h.id; render(); };
  actions.append(noteBtn);

  // edit button
  const editBtn = el('button', 'icon-btn', '⚙️');
  editBtn.title = 'Edit habit';
  editBtn.onclick = () => openModal(h.id);
  actions.append(editBtn);

  if (h.goal) {
    const c = el('div', 'counter');
    const minus = el('button', null, '−');
    minus.onclick = () => { setEntry(h.id, ds, { count: Math.max(0, entry.count - 1) }); render(); };
    const count = el('span', 'count');
    count.innerHTML = `<b>${entry.count}</b> / ${tgt} ${h.goal.unit || ''}`;
    const plus = el('button', null, '+');
    plus.onclick = () => { setEntry(h.id, ds, { count: entry.count + 1 }); render(); };
    c.append(minus, count, plus);
    actions.append(c);
  }

  const check = el('button', 'check' + (done ? ' done' : ''), '✓');
  check.title = done ? 'Undo' : 'Complete';
  check.onclick = () => { setEntry(h.id, ds, { count: done ? 0 : tgt }); render(); };
  actions.append(check);

  card.append(actions);

  // drag reorder
  if (draggable) {
    card.draggable = true;
    card.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', h.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (ev) => { ev.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (ev) => {
      ev.preventDefault();
      card.classList.remove('drag-over');
      const srcId = ev.dataTransfer.getData('text/plain');
      if (srcId && srcId !== h.id) reorder(srcId, h.id);
    });
  }

  wrap.append(card);

  if (openNoteId === h.id) {
    const row = el('div', 'note-row');
    const ta = document.createElement('textarea');
    ta.placeholder = 'Note for today… (saved automatically)';
    ta.value = entry.note || '';
    ta.oninput = () => setEntry(h.id, ds, { note: ta.value.trim() || undefined });
    row.append(ta);
    wrap.append(row);
    setTimeout(() => ta.focus(), 0);
  }
  return wrap;
}

function reorder(srcId, destId) {
  const order = activeHabits().map(h => h.id);
  const from = order.indexOf(srcId), to = order.indexOf(destId);
  if (from < 0 || to < 0) return;
  order.splice(to, 0, order.splice(from, 1)[0]);
  order.forEach((id, i) => {
    const h = data.habits.find(x => x.id === id);
    if (h) h.order = i;
  });
  persist(); render();
}

// ---------- CALENDAR ----------

function renderCalendar(root) {
  const habits = activeHabits();
  if (!calHabitId || !habits.find(h => h.id === calHabitId)) calHabitId = habits[0] && habits[0].id;
  if (!calMonth) calMonth = today().slice(0, 7);

  const controls = el('div', 'cal-controls');
  const sel = document.createElement('select');
  habits.forEach(h => {
    const o = document.createElement('option');
    o.value = h.id; o.textContent = `${h.icon} ${h.name}`;
    if (h.id === calHabitId) o.selected = true;
    sel.append(o);
  });
  sel.onchange = () => { calHabitId = sel.value; render(); };
  controls.append(sel);
  root.append(controls);

  const habit = habits.find(h => h.id === calHabitId);
  if (habit) root.append(heatmap(habit));

  root.append(monthGrid(habits));
}

function heatmap(h) {
  const wrap = el('div', 'heatmap-wrap');
  wrap.append(el('div', 'heatmap-title', `${h.icon} ${h.name} — last 12 months`));
  const streak = E.currentStreak(h, data.entries, data.skipDays, today());
  const best = E.bestStreak(h, data.entries, data.skipDays, today());
  const unit = E.streakUnit(h) === 'weeks' ? 'week' : 'day';
  wrap.append(el('div', 'heatmap-sub', `🔥 ${streak} ${unit} current streak · 🏆 ${best} ${unit} best`));

  const grid = el('div', 'heatmap');
  const end = today();
  // Start ~52 weeks back, aligned to Monday so columns are weeks.
  let start = E.addDays(end, -364);
  start = E.weekStart(start);
  const tgt = E.target(h);

  for (let ds = start; ds <= end; ds = E.addDays(ds, 1)) {
    const cell = el('div', 'hm-cell');
    const count = E.getCount(data.entries, h.id, ds);
    const skip = E.isSkip(data.skipDays, ds);
    if (skip) cell.classList.add('skip');
    if (count > 0) {
      const ratio = Math.min(1, count / tgt);
      cell.style.background = hexAlpha(h.color, 0.25 + 0.75 * ratio);
    }
    cell.title = `${ds}: ${count}/${tgt}${skip ? ' (skip day)' : ''}`;
    grid.append(cell);
  }
  wrap.append(grid);

  const legend = el('div', 'hm-legend');
  legend.append(el('span', null, 'Less '));
  [0, 0.35, 0.6, 1].forEach(a => {
    const c = el('span', 'hm-cell');
    if (a) c.style.background = hexAlpha(h.color, 0.25 + 0.75 * a);
    legend.append(c);
  });
  legend.append(el('span', null, ' More · dashed = skip day'));
  wrap.append(legend);
  return wrap;
}

function monthGrid(habits) {
  const wrap = el('div', 'month-grid');
  const [y, m] = calMonth.split('-').map(Number);

  const nav = el('div', 'month-nav');
  const prev = el('button', 'btn ghost small', '←');
  prev.onclick = () => { calMonth = shiftMonth(calMonth, -1); render(); };
  const next = el('button', 'btn ghost small', '→');
  next.onclick = () => { calMonth = shiftMonth(calMonth, 1); render(); };
  const title = el('h3', null, new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  nav.append(prev, title, next);
  nav.append(el('span', 'heatmap-sub', ' All habits — one dot per habit, solid = goal hit'));
  wrap.append(nav);

  const table = el('div', 'month-table');
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => table.append(el('div', 'month-dow', d)));

  const first = `${calMonth}-01`;
  const startPad = (E.dayOfWeek(first) + 6) % 7; // Monday-based
  const daysInMonth = new Date(y, m, 0).getDate();
  const cursor = today();

  for (let i = 0; i < startPad; i++) table.append(el('div', 'month-cell other'));
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calMonth}-${d < 10 ? '0' + d : d}`;
    const cell = el('div', 'month-cell'
      + (ds === cursor ? ' today-cell' : '')
      + (E.isSkip(data.skipDays, ds) ? ' skip-cell' : ''));
    cell.append(el('div', 'dnum', String(d)));
    const dots = el('div', 'month-dots');
    habits.forEach(h => {
      if (!E.isScheduledOn(h, ds)) return;
      const dot = el('span', 'mdot' + (E.isCompleteOn(h, data.entries, ds) ? ' hit' : ''));
      dot.style.background = h.color;
      dot.title = `${h.icon} ${h.name}`;
      dots.append(dot);
    });
    cell.append(dots);
    const note = habits.map(h => entryFor(h.id, ds).note).filter(Boolean).join(' · ');
    if (note) {
      cell.title = note;
      cell.append(el('div', 'dnum', '📝'));
    }
    table.append(cell);
  }
  wrap.append(table);
  return wrap;
}

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1);
}

// ---------- STATS ----------

function renderStats(root) {
  const habits = activeHabits();
  if (!habits.length) return renderEmpty(root);
  const ds = today();
  const grid = el('div', 'stats-grid');

  habits.forEach(h => {
    const card = el('div', 'stat-card');
    const head = el('div', 'stat-head');
    const icon = el('div', 'habit-icon', h.icon);
    icon.style.background = hexAlpha(h.color, 0.18);
    head.append(icon);
    const tw = el('div');
    tw.append(el('h3', null, h.name));
    tw.append(el('div', 'sub', scheduleLabel(h) + (h.goal ? ` · goal ${h.goal.target} ${h.goal.unit || ''}` : '')));
    head.append(tw);
    card.append(head);

    const unit = E.streakUnit(h) === 'weeks' ? 'wk' : 'd';
    const nums = el('div', 'stat-nums');
    [[`${E.currentStreak(h, data.entries, data.skipDays, ds)}${unit}`, 'streak'],
     [`${E.bestStreak(h, data.entries, data.skipDays, ds)}${unit}`, 'best'],
     [String(E.totalCompletions(h, data.entries)), 'total'],
     [`${E.completionRate(h, data.entries, data.skipDays, 30, ds)}%`, '30 days']]
      .forEach(([v, k]) => {
        const n = el('div', 'stat-num');
        n.append(el('div', 'v', v));
        n.append(el('div', 'k', k));
        nums.append(n);
      });
    card.append(nums);

    const bars = el('div', 'bars');
    [[30, '30d'], [90, '90d'], [365, '365d']].forEach(([days, lbl]) => {
      const pct = E.completionRate(h, data.entries, data.skipDays, days, ds);
      const row = el('div', 'bar-row');
      row.append(el('span', 'lbl', lbl));
      const bar = el('div', 'bar');
      const fill = el('div');
      fill.style.width = pct + '%';
      fill.style.background = h.color;
      bar.append(fill);
      row.append(bar);
      row.append(el('span', 'pct', pct + '%'));
      bars.append(row);
    });
    card.append(bars);
    grid.append(card);
  });
  root.append(grid);
}

// ---------- MODAL (add / edit habit) ----------

const form = {
  icon: ICONS[0], color: COLORS[0], schedType: 'daily', days: [1,2,3,4,5], reminders: [],
};

function openModal(habitId) {
  editingId = habitId;
  const h = habitId ? data.habits.find(x => x.id === habitId) : null;
  $('#modal-title').textContent = h ? 'Edit Habit' : 'New Habit';
  $('#btn-delete').classList.toggle('hidden', !h);
  $('#f-name').value = h ? h.name : '';
  form.icon = h ? h.icon : ICONS[Math.floor(Math.random() * ICONS.length)];
  form.color = h ? h.color : COLORS[data.habits.length % COLORS.length];
  form.schedType = h ? h.schedule.type : 'daily';
  form.days = h && h.schedule.days ? [...h.schedule.days] : [1,2,3,4,5];
  form.reminders = h ? [...h.reminders] : [];
  $('#f-times-n').value = h && h.schedule.times ? h.schedule.times : 3;
  $('#f-goal-on').checked = !!(h && h.goal);
  $('#f-goal-target').value = h && h.goal ? h.goal.target : 8;
  $('#f-goal-unit').value = h && h.goal ? (h.goal.unit || '') : '';
  drawModal();
  $('#modal').classList.remove('hidden');
  setTimeout(() => $('#f-name').focus(), 0);
}

function drawModal() {
  // icons
  const ig = $('#f-icons');
  ig.innerHTML = '';
  ICONS.forEach(ic => {
    const b = el('button', ic === form.icon ? 'sel' : '', ic);
    b.type = 'button';
    b.onclick = () => { form.icon = ic; drawModal(); };
    ig.append(b);
  });
  // colors
  const cg = $('#f-colors');
  cg.innerHTML = '';
  COLORS.forEach(c => {
    const b = el('button', c === form.color ? 'sel' : '');
    b.type = 'button';
    b.style.background = c;
    b.onclick = () => { form.color = c; drawModal(); };
    cg.append(b);
  });
  // schedule segments
  document.querySelectorAll('#f-schedule button').forEach(b =>
    b.classList.toggle('active', b.dataset.s === form.schedType));
  $('#f-weekdays').classList.toggle('hidden', form.schedType !== 'weekdays');
  $('#f-times').classList.toggle('hidden', form.schedType !== 'timesPerWeek');
  // weekday toggles (Mon-first display)
  const wd = $('#f-weekdays');
  wd.innerHTML = '';
  [1,2,3,4,5,6,0].forEach(d => {
    const b = el('button', 'dow-btn' + (form.days.includes(d) ? ' sel' : ''), DOW_SHORT[d]);
    b.type = 'button';
    b.onclick = () => {
      form.days = form.days.includes(d) ? form.days.filter(x => x !== d) : [...form.days, d];
      drawModal();
    };
    wd.append(b);
  });
  // goal visibility
  $('#f-goal').classList.toggle('hidden', !$('#f-goal-on').checked);
  // reminders
  const rw = $('#f-reminders');
  rw.innerHTML = '';
  form.reminders.forEach((t, i) => {
    const row = el('div', 'reminder-row');
    const inp = document.createElement('input');
    inp.type = 'time'; inp.value = t;
    inp.onchange = () => { form.reminders[i] = inp.value; };
    const rm = el('button', 'rm', '✕');
    rm.type = 'button';
    rm.onclick = () => { form.reminders.splice(i, 1); drawModal(); };
    row.append(inp, rm);
    rw.append(row);
  });
}

function saveModal() {
  const name = $('#f-name').value.trim();
  if (!name) { toast('Give your habit a name'); return; }
  let schedule;
  if (form.schedType === 'weekdays') {
    if (!form.days.length) { toast('Pick at least one weekday'); return; }
    schedule = { type: 'weekdays', days: [...form.days].sort() };
  } else if (form.schedType === 'timesPerWeek') {
    schedule = { type: 'timesPerWeek', times: Math.min(7, Math.max(1, parseInt($('#f-times-n').value) || 3)) };
  } else {
    schedule = { type: 'daily' };
  }
  const goal = $('#f-goal-on').checked
    ? { target: Math.max(1, parseInt($('#f-goal-target').value) || 1), unit: $('#f-goal-unit').value.trim() }
    : null;
  const reminders = form.reminders.filter(t => /^\d{2}:\d{2}$/.test(t));

  if (editingId) {
    const h = data.habits.find(x => x.id === editingId);
    Object.assign(h, { name, icon: form.icon, color: form.color, schedule, goal, reminders });
  } else {
    data.habits.push({
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, icon: form.icon, color: form.color, schedule, goal, reminders,
      createdAt: today(), archived: false,
      order: data.habits.length,
    });
  }
  persist();
  closeModal();
  render();
  toast(editingId ? 'Habit updated' : 'Habit created 🔥');
}

function closeModal() {
  $('#modal').classList.add('hidden');
  editingId = null;
}

function deleteHabit() {
  if (!editingId) return;
  const h = data.habits.find(x => x.id === editingId);
  if (!confirm(`Delete "${h.name}" and all its history? This cannot be undone.`)) return;
  data.habits = data.habits.filter(x => x.id !== editingId);
  delete data.entries[editingId];
  persist();
  closeModal();
  render();
  toast('Habit deleted');
}

// ---------- wiring ----------

function wire() {
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => { view = t.dataset.view; openNoteId = null; render(); }));

  $('#btn-add').onclick = () => openModal(null);
  $('#btn-cancel').onclick = closeModal;
  $('#btn-save').onclick = saveModal;
  $('#btn-delete').onclick = deleteHabit;
  $('#modal').addEventListener('mousedown', (e) => { if (e.target === $('#modal')) closeModal(); });

  document.querySelectorAll('#f-schedule button').forEach(b =>
    b.addEventListener('click', () => { form.schedType = b.dataset.s; drawModal(); }));
  $('#f-goal-on').addEventListener('change', drawModal);
  $('#f-add-reminder').onclick = () => { form.reminders.push('08:00'); drawModal(); };

  $('#btn-export-json').onclick = async () => {
    await api.saveData(data);
    const r = await api.exportJSON();
    if (r.ok) toast('Exported → ' + r.path);
  };
  $('#btn-export-csv').onclick = async () => {
    await api.saveData(data);
    const r = await api.exportCSV();
    if (r.ok) toast('Exported → ' + r.path);
  };
  $('#btn-import').onclick = async () => {
    const r = await api.importJSON();
    if (r.ok) { data = r.data; render(); toast('Import complete — data replaced'); }
    else if (r.error) toast('Import failed: ' + r.error);
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); openNoteId = null; render(); }
  });
}

// ---------- boot ----------

(async function boot() {
  data = await api.loadData();
  wire();
  pushReminders();
  render();
  console.log(`Streakly ready — ${data.habits.length} habit(s) loaded.`);
})();
