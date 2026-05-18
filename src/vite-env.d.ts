/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface TranscriptionResult {
  success: boolean
  text?: string
  error?: string
}

interface SherpaOnnxConfig {
  modelPath: string
  tokensPath: string
  numThreads?: number
  decodingMethod?: 'greedy_search' | 'modified_beam_search'
}

/** NotebookNodeData - 用于索引的节点数据 */
interface NotebookNodeData {
  notebookId: string
  notebookName: string
  nodeId: string
  nodeTitle: string
  pdfPage?: number
  fieldType: 'transcript' | 'agentResult'
  text: string
}

/** 平台信息 */
interface PlatformInfo {
  isWindows: boolean
  isMacOS: boolean
  isLinux: boolean
  platform: 'win32' | 'darwin' | 'linux'
}

interface ElectronAPI {
  // 平台信息
  platform: PlatformInfo
  saveFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>
  saveFileBuffer: (filePath: string, data: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
  readFile: (filePath: string, encoding?: string) => Promise<{ success: boolean; data?: string | ArrayBuffer; error?: string }>
  copyFile: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>
  selectDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>
  showOpenDialog: (options: {
    title?: string
    filters?: { name: string; extensions: string[] }[]
    properties?: string[]
  }) => Promise<{ canceled: boolean; filePaths: string[] }>
  getAppPath: (name: string) => Promise<string>
  exists: (filePath: string) => Promise<boolean>
  mkdir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  ensureDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  readdir: (dirPath: string) => Promise<{ success: boolean; data?: string[]; error?: string }>
  unlink: (filePath: string) => Promise<{ success: boolean; error?: string }>
  moveFile: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>
  moveDir: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>
  rmdir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  writeFile: (filePath: string, data: ArrayBuffer | Buffer) => Promise<{ success: boolean; error?: string }>
  setTheme: (isDark: boolean) => Promise<{ success: boolean }>
  readConfig: () => Promise<{ success: boolean; data?: string; error?: string }>
  saveConfig: (data: string) => Promise<{ success: boolean; error?: string }>
  transcribeAudio: (audioData: number[], mimeType: string, config: SherpaOnnxConfig) => Promise<TranscriptionResult>
  // Deep link API
  getDeepLink: () => Promise<string | null>
  onDeepLink: (callback: (url: string) => void) => void
  removeDeepLinkListener: () => void
  // 窗口控制（用于Windows自定义标题栏）
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  // 获取应用图标 DataURL
  getIconDataUrl: () => Promise<string | null>
  // 获取系统语言
  getSystemLocale: () => Promise<string>
  // 打开本地文件（使用系统默认程序）
  openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>
  // Vector Database API (embedJs)
  initVectorDb: (dimension?: number, maxElements?: number) => Promise<{ success: boolean; dimension?: number; error?: string }>
  indexNodes: (nodes: NotebookNodeData[]) => Promise<{ success: boolean; entriesAdded?: number; failedCount?: number; failedNodes?: string[]; error?: string }>
  semanticSearch: (query: string, topK?: number) => Promise<{
    success: boolean
    results?: Array<{
      pageContent: string
      score: number
      metadata: {
        notebookId: string
        notebookName: string
        nodeId: string
        nodeTitle: string
        pdfPage?: number
        fieldType: 'transcript' | 'agentResult'
        source: string
        textHash: string
      }
    }>
    error?: string
  }>
  resetVectorDb: () => Promise<{ success: boolean; error?: string }>
  deleteLoader: (loaderId: string) => Promise<{ success: boolean; error?: string }>
  getVectorDbStatus: () => Promise<{
    success: boolean
    status?: {
      initialized: boolean
      entriesCount: number
      hnswlibAvailable: boolean
    }
    error?: string
  }>
  getLoaders: () => Promise<{
    success: boolean
    loaders?: Array<{
      uniqueId: string
      type: string
      chunksProcessed: number
    }>
    error?: string
  }>
  getIndexedHashes: () => Promise<{
    success: boolean
    hashes: Record<string, string>  // source -> textHash
    error?: string
  }>
  getIndexStatusFull: (currentNodes: Array<{ source: string; textHash: string }>) => Promise<{
    success: boolean
    totalNodes: number
    indexedNodes: number
    outdatedNodes: number
    hashes?: Record<string, string>
    error?: string
  }>
  indexNodesIncremental: (nodes: NotebookNodeData[]) => Promise<{
    success: boolean
    entriesAdded?: number
    error?: string
  }>
  deleteIndexedNodes: (sources: string[]) => Promise<{
    success: boolean
    deletedCount?: number
    error?: string
  }>
  deleteIndexedNodesByTextHash: (textHash: string) => Promise<{
    success: boolean
    deletedCount?: number
    error?: string
  }>
  // Index progress event
  onIndexProgress: (callback: (data: { progress: number; total: number; indexed: number; failed: number }) => void) => void
  removeIndexProgressListener: () => void
}

interface Window {
  electronAPI: ElectronAPI
}