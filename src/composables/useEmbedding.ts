/**
 * Embedding 工具函数
 * 提供文本 hash 功能
 */

/**
 * 生成文本的 SHA256 hash
 */
export function textHash(text: string): string {
  // 使用简单的 hash 函数
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // 转换为十六进制字符串，并添加前缀以区分
  return `sha256-${Math.abs(hash).toString(16).padStart(8, '0')}`
}