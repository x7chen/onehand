import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Notebook, CanvasNode, CanvasInfo, CanvasPage } from '@/types/notebook'
import type { NotebookContext } from '@/types/context'
import { getNotebooksDir, getNotebookFilePath, getPdfDir, getNotebookDataDir, getNotebookAudioDir, getNotebookImagesDir } from '@/utils/userFilesPath'

// 创建新画布页的工厂函数
function createCanvasInfo(id?: string, type: 'infinite' | 'pdf' = 'infinite', pdfPage?: number): CanvasInfo {
  const info: CanvasInfo = {
    id: id || `canvas-${Date.now()}`,
    type,
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: Date.now()
  }
  if (pdfPage !== undefined) {
    info.pdfPage = pdfPage
  }
  return info
}

// 创建新画布页的工厂函数（旧格式兼容）
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
    canvasId: node.canvasId || undefined,
    transcriptStatus: node.transcriptStatus || (node.transcript ? 'done' : 'pending'),
    agentStatus: node.agentStatus || (node.agentResult ? 'done' : 'pending')
  }
}

// 检查笔记本是否使用旧格式（节点在 canvas.nodes 中）
function isOldFormat(notebook: Notebook): boolean {
  // 如果有 nodes 数组直接在笔记本上，是新格式
  if (notebook.nodes && notebook.nodes.length > 0) {
    return false
  }
  // 如果 canvases 中有节点，是旧格式
  if (notebook.canvases && notebook.canvases.length > 0) {
    const firstCanvas = notebook.canvases[0]
    if ('nodes' in firstCanvas && Array.isArray((firstCanvas as CanvasPage).nodes)) {
      const nodes = (firstCanvas as CanvasPage).nodes
      return nodes !== undefined && nodes.length > 0
    }
  }
  return false
}

// 迁移旧笔记本数据到新格式
function migrateNotebook(notebook: Notebook): { notebook: Notebook; needsSave: boolean } {
  let needsSave = false

  // 检查是否是旧格式
  if (isOldFormat(notebook)) {
    // 转换为新格式
    const allNodes: CanvasNode[] = []
    const canvasInfos: CanvasInfo[] = []

    if (notebook.canvases) {
      for (const canvas of notebook.canvases as CanvasPage[]) {
        // 创建画布元信息
        const canvasInfo: CanvasInfo = {
          id: canvas.id,
          type: canvas.type,
          viewport: canvas.viewport,
          createdAt: canvas.createdAt,
          pdfPage: canvas.pdfPage
        }
        canvasInfos.push(canvasInfo)

        // 提取节点并添加 canvasId
        if (canvas.nodes && canvas.nodes.length > 0) {
          for (const node of canvas.nodes) {
            allNodes.push({
              ...ensureNodeRuntimeState(node),
              canvasId: canvas.id
            })
          }
        }
      }
    }

    // 设置新格式
    notebook.nodes = allNodes
    notebook.canvases = canvasInfos

    // 设置 currentCanvasId
    const currentIndex = notebook.currentCanvasIndex ?? 0
    notebook.currentCanvasId = canvasInfos[currentIndex]?.id || canvasInfos[0]?.id || undefined

    // 移除旧属性
    notebook.currentCanvasIndex = undefined

    needsSave = true
    console.log(`Migrated notebook "${notebook.name}" to new format: ${allNodes.length} nodes, ${canvasInfos.length} canvases`)
  } else {
    // 新格式，检查是否需要补充属性
    if (!notebook.nodes) {
      notebook.nodes = []
      needsSave = true
    }

    if (!notebook.canvases || notebook.canvases.length === 0) {
      // 如果没有画布，创建默认画布
      const defaultCanvas = createCanvasInfo('canvas-1', notebook.pdfPath ? 'pdf' : 'infinite', notebook.pdfPath ? 1 : undefined)
      notebook.canvases = [defaultCanvas]
      notebook.currentCanvasId = defaultCanvas.id
      needsSave = true
    }

    if (!notebook.currentCanvasId && notebook.canvases.length > 0) {
      notebook.currentCanvasId = notebook.canvases[0].id
      needsSave = true
    }

    // 处理遗留的 currentCanvasIndex
    if (notebook.currentCanvasIndex !== undefined && notebook.canvases) {
      const canvasId = notebook.canvases[notebook.currentCanvasIndex]?.id
      if (canvasId) {
        notebook.currentCanvasId = canvasId
        notebook.currentCanvasIndex = undefined
        needsSave = true
      }
    }

    // 为节点设置运行时状态
    notebook.nodes = notebook.nodes.map(ensureNodeRuntimeState)

    // 修复 PDF 画布缺少 pdfPage 的问题
    if (notebook.canvases) {
      notebook.canvases = notebook.canvases.map((canvas, index) => {
        if (canvas.type === 'pdf' && canvas.pdfPage === undefined) {
          canvas.pdfPage = index + 1
          needsSave = true
        }
        return canvas
      })
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

  // 获取当前画布 ID
  const currentCanvasId = computed<string | null>(() => {
    return currentNotebook.value?.currentCanvasId || null
  })

  // 获取当前画布元信息（不含节点）
  const currentCanvas = computed<CanvasInfo | null>(() => {
    const notebook = currentNotebook.value
    if (!notebook?.canvases || !notebook.currentCanvasId) return null
    return notebook.canvases.find(c => c.id === notebook.currentCanvasId) || null
  })

  // 获取当前画布的所有节点
  const currentCanvasNodes = computed<CanvasNode[]>(() => {
    const notebook = currentNotebook.value
    if (!notebook?.nodes || !notebook.currentCanvasId) return []
    return notebook.nodes.filter(n => n.canvasId === notebook.currentCanvasId)
  })

  // 获取当前页码（从1开始显示）
  const currentPageNumber = computed(() => {
    const notebook = currentNotebook.value
    if (!notebook?.canvases || !notebook.currentCanvasId) return 1
    const index = notebook.canvases.findIndex(c => c.id === notebook.currentCanvasId)
    return index >= 0 ? index + 1 : 1
  })

  // 获取总页数
  const totalPages = computed(() => currentNotebook.value?.canvases?.length || 0)

  // 当前画布索引（用于兼容旧代码）
  const currentCanvasIndex = computed(() => {
    const notebook = currentNotebook.value
    if (!notebook?.canvases || !notebook.currentCanvasId) return 0
    return notebook.canvases.findIndex(c => c.id === notebook.currentCanvasId)
  })

  // 是否有上一页
  const hasPrevPage = computed(() => currentCanvasIndex.value > 0)

  // 是否有下一页
  const hasNextPage = computed(() => {
    if (!currentNotebook.value?.canvases) return false
    return currentCanvasIndex.value < currentNotebook.value.canvases.length - 1
  })

  // 当前画布是否为空（没有节点）
  const isCurrentCanvasEmpty = computed(() => {
    return currentCanvasNodes.value.length === 0
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

    const defaultCanvas = createCanvasInfo('canvas-1', finalPdfPath ? 'pdf' : 'infinite', finalPdfPath ? 1 : undefined)

    const notebook: Notebook = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes: [],
      canvases: [defaultCanvas],
      currentCanvasId: defaultCanvas.id
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
      // 移除运行时属性
      delete (notebookToSave as any).currentCanvasIndex

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

  // 获取指定画布的所有节点
  function getCanvasNodes(canvasId: string): CanvasNode[] {
    if (!currentNotebook.value?.nodes) return []
    return currentNotebook.value.nodes.filter(n => n.canvasId === canvasId)
  }

  // 获取指定画布的元信息
  function getCanvasInfo(canvasId: string): CanvasInfo | null {
    if (!currentNotebook.value?.canvases) return null
    return currentNotebook.value.canvases.find(c => c.id === canvasId) || null
  }

  // 切换到指定画布
  function switchToCanvas(canvasId: string) {
    if (currentNotebook.value && currentNotebook.value.canvases?.find(c => c.id === canvasId)) {
      currentNotebook.value.currentCanvasId = canvasId
      saveNotebook(currentNotebook.value)
    }
  }

  // 切换到上一页（自动删除空页）
  function goToPrevPage() {
    if (!currentNotebook.value?.canvases) return
    const currentIndex = currentCanvasIndex.value
    if (currentIndex > 0) {
      const prevCanvasId = currentNotebook.value.canvases[currentIndex - 1]?.id
      if (prevCanvasId) {
        // 检查当前页是否为空，如果是则删除
        if (isCurrentCanvasEmpty.value && currentNotebook.value.canvases.length > 1) {
          // 删除当前空页
          currentNotebook.value.canvases = currentNotebook.value.canvases.filter(c => c.id !== currentCanvasId.value)
          currentNotebook.value.currentCanvasId = prevCanvasId
          // 更新节点中的 canvasId（删除空画布的节点）
          if (currentNotebook.value.nodes) {
            currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => n.canvasId !== currentCanvasId.value)
          }
          saveNotebook(currentNotebook.value)
          return
        }
        currentNotebook.value.currentCanvasId = prevCanvasId
        saveNotebook(currentNotebook.value)
      }
    }
  }

  // 切换到下一页（自动删除空页）
  function goToNextPage() {
    if (!currentNotebook.value?.canvases) return
    const currentIndex = currentCanvasIndex.value
    if (currentIndex < currentNotebook.value.canvases.length - 1) {
      const nextCanvasId = currentNotebook.value.canvases[currentIndex + 1]?.id
      if (nextCanvasId) {
        // 检查当前页是否为空，如果是则删除
        if (isCurrentCanvasEmpty.value && currentNotebook.value.canvases.length > 1) {
          // 删除当前空页
          currentNotebook.value.canvases = currentNotebook.value.canvases.filter(c => c.id !== currentCanvasId.value)
          currentNotebook.value.currentCanvasId = nextCanvasId
          // 更新节点中的 canvasId
          if (currentNotebook.value.nodes) {
            currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => n.canvasId !== currentCanvasId.value)
          }
          saveNotebook(currentNotebook.value)
          return
        }
        currentNotebook.value.currentCanvasId = nextCanvasId
        saveNotebook(currentNotebook.value)
      }
    }
  }

  // 清理所有空页（保留当前页即使为空）
  function cleanupEmptyPages(): number {
    if (!currentNotebook.value?.canvases) return 0

    const currentId = currentCanvasId.value
    const originalLength = currentNotebook.value.canvases.length

    // 找出所有非空的画布 ID
    const nonEmptyCanvasIds = new Set<string>()
    if (currentNotebook.value.nodes) {
      for (const node of currentNotebook.value.nodes) {
        if (node.canvasId) {
          nonEmptyCanvasIds.add(node.canvasId)
        }
      }
    }

    // 过滤画布：保留当前画布或非空画布
    const newCanvases = currentNotebook.value.canvases.filter(canvas => {
      return canvas.id === currentId || nonEmptyCanvasIds.has(canvas.id)
    })

    // 确保至少有一页
    if (newCanvases.length === 0) {
      newCanvases.push(createCanvasInfo())
      currentNotebook.value.currentCanvasId = newCanvases[0].id
    }

    currentNotebook.value.canvases = newCanvases

    // 删除不属于任何画布的节点
    if (currentNotebook.value.nodes) {
      const validCanvasIds = new Set(newCanvases.map(c => c.id))
      currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => !n.canvasId || validCanvasIds.has(n.canvasId))
    }

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
    if (isCurrentCanvasEmpty.value) {
      return false
    }

    // 创建新页面并切换到新页面
    const newCanvas = createCanvasInfo()
    currentNotebook.value.canvases.push(newCanvas)
    currentNotebook.value.currentCanvasId = newCanvas.id
    saveNotebook(currentNotebook.value)
    return true
  }

  // 在当前页之前插入新画布
  function insertPageBefore(): boolean {
    if (!currentNotebook.value) return false

    // 确保 canvases 数组存在
    if (!currentNotebook.value.canvases) {
      currentNotebook.value.canvases = []
    }

    const currentIndex = currentCanvasIndex.value
    const newCanvas = createCanvasInfo()
    currentNotebook.value.canvases.splice(currentIndex, 0, newCanvas)
    currentNotebook.value.currentCanvasId = newCanvas.id
    saveNotebook(currentNotebook.value)
    return true
  }

  // 在当前页之后插入新画布
  function insertPageAfter(): boolean {
    if (!currentNotebook.value) return false

    // 确保 canvases 数组存在
    if (!currentNotebook.value.canvases) {
      currentNotebook.value.canvases = []
    }

    const currentIndex = currentCanvasIndex.value
    const newCanvas = createCanvasInfo()
    currentNotebook.value.canvases.splice(currentIndex + 1, 0, newCanvas)
    currentNotebook.value.currentCanvasId = newCanvas.id
    saveNotebook(currentNotebook.value)
    return true
  }

  // 删除指定页面
  function removePage(pageIndex: number): boolean {
    if (!currentNotebook.value?.canvases) return false
    if (pageIndex < 0 || pageIndex >= currentNotebook.value.canvases.length) return false

    const canvasToRemove = currentNotebook.value.canvases[pageIndex]
    if (!canvasToRemove) return false

    // 删除该画布的所有节点
    if (currentNotebook.value.nodes) {
      currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => n.canvasId !== canvasToRemove.id)
    }

    // 删除画布
    currentNotebook.value.canvases.splice(pageIndex, 1)

    // 调整当前画布 ID
    if (currentNotebook.value.currentCanvasId === canvasToRemove.id) {
      // 如果删除的是当前画布，切换到相邻画布
      const newIndex = Math.min(pageIndex, currentNotebook.value.canvases.length - 1)
      currentNotebook.value.currentCanvasId = currentNotebook.value.canvases[newIndex]?.id
    }

    // 确保至少保留一页
    if (currentNotebook.value.canvases.length === 0) {
      const defaultCanvas = createCanvasInfo()
      currentNotebook.value.canvases.push(defaultCanvas)
      currentNotebook.value.currentCanvasId = defaultCanvas.id
    }

    saveNotebook(currentNotebook.value)
    return true
  }

  // 检查并删除空白页面（当页面节点被清空时调用）
  function checkAndRemoveEmptyPage(): boolean {
    if (!currentNotebook.value?.canvases) return false

    // 如果当前页为空且不是唯一一页，则删除
    if (isCurrentCanvasEmpty.value && currentNotebook.value.canvases.length > 1) {
      const currentIndex = currentCanvasIndex.value
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

  // 添加节点到指定画布（默认当前画布）
  function addNode(node: CanvasNode, canvasId?: string) {
    if (!currentNotebook.value) return

    const targetCanvasId = canvasId || currentCanvasId.value
    if (!targetCanvasId) return

    // 确保节点有 canvasId
    node.canvasId = targetCanvasId

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

  // 删除节点
  function removeNode(nodeId: string) {
    if (!currentNotebook.value?.nodes) return

    currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => n.id !== nodeId)
    saveNotebook(currentNotebook.value)
    // 更新映射缓存
    if (nodeToNotebookMap) {
      nodeToNotebookMap.delete(nodeId)
    }

    // 删除节点后检查当前页是否为空，如果是则自动删除
    checkAndRemoveEmptyPage()
  }

  // ========== PDF 页面画布管理方法 ==========

  // 获取或创建指定 PDF 页码的画布，并切换到该画布
  function getOrCreateCanvasForPdfPage(pdfPageNumber: number): CanvasInfo | null {
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
      currentNotebook.value.currentCanvasId = targetCanvas.id
      return targetCanvas
    }

    // 没找到，需要创建新画布并插入到正确位置
    const newCanvas = createCanvasInfo(undefined, 'pdf', pdfPageNumber)

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
    currentNotebook.value.currentCanvasId = newCanvas.id
    saveNotebook(currentNotebook.value)

    return newCanvas
  }

  // 获取指定 PDF 页码的画布（不创建）
  function getCanvasByPdfPage(pdfPageNumber: number): CanvasInfo | null {
    if (!currentNotebook.value?.canvases) return null
    return currentNotebook.value.canvases.find(
      canvas => canvas.pdfPage === pdfPageNumber
    ) || null
  }

  // 切换到指定 PDF 页码的画布
  function switchToPdfPage(pdfPageNumber: number): boolean {
    if (!currentNotebook.value?.canvases) return false

    const canvas = currentNotebook.value.canvases.find(
      canvas => canvas.pdfPage === pdfPageNumber
    )

    if (canvas) {
      currentNotebook.value.currentCanvasId = canvas.id
      return true
    }
    return false
  }

  // 在指定 PDF 页码的画布中添加节点（自动创建画布如果不存在）
  function addNodeToPdfPage(node: CanvasNode, pdfPageNumber: number) {
    const canvas = getOrCreateCanvasForPdfPage(pdfPageNumber)
    if (canvas) {
      node.canvasId = canvas.id
      if (!currentNotebook.value!.nodes) {
        currentNotebook.value!.nodes = []
      }
      currentNotebook.value!.nodes.push(node)
      saveNotebook(currentNotebook.value!)
    }
  }

  // 在指定 PDF 页码的画布中更新节点
  function updateNodeInPdfPage(nodeId: string, pdfPageNumber: number, updates: Partial<CanvasNode>, skipSave = false) {
    const canvas = getCanvasByPdfPage(pdfPageNumber)
    if (canvas && currentNotebook.value?.nodes) {
      const node = currentNotebook.value.nodes.find(n => n.id === nodeId && n.canvasId === canvas.id)
      if (node) {
        Object.assign(node, updates)
        if (!skipSave) {
          saveNotebook(currentNotebook.value)
        }
      }
    }
  }

  // 从指定 PDF 页码的画布中删除节点
  function removeNodeFromPdfPage(nodeId: string, pdfPageNumber: number) {
    const canvas = getCanvasByPdfPage(pdfPageNumber)
    if (canvas && currentNotebook.value?.nodes) {
      currentNotebook.value.nodes = currentNotebook.value.nodes.filter(n => n.id !== nodeId || n.canvasId !== canvas.id)
      saveNotebook(currentNotebook.value)

      // 如果该画布为空且不是唯一画布，删除该画布
      const canvasNodes = getCanvasNodes(canvas.id)
      if (canvasNodes.length === 0 && currentNotebook.value.canvases && currentNotebook.value.canvases.length > 1) {
        const canvasIndex = currentNotebook.value.canvases.findIndex(c => c.id === canvas.id)
        const isCurrentCanvas = canvas.id === currentCanvasId.value

        // 只有当删除的不是当前画布时才删除
        if (canvasIndex !== -1 && !isCurrentCanvas) {
          currentNotebook.value.canvases.splice(canvasIndex, 1)
          saveNotebook(currentNotebook.value)
        }
      }
    }
  }

  // 获取指定 PDF 页码画布中的所有节点
  function getNodesByPdfPage(pdfPageNumber: number): CanvasNode[] {
    const canvas = getCanvasByPdfPage(pdfPageNumber)
    if (!canvas) return []
    return getCanvasNodes(canvas.id)
  }

  // 获取所有 PDF 页码画布（按页码排序）
  function getAllPdfPageCanvases(): CanvasInfo[] {
    if (!currentNotebook.value?.canvases) return []
    return currentNotebook.value.canvases
      .filter(canvas => canvas.pdfPage !== undefined)
      .sort((a, b) => (a.pdfPage || 0) - (b.pdfPage || 0))
  }

  // 查找节点所在的 PDF 页码
  function findNodePdfPage(nodeId: string): number | null {
    if (!currentNotebook.value?.nodes || !currentNotebook.value?.canvases) return null

    const node = currentNotebook.value.nodes.find(n => n.id === nodeId)
    if (!node?.canvasId) return null

    const canvas = currentNotebook.value.canvases.find(c => c.id === node.canvasId)
    return canvas?.pdfPage || null
  }

  // 更新节点（自动查找所在 PDF 页码）
  function updateNodeAuto(nodeId: string, updates: Partial<CanvasNode>, skipSave = false) {
    const pdfPage = findNodePdfPage(nodeId)
    if (pdfPage !== null) {
      updateNodeInPdfPage(nodeId, pdfPage, updates, skipSave)
    } else {
      updateNode(nodeId, updates, skipSave)
    }
  }

  // 删除节点（自动查找所在 PDF 页码）
  function removeNodeAuto(nodeId: string) {
    const pdfPage = findNodePdfPage(nodeId)
    if (pdfPage !== null) {
      removeNodeFromPdfPage(nodeId, pdfPage)
    } else {
      removeNode(nodeId)
    }
  }

  // 获取所有画布中已选中作为上下文的节点（跨画布）
  function getAllSelectedContextNodes(excludeNodeId?: string): CanvasNode[] {
    if (!currentNotebook.value?.nodes) return []

    return currentNotebook.value.nodes
      .filter(n => n.selectedAsContext && n.transcriptStatus === 'done')
      .filter(n => !excludeNodeId || n.id !== excludeNodeId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  // 获取所有画布中的所有节点（跨画布）
  function getAllNodes(): CanvasNode[] {
    if (!currentNotebook.value?.nodes) return []
    return [...currentNotebook.value.nodes]
  }

  // 统计所有画布中已选中作为上下文的节点数量（跨画布）
  function countAllSelectedContext(): number {
    return getAllSelectedContextNodes().length
  }

  // 统计所有画布中可被选择作为上下文的节点数量（跨画布）
  function countAllSelectableNodes(): number {
    if (!currentNotebook.value?.nodes) return 0
    return currentNotebook.value.nodes.filter(n => n.transcriptStatus === 'done').length
  }

  return {
    notebooks,
    currentNotebook,
    notebookList,
    currentCanvasId,
    currentCanvas,
    currentCanvasNodes,
    currentCanvasIndex, // 兼容旧代码
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
    getCanvasNodes,
    getCanvasInfo,
    switchToCanvas,
    goToPrevPage,
    goToNextPage,
    addNewPage,
    insertPageBefore,
    insertPageAfter,
    removePage,
    checkAndRemoveEmptyPage,
    cleanupEmptyPages,
    getCurrentViewport,
    updateCurrentViewport,
    addNode,
    updateNode,
    batchUpdateContextSelection,
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