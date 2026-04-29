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
  moveFile: (srcPath, destPath) => ipcRenderer.invoke('move-file', srcPath, destPath),
  moveDir: (srcPath, destPath) => ipcRenderer.invoke('move-dir', srcPath, destPath),
  rmdir: (dirPath) => ipcRenderer.invoke('rmdir', dirPath),
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
  // 打开本地文件（使用系统默认程序）
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  // Vector Database API (embedJs with LibSQL)
  initVectorDb: (dimension, maxElements) => ipcRenderer.invoke('init-vector-db', dimension, maxElements),
  indexNodes: (nodes) => ipcRenderer.invoke('index-nodes', nodes),
  indexNodesIncremental: (nodes) => ipcRenderer.invoke('index-nodes-incremental', nodes),
  deleteIndexedNodes: (sources) => ipcRenderer.invoke('delete-indexed-nodes', sources),
  semanticSearch: (query, topK) => ipcRenderer.invoke('semantic-search', query, topK),
  resetVectorDb: () => ipcRenderer.invoke('reset-vector-db'),
  deleteLoader: (loaderId) => ipcRenderer.invoke('delete-loader', loaderId),
  getVectorDbStatus: () => ipcRenderer.invoke('get-vector-db-status'),
  getLoaders: () => ipcRenderer.invoke('get-loaders'),
  getIndexedHashes: () => ipcRenderer.invoke('get-indexed-hashes'),
  getIndexStatusFull: (currentNodes) => ipcRenderer.invoke('get-index-status-full', currentNodes),
  // Index progress event
  onIndexProgress: (callback) => {
    ipcRenderer.on('index-progress', (event, data) => callback(data))
  },
  removeIndexProgressListener: () => {
    ipcRenderer.removeAllListeners('index-progress')
  }
})