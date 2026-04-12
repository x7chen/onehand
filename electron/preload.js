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
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  // 获取应用图标 DataURL
  getIconDataUrl: () => ipcRenderer.invoke('get-icon-data-url'),
  // 获取系统语言
  getSystemLocale: () => ipcRenderer.invoke('get-system-locale'),
  // Vector Database API
  initVectorDb: (dimension, maxElements) => ipcRenderer.invoke('init-vector-db', dimension, maxElements),
  addVector: (entryKey, vector, metadata) => ipcRenderer.invoke('add-vector', entryKey, vector, metadata),
  searchVectors: (queryVector, k) => ipcRenderer.invoke('search-vectors', queryVector, k),
  deleteVector: (entryKey) => ipcRenderer.invoke('delete-vector', entryKey),
  saveVectorDb: () => ipcRenderer.invoke('save-vector-db'),
  loadVectorDb: () => ipcRenderer.invoke('load-vector-db'),
  getVectorDbMetadata: () => ipcRenderer.invoke('get-vector-db-metadata'),
  updateVectorDbMetadata: (metadata) => ipcRenderer.invoke('update-vector-db-metadata', metadata),
  getVectorDbStatus: () => ipcRenderer.invoke('get-vector-db-status')
})
