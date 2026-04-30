import { useSettingsStore } from '@/stores/settingsStore'

/**
 * 获取用户文件目录路径
 * 如果用户设置了自定义路径，使用自定义路径；否则使用默认的 userData 目录
 */
export async function getUserFilesPath(): Promise<string> {
  const settingsStore = useSettingsStore()

  // 确保 settings 已加载
  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }

  const customPath = settingsStore.settings.general.userFilesPath

  if (customPath && customPath.trim() !== '') {
    // 使用用户自定义路径
    return customPath.trim()
  }

  // 使用默认的 userData 目录
  const appDataPath = await window.electronAPI.getAppPath('userData')
  return appDataPath
}

/**
 * 获取笔记本目录路径
 */
export async function getNotebooksDir(): Promise<string> {
  const basePath = await getUserFilesPath()
  return `${basePath}/notebooks`
}

/**
 * 获取 PDF 目录路径
 */
export async function getPdfDir(): Promise<string> {
  const basePath = await getUserFilesPath()
  return `${basePath}/pdf`
}

/**
 * 获取上下文目录路径
 */
export async function getContextsDir(): Promise<string> {
  const basePath = await getUserFilesPath()
  return `${basePath}/contexts`
}

/**
 * 获取单个笔记本文件路径
 */
export async function getNotebookFilePath(notebookId: string): Promise<string> {
  const notebooksDir = await getNotebooksDir()
  return `${notebooksDir}/${notebookId}.json`
}

/**
 * 获取笔记本数据目录（用于存储音频、图片等）
 */
export async function getNotebookDataDir(notebookId: string): Promise<string> {
  const notebooksDir = await getNotebooksDir()
  return `${notebooksDir}/${notebookId}`
}

/**
 * 获取笔记本音频目录
 */
export async function getNotebookAudioDir(notebookId: string): Promise<string> {
  const notebookDir = await getNotebookDataDir(notebookId)
  return `${notebookDir}/audio`
}

/**
 * 获取笔记本图片目录
 */
export async function getNotebookImagesDir(notebookId: string): Promise<string> {
  const notebookDir = await getNotebookDataDir(notebookId)
  return `${notebookDir}/images`
}

/**
 * 获取笔记本PDF目录
 */
export async function getNotebookPdfDir(notebookId: string): Promise<string> {
  const notebookDir = await getNotebookDataDir(notebookId)
  return `${notebookDir}/pdf`
}

/**
 * 获取用户数据目录下的文件路径（用于快捷指令等）
 */
export async function getUserDataFilePath(filename: string): Promise<string> {
  const basePath = await getUserFilesPath()
  return `${basePath}/${filename}`
}

/**
 * 获取回收站目录路径
 */
export async function getTrashDir(): Promise<string> {
  const basePath = await getUserFilesPath()
  return `${basePath}/trash`
}

/**
 * 获取回收站笔记本目录
 */
export async function getTrashNotebooksDir(): Promise<string> {
  const trashDir = await getTrashDir()
  return `${trashDir}/notebooks`
}

/**
 * 获取回收站笔记本文件路径
 */
export async function getTrashNotebookFilePath(originalId: string): Promise<string> {
  const trashDir = await getTrashNotebooksDir()
  return `${trashDir}/${originalId}.json`
}

/**
 * 获取回收站笔记本数据目录（用于存储音频、图片等）
 */
export async function getTrashNotebookDataDir(originalId: string): Promise<string> {
  const trashDir = await getTrashNotebooksDir()
  return `${trashDir}/${originalId}`
}

/**
 * 获取回收站上下文文件路径
 */
export async function getTrashContextsFilePath(): Promise<string> {
  const trashDir = await getTrashDir()
  return `${trashDir}/contexts.json`
}

/**
 * 获取回收站快捷指令文件路径
 */
export async function getTrashQuickCommandsFilePath(): Promise<string> {
  const trashDir = await getTrashDir()
  return `${trashDir}/quickCommands.json`
}

/**
 * 获取回收站笔记本元数据文件路径
 */
export async function getTrashNotebooksMetaFilePath(): Promise<string> {
  const trashDir = await getTrashDir()
  return `${trashDir}/notebooks_meta.json`
}

/**
 * 获取回收站节点文件路径
 */
export async function getTrashNodesFilePath(): Promise<string> {
  const trashDir = await getTrashDir()
  return `${trashDir}/nodes.json`
}

/**
 * 获取回收站节点附件目录（音频、图片等）
 */
export async function getTrashNodesDataDir(): Promise<string> {
  const trashDir = await getTrashDir()
  return `${trashDir}/nodes`
}