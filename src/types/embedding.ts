/**
 * Embedding 和向量数据库相关类型定义
 */

import type { CanvasNode } from './notebook'

/** 向量维度类型 */
export type VectorDimension = 1536 | 768 | 384 | 1024

/** 向量元数据条目 */
export interface VectorMetadataEntry {
  /** HNSW 内部 ID */
  id: number
  /** 笔记本 ID */
  notebookId: string
  /** 画布 ID */
  canvasId: string
  /** 节点 ID */
  nodeId: string
  /** 字段类型：transcript 或 agentResult */
  fieldType: 'transcript' | 'agentResult'
  /** 文本 SHA256 hash，用于检测变化 */
  textHash: string
  /** 更新时间戳 */
  updatedAt: number
}

/** 向量数据库元数据文件结构 */
export interface VectorDbMetadata {
  /** 所有向量条目的映射，key 为 notebookId:nodeId:fieldType */
  entries: Record<string, VectorMetadataEntry>
  /** 向量维度 */
  dimension: VectorDimension
  /** 最大元素数 */
  maxElements: number
  /** 下一个可用的内部 ID */
  nextId: number
}

/** 语义搜索结果 */
export interface SemanticSearchResult {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  nodeTitle: string
  fieldType: 'transcript' | 'agentResult'
  fullText: string
  /** 相似度分数 (0-1) */
  similarity: number
  /** 元数据条目 */
  metadata: VectorMetadataEntry
}

/** 索引状态 */
export interface IndexStatus {
  /** 总节点数 */
  totalNodes: number
  /** 已索引节点数 */
  indexedNodes: number
  /** 需要更新的节点数 */
  outdatedNodes: number
  /** 是否正在索引 */
  isIndexing: boolean
  /** 当前索引进度 (0-100) */
  progress?: number
}

/** 被跳过的索引节点 */
export interface SkippedIndexNode {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  nodeTitle: string
  fieldType: 'transcript' | 'agentResult'
  reason: string  // 跳过原因，如 "文本过长"
}

/** Embedding 生成配置 */
export interface EmbeddingConfig {
  baseUrl: string
  apiKey: string
  model: string
}

/** Embedding API 响应 */
export interface EmbeddingResponse {
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

/** 用于索引的节点数据 */
export interface NodeIndexData {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  node: CanvasNode
}