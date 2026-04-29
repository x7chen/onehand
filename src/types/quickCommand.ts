/**
 * 快捷指令接口
 */
export interface QuickCommand {
  id: string
  name: string
  content: string  // 提示词内容
  color: string
  createdAt: number
  updatedAt: number
}

/**
 * 预设指令颜色
 */
export const QUICK_COMMAND_COLORS = [
  '#66bb6a', // 绿色
  '#4299e1', // 蓝色
  '#ed8936', // 橙色
  '#e53e3e', // 红色
  '#9f7aea', // 紫色
  '#ed64a6', // 粉色
  '#38b2ac', // 青色
  '#ecc94b', // 黄色
] as const

export type QuickCommandColor = typeof QUICK_COMMAND_COLORS[number]

/**
 * 回收站快捷指令
 */
export interface TrashQuickCommand extends QuickCommand {
  deletedAt: number
}