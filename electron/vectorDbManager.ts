import { RAGApplication, RAGApplicationBuilder } from '@llm-tools/embedjs'
import { LibSqlDb } from '@llm-tools/embedjs-libsql'
import { ExtractChunkData } from '@llm-tools/embedjs-interfaces'
import { OpenAICompatibleEmbeddings, EmbeddingConfig } from './embeddings/OpenAICompatibleEmbeddings.js'
import { NotebookLoader, NotebookNodeData } from './loaders/NotebookLoader.js'
import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'

/**
 * VectorDbManager
 * 管理 embedJs RAGApplication，使用 LibSQL (SQLite) 作为向量数据库
 */
export class VectorDbManager {
  private ragApp: RAGApplication | null = null
  private dbPath: string
  private dbFilePath: string
  private config: EmbeddingConfig | null = null
  private initialized: boolean = false
  private customDbPath: string | null = null  // 用户自定义路径

  constructor(userDataPath: string) {
    this.dbPath = path.join(userDataPath, 'vector-db')
    this.dbFilePath = path.join(this.dbPath, 'notebooks.db')
  }

  /**
   * 设置自定义的向量数据库路径
   */
  setCustomPath(customPath: string) {
    this.customDbPath = customPath
    this.dbPath = path.join(customPath, 'vector-db')
    this.dbFilePath = path.join(this.dbPath, 'notebooks.db')
  }

  /**
   * 初始化向量数据库
   */
  async init(config: EmbeddingConfig): Promise<{ dimension: number }> {
    this.config = config

    // 确保目录存在
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true })
    }

    this.ragApp = await new RAGApplicationBuilder()
      .setModel('NO_MODEL')  // 只使用 search，不需要 LLM
      .setEmbeddingModel(new OpenAICompatibleEmbeddings(config))
      .setVectorDatabase(new LibSqlDb({
        path: this.dbFilePath,
        tableName: 'notebook_vectors'
      }))
      .setEmbeddingRelevanceCutOff(0.1)
      .setSearchResultCount(50)
      .build()

    this.initialized = true

    return { dimension: config.dimensions }
  }

  /**
   * 索引笔记本节点
   */
  async indexNodes(nodes: NotebookNodeData[]): Promise<number> {
    if (!this.ragApp || !this.initialized) {
      throw new Error('VectorDb not initialized')
    }

    const loader = new NotebookLoader(nodes)
    const result = await this.ragApp.addLoader(loader)

    return result.entriesAdded
  }

  /**
   * 索引笔记本节点（指定 loaderId）
   * 注意：如果 loaderId 已存在，会先删除再添加，确保数据更新
   */
  async indexNodesWithLoaderId(nodes: NotebookNodeData[], loaderId: string): Promise<number> {
    if (!this.ragApp || !this.initialized) {
      throw new Error('VectorDb not initialized')
    }

    // 先尝试删除旧的 loader（如果存在），确保数据能被更新
    // embedJs 的 addLoader 会检查 loaderId 是否已存在，如果存在会跳过
    // 所以我们需要先删除，再添加
    try {
      await this.ragApp.deleteLoader(loaderId)
    } catch (e) {
      // loader 不存在，忽略错误
    }

    const loader = new NotebookLoader(nodes, loaderId)
    const result = await this.ragApp.addLoader(loader)

    return result.entriesAdded
  }

  /**
   * 索引单个节点（使用细粒度 loaderId 以支持删除）
   */
  async indexSingleNode(node: NotebookNodeData): Promise<number> {
    if (!this.ragApp || !this.initialized) {
      throw new Error('VectorDb not initialized')
    }

    // 使用 notebookId:nodeId:fieldType 作为 uniqueId，支持精确删除
    const uniqueId = `${node.notebookId}:${node.nodeId}:${node.fieldType}`
    const loader = new NotebookLoader([node], uniqueId)

    const result = await this.ragApp.addLoader(loader)
    return result.entriesAdded
  }

  /**
   * 语义搜索
   */
  async search(query: string, topK: number = 20): Promise<ExtractChunkData[]> {
    if (!this.ragApp || !this.initialized) {
      throw new Error('VectorDb not initialized')
    }

    const results = await this.ragApp.search(query)

    // 限制返回数量
    return results.slice(0, topK)
  }

  /**
   * 获取向量数量
   */
  async getEmbeddingsCount(): Promise<number> {
    if (!this.ragApp || !this.initialized) {
      return 0
    }
    return this.ragApp.getEmbeddingsCount()
  }

  /**
   * 重置数据库
   */
  async reset(): Promise<void> {
    if (!this.ragApp || !this.initialized) {
      return
    }
    await this.ragApp.reset()
  }

  /**
   * 删除指定 loader 的数据
   */
  async deleteByLoaderId(loaderId: string): Promise<boolean> {
    if (!this.ragApp || !this.initialized) {
      return false
    }

    try {
      const result = await this.ragApp.deleteLoader(loaderId)
      return result
    } catch (error) {
      return false
    }
  }

  /**
   * 获取已加载的 loaders 列表
   */
  async getLoaders(): Promise<Array<{ uniqueId: string; type: string; chunksProcessed: number }>> {
    if (!this.ragApp || !this.initialized) {
      return []
    }

    const loaders = await this.ragApp.getLoaders()
    return loaders.map(l => ({
      uniqueId: l.uniqueId,
      type: l.type,
      chunksProcessed: l.chunksProcessed
    }))
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * 获取数据库文件路径（用于检查是否已有数据）
   */
  getDbFilePath(): string {
    return this.dbFilePath
  }

  /**
   * 检查数据库文件是否存在
   */
  hasExistingData(): boolean {
    return fs.existsSync(this.dbFilePath)
  }

  /**
   * 删除指定 source 的数据（用于增量更新）
   * 注意：source 格式为 notebookId:nodeId:fieldType
   * 这正是我们使用的 loaderId 格式
   */
  async deleteBySource(source: string): Promise<boolean> {
    if (!this.ragApp || !this.initialized) {
      return false
    }

    try {
      // source 就是 loaderId，直接调用 deleteLoader
      const result = await this.ragApp.deleteLoader(source)
      return result
    } catch (error) {
      console.error(`Failed to delete by source ${source}:`, error)
      return false
    }
  }

  /**
   * 获取所有已索引数据的 source 和 textHash
   * 直接查询 LibSQL 数据库
   */
  async getAllIndexedHashes(): Promise<Map<string, string>> {
    if (!fs.existsSync(this.dbFilePath)) {
      return new Map()
    }

    try {
      const dbUrl = `file:${this.dbFilePath.replace(/\\/g, '/')}`
      
      const client = createClient({
        url: dbUrl
      })

      const allResult = await client.execute(
        `SELECT source, metadata FROM notebook_vectors`
      )

      const hashes = new Map<string, string>()

      for (const row of allResult.rows) {
        const source = row.source?.toString() || ''
        const metadataStr = row.metadata?.toString() || ''
        try {
          const metadata = JSON.parse(metadataStr)
          const textHash = metadata.textHash
          if (source && textHash) {
            hashes.set(source, textHash)
          }
        } catch (e) {
          console.warn(`getAllIndexedHashes: failed to parse metadata for ${source}`)
        }
      }

      return hashes
    } catch (error) {
      console.error('Failed to get indexed hashes:', error)
      return new Map()
    }
  }
}