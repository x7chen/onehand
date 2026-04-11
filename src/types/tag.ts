/**
 * 标签接口
 */
export interface Tag {
  id: string
  name: string
  color: string
  createdAt: number
  updatedAt: number
}

/**
 * 预设标签颜色
 */
export const TAG_COLORS = [
  '#66bb6a', // 绿色
  '#4299e1', // 蓝色
  '#ed8936', // 橙色
  '#e53e3e', // 红色
  '#9f7aea', // 紫色
  '#ed64a6', // 粋色
  '#38b2ac', // 色
  '#ecc94b', // 黄色
] as const

export type TagColor = typeof TAG_COLORS[number]