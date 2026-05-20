<template>
  <div class="auxiliary-sidebar" v-show="auxiliarySidebarStore.visible" :style="{ width: sidebarWidth + 'px' }">
    <div class="auxiliary-sidebar-resizer" @mousedown="startResize"></div>
    <div class="auxiliary-sidebar-content">
      <!-- 标题栏 -->
      <div class="auxiliary-sidebar-header">
        <span class="auxiliary-sidebar-title">{{ title }}</span>
        <button class="auxiliary-sidebar-close-btn" @click="auxiliarySidebarStore.hide()" :title="t('common.close')">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- 关联笔记内容 -->
      <div
        v-if="auxiliarySidebarStore.contentType === 'relatedNotes'"
        class="auxiliary-sidebar-body"
        :class="{ 'scrollbar-visible': scrollbarVisible }"
        @scroll="handleScroll"
      >
        <!-- 搜索中状态 -->
        <div v-if="auxiliarySidebarStore.isSearching" class="related-notes-loading">
          <div class="loading-spinner"></div>
          <span>{{ t('voiceNote.searchingRelated') }}</span>
        </div>
        <!-- 搜索结果列表 -->
        <div v-else-if="auxiliarySidebarStore.relatedNotes.length > 0" class="related-notes-list">
          <div
            v-for="result in auxiliarySidebarStore.relatedNotes"
            :key="result.nodeId + result.fieldType"
            class="related-note-item"
            @click="navigateToRelatedNote(result)"
          >
            <div class="related-note-meta">
              <span class="related-notebook-name">{{ result.notebookName }}</span>
              <span v-if="result.nodeTitle" class="related-note-separator">·</span>
              <span v-if="result.nodeTitle" class="related-note-title">{{ result.nodeTitle }}</span>
              <span class="related-note-separator">·</span>
              <span class="related-note-similarity">{{ Math.round(result.similarity * 100) }}%</span>
            </div>
            <div class="related-note-preview">{{ getPreviewText(result.fullText) }}</div>
          </div>
        </div>
        <!-- 无结果状态 -->
        <div v-else class="related-notes-empty">
          <span>{{ t('voiceNote.noRelatedNotes') }}</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="auxiliary-sidebar-empty">
        <span>{{ t('auxiliarySidebar.noContent') }}</span>
      </div>
    </div>

    <!-- 关联笔记详情弹窗 -->
    <NodePopup
      :visible="showRelatedNodePopup"
      :url="relatedNodeUrl"
      @close="closeRelatedNodePopup"
      @navigate="handleRelatedNodeNavigate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuxiliarySidebarStore } from '@/stores/auxiliarySidebarStore'
import { useNotebookStore } from '@/stores/notebookStore'
import NodePopup from '@/components/NodePopup.vue'
import { findNodeByNodeId, generateDeepLinkUrl } from '@/composables/useDeepLink'
import type { SemanticSearchResult } from '@/types/embedding'
import type { NodePopupData, DeepLinkData } from '@/composables/useDeepLink'

const { t } = useI18n()
const router = useRouter()
const auxiliarySidebarStore = useAuxiliarySidebarStore()
const notebookStore = useNotebookStore()

// 侧边栏宽度
const sidebarWidth = ref(280)

// 滚动条显示状态
const scrollbarVisible = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

// 关联笔记详情弹窗
const showRelatedNodePopup = ref(false)
const relatedNodeUrl = ref('')
const relatedNodeData = ref<NodePopupData | null>(null)

// 标题
const title = computed(() => {
  if (auxiliarySidebarStore.contentType === 'relatedNotes') {
    return t('voiceNote.relatedNotes')
  }
  return t('auxiliarySidebar.title')
})

// 获取预览文本
function getPreviewText(text: string, maxLength = 100): string {
  if (!text) return ''
  const cleaned = text.replace(/\n+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength) + '...'
}

// 滚动条自动隐藏
function handleScroll() {
  scrollbarVisible.value = true
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
  scrollTimeout = setTimeout(() => {
    scrollbarVisible.value = false
  }, 1000) // 1秒后隐藏
}

// 点击关联笔记 - 显示详情弹窗
async function navigateToRelatedNote(result: SemanticSearchResult) {
  const nodeData = await findNodeByNodeId(result.nodeId)
  if (nodeData) {
    relatedNodeData.value = nodeData
    relatedNodeUrl.value = generateDeepLinkUrl(result.nodeId)
    showRelatedNodePopup.value = true
  }
}

// 关闭关联笔记详情弹窗
function closeRelatedNodePopup() {
  showRelatedNodePopup.value = false
  relatedNodeUrl.value = ''
  relatedNodeData.value = null
}

// 从详情弹窗跳转到笔记
function handleRelatedNodeNavigate(data: DeepLinkData) {
  closeRelatedNodePopup()
  const notebook = notebookStore.notebooks.find(n => n.id === data.notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)
    if (notebook.pdfPath) {
      router.push(`/pdf/${data.notebookId}?nodeId=${data.nodeId}`)
    } else {
      router.push(`/multi-chat/${data.notebookId}?nodeId=${data.nodeId}`)
    }
  }
}

// 拖拽调整宽度
function startResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  function handleResize(e: MouseEvent) {
    const minWidth = 200
    const maxWidth = 600
    const diff = startX - e.clientX // 向左拖动增加宽度
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + diff))
    sidebarWidth.value = newWidth
  }

  function stopResize() {
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
  }

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}
</script>

<style scoped>
.auxiliary-sidebar {
  min-width: 200px;
  max-width: 600px;
  height: 100%;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  flex-shrink: 0;
  display: flex;
  position: relative;
}

.auxiliary-sidebar-resizer {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  z-index: 10;
}

.auxiliary-sidebar-resizer:hover {
  background: var(--color-primary);
  opacity: 0.5;
}

.auxiliary-sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-left: 4px;
}

.auxiliary-sidebar-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.auxiliary-sidebar-title {
  font-size: var(--font-size-heading);
  font-weight: 500;
  color: var(--text-primary);
}

.auxiliary-sidebar-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.auxiliary-sidebar-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.auxiliary-sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  /* 默认隐藏滚动条 */
  scrollbar-color: transparent transparent;
}

.auxiliary-sidebar-body::-webkit-scrollbar {
  width: 4px;
}

.auxiliary-sidebar-body::-webkit-scrollbar-track {
  background: transparent;
}

.auxiliary-sidebar-body::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
}

/* 滚动时显示滚动条 */
.auxiliary-sidebar-body.scrollbar-visible {
  scrollbar-color: rgba(128, 128, 128, 0.3) transparent;
}

.auxiliary-sidebar-body.scrollbar-visible::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
}

.auxiliary-sidebar-body.scrollbar-visible::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}

/* 深色模式下滚动条 */
:root.dark .auxiliary-sidebar-body.scrollbar-visible {
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

:root.dark .auxiliary-sidebar-body.scrollbar-visible::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

:root.dark .auxiliary-sidebar-body.scrollbar-visible::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}

.auxiliary-sidebar-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: var(--font-size-body);
}

/* 关联笔记列表样式 */
.related-notes-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.related-notes-loading span {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}

.related-notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.related-note-item {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.related-note-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-color);
}

.related-note-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-small);
  margin-bottom: 6px;
}

.related-notebook-name {
  color: var(--color-primary);
  font-weight: 500;
}

.related-note-separator {
  color: var(--text-tertiary);
}

.related-note-title {
  color: var(--text-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-note-similarity {
  color: var(--text-secondary);
}

.related-note-preview {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.related-notes-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: var(--font-size-body);
}
</style>