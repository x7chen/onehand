import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ContextFile, ContextType, ContextColor } from '@/types/context'
import { CONTEXT_COLORS } from '@/types/context'

export const useContextStore = defineStore('context', () => {
  const contextFiles = ref<ContextFile[]>([])

  const allContextFiles = computed(() => contextFiles.value)

  const staticContextFiles = computed(() =>
    contextFiles.value.filter(f => f.type === 'static')
  )

  const dynamicContextFiles = computed(() =>
    contextFiles.value.filter(f => f.type === 'dynamic')
  )

  /**
   * 获取下一个可用的标签颜色
   */
  function getNextColor(existingFiles: ContextFile[]): ContextColor {
    const usedColors = new Set(existingFiles.map(f => f.color))
    for (const color of CONTEXT_COLORS) {
      if (!usedColors.has(color)) {
        return color
      }
    }
    // 如果所有颜色都用过，随机返回一个
    return CONTEXT_COLORS[Math.floor(Math.random() * CONTEXT_COLORS.length)]
  }

  /**
   * 加载上下文文件列表
   */
  async function loadContextFiles() {
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const contextsDir = `${appDataPath}/contexts`
      const exists = await window.electronAPI.exists(`${contextsDir}/contexts.json`)

      if (exists) {
        const result = await window.electronAPI.readFile(`${contextsDir}/contexts.json`, 'utf-8')
        if (result.success && result.data && typeof result.data === 'string') {
          const files = JSON.parse(result.data) as ContextFile[]
          // 兼容旧数据：为没有 color 属性的文件分配颜色
          files.forEach(file => {
            if (!file.color) {
              const sameTypeFiles = files.filter(f => f.type === file.type)
              file.color = getNextColor(sameTypeFiles)
            }
          })
          contextFiles.value = files
          // 保存更新后的数据
          await saveContextFiles()
        }
      }
    } catch (error) {
      console.error('Failed to load context files:', error)
    }
  }

  /**
   * 保存上下文文件列表
   */
  async function saveContextFiles() {
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const contextsDir = `${appDataPath}/contexts`
      await window.electronAPI.mkdir(contextsDir)
      await window.electronAPI.saveFile(
        `${contextsDir}/contexts.json`,
        JSON.stringify(contextFiles.value, null, 2)
      )
    } catch (error) {
      console.error('Failed to save context files:', error)
    }
  }

  /**
   * 创建新的上下文文件
   */
  async function createContextFile(
    name: string,
    type: ContextType,
    content: string = '',
    notebookId?: string
  ): Promise<ContextFile> {
    const existingFiles = type === 'static' ? staticContextFiles.value : dynamicContextFiles.value
    const contextFile: ContextFile = {
      id: `ctx-${Date.now()}`,
      name,
      type,
      color: getNextColor(existingFiles),
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notebookId
    }

    contextFiles.value.push(contextFile)
    await saveContextFiles()

    // 同时保存内容到单独的 markdown 文件
    await saveContextFileContent(contextFile)

    return contextFile
  }

  /**
   * 保存上下文文件内容到 markdown 文件
   */
  async function saveContextFileContent(contextFile: ContextFile) {
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const contextsDir = `${appDataPath}/contexts`
      await window.electronAPI.mkdir(contextsDir)
      await window.electronAPI.saveFile(
        `${contextsDir}/${contextFile.id}.md`,
        contextFile.content
      )
    } catch (error) {
      console.error('Failed to save context file content:', error)
    }
  }

  /**
   * 读取上下文文件内容
   */
  async function loadContextFileContent(contextFileId: string): Promise<string | null> {
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const contextsDir = `${appDataPath}/contexts`
      const result = await window.electronAPI.readFile(`${contextsDir}/${contextFileId}.md`, 'utf-8')
      if (result.success && result.data && typeof result.data === 'string') {
        return result.data
      }
    } catch (error) {
      console.error('Failed to load context file content:', error)
    }
    return null
  }

  /**
   * 更新上下文文件
   */
  async function updateContextFile(
    contextFileId: string,
    updates: Partial<ContextFile>
  ) {
    const index = contextFiles.value.findIndex(f => f.id === contextFileId)
    if (index !== -1) {
      const file = contextFiles.value[index]
      Object.assign(file, {
        ...updates,
        updatedAt: Date.now()
      })
      await saveContextFiles()

      // 如果内容更新了，保存到 markdown 文件
      if (updates.content !== undefined) {
        await saveContextFileContent(file)
      }
    }
  }

  /**
   * 更新上下文文件颜色
   */
  async function updateContextColor(
    contextFileId: string,
    color: string
  ) {
    const index = contextFiles.value.findIndex(f => f.id === contextFileId)
    if (index !== -1) {
      contextFiles.value[index].color = color
      contextFiles.value[index].updatedAt = Date.now()
      await saveContextFiles()
    }
  }

  /**
   * 删除上下文文件
   */
  async function deleteContextFile(contextFileId: string) {
    contextFiles.value = contextFiles.value.filter(f => f.id !== contextFileId)
    await saveContextFiles()

    // 注意：electron API 没有提供删除文件的方法，这里只从列表中删除
    // 如果需要物理删除，需要在 electron 主进程中添加 deleteFile IPC 处理
  }

  /**
   * 根据 ID 获取上下文文件
   */
  function getContextFileById(id: string): ContextFile | undefined {
    return contextFiles.value.find(f => f.id === id)
  }

  /**
   * 追加内容到动态上下文文件
   */
  async function appendToDynamicContext(
    contextFileId: string,
    content: string
  ) {
    const file = contextFiles.value.find(f => f.id === contextFileId)
    if (file && file.type === 'dynamic') {
      const newContent = file.content 
        ? file.content + '\n\n' + content 
        : content
      
      file.content = newContent
      file.updatedAt = Date.now()
      
      await saveContextFiles()
      await saveContextFileContent(file)
    }
  }

  return {
    contextFiles,
    allContextFiles,
    staticContextFiles,
    dynamicContextFiles,
    loadContextFiles,
    createContextFile,
    updateContextFile,
    updateContextColor,
    deleteContextFile,
    getContextFileById,
    appendToDynamicContext,
    loadContextFileContent,
    saveContextFileContent,
    getNextColor
  }
})
