import type { NotebookContext } from './context'

export interface Notebook {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** 笔记本下的所有节点 */
  nodes?: CanvasNode[]
  /** 笔记本级视口状态 */
  viewport?: Viewport
  context?: NotebookContext
  pdfPath?: string
  /** 笔记本使用的模型配置ID，如果未设置则使用全局默认 */
  modelId?: string
  /** PDF笔记本上次查看的页码（从1开始），用于恢复阅读位置 */
  lastPdfPage?: number
  /** 是否为回收站笔记本，回收站不参与普通笔记本列表遍历 */
  isTrash?: boolean
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
  updatedAt?: number  // 更新时间，用于排序
  duration?: number
  pdfPage?: number
  pdfPosition?: { x: number; y: number }
  highlightRect?: { x: number; y: number; width: number; height: number }
  /** 印象笔记节点ID，用于跳转到印象笔记 */
  ever_id?: string
  /** 来源笔记本ID，仅当节点在回收站时有效，用于恢复到原笔记本 */
  sourceNotebookId?: string
}

/** 画布显示节点，包含动态计算的位置 */
export interface DisplayNode extends CanvasNode {
  displayPosition: { x: number; y: number }
}

/** 回收站笔记本元数据 */
export interface TrashNotebook {
  originalId: string  // 原笔记本ID
  name: string
  deletedAt: number   // 删除时间
  createdAt: number
  updatedAt: number
  pdfPath?: string    // PDF路径（如果有）
  nodeCount: number   // 笔记数量
}