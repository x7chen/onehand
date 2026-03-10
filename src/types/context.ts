/**
 * 上下文文件类型
 */
export type ContextType = 'static' | 'dynamic'

/**
 * 上下文文件接口
 */
export interface ContextFile {
  id: string
  name: string
  type: ContextType
  color: string
  content: string
  createdAt: number
  updatedAt: number
  // 动态上下文关联的项目 ID（可选）
  projectId?: string
}

/**
 * 预设标签颜色
 */
export const CONTEXT_COLORS = [
  '#66bb6a', // 绿色
  '#4299e1', // 蓝色
  '#ed8936', // 橙色
  '#e53e3e', // 红色
  '#9f7aea', // 紫色
  '#ed64a6', // 粉色
  '#38b2ac', // 青色
  '#ecc94b', // 黄色
] as const

export type ContextColor = typeof CONTEXT_COLORS[number]

/**
 * 项目关联的上下文
 */
export interface ProjectContext {
  // 静态上下文文件 ID 列表（支持多选）
  staticContextIds?: string[]
  // 动态上下文文件 ID
  dynamicContextId?: string
}
