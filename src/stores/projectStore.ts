import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, CanvasNode, CanvasPage } from '@/types/project'
import type { ProjectContext } from '@/types/context'

// 创建新画布页的工厂函数
function createCanvasPage(id?: string): CanvasPage {
  return {
    id: id || `canvas-${Date.now()}`,
    type: 'infinite',
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    createdAt: Date.now()
  }
}

// 迁移旧项目数据到多页格式
function migrateProject(project: Project): Project {
  // 如果已经有 canvases 数组，不需要迁移
  if (project.canvases && project.canvases.length > 0) {
    if (project.currentCanvasIndex === undefined) {
      project.currentCanvasIndex = 0
    }
    return project
  }

  // 迁移旧数据：将单个 canvas 转换为 canvases 数组
  if (project.canvas) {
    project.canvases = [{
      ...project.canvas,
      createdAt: project.createdAt
    }]
    project.currentCanvasIndex = 0
    // 保留旧的 canvas 字段以兼容旧版本
  } else {
    // 如果没有 canvas 数据，创建一个默认的
    project.canvases = [createCanvasPage()]
    project.currentCanvasIndex = 0
  }

  return project
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)

  const projectList = computed(() => projects.value)

  // 获取当前画布页
  const currentCanvas = computed<CanvasPage | null>(() => {
    if (!currentProject.value?.canvases) return null
    const index = currentProject.value.currentCanvasIndex ?? 0
    return currentProject.value.canvases[index] || null
  })

  // 获取当前页码（从1开始显示）
  const currentPageNumber = computed(() => (currentProject.value?.currentCanvasIndex ?? 0) + 1)

  // 获取总页数
  const totalPages = computed(() => currentProject.value?.canvases?.length || 0)

  // 是否有上一页
  const hasPrevPage = computed(() => (currentProject.value?.currentCanvasIndex ?? 0) > 0)

  // 是否有下一页
  const hasNextPage = computed(() => {
    if (!currentProject.value?.canvases) return false
    const index = currentProject.value.currentCanvasIndex ?? 0
    return index < currentProject.value.canvases.length - 1
  })

  // 当前画布是否为空（没有节点）
  const isCurrentCanvasEmpty = computed(() => {
    return !currentCanvas.value?.nodes || currentCanvas.value.nodes.length === 0
  })

  async function loadProjects() {
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const projectsDir = `${appDataPath}/projects`
      const exists = await window.electronAPI.exists(`${projectsDir}/projects.json`)

      if (exists) {
        const result = await window.electronAPI.readFile(`${projectsDir}/projects.json`, 'utf-8')
        if (result.success && result.data && typeof result.data === 'string') {
          const loadedProjects = JSON.parse(result.data) as Project[]
          // 迁移所有项目到多页格式
          projects.value = loadedProjects.map(migrateProject)
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  async function createProject(name: string, context?: ProjectContext) {
    const project: Project = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      canvases: [createCanvasPage('canvas-1')],
      currentCanvasIndex: 0
    }

    if (context && (context.staticContextIds?.length || context.dynamicContextId)) {
      project.context = context
    }

    projects.value.push(project)
    await saveProjects()
    return project
  }

  async function saveProject(project: Project) {
    project.updatedAt = Date.now()
    const index = projects.value.findIndex(p => p.id === project.id)
    if (index !== -1) {
      // 更新现有项目 - 使用 Object.assign 保持响应式
      Object.assign(projects.value[index], project)
      // 同步更新 currentProject
      if (currentProject.value && currentProject.value.id === project.id) {
        Object.assign(currentProject.value, project)
      }
    } else {
      projects.value.push(project)
    }
    await saveProjects()
  }

  async function saveProjects() {
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const projectsDir = `${appDataPath}/projects`
      await window.electronAPI.mkdir(projectsDir)
      await window.electronAPI.saveFile(
        `${projectsDir}/projects.json`,
        JSON.stringify(projects.value, null, 2)
      )
    } catch (error) {
      console.error('Failed to save projects:', error)
    }
  }

  async function deleteProject(projectId: string) {
    projects.value = projects.value.filter(p => p.id !== projectId)
    await saveProjects()
  }

  function setCurrentProject(project: Project | null) {
    currentProject.value = project
  }

  // 切换到上一页（自动删除空页）
  function goToPrevPage() {
    if (!currentProject.value || !currentProject.value.canvases) return
    const currentIndex = currentProject.value.currentCanvasIndex ?? 0
    if (currentIndex > 0) {
      // 检查当前页是否为空，如果是则删除
      const currentPage = currentProject.value.canvases[currentIndex]
      if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
        // 删除当前空页（除了第一页）
        if (currentProject.value.canvases.length > 1) {
          currentProject.value.canvases.splice(currentIndex, 1)
          // 索引已经-1了，因为删除了当前页
          currentProject.value.currentCanvasIndex = currentIndex - 1
          saveProject(currentProject.value)
          return
        }
      }
      currentProject.value.currentCanvasIndex = currentIndex - 1
      saveProject(currentProject.value)
    }
  }

  // 切换到下一页（自动删除空页）
  function goToNextPage() {
    if (!currentProject.value || !currentProject.value.canvases) return
    const currentIndex = currentProject.value.currentCanvasIndex ?? 0
    if (currentIndex < currentProject.value.canvases.length - 1) {
      // 检查当前页是否为空，如果是则删除
      const currentPage = currentProject.value.canvases[currentIndex]
      if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
        // 删除当前空页（除了最后一页）
        if (currentProject.value.canvases.length > 1) {
          currentProject.value.canvases.splice(currentIndex, 1)
          // 索引保持不变，因为删除了当前页，下一页变成了当前页
          saveProject(currentProject.value)
          return
        }
      }
      currentProject.value.currentCanvasIndex = currentIndex + 1
      saveProject(currentProject.value)
    }
  }

  // 清理所有空页（保留当前页即使为空）
  function cleanupEmptyPages(): number {
    if (!currentProject.value?.canvases) return 0
    
    const currentIndex = currentProject.value.currentCanvasIndex ?? 0
    const originalLength = currentProject.value.canvases.length
    
    // 过滤掉空页，但保留当前页（即使为空）
    const newCanvases: CanvasPage[] = []
    let newCurrentIndex = 0
    
    currentProject.value.canvases.forEach((page, index) => {
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
    
    currentProject.value.canvases = newCanvases
    currentProject.value.currentCanvasIndex = newCurrentIndex
    
    const removedCount = originalLength - newCanvases.length
    if (removedCount > 0) {
      saveProject(currentProject.value)
    }
    return removedCount
  }

  // 新增一页
  function addNewPage(): boolean {
    if (!currentProject.value) return false

    // 确保 canvases 数组存在
    if (!currentProject.value.canvases) {
      currentProject.value.canvases = []
    }

    // 检查当前页是否为空，如果为空则不允许新增
    const currentIndex = currentProject.value.currentCanvasIndex ?? 0
    const currentPage = currentProject.value.canvases[currentIndex]
    if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
      return false
    }

    // 创建新页面并切换到新页面
    const newPage = createCanvasPage()
    currentProject.value.canvases.push(newPage)
    currentProject.value.currentCanvasIndex = currentProject.value.canvases.length - 1
    saveProject(currentProject.value)
    return true
  }

  // 删除指定页面
  function removePage(pageIndex: number): boolean {
    if (!currentProject.value?.canvases) return false
    if (pageIndex < 0 || pageIndex >= currentProject.value.canvases.length) return false

    currentProject.value.canvases.splice(pageIndex, 1)

    // 如果删除的是当前页或之前的页面，调整当前页索引
    const currentIndex = currentProject.value.currentCanvasIndex ?? 0
    if (pageIndex <= currentIndex && currentIndex > 0) {
      currentProject.value.currentCanvasIndex = currentIndex - 1
    }

    // 确保至少保留一页
    if (currentProject.value.canvases.length === 0) {
      currentProject.value.canvases.push(createCanvasPage())
      currentProject.value.currentCanvasIndex = 0
    }

    saveProject(currentProject.value)
    return true
  }

  // 检查并删除空白页面（当页面节点被清空时调用）
  function checkAndRemoveEmptyPage(): boolean {
    if (!currentProject.value?.canvases) return false

    const currentIndex = currentProject.value.currentCanvasIndex ?? 0
    const currentPage = currentProject.value.canvases[currentIndex]

    // 如果当前页为空且不是唯一一页，则删除
    if (currentPage && (!currentPage.nodes || currentPage.nodes.length === 0)) {
      // 如果只有一页，不删除
      if (currentProject.value.canvases.length <= 1) {
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
    if (currentProject.value && currentCanvas.value) {
      currentCanvas.value.viewport = viewport
      saveProject(currentProject.value)
    }
  }

  function addNode(node: CanvasNode) {
    if (currentProject.value && currentCanvas.value) {
      currentCanvas.value.nodes.push(node)
      saveProject(currentProject.value)
    }
  }

  function updateNode(nodeId: string, updates: Partial<CanvasNode>) {
    if (currentProject.value && currentCanvas.value) {
      const node = currentCanvas.value.nodes.find(n => n.id === nodeId)
      if (node) {
        Object.assign(node, updates)
        saveProject(currentProject.value)
      }
    }
  }

  function removeNode(nodeId: string) {
    if (currentProject.value && currentCanvas.value) {
      currentCanvas.value.nodes = currentCanvas.value.nodes.filter(
        n => n.id !== nodeId
      )
      saveProject(currentProject.value)

      // 删除节点后检查当前页是否为空，如果是则自动删除
      checkAndRemoveEmptyPage()
    }
  }

  return {
    projects,
    currentProject,
    projectList,
    currentCanvas,
    currentPageNumber,
    totalPages,
    hasPrevPage,
    hasNextPage,
    isCurrentCanvasEmpty,
    loadProjects,
    createProject,
    saveProject,
    deleteProject,
    setCurrentProject,
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
    removeNode
  }
})
