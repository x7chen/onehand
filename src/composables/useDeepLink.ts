import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import type { CanvasNode, CanvasPage, Project } from '@/types/project'

export interface DeepLinkData {
  projectId: string
  canvasId: string
  nodeId: string
}

export interface NodePopupData {
  project: Project
  canvas: CanvasPage
  node: CanvasNode
}

/**
 * Parse onehand:// URL
 * Format: onehand://project_id/canvas_id/node_id
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
      projectId: parts[0],
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
export function generateDeepLinkUrl(projectId: string, canvasId: string, nodeId: string): string {
  return `onehand://${projectId}/${canvasId}/${nodeId}`
}

/**
 * Find a node by deep link data
 */
export async function findNodeByDeepLink(data: DeepLinkData): Promise<NodePopupData | null> {
  const projectStore = useProjectStore()

  // Load projects if not loaded
  if (projectStore.projects.length === 0) {
    await projectStore.loadProjects()
  }

  // Find the project
  const project = projectStore.projects.find(p => p.id === data.projectId)
  if (!project) {
    console.warn('Project not found:', data.projectId)
    return null
  }

  // Find the canvas
  const canvas = project.canvases?.find(c => c.id === data.canvasId)
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

  return { project, canvas, node }
}

/**
 * Composable for handling deep links
 */
export function useDeepLink() {
  const router = useRouter()
  const projectStore = useProjectStore()
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
      error.value = '找不到链接指向的节点，可能已被删除'
      return
    }

    // Set the project as current
    projectStore.setCurrentProject(nodeData.project)

    // For PDF projects, switch to the correct PDF page
    if (nodeData.project.pdfPath && nodeData.canvas.pdfPage) {
      projectStore.switchToPdfPage(nodeData.canvas.pdfPage)
    } else {
      // For non-PDF projects, find the canvas index by ID
      const canvasIndex = nodeData.project.canvases?.findIndex(c => c.id === data.canvasId) ?? 0
      if (canvasIndex >= 0 && nodeData.project.currentCanvasIndex !== canvasIndex) {
        nodeData.project.currentCanvasIndex = canvasIndex
      }
    }

    // Navigate to the correct view based on project type
    if (nodeData.project.pdfPath) {
      // PDF project - navigate to PdfReaderView
      router.push(`/pdf/${data.projectId}`)
    } else {
      // Normal project - navigate to NodeListView
      router.push(`/node-list/${data.projectId}`)
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