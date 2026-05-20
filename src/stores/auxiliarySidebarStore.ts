import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SemanticSearchResult } from '@/types/embedding'

export const useAuxiliarySidebarStore = defineStore('auxiliarySidebar', () => {
  // 是否显示辅助侧边栏
  const visible = ref(false)

  // 内容类型
  const contentType = ref<'relatedNotes' | null>(null)

  // 关联笔记列表
  const relatedNotes = ref<SemanticSearchResult[]>([])

  // 是否正在搜索
  const isSearching = ref(false)

  // 来源节点ID
  const sourceNodeId = ref<string | null>(null)

  // 来源节点标题（用于标题显示）
  const sourceNodeTitle = ref<string | null>(null)

  // 显示关联笔记（搜索完成时调用）
  function showRelatedNotes(notes: SemanticSearchResult[], nodeId: string, nodeTitle?: string) {
    contentType.value = 'relatedNotes'
    relatedNotes.value = notes
    sourceNodeId.value = nodeId
    sourceNodeTitle.value = nodeTitle || null
    isSearching.value = false  // 搜索完成，重置状态
    visible.value = true
  }

  // 设置搜索状态
  function setSearching(searching: boolean) {
    isSearching.value = searching
  }

  // 清空内容
  function clearContent() {
    contentType.value = null
    relatedNotes.value = []
    sourceNodeId.value = null
    sourceNodeTitle.value = null
    isSearching.value = false
  }

  // 切换显示/隐藏
  function toggle() {
    visible.value = !visible.value
    if (!visible.value) {
      clearContent()
    }
  }

  // 显示侧边栏
  function show() {
    visible.value = true
  }

  // 隐藏侧边栏
  function hide() {
    visible.value = false
    clearContent()
  }

  return {
    visible,
    contentType,
    relatedNotes,
    isSearching,
    sourceNodeId,
    sourceNodeTitle,
    showRelatedNotes,
    setSearching,
    clearContent,
    toggle,
    show,
    hide
  }
})