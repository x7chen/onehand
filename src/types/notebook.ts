import type { NotebookContext } from './context'

export interface Notebook {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** 笔记本下的所有节点（扁平化存储，节点通过 canvasId 属性指向所属画布） */
  nodes?: CanvasNode[]
  /** 画布元信息（不含节点） */
  canvases?: CanvasInfo[]
  /** 当前画布 ID */
  currentCanvasId?: string
  /** @deprecated 使用 currentCanvasId 替代 */
  currentCanvasIndex?: number
  context?: NotebookContext
  pdfPath?: string
  /** 笔记本使用的模型配置ID，如果未设置则使用全局默认 */
  modelId?: string
  /** PDF笔记本上次查看的页码（从1开始），用于恢复阅读位置 */
  lastPdfPage?: number
}

/** 画布元信息（不含节点） */
export interface CanvasInfo {
  id: string
  type: 'infinite' | 'pdf'
  viewport: Viewport
  createdAt: number
  pdfPage?: number
}

/** @deprecated 使用 CanvasInfo 替代，保留用于数据迁移兼容 */
export interface CanvasPage extends CanvasInfo {
  /** @deprecated 节点已移至 Notebook.nodes */
  nodes?: CanvasNode[]
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasNode {
  id: string
  type: 'voice-note' | 'text-note' | 'image-note'
  title?: string
  position: { x: number; y: number }
  width?: number  // 节点宽度，默认为 CSS 变量 --node-width
  /** 所属画布 ID */
  canvasId?: string
  audioPath?: string
  imagePath?: string
  imageBase64?: string  // 图片节点的base64编码，用于AI上下文
  embeddedImages?: string[]  // 文本节点中内嵌图片的base64编码数组
  transcript: string | null
  transcriptStatus: 'pending' | 'processing' | 'done' | 'error'
  agentResult: string | null
  agentStatus: 'pending' | 'processing' | 'done' | 'error'
  thinkingContent?: string  // 思考过程内容
  thinkingStatus?: 'pending' | 'processing' | 'done'  // 思考状态
  selectedAsContext?: boolean
  isFavorite?: boolean
  tags?: string[]  // 节点标签列表
  createdAt: number
  duration?: number
  pdfPage?: number
  pdfPosition?: { x: number; y: number }
  highlightRect?: { x: number; y: number; width: number; height: number }
}