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
  type: 'voice-note' | 'text-note'
  title?: string
  position: { x: number; y: number }
  audioPath?: string
  transcript: string | null
  transcriptStatus: 'pending' | 'processing' | 'done' | 'error'
  agentResult: string | null
  agentStatus: 'pending' | 'processing' | 'done' | 'error'
  selectedAsContext?: boolean
  isFavorite?: boolean
  createdAt: number
  duration?: number
  pdfPage?: number
  pdfPosition?: { x: number; y: number }
  highlightRect?: { x: number; y: number; width: number; height: number }
}