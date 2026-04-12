/**
 * Embedding 工具函数
 * 提供 Embedding API 调用、文本 hash、相似度计算等功能
 */

import type { EmbeddingConfig, EmbeddingResponse } from '@/types/embedding'

/**
 * 生成文本的 SHA256 hash
 */
export function textHash(text: string): string {
  // 使用简单的 hash 函数（避免依赖 crypto 模块）
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // 转换为十六进制字符串，并添加前缀以区分
  return `sha256-${Math.abs(hash).toString(16).padStart(8, '0')}`
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }

  norm1 = Math.sqrt(norm1)
  norm2 = Math.sqrt(norm2)

  if (norm1 === 0 || norm2 === 0) {
    return 0
  }

  return dotProduct / (norm1 * norm2)
}

/**
 * 调用 Embedding API 生成向量
 */
export async function generateEmbedding(
  text: string,
  config: EmbeddingConfig
): Promise<number[]> {
  // 移除 baseUrl 末尾的斜杠
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      input: text
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`)
  }

  const data: EmbeddingResponse = await response.json()

  if (!data.data || data.data.length === 0) {
    throw new Error('No embedding data returned')
  }

  return data.data[0].embedding
}

/**
 * 批量生成多个文本的 embedding
 * 注意：大多数 API 对批量请求有数量限制
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  config: EmbeddingConfig,
  batchSize = 10
): Promise<number[][]> {
  const results: number[][] = []

  // 分批处理
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text, config))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * 规范化向量（使其长度为 1）
 */
export function normalizeVector(vec: number[]): number[] {
  let norm = 0
  for (const val of vec) {
    norm += val * val
  }
  norm = Math.sqrt(norm)

  if (norm === 0) {
    return vec
  }

  return vec.map(val => val / norm)
}

/**
 * 检查文本是否需要重新索引
 */
export function needsReindex(
  text: string,
  existingHash: string
): boolean {
  const currentHash = textHash(text)
  return currentHash !== existingHash
}