/**
 * Embedding 和向量数据库相关类型定义
 */

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
  metadata: {
    id: number
    notebookId: string
    canvasId: string
    nodeId: string
    fieldType: 'transcript' | 'agentResult'
    textHash: string
    updatedAt: number
  }
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