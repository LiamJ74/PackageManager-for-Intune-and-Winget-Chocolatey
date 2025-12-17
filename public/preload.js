const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  searchWinget: (query) => ipcRenderer.invoke('search-winget', query),
  searchChocolatey: (query) => ipcRenderer.invoke('search-chocolatey', query),
  deployToIntune: (config, script) => ipcRenderer.invoke('deploy-to-intune', config, script),
  showSaveDialog: (defaultPath) => ipcRenderer.invoke('show-save-dialog', defaultPath),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog')
});