import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotebookStore } from '@/stores/notebookStore'
import type { CanvasNode, Notebook, DisplayNode } from '@/types/notebook'

export interface DeepLinkData {
  notebookId: string
  nodeId: string
}

export interface NodePopupData {
  notebook: Notebook
  node: DisplayNode
}

/**
 * Parse onehand:// URL
 * New format: onehand://node_uuid
 */
export function parseDeepLinkUrl(url: string): string | null {
  if (!url || !url.startsWith('onehand://')) {
    return null
  }

  const nodeId = url.replace('onehand://', '')
  if (!nodeId) {
    console.warn('Invalid deep link URL format:', url)
    return null
  }

  return nodeId
}

/**
 * Generate a deep link URL for a node
 * New format: onehand://node_uuid
 */
export function generateDeepLinkUrl(nodeId: string): string {
  return `onehand://${nodeId}`
}

/**
 * Find a node by its ID across all notebooks
 */
export async function findNodeByNodeId(nodeId: string): Promise<NodePopupData | null> {
  const notebookStore = useNotebookStore()

  // Load notebooks if not loaded
  if (notebookStore.notebooks.length === 0) {
    await notebookStore.loadNotebooks()
  }

  // Search through all notebooks
  for (const notebook of notebookStore.notebooks) {
    if (!notebook.nodes) continue

    const node = notebook.nodes.find(n => n.id === nodeId)
    if (node) {
      return {
        notebook,
        node: {
          ...node,
          displayPosition: { x: 100, y: 100 }
        }
      }
    }
  }

  console.warn('Node not found:', nodeId)
  return null
}

/**
 * Alias for findNodeByNodeId (for backward compatibility)
 */
export async function findNodeByDeepLink(data: DeepLinkData): Promise<NodePopupData | null> {
  return findNodeByNodeId(data.nodeId)
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

    const nodeId = parseDeepLinkUrl(url)
    if (!nodeId) {
      error.value = '无效的链接格式'
      return
    }

    const nodeData = await findNodeByNodeId(nodeId)
    if (!nodeData) {
      error.value = '找不到链接指向的笔记，可能已被删除'
      return
    }

    // Set the notebook as current
    notebookStore.setCurrentNotebook(nodeData.notebook)

    // Navigate to the appropriate view
    if (nodeData.notebook.pdfPath) {
      // PDF notebook - navigate to PdfReaderView with nodeId query
      router.push(`/pdf/${nodeData.notebook.id}?nodeId=${nodeId}`)
    } else {
      // Normal notebook - navigate to multi-chat with nodeId query
      router.push(`/multi-chat/${nodeData.notebook.id}?nodeId=${nodeId}`)
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
    findNodeByNodeId,
    findNodeByDeepLink
  }
}