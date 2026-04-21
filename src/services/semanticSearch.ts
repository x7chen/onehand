/**
 * 语义搜索服务
 * 提供统一的搜索接口，支持语义搜索和关键词搜索的整合
 */

import type { SemanticSearchResult, SkippedIndexNode } from '@/types/embedding'
import { useVectorStore } from '@/stores/vectorStore'
import { useNotebookStore } from '@/stores/notebookStore'
import type { Notebook, CanvasPage, CanvasNode } from '@/types/notebook'

/** 搜索结果（兼容现有 SearchResult 格式） */
export interface UnifiedSearchResult {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  nodeTitle: string
  fieldType: 'transcript' | 'agentResult'
  fullText: string
  highlightedText?: string
  similarity?: number
  matchIndex?: number
}

/** 搜索模式 */
export type SearchMode = 'keyword' | 'semantic'

/** 搜索选项 */
export interface SearchOptions {
  mode: SearchMode
  topK?: number
  includeHighlight?: boolean
}

/**
 * 执行关键词搜索（现有逻辑）
 */
export function keywordSearch(query: string): UnifiedSearchResult[] {
  const notebookStore = useNotebookStore()
  const results: UnifiedSearchResult[] = []
  const lowerQuery = query.toLowerCase()

  // 检查查询是否包含英文字母
  const hasEnglishLetters = /[a-zA-Z]/.test(query)

  for (const notebook of notebookStore.notebooks) {
    if (!notebook.canvases || !notebook.nodes) continue

    for (const node of notebook.nodes) {
      // 找到节点所属的画布
      const canvas = notebook.canvases.find(c => c.id === node.canvasId)
      if (!canvas) continue

      // Search in transcript
      if (node.transcript) {
        const matches = findMatches(node.transcript, query, hasEnglishLetters)
        for (const match of matches) {
          results.push({
            notebookId: notebook.id,
            notebookName: notebook.name,
            canvasId: canvas.id,
            canvasName: getCanvasName(canvas, notebook),
            nodeId: node.id,
            nodeTitle: node.title || '',
            fieldType: 'transcript',
            fullText: node.transcript,
            highlightedText: createHighlightedText(node.transcript, query, match.index),
            matchIndex: match.index
          })
        }
      }

      // Search in agentResult
      if (node.agentResult) {
        const matches = findMatches(node.agentResult, query, hasEnglishLetters)
        for (const match of matches) {
          results.push({
            notebookId: notebook.id,
            notebookName: notebook.name,
            canvasId: canvas.id,
            canvasName: getCanvasName(canvas, notebook),
            nodeId: node.id,
            nodeTitle: node.title || '',
            fieldType: 'agentResult',
            fullText: node.agentResult,
            highlightedText: createHighlightedText(node.agentResult, query, match.index),
            matchIndex: match.index
          })
        }
      }
    }
  }

  // Sort by notebook name and canvas name
  results.sort((a, b) => {
    if (a.notebookName !== b.notebookName) {
      return a.notebookName.localeCompare(b.notebookName)
    }
    if (a.canvasName !== b.canvasName) {
      return a.canvasName.localeCompare(b.canvasName)
    }
    return (a.matchIndex || 0) - (b.matchIndex || 0)
  })

  return results
}

/**
 * 执行语义搜索
 */
export async function semanticSearch(query: string, topK = 20): Promise<UnifiedSearchResult[]> {
  const vectorStore = useVectorStore()
  const semanticResults = await vectorStore.semanticSearch(query, topK)

  return semanticResults.map(result => ({
    notebookId: result.notebookId,
    notebookName: result.notebookName,
    canvasId: result.canvasId,
    canvasName: result.canvasName,
    nodeId: result.nodeId,
    nodeTitle: result.nodeTitle,
    fieldType: result.fieldType,
    fullText: result.fullText,
    similarity: result.similarity
  }))
}

/**
 * 统一搜索接口
 */
export async function unifiedSearch(
  query: string,
  options: SearchOptions = { mode: 'keyword' }
): Promise<UnifiedSearchResult[]> {
  if (!query.trim()) {
    return []
  }

  if (options.mode === 'semantic') {
    return semanticSearch(query, options.topK || 20)
  } else {
    return keywordSearch(query)
  }
}

/**
 * 检查是否需要更新索引
 */
export async function checkIndexNeedsUpdate(): Promise<{
  needsUpdate: boolean
  status: {
    totalNodes: number
    indexedNodes: number
    outdatedNodes: number
  }
}> {
  const vectorStore = useVectorStore()
  const status = await vectorStore.getIndexStatus()

  return {
    needsUpdate: status.outdatedNodes > 0 || status.indexedNodes < status.totalNodes,
    status: {
      totalNodes: status.totalNodes,
      indexedNodes: status.indexedNodes,
      outdatedNodes: status.outdatedNodes
    }
  }
}

/**
 * 更新索引
 */
export async function updateIndex(onProgress?: (progress: number) => void): Promise<{ indexedCount: number }> {
  const vectorStore = useVectorStore()

  // 确保向量数据库已初始化
  if (!vectorStore.isInitialized) {
    const success = await vectorStore.initVectorDb()
    if (!success) {
      console.error('Failed to initialize vector database')
      return { indexedCount: 0 }
    }
  }

  return vectorStore.indexAllNotebooks(onProgress)
}

// ========== 辅助函数 ==========

function findMatches(text: string, query: string, hasEnglishLetters: boolean): { index: number }[] {
  const matches: { index: number }[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  if (hasEnglishLetters) {
    // 使用正则表达式匹配完整单词
    const regex = new RegExp(`\\b${escapeRegExp(lowerQuery)}\\b`, 'gi')
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      matches.push({ index: match.index })
    }
  } else {
    // 对于中文等非英文，使用普通匹配
    let index = 0
    while (true) {
      index = lowerText.indexOf(lowerQuery, index)
      if (index === -1) break
      matches.push({ index })
      index += 1
    }
  }

  return matches
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createHighlightedText(text: string, query: string, matchIndex: number): string {
  const visibleLength = 80
  const halfVisible = visibleLength / 2
  let start = Math.max(0, matchIndex - halfVisible * 0.6)
  let end = Math.min(text.length, start + visibleLength)

  if (end - start < visibleLength) {
    start = Math.max(0, end - visibleLength)
  }

  const beforeMatch = escapeHtml(text.slice(start, matchIndex))
  const matchedText = escapeHtml(text.slice(matchIndex, matchIndex + query.length))
  const afterMatch = escapeHtml(text.slice(matchIndex + query.length, end))

  let result = ''

  if (start > 0) {
    result += '...'
  }

  result += `${beforeMatch}<mark class="highlight">${matchedText}</mark>${afterMatch}`

  if (end < text.length) {
    result += '...'
  }

  return result
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function getCanvasName(canvas: CanvasPage, notebook: Notebook): string {
  if (canvas.pdfPage !== undefined) {
    return `第 ${canvas.pdfPage} 页`
  }

  const index = notebook.canvases?.findIndex(c => c.id === canvas.id) ?? 0
  if (notebook.canvases && notebook.canvases.length > 1) {
    return `第 ${index + 1} 页`
  }
  return '画布'
}