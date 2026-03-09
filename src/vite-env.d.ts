/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  saveFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>
  saveFileBuffer: (filePath: string, data: ArrayBuffer) => Promise<{ success: boolean; error?: string }>
  readFile: (filePath: string, encoding?: string) => Promise<{ success: boolean; data?: string | ArrayBuffer; error?: string }>
  selectDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>
  getAppPath: (name: string) => Promise<string>
  exists: (filePath: string) => Promise<boolean>
  mkdir: (dirPath: string) => Promise<{ success: boolean; error?: string }>
  setTheme: (isDark: boolean) => Promise<{ success: boolean }>
  readConfig: () => Promise<{ success: boolean; data?: string; error?: string }>
  saveConfig: (data: string) => Promise<{ success: boolean; error?: string }>
}

interface Window {
  electronAPI: ElectronAPI
}
