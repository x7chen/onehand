import type { NotebookContext } from './context'

export interface Notebook {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** @deprecated 使用 canvases 数组替代 */
  canvas?: Canvas
  canvases?: CanvasPage[]
  currentCanvasIndex?: number
  context?: NotebookContext
  pdfPath?: string
  /** 笔记本使用的模型配置ID，如果未设置则使用全局默认 */
  modelId?: string
}

export interface CanvasPage {
  id: string
  type: 'infinite' | 'pdf'
  viewport: Viewport
  nodes: CanvasNode[]
  createdAt: number
  pdfPage?: number
}

/** @deprecated 使用 CanvasPage 替代 */
export interface Canvas extends CanvasPage {}

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