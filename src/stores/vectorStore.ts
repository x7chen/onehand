/**
 * Vector Store
 * 管理向量数据库状态，提供索引更新和搜索功能
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { VectorMetadataEntry, VectorDbMetadata, SemanticSearchResult, IndexStatus, NodeIndexData, SkippedIndexNode } from '@/types/embedding'
import type { CanvasNode } from '@/types/notebook'
import { useNotebookStore } from './notebookStore'
import { useSettingsStore } from './settingsStore'
import { generateEmbedding, textHash, cosineSimilarity, normalizeVector } from '@/composables/useEmbedding'

const DEFAULT_MAX_ELEMENTS = 100000

export const useVectorStore = defineStore('vector', () => {
  // 状态
  const isInitialized = ref(false)
  const isIndexing = ref(false)
  const metadata = ref<VectorDbMetadata | null>(null)
  const indexProgress = ref(0)

  // 计算属性
  const entriesCount = computed(() => {
    return metadata.value ? Object.keys(metadata.value.entries).length : 0
  })

  /**
   * 初始化向量数据库
   */
  async function initVectorDb(): Promise<boolean> {
    try {
      const settingsStore = useSettingsStore()
      const dimension = settingsStore.settings.llm.embeddingDimension || 1536

      // 先检查状态
      const statusResult = await window.electronAPI.getVectorDbStatus()
      console.log('Vector DB status before init:', statusResult)

      if (statusResult.success && statusResult.status?.initialized) {
        // 检查维度和最大元素数是否匹配
        const existingDimension = statusResult.status.dimension
        const existingMaxElements = statusResult.status.maxElements
        if (existingDimension !== dimension || existingMaxElements < DEFAULT_MAX_ELEMENTS) {
          console.log(`Config mismatch: DB has dimension=${existingDimension}, maxElements=${existingMaxElements}. Config has dimension=${dimension}. Need to rebuild index.`)
          // 参数变更需要重新初始化
          const initResult = await window.electronAPI.initVectorDb(dimension, DEFAULT_MAX_ELEMENTS)
          if (initResult.success) {
            isInitialized.value = true
            metadata.value = null // 清空旧元数据
            return true
          }
        } else {
          console.log('Vector DB already initialized with correct config')
          isInitialized.value = true
          const metadataResult = await window.electronAPI.getVectorDbMetadata()
          if (metadataResult.success) {
            metadata.value = metadataResult.metadata
          }
          return true
        }
      }

      // 尝试加载已有的数据库
      const loadResult = await window.electronAPI.loadVectorDb()
      console.log('loadVectorDb result:', loadResult)
      if (loadResult.success) {
        // 检查加载的参数是否与配置匹配
        const loadedMetadata = await window.electronAPI.getVectorDbMetadata()
        if (loadedMetadata.success && loadedMetadata.metadata) {
          const loadedDimension = loadedMetadata.metadata.dimension
          const loadedMaxElements = loadedMetadata.metadata.maxElements
          if (loadedDimension !== dimension || loadedMaxElements < DEFAULT_MAX_ELEMENTS) {
            console.log(`Loaded DB config mismatch: dimension=${loadedDimension}, maxElements=${loadedMaxElements}. Reinitializing...`)
            const initResult = await window.electronAPI.initVectorDb(dimension, DEFAULT_MAX_ELEMENTS)
            if (initResult.success) {
              isInitialized.value = true
              metadata.value = null
              return true
            }
          } else {
            isInitialized.value = true
            metadata.value = loadedMetadata.metadata
            console.log('Vector DB loaded:', loadResult.entriesCount, 'entries')
            return true
          }
        }
      }

      // 创建新的数据库
      const initResult = await window.electronAPI.initVectorDb(dimension, DEFAULT_MAX_ELEMENTS)
      console.log('initVectorDb result:', initResult)
      if (initResult.success) {
        isInitialized.value = true
        const statusResult = await window.electronAPI.getVectorDbMetadata()
        if (statusResult.success) {
          metadata.value = statusResult.metadata
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
   * 获取条目键
   */
  function getEntryKey(notebookId: string, nodeId: string, fieldType: 'transcript' | 'agentResult'): string {
    return `${notebookId}:${nodeId}:${fieldType}`
  }

  /**
   * 检查节点是否需要索引
   */
  function needsIndexing(notebookId: string, nodeId: string, fieldType: 'transcript' | 'agentResult', text: string): boolean {
    if (!metadata.value) {
      console.log(`needsIndexing: no metadata, needs index for ${notebookId}:${nodeId}:${fieldType}`)
      return true
    }

    const key = getEntryKey(notebookId, nodeId, fieldType)
    const entry = metadata.value.entries[key]

    if (!entry) {
      console.log(`needsIndexing: no entry for ${key}, needs index`)
      return true
    }

    const currentHash = textHash(text)
    const needsUpdate = currentHash !== entry.textHash
    if (needsUpdate) {
      console.log(`needsIndexing: hash mismatch for ${key}, current=${currentHash}, stored=${entry.textHash}`)
    }
    return needsUpdate
  }

  /**
   * 索引单个节点字段
   * 返回 { success: boolean, skipped?: SkippedIndexNode }
   */
  async function indexNodeField(
    notebookId: string,
    notebookName: string,
    canvasId: string,
    canvasName: string,
    node: CanvasNode,
    fieldType: 'transcript' | 'agentResult'
  ): Promise<{ success: boolean; skipped?: SkippedIndexNode }> {
    const text = fieldType === 'transcript' ? node.transcript : node.agentResult
    if (!text || text.trim().length === 0) {
      return { success: false }
    }

    // 检查文本长度，超出 token 限制则跳过
    // 大多数嵌入模型限制 8192 tokens，约等于 ~20000 字符
    const MAX_CHARS = 20000
    if (text.length > MAX_CHARS) {
      console.log(`Skipping indexing for ${notebookId}:${node.id}:${fieldType}: text too long (${text.length} chars > ${MAX_CHARS})`)
      return {
        success: false,
        skipped: {
          notebookId,
          notebookName,
          canvasId,
          canvasName,
          nodeId: node.id,
          nodeTitle: node.title || '',
          fieldType,
          reason: `文本过长 (${text.length} 字符，超过 ${MAX_CHARS} 限制)`
        }
      }
    }

    const settingsStore = useSettingsStore()
    // 获取嵌入模型使用的 profile
    const embeddingProfileId = settingsStore.settings.llm.embeddingProfileId
    const profile = embeddingProfileId
      ? settingsStore.settings.llm.profiles.find(p => p.id === embeddingProfileId)
      : settingsStore.activeProfile
    if (!profile) {
      console.error('No embedding profile available')
      return { success: false }
    }

    try {
      // 生成 embedding，使用 profile 中的模型
      const embedding = await generateEmbedding(text, {
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: profile.model
      })

      // 规范化向量
      const normalizedVector = normalizeVector(embedding)

      // 添加到数据库
      const entryKey = getEntryKey(notebookId, node.id, fieldType)
      const result = await window.electronAPI.addVector(entryKey, normalizedVector, {
        notebookId,
        notebookName,
        canvasId,
        canvasName,
        nodeId: node.id,
        nodeTitle: node.title || '',
        fieldType,
        textHash: textHash(text)
      })

      console.log(`addVector result for ${entryKey}:`, result)

      if (result.success && result.id !== undefined) {
        // 更新本地元数据
        if (metadata.value) {
          metadata.value.entries[entryKey] = {
            id: result.id,
            notebookId,
            canvasId,
            nodeId: node.id,
            fieldType,
            textHash: textHash(text),
            updatedAt: Date.now()
          }
          console.log(`Metadata updated for ${entryKey}`)
        } else {
          console.warn('metadata.value is null, cannot update')
        }
        return { success: true }
      }

      console.warn(`addVector failed for ${entryKey}:`, result.error)
      return { success: false }
    } catch (error) {
      console.error('Error indexing node field:', error)
      return { success: false }
    }
  }

  /**
   * 批量索引所有笔记本
   * 返回 { indexedCount: number, skippedNodes: SkippedIndexNode[] }
   */
  async function indexAllNotebooks(onProgress?: (progress: number) => void): Promise<{ indexedCount: number; skippedNodes: SkippedIndexNode[] }> {
    if (isIndexing.value) {
      console.warn('Already indexing')
      return { indexedCount: 0, skippedNodes: [] }
    }

    isIndexing.value = true
    indexProgress.value = 0

    const notebookStore = useNotebookStore()
    const skippedNodes: SkippedIndexNode[] = []
    let indexedCount = 0
    let totalCount = 0

    // 计算总数
    for (const notebook of notebookStore.notebooks) {
      if (!notebook.canvases) continue
      for (const canvas of notebook.canvases) {
        for (const node of canvas.nodes) {
          if (node.transcript) totalCount++
          if (node.agentResult) totalCount++
        }
      }
    }

    // 索引每个节点
    for (const notebook of notebookStore.notebooks) {
      if (!notebook.canvases) continue

      const canvasName = notebook.canvases.length > 1 ? `第 ${(notebook.currentCanvasIndex ?? 0) + 1} 页` : '画布'

      for (const canvas of notebook.canvases) {
        for (const node of canvas.nodes) {
          // 索引 transcript
          if (node.transcript && needsIndexing(notebook.id, node.id, 'transcript', node.transcript)) {
            const result = await indexNodeField(
              notebook.id,
              notebook.name,
              canvas.id,
              canvasName,
              node,
              'transcript'
            )
            if (result.success) indexedCount++
            else if (result.skipped) skippedNodes.push(result.skipped)
          }

          // 索引 agentResult
          if (node.agentResult && needsIndexing(notebook.id, node.id, 'agentResult', node.agentResult)) {
            const result = await indexNodeField(
              notebook.id,
              notebook.name,
              canvas.id,
              canvasName,
              node,
              'agentResult'
            )
            if (result.success) indexedCount++
            else if (result.skipped) skippedNodes.push(result.skipped)
          }

          // 更新进度
          indexProgress.value = Math.round((indexedCount / totalCount) * 100)
          onProgress?.(indexProgress.value)
        }
      }
    }

    // 保存数据库
    await window.electronAPI.saveVectorDb()

    // 重新从主进程获取最新的 metadata
    const metadataResult = await window.electronAPI.getVectorDbMetadata()
    if (metadataResult.success && metadataResult.metadata) {
      metadata.value = metadataResult.metadata
    }

    isIndexing.value = false
    return { indexedCount, skippedNodes }
  }

  /**
   * 语义搜索
   */
  async function semanticSearch(query: string, topK = 20): Promise<SemanticSearchResult[]> {
    if (!isInitialized.value) {
      await initVectorDb()
    }

    const settingsStore = useSettingsStore()
    // 获取嵌入模型使用的 profile
    const embeddingProfileId = settingsStore.settings.llm.embeddingProfileId
    const profile = embeddingProfileId
      ? settingsStore.settings.llm.profiles.find(p => p.id === embeddingProfileId)
      : settingsStore.activeProfile
    if (!profile) {
      console.error('No embedding profile available')
      return []
    }

    try {
      // 生成查询 embedding，使用 profile 中的模型
      const queryEmbedding = await generateEmbedding(query, {
        baseUrl: profile.baseUrl,
        apiKey: profile.apiKey,
        model: profile.model
      })

      const normalizedQuery = normalizeVector(queryEmbedding)

      // 搜索向量数据库
      const searchResult = await window.electronAPI.searchVectors(normalizedQuery, topK)

      if (!searchResult.success || !searchResult.results) {
        console.error('Search failed:', searchResult.error)
        return []
      }

      // 获取完整的文本内容
      const notebookStore = useNotebookStore()
      const results: SemanticSearchResult[] = []

      for (const item of searchResult.results) {
        const notebook = notebookStore.notebooks.find(n => n.id === item.metadata.notebookId)
        if (!notebook) continue

        const canvas = notebook.canvases?.find(c => c.id === item.metadata.canvasId)
        if (!canvas) continue

        const node = canvas.nodes.find(n => n.id === item.metadata.nodeId)
        if (!node) continue

        const text = item.metadata.fieldType === 'transcript' ? node.transcript : node.agentResult
        if (!text) continue

        // 从元数据获取完整信息
        const entryKey = getEntryKey(item.metadata.notebookId, item.metadata.nodeId, item.metadata.fieldType)
        const fullMetadata = metadata.value?.entries[entryKey]

        results.push({
          notebookId: item.metadata.notebookId,
          notebookName: notebook.name,
          canvasId: item.metadata.canvasId,
          canvasName: canvas.pdfPage ? `第 ${canvas.pdfPage} 页` : '画布',
          nodeId: item.metadata.nodeId,
          nodeTitle: node.title || '',
          fieldType: item.metadata.fieldType,
          fullText: text,
          similarity: item.similarity,
          metadata: fullMetadata || {
            id: 0,
            notebookId: item.metadata.notebookId,
            canvasId: item.metadata.canvasId,
            nodeId: item.metadata.nodeId,
            fieldType: item.metadata.fieldType,
            textHash: '',
            updatedAt: Date.now()
          }
        })
      }

      return results
    } catch (error) {
      console.error('Semantic search error:', error)
      return []
    }
  }

  /**
   * 获取索引状态
   */
  async function getIndexStatus(): Promise<IndexStatus> {
    const notebookStore = useNotebookStore()

    // 确保使用最新的 metadata
    const metadataResult = await window.electronAPI.getVectorDbMetadata()
    if (metadataResult.success && metadataResult.metadata) {
      metadata.value = metadataResult.metadata
    }

    let totalNodes = 0
    let indexedNodes = 0
    let outdatedNodes = 0

    for (const notebook of notebookStore.notebooks) {
      if (!notebook.canvases) continue

      for (const canvas of notebook.canvases) {
        for (const node of canvas.nodes) {
          if (node.transcript) {
            totalNodes++
            if (!needsIndexing(notebook.id, node.id, 'transcript', node.transcript)) {
              indexedNodes++
            } else {
              outdatedNodes++
            }
          }
          if (node.agentResult) {
            totalNodes++
            if (!needsIndexing(notebook.id, node.id, 'agentResult', node.agentResult)) {
              indexedNodes++
            } else {
              outdatedNodes++
            }
          }
        }
      }
    }

    console.log(`Index status: total=${totalNodes}, indexed=${indexedNodes}, outdated=${outdatedNodes}`)

    return {
      totalNodes,
      indexedNodes,
      outdatedNodes,
      isIndexing: isIndexing.value,
      progress: indexProgress.value
    }
  }

  /**
   * 保存向量数据库
   */
  async function saveVectorDb(): Promise<boolean> {
    const result = await window.electronAPI.saveVectorDb()
    return result.success
  }

  return {
    isInitialized,
    isIndexing,
    metadata,
    indexProgress,
    entriesCount,
    initVectorDb,
    needsIndexing,
    indexNodeField,
    indexAllNotebooks,
    semanticSearch,
    getIndexStatus,
    saveVectorDb
  }
})