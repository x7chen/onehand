const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (filePath, data) => ipcRenderer.invoke('save-file', filePath, data),
  saveFileBuffer: (filePath, data) => ipcRenderer.invoke('save-file-buffer', filePath, data),
  readFile: (filePath, encoding = 'utf-8') => ipcRenderer.invoke('read-file', filePath, encoding),
  copyFile: (srcPath, destPath) => ipcRenderer.invoke('copy-file', srcPath, destPath),
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
  transcribeAudio: (audioData, mimeType, config) => ipcRenderer.invoke('transcribe-audio', audioData, mimeType, config),
  // Deep link API
  getDeepLink: () => ipcRenderer.invoke('get-deep-link'),
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (event, url) => callback(url))
  },
  removeDeepLinkListener: () => {
    ipcRenderer.removeAllListeners('deep-link')
  },
  // 窗口控制（用于Windows自定义标题栏）
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized')
})
