/**
 * 上下文构建工具函数
 * 用于处理节点上下文、图片加载等
 */

import { getNotebookDataDir } from '@/utils/userFilesPath'

/**
 * 提取文本中的图片路径
 */
export function extractImagePaths(text: string): string[] {
  const imgRegex = /!\[.*?\]\((images\/[^)]+)\)/g
  const paths: string[] = []
  let match
  while ((match = imgRegex.exec(text)) !== null) {
    paths.push(match[1])
  }
  return paths
}

/**
 * MIME 类型映射
 */
const MIME_TYPES: Record<string, string> = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp'
}

/**
 * 获取图片的 MIME 类型
 */
export function getImageMimeType(imagePath: string): string {
  const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'
  return MIME_TYPES[ext] || 'image/png'
}

/**
 * 将 ArrayBuffer 转换为 base64 数据 URL
 */
export function arrayBufferToBase64Url(buffer: ArrayBuffer, imagePath: string): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  const mimeType = getImageMimeType(imagePath)
  return `data:${mimeType};base64,${base64}`
}

/**
 * readFile 函数类型
 */
type ReadFileFunction = (path: string, format: string) => Promise<{ success: boolean; data?: string | ArrayBuffer; error?: string }>

/**
 * 加载 transcript 中的内嵌图片并返回 base64 数组
 */
export async function loadEmbeddedImagesForTranscript(
  transcript: string,
  notebookId: string,
  readFile: ReadFileFunction
): Promise<string[] | undefined> {
  const imagePaths = extractImagePaths(transcript)
  if (imagePaths.length === 0) return undefined

  const notebookDir = await getNotebookDataDir(notebookId)
  const base64Images: string[] = []

  for (const imagePath of imagePaths) {
    const fullPath = `${notebookDir}/${imagePath}`
    const result = await readFile(fullPath, 'arraybuffer')

    if (result.success && result.data instanceof ArrayBuffer) {
      const base64Url = arrayBufferToBase64Url(result.data, imagePath)
      base64Images.push(base64Url)
    }
  }

  return base64Images.length > 0 ? base64Images : undefined
}

/**
 * 加载图片节点的 base64 编码
 */
export async function loadImageBase64(
  imagePath: string,
  notebookId: string,
  readFile: ReadFileFunction
): Promise<string | undefined> {
  const notebookDir = await getNotebookDataDir(notebookId)
  const fullPath = `${notebookDir}/${imagePath}`
  const result = await readFile(fullPath, 'arraybuffer')

  if (result.success && result.data instanceof ArrayBuffer) {
    return arrayBufferToBase64Url(result.data, imagePath)
  }

  return undefined
}