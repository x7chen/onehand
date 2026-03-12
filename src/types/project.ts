import type { ProjectContext } from './context'

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** @deprecated 使用 canvases 数组替代 */
  canvas?: Canvas
  canvases?: CanvasPage[]
  currentCanvasIndex?: number
  context?: ProjectContext
}

export interface CanvasPage {
  id: string
  type: 'infinite' | 'pdf'
  viewport: Viewport
  nodes: CanvasNode[]
  createdAt: number
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
  type: 'voice-note' | 'text-note' // Added text-note type
  position: { x: number; y: number }
  audioPath?: string // Optional for text-note
  transcript: string | null
  transcriptStatus: 'pending' | 'processing' | 'done' | 'error'
  agentResult: string | null
  agentStatus: 'pending' | 'processing' | 'done' | 'error'
  selectedAsContext?: boolean
  isFavorite?: boolean // 收藏状态
  createdAt: number
  duration?: number // Recording duration in milliseconds
}
