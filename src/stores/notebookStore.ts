import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notebook, CanvasNode, CanvasPage } from '@/types/notebook'
import type { NotebookContext } from '@/types/context'

// 创建新画布页的工厂函数
function createCanvasPage(id?: string, type: 'infinite' | 'pdf' = 'infinite', pdfPage?: number): CanvasPage {
  const page: CanvasPage = {
    id: id || `canvas-${Date.now()}`,
    type,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    createdAt: Date.now()
  }
  if (pdfPage !== undefined) {
    page.pdfPage = pdfPage
  }
  return page
}

// 为节点设置默认的运行时状态
function ensureNodeRuntimeState(node: CanvasNode): CanvasNode {
  return {
    ...node,
    transcriptStatus: node.transcriptStatus || (node.transcript ? 'done' : 'pending'),
    agentStatus: node.agentStatus || (node.agentResult ? 'done' : 'pending')
  }
}

// 迁移旧笔记本数据到多页格式并设置运行时状态
function migrateNotebook(notebook: Notebook): Notebook {
  // 如果已经有 canvases 数组，不需要迁移
  if (notebook.canvases && notebook.canvases.length > 0) {
    if (notebook.currentCanvasIndex === undefined) {
      notebook.currentCanvasIndex = 0
    }
  } else if (notebook.canvas) {
    // 迁移旧数据：将单个 canvas 转换为 canvases 数组
    notebook.canvases = [{
      ...notebook.canvas,
      createdAt: notebook.createdAt
    }]
    notebook.currentCanvasIndex = 0
  } else {
    // 如果没有 canvas 数据，创建一个默认的
    notebook.canvases = [createCanvasPage()]
    notebook.currentCanvasIndex = 0
  }

  // 为每个节点设置运行时状态
  if (notebook.canvases) {
    notebook.canvases = notebook.canvases.map(canvas => ({
      ...canvas,
      nodes: canvas.nodes.map(ensureNodeRuntimeState)
    }))
  }

  return notebook
}

// 获取笔记本目录路径
async function getNotebooksDir(): Promise<string> {
  const appDataPath = await window.electronAPI.getAppPath('userData')
  return `${appDataPath}/notebooks`
}

// 获取单个笔记本文件路径
async function getNotebookFilePath(notebookId: string): Promise<string> {
  const notebooksDir = await getNotebooksDir()
  return `${notebooksDir}/${notebookId}.json`
}

export const useNotebookStore = defineStore('notebook', () => {
  const notebooks = ref<Notebook[]>([])
  const currentNotebook = ref<Notebook | null>(null)

  const notebookList = computed(() => notebooks.value)

  // 获取当前画布页
  const currentCanvas = computed<CanvasPage | null>(() => {
    if (!currentNotebook.value?.canvases) return null
    const index = currentNotebook.value.currentCanvasIndex ?? 0
    return currentNotebook.value.canvases[index] || null
  })

  // 获取当前页码（从1开始显示）
  const currentPageNumber = computed(() => (currentNotebook.value?.currentCanvasIndex ?? 0) + 1)

  // 获取总页数
  const totalPages = computed(() => currentNotebook.value?.canvases?.length || 0)

  // 是否有上一页
  const hasPrevPage = computed(() => (currentNotebook.value?.currentCanvasIndex ?? 0) > 0)

  // 是否有下一页
  const hasNextPage = computed(() => {
    if (!currentNotebook.value?.canvases) return false
    const index = currentNotebook.value.currentCanvasIndex ?? 0
    return index < currentNotebook.value.canvases.length - 1
  })

  // 当前画布是否为空（没有节点）
  const isCurrentCanvasEmpty = computed(() => {
    return !currentCanvas.value?.nodes || currentCanvas.value.nodes.length === 0
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
              const migratedNotebook = migrateNotebook(notebook)
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

      for (const file of jsonFiles) {
        const filePath = `${notebooksDir}/${file}`
        const fileResult = await window.electronAPI.readFile(filePath, 'utf-8')

        if (fileResult.success && fileResult.data && typeof fileResult.data === 'string') {
          try {
            const notebook = JSON.parse(fileResult.data) as Notebook
            loadedNotebooks.push(migrateNotebook(notebook))
          } catch (parseError) {
            console.error(`Failed to parse notebook file ${file}:`, parseError)
          }
        }
      }

      // 按更新时间排序
      loadedNotebooks.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      notebooks.value = loadedNotebooks
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
        const appDataPath = await window.electronAPI.getAppPath('userData')
        const pdfDir = `${appDataPath}/pdf`

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
      canvases: [createCanvasPage('canvas-1', finalPdfPath ? 'pdf' : 'infinite')],
      currentCanvasIndex: 0
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
        canvases: notebook.canvases?.map(canvas => ({
          ...canvas,
          nodes: canvas.nodes
            .filter(node => !isNodeEmpty(node))
            .map(cleanNodeForSave)
        }))
      }
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

  // 切换到上一页（自动删除空页）
  function goToPrevPage() {
    if (!currentNotebook.value || !currentNotebook.value.canvases) return
    const currentIndex = currentNotebook.value.currentCanvasIndex ?? 0
    if (currentIndex > 0) {
      // 检查当前页是否为空，如果是则删除
      const currentPage = currentNotebook.value.canvases[currentIndex]
      if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
        // 删除当前空页（除了第一页）
        if (currentNotebook.value.canvases.length > 1) {
          currentNotebook.value.canvases.splice(currentIndex, 1)
          // 索引已经-1了，因为删除了当前页
          currentNotebook.value.currentCanvasIndex = currentIndex - 1
          saveNotebook(currentNotebook.value)
          return
        }
      }
      currentNotebook.value.currentCanvasIndex = currentIndex - 1
      saveNotebook(currentNotebook.value)
    }
  }

  // 切换到下一页（自动删除空页）
  function goToNextPage() {
    if (!currentNotebook.value || !currentNotebook.value.canvases) return
    const currentIndex = currentNotebook.value.currentCanvasIndex ?? 0
    if (currentIndex < currentNotebook.value.canvases.length - 1) {
      // 检查当前页是否为空，如果是则删除
      const currentPage = currentNotebook.value.canvases[currentIndex]
      if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
        // 删除当前空页（除了最后一页）
        if (currentNotebook.value.canvases.length > 1) {
          currentNotebook.value.canvases.splice(currentIndex, 1)
          // 索引保持不变，因为删除了当前页，下一页变成了当前页
          saveNotebook(currentNotebook.value)
          return
        }
      }
      currentNotebook.value.currentCanvasIndex = currentIndex + 1
      saveNotebook(currentNotebook.value)
    }
  }

  // 清理所有空页（保留当前页即使为空）
  function cleanupEmptyPages(): number {
    if (!currentNotebook.value?.canvases) return 0

    const currentIndex = currentNotebook.value.currentCanvasIndex ?? 0
    const originalLength = currentNotebook.value.canvases.length

    // 过滤掉空页，但保留当前页（即使为空）
    const newCanvases: CanvasPage[] = []
    let newCurrentIndex = 0

    currentNotebook.value.canvases.forEach((page, index) => {
      // 保留当前页，即使为空
      if (index === currentIndex) {
        newCanvases.push(page)
        newCurrentIndex = newCanvases.length - 1
      } else if (page.nodes && page.nodes.length > 0) {
        // 非当前页且非空，保留
        newCanvases.push(page)
      }
      // 空页且非当前页，不保留
    })

    // 确保至少有一页
    if (newCanvases.length === 0) {
      newCanvases.push(createCanvasPage())
      newCurrentIndex = 0
    }

    currentNotebook.value.canvases = newCanvases
    currentNotebook.value.currentCanvasIndex = newCurrentIndex

    const removedCount = originalLength - newCanvases.length
    if (removedCount > 0) {
      saveNotebook(currentNotebook.value)
    }
    return removedCount
  }

  // 新增一页
  function addNewPage(): boolean {
    if (!currentNotebook.value) return false

    // 确保 canvases 数组存在
    if (!currentNotebook.value.canvases) {
      currentNotebook.value.canvases = []
    }

    // 检查当前页是否为空，如果为空则不允许新增
    const currentIndex = currentNotebook.value.currentCanvasIndex ?? 0
    const currentPage = currentNotebook.value.canvases[currentIndex]
    if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
      return false
    }

    // 创建新页面并切换到新页面
    const newPage = createCanvasPage()
    currentNotebook.value.canvases.push(newPage)
    currentNotebook.value.currentCanvasIndex = currentNotebook.value.canvases.length - 1
    saveNotebook(currentNotebook.value)
    return true
  }

  // 删除指定页面
  function removePage(pageIndex: number): boolean {
    if (!currentNotebook.value?.canvases) return false
    if (pageIndex < 0 || pageIndex >= currentNotebook.value.canvases.length) return false

    currentNotebook.value.canvases.splice(pageIndex, 1)

    // 如果删除的是当前页或之前的页面，调整当前页索引
    const currentIndex = currentNotebook.value.currentCanvasIndex ?? 0
    if (pageIndex <= currentIndex && currentIndex > 0) {
      currentNotebook.value.currentCanvasIndex = currentIndex - 1
    }

    // 确保至少保留一页
    if (currentNotebook.value.canvases.length === 0) {
      currentNotebook.value.canvases.push(createCanvasPage())
      currentNotebook.value.currentCanvasIndex = 0
    }

    saveNotebook(currentNotebook.value)
    return true
  }

  // 检查并删除空白页面（当页面节点被清空时调用）
  function checkAndRemoveEmptyPage(): boolean {
    if (!currentNotebook.value?.canvases) return false

    const currentIndex = currentNotebook.value.currentCanvasIndex ?? 0
    const currentPage = currentNotebook.value.canvases[currentIndex]

    // 如果当前页为空且不是唯一一页，则删除
    if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
      // 如果只有一页，不删除
      if (currentNotebook.value.canvases.length <= 1) {
        return false
      }
      return removePage(currentIndex)
    }
    return false
  }

  // 获取当前画布的 viewport
  function getCurrentViewport(): { x: number; y: number; zoom: number } {
    return currentCanvas.value?.viewport || { x: 0, y: 0, zoom: 1 }
  }

  // 更新当前画布的 viewport
  function updateCurrentViewport(viewport: { x: number; y: number; zoom: number }) {
    if (currentNotebook.value && currentCanvas.value) {
      currentCanvas.value.viewport = viewport
      saveNotebook(currentNotebook.value)
    }
  }

  function addNode(node: CanvasNode) {
    if (currentNotebook.value && currentCanvas.value) {
      // 创建新数组以触发 Vue 响应式更新
      currentCanvas.value.nodes = [...currentCanvas.value.nodes, node]
      saveNotebook(currentNotebook.value)
    }
  }

  function updateNode(nodeId: string, updates: Partial<CanvasNode>, skipSave = false) {
    if (currentNotebook.value && currentCanvas.value) {
      const node = currentCanvas.value.nodes.find(n => n.id === nodeId)
      if (node) {
        Object.assign(node, updates)
        if (!skipSave) {
          saveNotebook(currentNotebook.value)
        }
      }
    }
  }

  function removeNode(nodeId: string) {
    if (currentNotebook.value && currentCanvas.value) {
      currentCanvas.value.nodes = currentCanvas.value.nodes.filter(
        n => n.id !== nodeId
      )
      saveNotebook(currentNotebook.value)

      // 删除节点后检查当前页是否为空，如果是则自动删除
      checkAndRemoveEmptyPage()
    }
  }

  // ========== PDF 页面画布管理方法 ==========

  // 获取或创建指定 PDF 页码的画布，并切换到该画布
  function getOrCreateCanvasForPdfPage(pdfPageNumber: number): CanvasPage | null {
    if (!currentNotebook.value) return null

    // 确保 canvases 数组存在
    if (!currentNotebook.value.canvases) {
      currentNotebook.value.canvases = []
    }

    // 查找是否已存在该 PDF 页码的画布
    let targetCanvas = currentNotebook.value.canvases.find(
      canvas => canvas.pdfPage === pdfPageNumber
    )

    if (targetCanvas) {
      // 找到了，切换到该画布
      const index = currentNotebook.value.canvases.indexOf(targetCanvas)
      currentNotebook.value.currentCanvasIndex = index
      return targetCanvas
    }

    // 没找到，需要创建新画布并插入到正确位置
    const newCanvas = createCanvasPage(undefined, 'pdf', pdfPageNumber)

    // 找到插入位置：按 pdfPage 升序排列
    let insertIndex = 0
    for (let i = 0; i < currentNotebook.value.canvases.length; i++) {
      const canvas = currentNotebook.value.canvases[i]
      // 如果画布没有 pdfPage 或 pdfPage 小于目标页码，继续往后找
      if (canvas.pdfPage === undefined || canvas.pdfPage < pdfPageNumber) {
        insertIndex = i + 1
      } else {
        break
      }
    }

    // 插入新画布
    currentNotebook.value.canvases.splice(insertIndex, 0, newCanvas)
    currentNotebook.value.currentCanvasIndex = insertIndex
    saveNotebook(currentNotebook.value)

    return newCanvas
  }

  // 获取指定 PDF 页码的画布（不创建）
  function getCanvasByPdfPage(pdfPageNumber: number): CanvasPage | null {
    if (!currentNotebook.value?.canvases) return null
    return currentNotebook.value.canvases.find(
      canvas => canvas.pdfPage === pdfPageNumber
    ) || null
  }

  // 切换到指定 PDF 页码的画布
  function switchToPdfPage(pdfPageNumber: number): boolean {
    if (!currentNotebook.value?.canvases) return false

    const index = currentNotebook.value.canvases.findIndex(
      canvas => canvas.pdfPage === pdfPageNumber
    )

    if (index !== -1) {
      currentNotebook.value.currentCanvasIndex = index
      return true
    }
    return false
  }

  // 在指定 PDF 页码的画布中添加节点（自动创建画布如果不存在）
  function addNodeToPdfPage(node: CanvasNode, pdfPageNumber: number) {
    const canvas = getOrCreateCanvasForPdfPage(pdfPageNumber)
    if (canvas) {
      // 创建新数组以触发 Vue 响应式更新
      canvas.nodes = [...canvas.nodes, node]
      saveNotebook(currentNotebook.value!)
    }
  }

  // 在指定 PDF 页码的画布中更新节点
  function updateNodeInPdfPage(nodeId: string, pdfPageNumber: number, updates: Partial<CanvasNode>, skipSave = false) {
    const canvas = getCanvasByPdfPage(pdfPageNumber)
    if (canvas) {
      const node = canvas.nodes.find(n => n.id === nodeId)
      if (node) {
        Object.assign(node, updates)
        if (!skipSave) {
          saveNotebook(currentNotebook.value!)
        }
      }
    }
  }

  // 从指定 PDF 页码的画布中删除节点
  function removeNodeFromPdfPage(nodeId: string, pdfPageNumber: number) {
    const canvas = getCanvasByPdfPage(pdfPageNumber)
    if (canvas) {
      canvas.nodes = canvas.nodes.filter(n => n.id !== nodeId)
      saveNotebook(currentNotebook.value!)

      // 如果该画布为空且不是唯一画布，删除该画布
      if (canvas.nodes.length === 0 && currentNotebook.value?.canvases && currentNotebook.value.canvases.length > 1) {
        const canvasIndex = currentNotebook.value.canvases.indexOf(canvas)
        if (canvasIndex !== -1) {
          currentNotebook.value.canvases.splice(canvasIndex, 1)
          // 调整当前画布索引
          if (currentNotebook.value.currentCanvasIndex !== undefined) {
            if (currentNotebook.value.currentCanvasIndex >= canvasIndex && currentNotebook.value.currentCanvasIndex > 0) {
              currentNotebook.value.currentCanvasIndex--
            }
          }
          saveNotebook(currentNotebook.value)
        }
      }
    }
  }

  // 获取指定 PDF 页码画布中的所有节点
  function getNodesByPdfPage(pdfPageNumber: number): CanvasNode[] {
    const canvas = getCanvasByPdfPage(pdfPageNumber)
    return canvas?.nodes || []
  }

  // 获取所有 PDF 页码画布（按页码排序）
  function getAllPdfPageCanvases(): CanvasPage[] {
    if (!currentNotebook.value?.canvases) return []
    return currentNotebook.value.canvases
      .filter(canvas => canvas.pdfPage !== undefined)
      .sort((a, b) => (a.pdfPage || 0) - (b.pdfPage || 0))
  }

  // 查找节点所在的 PDF 页码
  function findNodePdfPage(nodeId: string): number | null {
    if (!currentNotebook.value?.canvases) return null
    for (const canvas of currentNotebook.value.canvases) {
      if (canvas.nodes.some(n => n.id === nodeId)) {
        return canvas.pdfPage || null
      }
    }
    return null
  }

  // 更新节点（自动查找所在 PDF 页码）
  function updateNodeAuto(nodeId: string, updates: Partial<CanvasNode>, skipSave = false) {
    const pdfPage = findNodePdfPage(nodeId)
    if (pdfPage !== null) {
      updateNodeInPdfPage(nodeId, pdfPage, updates, skipSave)
    }
  }

  // 删除节点（自动查找所在 PDF 页码）
  function removeNodeAuto(nodeId: string) {
    const pdfPage = findNodePdfPage(nodeId)
    if (pdfPage !== null) {
      removeNodeFromPdfPage(nodeId, pdfPage)
    }
  }

  // 获取所有画布中已选中作为上下文的节点（跨画布）
  function getAllSelectedContextNodes(excludeNodeId?: string): CanvasNode[] {
    if (!currentNotebook.value?.canvases) return []
    const selectedNodes: CanvasNode[] = []
    for (const canvas of currentNotebook.value.canvases) {
      for (const node of canvas.nodes) {
        if (node.selectedAsContext && node.transcriptStatus === 'done') {
          if (!excludeNodeId || node.id !== excludeNodeId) {
            selectedNodes.push(node)
          }
        }
      }
    }
    return selectedNodes.sort((a, b) => a.createdAt - b.createdAt)
  }

  // 获取所有画布中的所有节点（跨画布）
  function getAllNodes(): CanvasNode[] {
    if (!currentNotebook.value?.canvases) return []
    const allNodes: CanvasNode[] = []
    for (const canvas of currentNotebook.value.canvases) {
      for (const node of canvas.nodes) {
        allNodes.push(node)
      }
    }
    return allNodes
  }

  // 统计所有画布中已选中作为上下文的节点数量（跨画布）
  function countAllSelectedContext(): number {
    return getAllSelectedContextNodes().length
  }

  // 统计所有画布中可被选择作为上下文的节点数量（跨画布）
  function countAllSelectableNodes(): number {
    if (!currentNotebook.value?.canvases) return 0
    let count = 0
    for (const canvas of currentNotebook.value.canvases) {
      for (const node of canvas.nodes) {
        if (node.transcriptStatus === 'done') {
          count++
        }
      }
    }
    return count
  }

  return {
    notebooks,
    currentNotebook,
    notebookList,
    currentCanvas,
    currentPageNumber,
    totalPages,
    hasPrevPage,
    hasNextPage,
    isCurrentCanvasEmpty,
    loadNotebooks,
    createNotebook,
    saveNotebook,
    deleteNotebook,
    setCurrentNotebook,
    goToPrevPage,
    goToNextPage,
    addNewPage,
    removePage,
    checkAndRemoveEmptyPage,
    cleanupEmptyPages,
    getCurrentViewport,
    updateCurrentViewport,
    addNode,
    updateNode,
    removeNode,
    // PDF 页面画布管理
    getOrCreateCanvasForPdfPage,
    getCanvasByPdfPage,
    switchToPdfPage,
    addNodeToPdfPage,
    updateNodeInPdfPage,
    removeNodeFromPdfPage,
    getNodesByPdfPage,
    getAllPdfPageCanvases,
    findNodePdfPage,
    updateNodeAuto,
    removeNodeAuto,
    // 跨画布操作
    getAllSelectedContextNodes,
    getAllNodes,
    countAllSelectedContext,
    countAllSelectableNodes
  }
})