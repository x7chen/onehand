import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project, CanvasNode } from '@/types/project'
import type { ProjectContext } from '@/types/context'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)

  const projectList = computed(() => projects.value)

  async function loadProjects() {
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const projectsDir = `${appDataPath}/projects`
      const exists = await window.electronAPI.exists(`${projectsDir}/projects.json`)

      if (exists) {
        const result = await window.electronAPI.readFile(`${projectsDir}/projects.json`)
        if (result.success && result.data) {
          projects.value = JSON.parse(result.data)
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
      canvas: {
        id: 'canvas-1',
        type: 'infinite',
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: []
      }
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

  function addNode(node: CanvasNode) {
    if (currentProject.value) {
      currentProject.value.canvas.nodes.push(node)
      saveProject(currentProject.value)
    }
  }

  function updateNode(nodeId: string, updates: Partial<CanvasNode>) {
    if (currentProject.value) {
      const node = currentProject.value.canvas.nodes.find(n => n.id === nodeId)
      if (node) {
        Object.assign(node, updates)
        saveProject(currentProject.value)
      }
    }
  }

  function removeNode(nodeId: string) {
    if (currentProject.value) {
      currentProject.value.canvas.nodes = currentProject.value.canvas.nodes.filter(
        n => n.id !== nodeId
      )
      saveProject(currentProject.value)
    }
  }

  return {
    projects,
    currentProject,
    projectList,
    loadProjects,
    createProject,
    saveProject,
    deleteProject,
    setCurrentProject,
    addNode,
    updateNode,
    removeNode
  }
})
