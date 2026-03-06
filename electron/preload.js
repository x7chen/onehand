const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (filePath, data) => ipcRenderer.invoke('save-file', filePath, data),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  exists: (filePath) => ipcRenderer.invoke('exists', filePath),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  setTheme: (isDark) => ipcRenderer.invoke('set-theme', isDark)
})
