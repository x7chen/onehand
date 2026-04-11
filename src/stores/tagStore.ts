import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tag, TagColor } from '@/types/tag'
import { TAG_COLORS } from '@/types/tag'
import { getUserDataFilePath } from '@/utils/userFilesPath'

export const useTagStore = defineStore('tag', () => {
  const tags = ref<Tag[]>([])

  /**
   * 获取下一个可用的颜色
   */
  function getNextColor(): TagColor {
    const usedColors = new Set(tags.value.map(t => t.color))
    for (const color of TAG_COLORS) {
      if (!usedColors.has(color)) {
        return color
      }
    }
    return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]
  }

  /**
   * 加载标签
   */
  async function loadTags() {
    try {
      const filePath = await getUserDataFilePath('tags.json')
      const exists = await window.electronAPI.exists(filePath)

      if (exists) {
        const result = await window.electronAPI.readFile(filePath, 'utf-8')
        if (result.success && result.data && typeof result.data === 'string') {
          const loadedTags = JSON.parse(result.data) as Tag[]
          // 兼容旧数据：为没有 color 属性的标签分配颜色
          loadedTags.forEach(tag => {
            if (!tag.color) {
              tag.color = getNextColor()
            }
          })
          tags.value = loadedTags
          await saveTags()
        }
      }
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  /**
   * 保存标签
   */
  async function saveTags() {
    try {
      const filePath = await getUserDataFilePath('tags.json')
      await window.electronAPI.saveFile(
        filePath,
        JSON.stringify(tags.value, null, 2)
      )
    } catch (error) {
      console.error('Failed to save tags:', error)
    }
  }

  /**
   * 创建新的标签
   */
  async function createTag(name: string): Promise<Tag> {
    // 检查是否已存在同名标签
    const existingTag = tags.value.find(t => t.name === name)
    if (existingTag) {
      return existingTag
    }

    const tag: Tag = {
      id: `tag-${Date.now()}`,
      name,
      color: getNextColor(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    tags.value.push(tag)
    await saveTags()

    return tag
  }

  /**
   * 更新标签
   */
  async function updateTag(
    tagId: string,
    updates: Partial<Tag>
  ) {
    const index = tags.value.findIndex(t => t.id === tagId)
    if (index !== -1) {
      Object.assign(tags.value[index], {
        ...updates,
        updatedAt: Date.now()
      })
      await saveTags()
    }
  }

  /**
   * 删除标签
   */
  async function deleteTag(tagId: string) {
    tags.value = tags.value.filter(t => t.id !== tagId)
    await saveTags()
  }

  /**
   * 删除标签（按名称）
   */
  async function deleteTagByName(name: string) {
    const tag = tags.value.find(t => t.name === name)
    if (tag) {
      await deleteTag(tag.id)
    }
  }

  /**
   * 根据 ID 获取标签
   */
  function getTagById(id: string): Tag | undefined {
    return tags.value.find(t => t.id === id)
  }

  /**
   * 根据名称获取标签
   */
  function getTagByName(name: string): Tag | undefined {
    return tags.value.find(t => t.name === name)
  }

  /**
   * 获取所有标签名称列表
   */
  const allTagNames = computed(() => tags.value.map(t => t.name))

  /**
   * 搜索标签（用于自动补全）
   */
  function searchTags(query: string): Tag[] {
    if (!query.trim()) {
      return tags.value
    }
    const lowerQuery = query.toLowerCase()
    return tags.value.filter(t => t.name.toLowerCase().includes(lowerQuery))
  }

  /**
   * 确保标签存在（不存在则创建）
   */
  async function ensureTagExists(name: string): Promise<Tag> {
    const existingTag = getTagByName(name)
    if (existingTag) {
      return existingTag
    }
    return createTag(name)
  }

  return {
    tags,
    allTagNames,
    loadTags,
    saveTags,
    createTag,
    updateTag,
    deleteTag,
    deleteTagByName,
    getTagById,
    getTagByName,
    searchTags,
    ensureTagExists,
    getNextColor
  }
})