import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuickCommand, QuickCommandColor, TrashQuickCommand } from '@/types/quickCommand'
import { QUICK_COMMAND_COLORS } from '@/types/quickCommand'
import { getUserDataFilePath, getTrashQuickCommandsFilePath } from '@/utils/userFilesPath'

export const useQuickCommandStore = defineStore('quickCommand', () => {
  const quickCommands = ref<QuickCommand[]>([])
  const trashQuickCommands = ref<TrashQuickCommand[]>([])

  /**
   * 获取下一个可用的颜色
   */
  function getNextColor(): QuickCommandColor {
    const usedColors = new Set(quickCommands.value.map(c => c.color))
    for (const color of QUICK_COMMAND_COLORS) {
      if (!usedColors.has(color)) {
        return color
      }
    }
    return QUICK_COMMAND_COLORS[Math.floor(Math.random() * QUICK_COMMAND_COLORS.length)]
  }

  /**
   * 加载快捷指令
   */
  async function loadQuickCommands() {
    try {
      // 加载回收站快捷指令
      await loadTrashQuickCommands()

      const filePath = await getUserDataFilePath('quickCommands.json')
      const exists = await window.electronAPI.exists(filePath)

      if (exists) {
        const result = await window.electronAPI.readFile(filePath, 'utf-8')
        if (result.success && result.data && typeof result.data === 'string') {
          const commands = JSON.parse(result.data) as QuickCommand[]
          // 兼容旧数据：为没有 color 属性的指令分配颜色
          commands.forEach(cmd => {
            if (!cmd.color) {
              cmd.color = getNextColor()
            }
          })
          quickCommands.value = commands
          await saveQuickCommands()
        }
      }
    } catch (error) {
      console.error('Failed to load quick commands:', error)
    }
  }

  /**
   * 保存快捷指令
   */
  async function saveQuickCommands() {
    try {
      const filePath = await getUserDataFilePath('quickCommands.json')
      await window.electronAPI.saveFile(
        filePath,
        JSON.stringify(quickCommands.value, null, 2)
      )
    } catch (error) {
      console.error('Failed to save quick commands:', error)
    }
  }

  /**
   * 创建新的快捷指令
   */
  async function createQuickCommand(name: string, content: string): Promise<QuickCommand> {
    const command: QuickCommand = {
      id: `qc-${Date.now()}`,
      name,
      content,
      color: getNextColor(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    quickCommands.value.push(command)
    await saveQuickCommands()

    return command
  }

  /**
   * 更新快捷指令
   */
  async function updateQuickCommand(
    commandId: string,
    updates: Partial<QuickCommand>
  ) {
    const index = quickCommands.value.findIndex(c => c.id === commandId)
    if (index !== -1) {
      Object.assign(quickCommands.value[index], {
        ...updates,
        updatedAt: Date.now()
      })
      await saveQuickCommands()
    }
  }

  /**
   * 删除快捷指令（移动到回收站）
   */
  async function deleteQuickCommand(commandId: string) {
    const command = quickCommands.value.find(c => c.id === commandId)
    if (!command) return

    // 创建回收站快捷指令
    const trashCommand: TrashQuickCommand = {
      ...command,
      deletedAt: Date.now()
    }

    // 添加到回收站列表
    trashQuickCommands.value.push(trashCommand)
    await saveTrashQuickCommands()

    // 从正常列表移除
    quickCommands.value = quickCommands.value.filter(c => c.id !== commandId)
    await saveQuickCommands()
  }

  /**
   * 从回收站恢复快捷指令
   */
  async function restoreQuickCommandFromTrash(commandId: string) {
    const trashCommand = trashQuickCommands.value.find(c => c.id === commandId)
    if (!trashCommand) return

    // 创建恢复的快捷指令（去掉 deletedAt）
    const restoredCommand: QuickCommand = {
      id: trashCommand.id,
      name: trashCommand.name,
      content: trashCommand.content,
      color: trashCommand.color,
      createdAt: trashCommand.createdAt,
      updatedAt: trashCommand.updatedAt
    }

    // 添加到正常列表
    quickCommands.value.push(restoredCommand)
    await saveQuickCommands()

    // 从回收站列表移除
    trashQuickCommands.value = trashQuickCommands.value.filter(c => c.id !== commandId)
    await saveTrashQuickCommands()
  }

  /**
   * 永久删除快捷指令
   */
  async function deleteQuickCommandPermanently(commandId: string) {
    trashQuickCommands.value = trashQuickCommands.value.filter(c => c.id !== commandId)
    await saveTrashQuickCommands()
  }

  /**
   * 保存回收站快捷指令
   */
  async function saveTrashQuickCommands() {
    try {
      const filePath = await getTrashQuickCommandsFilePath()
      await window.electronAPI.saveFile(
        filePath,
        JSON.stringify(trashQuickCommands.value, null, 2)
      )
    } catch (error) {
      console.error('Failed to save trash quick commands:', error)
    }
  }

  /**
   * 加载回收站快捷指令
   */
  async function loadTrashQuickCommands() {
    try {
      const filePath = await getTrashQuickCommandsFilePath()
      const exists = await window.electronAPI.exists(filePath)
      if (exists) {
        const result = await window.electronAPI.readFile(filePath, 'utf-8')
        if (result.success && result.data && typeof result.data === 'string') {
          trashQuickCommands.value = JSON.parse(result.data) as TrashQuickCommand[]
        }
      }
    } catch (error) {
      console.error('Failed to load trash quick commands:', error)
    }
  }

  /**
   * 根据 ID 获取快捷指令
   */
  function getQuickCommandById(id: string): QuickCommand | undefined {
    return quickCommands.value.find(c => c.id === id)
  }

  return {
    quickCommands,
    trashQuickCommands,
    loadQuickCommands,
    createQuickCommand,
    updateQuickCommand,
    deleteQuickCommand,
    restoreQuickCommandFromTrash,
    deleteQuickCommandPermanently,
    getQuickCommandById,
    getNextColor
  }
})