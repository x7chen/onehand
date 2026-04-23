import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notebook, CanvasNode } from '@/types/notebook'
import type { NotebookContext } from '@/types/context'
import { getNotebooksDir, getNotebookFilePath, getPdfDir, getNotebookDataDir, getNotebookAudioDir, getNotebookImagesDir } from '@/utils/userFilesPath'

// 为节点设置默认的运行时状态
function ensureNodeRuntimeState(node: CanvasNode): CanvasNode {
  return {
    ...node,
    transcriptStatus: node.transcriptStatus || (node.transcript ? 'done' : 'pending'),
    agentStatus: node.agentStatus || (node.agentResult ? 'done' : 'pending')
  }
}

// 检查笔记本是否使用旧格式（节点在 canvas.nodes 中或使用 canvasId）
function isOldFormat(notebook: Notebook): boolean {
  const oldNotebook = notebook as any
  // 如果有 canvases 数组，是旧格式
  if (oldNotebook.canvases && oldNotebook.canvases.length > 0) {
    return true
  }
  // 如果节点有 canvasId，是旧格式
  if (notebook.nodes && notebook.nodes.some(n => (n as any).canvasId)) {
    return true
  }
  return false
}

// 迁移旧笔记本数据到新格式
function migrateNotebook(notebook: Notebook): { notebook: Notebook; needsSave: boolean } {
  let needsSave = false
  const oldNotebook = notebook as any

  // 检查是否是旧格式
  if (isOldFormat(notebook)) {
    // 提取视口（取第一个画布的视口）
    let viewport = { x: 0, y: 0, zoom: 1 }
    if (oldNotebook.canvases && oldNotebook.canvases.length > 0) {
      const firstCanvas = oldNotebook.canvases[0]
      if (firstCanvas.viewport) {
        viewport = firstCanvas.viewport
      }
    }

    // 移除节点中的 canvasId
    const nodes = notebook.nodes?.map(node => {
      const { canvasId, ...rest } = node as any
      return ensureNodeRuntimeState(rest)
    }) || []

    // 设置新格式
    notebook.nodes = nodes
    notebook.viewport = viewport

    // 移除旧属性
    delete oldNotebook.canvases
    delete oldNotebook.currentCanvasId
    delete oldNotebook.currentCanvasIndex

    needsSave = true
    console.log(`Migrated notebook "${notebook.name}" to new format: ${nodes.length} nodes`)
  } else {
    // 新格式，检查是否需要补充属性
    if (!notebook.nodes) {
      notebook.nodes = []
      needsSave = true
    }

    if (!notebook.viewport) {
      notebook.viewport = { x: 0, y: 0, zoom: 1 }
      needsSave = true
    }

    // 为节点设置运行时状态
    notebook.nodes = notebook.nodes.map(ensureNodeRuntimeState)

    // 清理遗留的旧格式属性
    if ((notebook as any).canvases) {
      delete (notebook as any).canvases
      needsSave = true
    }
    if ((notebook as any).currentCanvasId) {
      delete (notebook as any).currentCanvasId
      needsSave = true
    }
    if ((notebook as any).currentCanvasIndex) {
      delete (notebook as any).currentCanvasIndex
      needsSave = true
    }
    // 清理节点中的 canvasId
    if (notebook.nodes.some(n => (n as any).canvasId)) {
      notebook.nodes = notebook.nodes.map(node => {
        const { canvasId, ...rest } = node as any
        return rest
      })
      needsSave = true
    }
  }

  return { notebook, needsSave }
}

export const useNotebookStore = defineStore('notebook', () => {
  const notebooks = ref<Notebook[]>([])
  const currentNotebook = ref<Notebook | null>(null)

  // 节点 ID 到笔记本的映射缓存（用于批量操作时快速查找）
  let nodeToNotebookMap: Map<string, Notebook> | null = null

  // 获取节点到笔记本的映射（懒加载）
  function getNodeToNotebookMap(): Map<string, Notebook> {
    if (!nodeToNotebookMap) {
      nodeToNotebookMap = new Map()
      for (const notebook of notebooks.value) {
        for (const node of notebook.nodes || []) {
          nodeToNotebookMap.set(node.id, notebook)
        }
      }
    }
    return nodeToNotebookMap
  }

  // 清除映射缓存（当笔记本结构变化时调用）
  function clearNodeToNotebookMap() {
    nodeToNotebookMap = null
  }

  const notebookList = computed(() => notebooks.value)

  // 获取当前笔记本视口
  const viewport = computed(() => {
    return currentNotebook.value?.viewport || { x: 0, y: 0, zoom: 1 }
  })

  // 加载所有笔记本（扫描笔记本目录）
  async function loadNotebooks() {
    try {
      const notebooksDir = await getNotebooksDir()
      const dirExists = await window.electronAPI.exists(notebooksDir)

      if (!dirExists) {
        notebooks.value = []
        return
      }

      // 检查是否存在旧格式的 notebooks.json 文件
      const oldNotebooksFile = `${notebooksDir}/notebooks.json`
      const oldFileExists = await window.electronAPI.exists(oldNotebooksFile)

      if (oldFileExists) {
        // 迁移旧格式数据
        const oldResult = await window.electronAPI.readFile(oldNotebooksFile, 'utf-8')
        if (oldResult.success && oldResult.data && typeof oldResult.data === 'string') {
          try {
            const oldNotebooks = JSON.parse(oldResult.data) as Notebook[]
            // 将每个笔记本保存到独立文件
            for (const notebook of oldNotebooks) {
              const { notebook: migratedNotebook } = migrateNotebook(notebook)
              await saveNotebookFile(migratedNotebook)
            }
            // 删除旧文件
            await window.electronAPI.unlink(oldNotebooksFile)
            console.log(`Migrated ${oldNotebooks.length} notebooks from old format`)
          } catch (parseError) {
            console.error('Failed to parse old notebooks.json:', parseError)
          }
        }
      }

      const result = await window.electronAPI.readdir(notebooksDir)
      if (!result.success || !result.data) {
        notebooks.value = []
        return
      }

      // 过滤出 .json 文件并加载
      const jsonFiles = result.data.filter(f => f.endsWith('.json'))
      const loadedNotebooks: Notebook[] = []
      const notebooksToSave: Notebook[] = []

      for (const file of jsonFiles) {
        const filePath = `${notebooksDir}/${file}`
        const fileResult = await window.electronAPI.readFile(filePath, 'utf-8')

        if (fileResult.success && fileResult.data && typeof fileResult.data === 'string') {
          try {
            const notebook = JSON.parse(fileResult.data) as Notebook
            const { notebook: migratedNotebook, needsSave } = migrateNotebook(notebook)
            loadedNotebooks.push(migratedNotebook)
            if (needsSave) {
              notebooksToSave.push(migratedNotebook)
            }
          } catch (parseError) {
            console.error(`Failed to parse notebook file ${file}:`, parseError)
          }
        }
      }

      // 保存需要迁移的笔记本
      for (const notebook of notebooksToSave) {
        await saveNotebookFile(notebook)
      }

      // 按更新时间排序
      loadedNotebooks.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      notebooks.value = loadedNotebooks
      // 清除节点映射缓存，下次批量操作时会重建
      clearNodeToNotebookMap()
    } catch (error) {
      console.error('Failed to load notebooks:', error)
    }
  }

  // 创建新笔记本
  async function createNotebook(name: string, context?: NotebookContext, pdfPath?: string) {
    let finalPdfPath = pdfPath

    // 如果有PDF路径，复制PDF到用户数据目录
    if (pdfPath) {
      try {
        const pdfDir = await getPdfDir()

        // 确保pdf目录存在
        await window.electronAPI.mkdir(pdfDir)

        // 生成新文件名：使用时间戳避免冲突
        const pdfName = pdfPath.split(/[/\\]/).pop() || 'document.pdf'
        const ext = pdfName.includes('.') ? pdfName.split('.').pop() : 'pdf'
        const newPdfName = `${Date.now()}.${ext}`
        const newPdfPath = `${pdfDir}/${newPdfName}`

        // 复制PDF文件
        const result = await window.electronAPI.copyFile(pdfPath, newPdfPath)
        if (result.success) {
          finalPdfPath = newPdfPath
        } else {
          console.error('Failed to copy PDF:', result.error)
        }
      } catch (error) {
        console.error('Failed to copy PDF to user data directory:', error)
      }
    }

    const notebook: Notebook = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    if (context && (context.staticContextIds?.length || context.dynamicContextId)) {
      notebook.context = context
    }

    if (finalPdfPath) {
      notebook.pdfPath = finalPdfPath
    }

    // 保存到独立文件
    await saveNotebookFile(notebook)

    notebooks.value.push(notebook)
    return notebook
  }

  // 清理节点中的运行时状态字段（不保存到文件）
  function cleanNodeForSave(node: CanvasNode): Omit<CanvasNode, 'transcriptStatus' | 'agentStatus' | 'selectedAsContext' | 'imageBase64' | 'embeddedImages' | 'thinkingContent' | 'thinkingStatus'> {
    const { transcriptStatus, agentStatus, selectedAsContext, imageBase64, embeddedImages, thinkingContent, thinkingStatus, ...rest } = node
    return rest
  }

  // 判断节点是否为空白（转写文本和AI回答都为空）
  function isNodeEmpty(node: CanvasNode): boolean {
    const hasTranscript = node.transcript && node.transcript.trim() !== ''
    const hasAgentResult = node.agentResult && node.agentResult.trim() !== ''
    return !hasTranscript && !hasAgentResult
  }

  // 保存单个笔记本到独立文件
  async function saveNotebookFile(notebook: Notebook) {
    try {
      const filePath = await getNotebookFilePath(notebook.id)
      // 清理节点中的运行时状态字段，并过滤掉空白节点
      const notebookToSave = {
        ...notebook,
        nodes: notebook.nodes
          ?.filter(node => !isNodeEmpty(node))
          .map(cleanNodeForSave)
      }
      // 移除运行时属性和旧格式属性
      delete (notebookToSave as any).currentCanvasIndex
      delete (notebookToSave as any).canvases
      delete (notebookToSave as any).currentCanvasId

      await window.electronAPI.saveFile(filePath, JSON.stringify(notebookToSave, null, 2))
    } catch (error) {
      console.error('Failed to save notebook file:', error)
    }
  }

  // 保存笔记本（更新内存和文件）
  async function saveNotebook(notebook: Notebook) {
    notebook.updatedAt = Date.now()
    const index = notebooks.value.findIndex(n => n.id === notebook.id)
    if (index !== -1) {
      // 更新现有笔记本 - 使用 Object.assign 保持响应式
      Object.assign(notebooks.value[index], notebook)
      // 同步更新 currentNotebook
      if (currentNotebook.value && currentNotebook.value.id === notebook.id) {
        Object.assign(currentNotebook.value, notebook)
      }
    } else {
      notebooks.value.push(notebook)
    }
    // 保存到独立文件
    await saveNotebookFile(notebook)
  }

  // 删除笔记本
  async function deleteNotebook(notebookId: string) {
    try {
      // 删除笔记本文件
      const filePath = await getNotebookFilePath(notebookId)
      await window.electronAPI.unlink(filePath)
    } catch (error) {
      console.error('Failed to delete notebook file:', error)
    }

    // 从内存中移除
    notebooks.value = notebooks.value.filter(n => n.id !== notebookId)
  }

  function setCurrentNotebook(notebook: Notebook | null) {
    currentNotebook.value = notebook
  }

  // 获取当前视口
  function getCurrentViewport(): { x: number; y: number; zoom: number } {
    return currentNotebook.value?.viewport || { x: 0, y: 0, zoom: 1 }
  }

  // 更新当前视口
  function updateCurrentViewport(newViewport: { x: number; y: number; zoom: number }) {
    if (currentNotebook.value) {
      currentNotebook.value.viewport = newViewport
      saveNotebook(currentNotebook.value)
    }
  }

  // 添加节点
  function addNode(node: CanvasNode) {
    if (!currentNotebook.value) return

    // 确保 nodes 数组存在
    if (!currentNotebook.value.nodes) {
      currentNotebook.value.nodes = []
    }

    currentNotebook.value.nodes.push(node)
    saveNotebook(currentNotebook.value)
    // 更新映射缓存
    if (nodeToNotebookMap) {
      nodeToNotebookMap.set(node.id, currentNotebook.value)
    }
  }

  // 更新节点
  function updateNode(nodeId: string, updates: Partial<CanvasNode>, skipSave = false) {
    if (!currentNotebook.value?.nodes) return

    const node = currentNotebook.value.nodes.find(n => n.id === nodeId)
    if (node) {
      Object.assign(node, updates)
      if (!skipSave) {
        saveNotebook(currentNotebook.value)
      }
    }
  }

  // 批量更新节点上下文选择状态（支持跨笔记本）
  async function batchUpdateContextSelection(nodeIds: string[], selected: boolean) {
    const map = getNodeToNotebookMap()
    const changedNotebooks = new Set<Notebook>()

    for (const nodeId of nodeIds) {
      const notebook = map.get(nodeId)
      if (notebook) {
        const node = notebook.nodes?.find(n => n.id === nodeId)
        if (node && node.selectedAsContext !== selected) {
          node.selectedAsContext = selected
          changedNotebooks.add(notebook)
        }
      }
    }

    // 并行保存所有有变化的笔记本
    if (changedNotebooks.size > 0) {
      await Promise.all(
        Array.from(changedNotebooks).map(notebook => saveNotebook(notebook))
      )
    }
  }

  // 更新节点收藏状态（支持跨笔记本）
  async function updateNodeFavorite(nodeId: string, isFavorite: boolean) {
    const map = getNodeToNotebookMap()
    const notebook = map.get(nodeId)
    if (notebook) {
      const node = notebook.nodes?.find(n => n.id === nodeId)
      if (node) {
        node.isFavorite = isFavorite
        await saveNotebook(notebook)
      }
    }
  }

  // 删除节点
  function removeNode(nodeId: string) {
    if (!currentNotebook.value?.nodes) return

    currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => n.id !== nodeId)
    saveNotebook(currentNotebook.value)
    // 更新映射缓存
    if (nodeToNotebookMap) {
      nodeToNotebookMap.delete(nodeId)
    }
  }

  // ========== PDF 页面相关方法 ==========

  // 获取指定 PDF 页码的所有节点
  function getNodesByPdfPage(pdfPageNumber: number): CanvasNode[] {
    if (!currentNotebook.value?.nodes) return []
    return currentNotebook.value.nodes.filter(n => n.pdfPage === pdfPageNumber)
  }

  // 查找节点的 PDF 页码
  function findNodePdfPage(nodeId: string): number | null {
    if (!currentNotebook.value?.nodes) return null
    const node = currentNotebook.value.nodes.find(n => n.id === nodeId)
    return node?.pdfPage || null
  }

  // 添加节点到指定 PDF 页码
  function addNodeToPdfPage(node: CanvasNode, pdfPageNumber: number) {
    node.pdfPage = pdfPageNumber
    addNode(node)
  }

  // 更新指定 PDF 页码的节点
  function updateNodeInPdfPage(nodeId: string, pdfPageNumber: number, updates: Partial<CanvasNode>, skipSave = false) {
    if (!currentNotebook.value?.nodes) return
    const node = currentNotebook.value.nodes.find(n => n.id === nodeId && n.pdfPage === pdfPageNumber)
    if (node) {
      Object.assign(node, updates)
      if (!skipSave) {
        saveNotebook(currentNotebook.value)
      }
    }
  }

  // 从指定 PDF 页码删除节点
  function removeNodeFromPdfPage(nodeId: string, pdfPageNumber: number) {
    if (!currentNotebook.value?.nodes) return
    currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => n.id !== nodeId || n.pdfPage !== pdfPageNumber)
    saveNotebook(currentNotebook.value)
  }

  // 更新节点（自动查找 PDF 页码）
  function updateNodeAuto(nodeId: string, updates: Partial<CanvasNode>, skipSave = false) {
    updateNode(nodeId, updates, skipSave)
  }

  // 删除节点（自动查找 PDF 页码）
  function removeNodeAuto(nodeId: string) {
    removeNode(nodeId)
  }

  // 获取已选中作为上下文的节点
  function getAllSelectedContextNodes(excludeNodeId?: string): CanvasNode[] {
    if (!currentNotebook.value?.nodes) return []

    return currentNotebook.value.nodes
      .filter(n => n.selectedAsContext && n.transcriptStatus === 'done')
      .filter(n => !excludeNodeId || n.id !== excludeNodeId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  // 获取所有节点
  function getAllNodes(): CanvasNode[] {
    if (!currentNotebook.value?.nodes) return []
    return [...currentNotebook.value.nodes]
  }

  // 统计已选中作为上下文的节点数量
  function countAllSelectedContext(): number {
    return getAllSelectedContextNodes().length
  }

  // 统计可被选择作为上下文的节点数量
  function countAllSelectableNodes(): number {
    if (!currentNotebook.value?.nodes) return 0
    return currentNotebook.value.nodes.filter(n => n.transcriptStatus === 'done').length
  }

  return {
    notebooks,
    currentNotebook,
    notebookList,
    viewport,
    loadNotebooks,
    createNotebook,
    saveNotebook,
    deleteNotebook,
    setCurrentNotebook,
    getCurrentViewport,
    updateCurrentViewport,
    addNode,
    updateNode,
    batchUpdateContextSelection,
    updateNodeFavorite,
    removeNode,
    // PDF 页面管理
    getNodesByPdfPage,
    findNodePdfPage,
    addNodeToPdfPage,
    updateNodeInPdfPage,
    removeNodeFromPdfPage,
    updateNodeAuto,
    removeNodeAuto,
    // 全局操作
    getAllSelectedContextNodes,
    getAllNodes,
    countAllSelectedContext,
    countAllSelectableNodes
  }
})