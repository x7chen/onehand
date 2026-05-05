import { RAGApplication, RAGApplicationBuilder } from '@llm-tools/embedjs'
import { LibSqlDb } from '@llm-tools/embedjs-libsql'
import { ExtractChunkData } from '@llm-tools/embedjs-interfaces'
import { OpenAICompatibleEmbeddings, EmbeddingConfig } from './embeddings/OpenAICompatibleEmbeddings.js'
import { NotebookLoader, NotebookNodeData } from './loaders/NotebookLoader.js'
import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'
import md5 from 'md5'

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
   * 直接调用 LibSQL 插入，绕过 embedJs 的 addLoader（避免其内部逻辑问题）
   */
  async indexNodesWithLoaderId(nodes: NotebookNodeData[], loaderId: string): Promise<number> {
    if (!this.config || !this.initialized) {
      throw new Error('VectorDb not initialized')
    }

    if (!fs.existsSync(this.dbFilePath)) {
      return 0
    }

    const dbUrl = `file:${this.dbFilePath.replace(/\\/g, '/')}`
    const client = createClient({ url: dbUrl })
    const embeddings = new OpenAICompatibleEmbeddings(this.config)

    let totalInserted = 0

    for (const node of nodes) {
      // 检查 pageContent 是否已存在（避免重复）
      const contentCheck = await client.execute(
        `SELECT id FROM notebook_vectors WHERE pageContent = ?`,
        [node.text]
      )

      if (contentCheck.rows.length > 0) {
        continue
      }

      // 获取嵌入向量
      const embedding = await embeddings.embedQuery(node.text)

      // 生成 chunk id
      const chunkId = `${loaderId}_${totalInserted}`
      const source = `${node.notebookId}:${node.nodeId}:${node.fieldType}`
      const textHash = md5(node.text)

      // 直接插入
      await client.execute({
        sql: `INSERT INTO notebook_vectors (id, pageContent, uniqueLoaderId, source, vector, metadata)
              VALUES (?, ?, ?, ?, vector32(?), ?)`,
        args: [
          chunkId,
          node.text,
          loaderId,
          source,
          `[${embedding.join(',')}]`,
          JSON.stringify({
            type: 'NotebookLoader',
            notebookId: node.notebookId,
            notebookName: node.notebookName,
            nodeId: node.nodeId,
            nodeTitle: node.nodeTitle,
            pdfPage: node.pdfPage,
            fieldType: node.fieldType,
            textHash: textHash
          })
        ]
      })

      totalInserted++
    }

    return totalInserted
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
   * 同时删除 uniqueLoaderId 和 source 字段匹配的数据
   * 使用参数化查询避免特殊字符导致的 SQL 错误
   */
  async deleteBySource(source: string): Promise<boolean> {
    if (!this.ragApp || !this.initialized) {
      return false
    }

    try {
      let deletedByLoader = false
      // 先尝试用 source 作为 uniqueLoaderId 删除
      // 注意：ragApp.deleteLoader 使用字符串拼接，可能有特殊字符问题
      // 所以我们主要依赖下面的参数化查询
      try {
        deletedByLoader = await this.ragApp.deleteLoader(source)
      } catch (e) {
        // loader 不存在或删除失败，继续用 SQL 删除
        console.warn(`deleteLoader failed for ${source}:`, e)
      }

      // 使用参数化查询直接删除数据库中的数据
      // 这是更可靠的方式，可以处理特殊字符
      if (fs.existsSync(this.dbFilePath)) {
        const dbUrl = `file:${this.dbFilePath.replace(/\\/g, '/')}`
        const client = createClient({ url: dbUrl })

        // 删除 uniqueLoaderId 或 source 列匹配的数据
        const result = await client.execute(
          `DELETE FROM notebook_vectors WHERE uniqueLoaderId = ? OR source = ?`,
          [source, source]
        )
        console.log(`deleteBySource(${source}): rowsAffected=${result.rowsAffected}, deletedByLoader=${deletedByLoader}`)
        return result.rowsAffected > 0 || deletedByLoader
      }

      return deletedByLoader
    } catch (error) {
      console.error(`Failed to delete by source ${source}:`, error)
      return false
    }
  }

  /**
   * 删除基于 textHash 的数据（用于删除共享内容）
   */
  async deleteByTextHash(textHash: string): Promise<number> {
    if (!this.ragApp || !this.initialized) {
      return 0
    }

    try {
      if (fs.existsSync(this.dbFilePath)) {
        const dbUrl = `file:${this.dbFilePath.replace(/\\/g, '/')}`
        const client = createClient({ url: dbUrl })

        const result = await client.execute(
          `DELETE FROM notebook_vectors WHERE json_extract(metadata, '$.textHash') = ?`,
          [textHash]
        )
        console.log(`deleteByTextHash(${textHash.substring(0, 8)}): rowsAffected=${result.rowsAffected}`)
        return result.rowsAffected
      }
      return 0
    } catch (error) {
      console.error(`Failed to delete by textHash ${textHash}:`, error)
      return 0
    }
  }

  /**
   * 获取所有已索引数据的 uniqueLoaderId 和 textHash
   * 直接查询 LibSQL 数据库
   * 使用 uniqueLoaderId 作为 key，与 deleteBySource 保持一致
   */
  async getAllIndexedHashes(): Promise<Map<string, string>> {
    if (!fs.existsSync(this.dbFilePath)) {
      return new Map()
    }

    try {
      const dbUrl = `file:${this.dbFilePath.replace(/\\/g, '/')}`
      const client = createClient({ url: dbUrl })

      const allResult = await client.execute(
        `SELECT uniqueLoaderId, metadata FROM notebook_vectors`
      )

      const hashes = new Map<string, string>()

      for (const row of allResult.rows) {
        const uniqueLoaderId = row.uniqueLoaderId?.toString() || ''
        const metadataStr = row.metadata?.toString() || ''
        try {
          const metadata = JSON.parse(metadataStr)
          const textHash = metadata.textHash
          if (uniqueLoaderId && textHash) {
            hashes.set(uniqueLoaderId, textHash)
          }
        } catch (e) {
          // metadata 解析失败，忽略
        }
      }

      return hashes
    } catch (error) {
      console.error('Failed to get indexed hashes:', error)
      return new Map()
    }
  }
}