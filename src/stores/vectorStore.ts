/**
 * Vector Store
 * 管理向量数据库状态，提供索引更新和搜索功能
 * 使用 embedJs 框架
 */

import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import md5 from 'md5'
import type { SemanticSearchResult, IndexStatus, SkippedIndexNode } from '@/types/embedding'
import { useNotebookStore } from './notebookStore'
import { useSettingsStore } from './settingsStore'

const DEFAULT_MAX_ELEMENTS = 100000

export const useVectorStore = defineStore('vector', () => {
  // 状态
  const isInitialized = ref(false)
  const isIndexing = ref(false)
  const indexProgress = ref(0)
  const entriesCount = ref(0)

  // 进度回调
  let progressCallback: ((progress: number) => void) | null = null

  // 设置进度事件监听
  const setupProgressListener = () => {
    window.electronAPI.onIndexProgress((data: { progress: number; total: number; indexed: number; failed: number }) => {
      indexProgress.value = data.progress
      if (progressCallback) {
        progressCallback(data.progress)
      }
    })
  }

  // 移除进度事件监听
  const removeProgressListener = () => {
    window.electronAPI.removeIndexProgressListener()
    progressCallback = null
  }

  // 计算属性
  const indexedCount = computed(() => entriesCount.value)

  /**
   * 初始化向量数据库
   */
  async function initVectorDb(): Promise<boolean> {
    try {
      const settingsStore = useSettingsStore()
      const dimension = settingsStore.settings.llm.embeddingDimension || 1536

      // 先检查 Electron 端的状态
      const statusResult = await window.electronAPI.getVectorDbStatus()
      console.log('Vector DB status:', statusResult)

      if (statusResult.success && statusResult.status?.hnswlibAvailable && statusResult.status?.initialized) {
        console.log('Vector DB already initialized in Electron')
        isInitialized.value = true
        entriesCount.value = statusResult.status.entriesCount
        return true
      }

      // 需要初始化
      console.log('Initializing vector DB with dimension:', dimension)
      const initResult = await window.electronAPI.initVectorDb(dimension, DEFAULT_MAX_ELEMENTS)
      console.log('initVectorDb result:', initResult)

      if (initResult.success) {
        isInitialized.value = true
        // 获取最新的状态
        const newStatus = await window.electronAPI.getVectorDbStatus()
        if (newStatus.success) {
          entriesCount.value = newStatus.status?.entriesCount || 0
        }
        return true
      }

      console.error('Failed to init vector DB:', initResult.error)
      return false
    } catch (error) {
      console.error('Error initializing vector DB:', error)
      return false
    }
  }

  /**
   * 收集所有笔记本节点数据
   */
  function collectNodes(): NotebookNodeData[] {
    const notebookStore = useNotebookStore()
    const nodes: NotebookNodeData[] = []

    const MAX_CHARS = 20000  // 与 NotebookLoader 保持一致

    for (const notebook of notebookStore.notebooks) {
      if (!notebook.nodes) continue

      for (const node of notebook.nodes) {
        // 添加 transcript（跳过过长文本）
        if (node.transcript && node.transcript.trim().length > 0) {
          if (node.transcript.length <= MAX_CHARS) {
            nodes.push({
              notebookId: notebook.id,
              notebookName: notebook.name,
              nodeId: node.id,
              nodeTitle: node.title || '',
              pdfPage: node.pdfPage,
              fieldType: 'transcript',
              text: node.transcript
            })
          }
        }

        // 添加 agentResult（跳过过长文本）
        if (node.agentResult && node.agentResult.trim().length > 0) {
          if (node.agentResult.length <= MAX_CHARS) {
            nodes.push({
              notebookId: notebook.id,
              notebookName: notebook.name,
              nodeId: node.id,
              nodeTitle: node.title || '',
              pdfPage: node.pdfPage,
              fieldType: 'agentResult',
              text: node.agentResult
            })
          }
        }
      }
    }

    return nodes
  }

  /**
   * 批量索引所有笔记本（增量更新）
   */
  async function indexAllNotebooks(onProgress?: (progress: number) => void): Promise<{ indexedCount: number; failedCount?: number; failedNodes?: SkippedIndexNode[] }> {
    if (isIndexing.value) {
      console.warn('Already indexing')
      return { indexedCount: 0 }
    }

    // 确保向量数据库已初始化
    if (!isInitialized.value) {
      const success = await initVectorDb()
      if (!success) {
        console.error('Failed to initialize vector database')
        return { indexedCount: 0 }
      }
    }

    isIndexing.value = true
    indexProgress.value = 0

    // 设置进度回调并开始监听
    progressCallback = onProgress || null
    setupProgressListener()
    onProgress?.(0)

    try {
      const notebookStore = useNotebookStore()

      // 收集当前所有节点的信息
      const currentNodesInfo: Array<{ source: string; node: NotebookNodeData; textHash: string }> = []
      const MAX_CHARS = 20000

      for (const notebook of notebookStore.notebooks) {
        if (!notebook.nodes) continue
        for (const node of notebook.nodes) {
          if (node.transcript && node.transcript.trim().length > 0 && node.transcript.length <= MAX_CHARS) {
            const source = `${notebook.id}:${node.id}:transcript`
            currentNodesInfo.push({
              source,
              node: {
                notebookId: notebook.id,
                notebookName: notebook.name,
                nodeId: node.id,
                nodeTitle: node.title || '',
                pdfPage: node.pdfPage,
                fieldType: 'transcript',
                text: node.transcript
              },
              textHash: md5(node.transcript)
            })
          }
          if (node.agentResult && node.agentResult.trim().length > 0 && node.agentResult.length <= MAX_CHARS) {
            const source = `${notebook.id}:${node.id}:agentResult`
            currentNodesInfo.push({
              source,
              node: {
                notebookId: notebook.id,
                notebookName: notebook.name,
                nodeId: node.id,
                nodeTitle: node.title || '',
                pdfPage: node.pdfPage,
                fieldType: 'agentResult',
                text: node.agentResult
              },
              textHash: md5(node.agentResult)
            })
          }
        }
      }

      // 让后端计算状态
      const statusResult = await window.electronAPI.getIndexStatusFull(
        currentNodesInfo.map(n => ({ source: n.source, textHash: n.textHash }))
      )

      if (!statusResult.success || statusResult.outdatedNodes === 0) {
        console.log('No changes to index')
        removeProgressListener()
        isIndexing.value = false
        return { indexedCount: 0 }
      }

      const indexedHashes = statusResult.hashes || {}
      const indexedTextHashes = new Set(Object.values(indexedHashes))

      // 找出需要更新的节点
      const nodesToUpdate: NotebookNodeData[] = []
      const sourcesToDelete: string[] = []

      // 检查新增或修改的节点
      for (const item of currentNodesInfo) {
        if (indexedHashes[item.source]) {
          // source 已索引，检查 hash 是否变化
          if (indexedHashes[item.source] !== item.textHash) {
            // 内容变化，需要先删除旧的再添加新的
            sourcesToDelete.push(item.source)
            nodesToUpdate.push(item.node)
          }
        } else {
          // source 未索引，检查是否是重复内容
          if (!indexedTextHashes.has(item.textHash)) {
            // 新内容，需要索引
            nodesToUpdate.push(item.node)
          }
        }
      }

      // 检查已删除的节点（source 在 indexedHashes 中但不在当前）
      const currentSources = new Set(currentNodesInfo.map(n => n.source))
      for (const [indexedSource, indexedHash] of Object.entries(indexedHashes)) {
        if (!currentSources.has(indexedSource)) {
          // 检查这个内容是否还有其他节点在使用
          const stillExists = currentNodesInfo.some(n => n.textHash === indexedHash)
          if (!stillExists) {
            // 内容确实不存在了，需要删除
            sourcesToDelete.push(indexedSource)
          }
        }
      }

      console.log(`Incremental update: ${nodesToUpdate.length} to index, ${sourcesToDelete.length} to delete`)

      // 先删除需要删除的节点（包括变化内容的旧数据）
      if (sourcesToDelete.length > 0) {
        console.log('sourcesToDelete:', sourcesToDelete)
        const deleteResult = await window.electronAPI.deleteIndexedNodes(sourcesToDelete)
        console.log(`Delete result: ${deleteResult.deletedCount} deleted`)
      }

      // 索引变化的节点（基于 textHash 去重）
      const nodesByTextHash = new Map<string, NotebookNodeData>()
      for (const node of nodesToUpdate) {
        const textHash = md5(node.text)
        if (!nodesByTextHash.has(textHash)) {
          nodesByTextHash.set(textHash, node)
        }
      }

      if (nodesByTextHash.size > 0) {
        const uniqueNodes = Array.from(nodesByTextHash.values())
        console.log('uniqueNodes to index:', uniqueNodes.map(n => ({
          source: `${n.notebookId}:${n.nodeId}:${n.fieldType}`,
          textPreview: n.text.substring(0, 30)
        })))
        const result = await window.electronAPI.indexNodesIncremental(uniqueNodes)
        console.log('Electron API indexNodesIncremental result:', result)

        if (result.success) {
          const added = result.entriesAdded || 0
          entriesCount.value = added
          indexProgress.value = 100
          onProgress?.(100)

          const newStatus = await window.electronAPI.getVectorDbStatus()
          if (newStatus.success) {
            entriesCount.value = newStatus.status?.entriesCount || added
          }

          return { indexedCount: added }
        } else {
          console.error('Failed to index nodes:', result.error)
          return { indexedCount: 0 }
        }
      }

      return { indexedCount: 0 }
    } catch (error) {
      console.error('Error indexing notebooks:', error)
      return { indexedCount: 0 }
    } finally {
      removeProgressListener()
      isIndexing.value = false
    }
  }

  /**
   * 语义搜索
   */
  async function semanticSearch(query: string, topK = 20): Promise<SemanticSearchResult[]> {
    if (!isInitialized.value) {
      await initVectorDb()
    }

    try {
      const result = await window.electronAPI.semanticSearch(query, topK)

      if (!result.success || !result.results) {
        console.error('Search failed:', result.error)
        return []
      }

      // 获取笔记本数据以补全信息
      const notebookStore = useNotebookStore()

      return result.results.map(r => {
        const notebook = notebookStore.notebooks.find(n => n.id === r.metadata.notebookId)
        const node = notebook?.nodes?.find(n => n.id === r.metadata.nodeId)

        return {
          notebookId: r.metadata.notebookId,
          notebookName: r.metadata.notebookName,
          nodeId: r.metadata.nodeId,
          nodeTitle: r.metadata.nodeTitle,
          pdfPage: r.metadata.pdfPage,
          fieldType: r.metadata.fieldType,
          fullText: r.pageContent,
          similarity: r.score,
          metadata: {
            id: 0,
            notebookId: r.metadata.notebookId,
            nodeId: r.metadata.nodeId,
            fieldType: r.metadata.fieldType,
            textHash: r.metadata.textHash,
            updatedAt: Date.now()
          }
        }
      })
    } catch (error) {
      console.error('Semantic search error:', error)
      return []
    }
  }

  /**
   * 获取索引状态（由后端统一计算）
   */
  async function getIndexStatus(): Promise<IndexStatus> {
    const notebookStore = useNotebookStore()

    // 收集当前所有节点的 source 和 textHash（不去重）
    const currentNodes: Array<{ source: string; textHash: string }> = []
    const MAX_CHARS = 20000

    for (const notebook of notebookStore.notebooks) {
      if (!notebook.nodes) continue
      for (const node of notebook.nodes) {
        if (node.transcript && node.transcript.trim().length > 0 && node.transcript.length <= MAX_CHARS) {
          const source = `${notebook.id}:${node.id}:transcript`
          currentNodes.push({ source, textHash: md5(node.transcript) })
        }
        if (node.agentResult && node.agentResult.trim().length > 0 && node.agentResult.length <= MAX_CHARS) {
          const source = `${notebook.id}:${node.id}:agentResult`
          currentNodes.push({ source, textHash: md5(node.agentResult) })
        }
      }
    }

    // 让后端统一计算状态
    const result = await window.electronAPI.getIndexStatusFull(currentNodes)
    console.log('getIndexStatus - backend result:', result)

    if (!result.success) {
      // 计算去重后的数量
      const uniqueTextHashes = new Set(currentNodes.map(n => n.textHash))
      return {
        totalNodes: uniqueTextHashes.size,
        indexedNodes: 0,
        outdatedNodes: uniqueTextHashes.size,
        isIndexing: isIndexing.value,
        progress: indexProgress.value
      }
    }

    return {
      totalNodes: result.totalNodes,
      indexedNodes: result.indexedNodes,
      outdatedNodes: result.outdatedNodes,
      isIndexing: isIndexing.value,
      progress: indexProgress.value
    }
  }

  /**
   * 重置向量数据库
   */
  async function resetVectorDb(): Promise<boolean> {
    const result = await window.electronAPI.resetVectorDb()
    if (result.success) {
      isInitialized.value = false
      entriesCount.value = 0
    }
    return result.success
  }

  return {
    isInitialized,
    isIndexing,
    indexProgress,
    entriesCount,
    indexedCount,
    initVectorDb,
    indexAllNotebooks,
    semanticSearch,
    getIndexStatus,
    resetVectorDb
  }
})