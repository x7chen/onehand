import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotebookStore } from '@/stores/notebookStore'
import type { CanvasNode, CanvasPage, Notebook } from '@/types/notebook'

export interface DeepLinkData {
  notebookId: string
  canvasId: string
  nodeId: string
}

export interface NodePopupData {
  notebook: Notebook
  canvas: CanvasPage
  node: CanvasNode
}

/**
 * Parse onehand:// URL
 * Format: onehand://notebook_id/canvas_id/node_id
 */
export function parseDeepLinkUrl(url: string): DeepLinkData | null {
  if (!url || !url.startsWith('onehand://')) {
    return null
  }

  try {
    // Remove the protocol prefix
    const path = url.replace('onehand://', '')
    const parts = path.split('/').filter(p => p) // Remove empty parts

    if (parts.length < 3) {
      console.warn('Invalid deep link URL format:', url)
      return null
    }

    return {
      notebookId: parts[0],
      canvasId: parts[1],
      nodeId: parts[2]
    }
  } catch (error) {
    console.error('Failed to parse deep link URL:', error)
    return null
  }
}

/**
 * Generate a deep link URL for a node
 */
export function generateDeepLinkUrl(notebookId: string, canvasId: string, nodeId: string): string {
  return `onehand://${notebookId}/${canvasId}/${nodeId}`
}

/**
 * Find a node by deep link data
 */
export async function findNodeByDeepLink(data: DeepLinkData): Promise<NodePopupData | null> {
  const notebookStore = useNotebookStore()

  // Load notebooks if not loaded
  if (notebookStore.notebooks.length === 0) {
    await notebookStore.loadNotebooks()
  }

  // Find the notebook
  const notebook = notebookStore.notebooks.find(p => p.id === data.notebookId)
  if (!notebook) {
    console.warn('Notebook not found:', data.notebookId)
    return null
  }

  // Find the canvas
  const canvas = notebook.canvases?.find(c => c.id === data.canvasId)
  if (!canvas) {
    console.warn('Canvas not found:', data.canvasId)
    return null
  }

  // Find the node
  const node = canvas.nodes.find(n => n.id === data.nodeId)
  if (!node) {
    console.warn('Node not found:', data.nodeId)
    return null
  }

  return { notebook, canvas, node }
}

/**
 * Composable for handling deep links
 */
export function useDeepLink() {
  const router = useRouter()
  const notebookStore = useNotebookStore()
  const deepLinkUrl = ref<string | null>(null)
  const error = ref<string | null>(null)

  // Handle incoming deep link
  async function handleDeepLink(url: string): Promise<void> {
    console.log('Handling deep link:', url)
    deepLinkUrl.value = url
    error.value = null

    const data = parseDeepLinkUrl(url)
    if (!data) {
      error.value = '无效的链接格式'
      return
    }

    const nodeData = await findNodeByDeepLink(data)
    if (!nodeData) {
      error.value = '找不到链接指向的笔记，可能已被删除'
      return
    }

    // Set the notebook as current
    notebookStore.setCurrentNotebook(nodeData.notebook)

    // For PDF notebooks, switch to the correct PDF page
    if (nodeData.notebook.pdfPath && nodeData.canvas.pdfPage) {
      notebookStore.switchToPdfPage(nodeData.canvas.pdfPage)
      // PDF notebook - navigate to PdfReaderView with nodeId query
      router.push(`/pdf/${data.notebookId}?nodeId=${data.nodeId}`)
    } else {
      // For non-PDF notebooks, find the canvas index by ID and switch
      const canvasIndex = nodeData.notebook.canvases?.findIndex(c => c.id === data.canvasId) ?? 0
      if (canvasIndex >= 0) {
        nodeData.notebook.currentCanvasIndex = canvasIndex
      }
      // Normal notebook - navigate to NodeListView with canvasId and nodeId query
      router.push(`/node-list/${data.notebookId}?canvasId=${data.canvasId}&nodeId=${data.nodeId}`)
    }
  }

  // Set up listeners
  onMounted(async () => {
    // Check for pending deep link
    if (window.electronAPI?.getDeepLink) {
      const url = await window.electronAPI.getDeepLink()
      if (url) {
        handleDeepLink(url)
      }
    }

    // Listen for deep link events
    if (window.electronAPI?.onDeepLink) {
      window.electronAPI.onDeepLink((url: string) => {
        handleDeepLink(url)
      })
    }
  })

  // Clean up listeners
  onUnmounted(() => {
    if (window.electronAPI?.removeDeepLinkListener) {
      window.electronAPI.removeDeepLinkListener()
    }
  })

  return {
    deepLinkUrl,
    error,
    handleDeepLink,
    parseDeepLinkUrl,
    generateDeepLinkUrl,
    findNodeByDeepLink
  }
}