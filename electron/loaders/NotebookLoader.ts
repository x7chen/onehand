import { BaseLoader } from '@llm-tools/embedjs-interfaces'
import md5 from 'md5'

/**
 * NotebookNodeData - 笔记本节点数据结构
 * 用于传递给 VectorDbManager 进行索引
 */
export interface NotebookNodeData {
  notebookId: string
  notebookName: string
  nodeId: string
  nodeTitle: string
  pdfPage?: number
  fieldType: 'transcript' | 'agentResult'
  text: string
}

/**
 * NotebookLoader
 * 将笔记本节点数据转换为 embedJs 可处理的 chunks
 */
export class NotebookLoader extends BaseLoader<{
  type: 'NotebookLoader'
  notebookId: string
  notebookName: string
  nodeId: string
  nodeTitle: string
  pdfPage?: number
  fieldType: 'transcript' | 'agentResult'
  textHash: string
}> {
  private nodes: NotebookNodeData[]

  constructor(nodes: NotebookNodeData[], uniqueId?: string) {
    // 使用固定的 uniqueId 以支持增量更新
    // 默认使用 'NotebookLoader' 作为全局 loader ID
    // 这样可以跟踪已处理的节点
    const loaderId = uniqueId || 'NotebookLoader'

    super(
      loaderId,
      { type: 'NotebookLoader', nodeCount: nodes.length },
      100000,  // chunkSize - 设置足够大，避免 embedJs 二次分割
      0     // chunkOverlap
    )
    this.nodes = nodes
  }

  override async *getUnfilteredChunks() {
    let skippedEmpty = 0
    let skippedTooLong = 0

    for (const node of this.nodes) {
      if (!node.text || node.text.trim().length === 0) {
        skippedEmpty++
        continue
      }

      const MAX_CHARS = 20000
      if (node.text.length > MAX_CHARS) {
        skippedTooLong++
        continue
      }

      yield {
        pageContent: node.text,
        metadata: {
          type: 'NotebookLoader' as const,
          source: `${node.notebookId}:${node.nodeId}:${node.fieldType}`,
          notebookId: node.notebookId,
          notebookName: node.notebookName,
          nodeId: node.nodeId,
          nodeTitle: node.nodeTitle,
          pdfPage: node.pdfPage,
          fieldType: node.fieldType,
          textHash: md5(node.text)
        }
      }
    }

    if (skippedEmpty > 0 || skippedTooLong > 0) {
      console.log(`NotebookLoader: skippedEmpty=${skippedEmpty}, skippedTooLong=${skippedTooLong}`)
    }
  }
}