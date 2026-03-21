const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (filePath, data) => ipcRenderer.invoke('save-file', filePath, data),
  saveFileBuffer: (filePath, data) => ipcRenderer.invoke('save-file-buffer', filePath, data),
  readFile: (filePath, encoding = 'utf-8') => ipcRenderer.invoke('read-file', filePath, encoding),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  exists: (filePath) => ipcRenderer.invoke('exists', filePath),
  mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
  readdir: (dirPath) => ipcRenderer.invoke('readdir', dirPath),
  unlink: (filePath) => ipcRenderer.invoke('unlink', filePath),
  setTheme: (isDark) => ipcRenderer.invoke('set-theme', isDark),
  readConfig: () => ipcRenderer.invoke('read-config'),
  saveConfig: (data) => ipcRenderer.invoke('save-config', data),
  transcribeAudio: (audioData, mimeType, config) => ipcRenderer.invoke('transcribe-audio', audioData, mimeType, config)
})
