'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('streakly', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportJSON: () => ipcRenderer.invoke('data:exportJSON'),
  exportCSV: () => ipcRenderer.invoke('data:exportCSV'),
  importJSON: () => ipcRenderer.invoke('data:importJSON'),
  updateReminders: (cfg) => ipcRenderer.send('reminders:update', cfg),
});
