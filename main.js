'use strict';

const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./src/store');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    title: 'Streakly',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Boot verification hook (used by CI / smoke checks): STREAKLY_SMOKE=1 npm start
  // prints a JSON snapshot of the booted UI and exits.
  if (process.env.STREAKLY_SMOKE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const snap = await win.webContents.executeJavaScript(`({
            engine: typeof window.StreaklyEngine,
            bridge: typeof window.streakly,
            tabs: document.querySelectorAll('.tab').length,
            viewChildren: document.getElementById('view').children.length,
            title: document.title,
          })`);
          console.log('SMOKE:' + JSON.stringify(snap));
        } catch (err) {
          console.log('SMOKE-ERROR:' + err.message);
        }
        app.exit(0);
      }, 1500);
    });
  }
}

// ---------- data IPC ----------

const userDir = () => app.getPath('userData');

ipcMain.handle('data:load', () => store.load(userDir()));
ipcMain.handle('data:save', (_e, data) => {
  store.save(userDir(), store.normalize(data));
  return true;
});

// ---------- export / import ----------

ipcMain.handle('data:exportJSON', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Streakly data (JSON)',
    defaultPath: `streakly-export-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, store.exportJSON(store.load(userDir())), 'utf8');
  return { ok: true, path: filePath };
});

ipcMain.handle('data:exportCSV', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Streakly history (CSV)',
    defaultPath: `streakly-history-${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, store.exportCSV(store.load(userDir())), 'utf8');
  return { ok: true, path: filePath };
});

ipcMain.handle('data:importJSON', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import Streakly data',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  try {
    const data = store.importJSON(fs.readFileSync(filePaths[0], 'utf8'));
    store.save(userDir(), data);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ---------- reminders ----------
// Renderer sends the reminder schedule; main fires OS notifications.
// { habits: [{ name, icon, times: ['08:00', ...] }], enabled: true }

let reminderConfig = { enabled: false, habits: [] };
const firedToday = new Set(); // 'name|HH:MM|YYYY-MM-DD'

ipcMain.on('reminders:update', (_e, cfg) => {
  reminderConfig = cfg || { enabled: false, habits: [] };
});

function checkReminders() {
  if (!reminderConfig.enabled || !Notification.isSupported()) return;
  const now = new Date();
  const p = n => (n < 10 ? '0' + n : '' + n);
  const hhmm = p(now.getHours()) + ':' + p(now.getMinutes());
  const today = now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
  for (const h of reminderConfig.habits || []) {
    for (const t of h.times || []) {
      const key = `${h.name}|${t}|${today}`;
      if (t === hhmm && !firedToday.has(key)) {
        firedToday.add(key);
        new Notification({
          title: `${h.icon || '⏰'} ${h.name}`,
          body: 'Time to keep your streak alive.',
          silent: false,
        }).show();
      }
    }
  }
  if (firedToday.size > 2000) firedToday.clear();
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.bensblueprints.streakly');
  createWindow();
  setInterval(checkReminders, 20 * 1000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
