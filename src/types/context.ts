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
  content: string
  createdAt: number
  updatedAt: number
  // 动态上下文关联的项目 ID（可选）
  projectId?: string
}

/**
 * 项目关联的上下文
 */
export interface ProjectContext {
  // 静态上下文文件 ID
  staticContextId?: string
  // 动态上下文文件 ID
  dynamicContextId?: string
}
