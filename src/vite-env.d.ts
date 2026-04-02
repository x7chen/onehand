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

interface ElectronAPI {
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
}

interface Window {
  electronAPI: ElectronAPI
}
