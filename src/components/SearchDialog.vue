<template>
  <div v-if="visible" class="search-dialog-overlay" @click="handleOverlayClick">
    <div class="search-dialog" @click.stop>
      <div class="search-header">
        <div class="search-input-wrapper">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" class="search-icon">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            :placeholder="t('common.searchAllNotes')"
            @input="handleSearch"
            @keyup.escape="close"
          />
          <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <button class="close-btn" @click="close" :title="t('common.close')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="search-results" ref="resultsContainer">
        <div v-if="isSearching" class="searching-state">
          <div class="loading-spinner"></div>
          <p>{{ t('common.searching') }}</p>
        </div>

        <div v-else-if="searchQuery && searchResults.length === 0" class="no-results">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <p>{{ t('common.noResults') }}</p>
        </div>

        <div v-else-if="searchResults.length > 0" class="results-list">
          <div class="results-count">
            {{ t('common.resultsFound', { count: searchResults.length }) }}
          </div>
          <div
            v-for="result in searchResults"
            :key="result.nodeId"
            class="result-item"
          >
            <div class="result-content" @click="openNodeDetail(result)">
              <div class="result-meta">
                <span class="notebook-name">{{ result.notebookName }}</span>
                <span class="separator">·</span>
                <span class="canvas-info">{{ result.canvasName }}</span>
                <template v-if="result.nodeTitle">
                  <span class="separator">·</span>
                  <span class="node-title">{{ result.nodeTitle }}</span>
                </template>
              </div>
              <div class="result-text" :title="result.fullText">
                <span class="text-line" v-html="result.highlightedText"></span>
              </div>
            </div>
            <button class="detail-btn" @click="openNodeDetail(result)" :title="t('voiceNote.viewDetails')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-else class="search-placeholder">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="placeholder-icon">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <p>{{ t('common.searchPlaceholder') }}</p>
        </div>
      </div>
    </div>

    <!-- Node Popup for detail view -->
    <NodePopup
      :visible="showNodePopup"
      :url="selectedNodeUrl"
      @close="closeNodePopup"
      @navigate="handleNavigate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NodePopup from '@/components/NodePopup.vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { generateDeepLinkUrl } from '@/composables/useDeepLink'
import type { DeepLinkData } from '@/composables/useDeepLink'
import type { Notebook, CanvasPage, CanvasNode } from '@/types/notebook'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

interface SearchResult {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  nodeTitle: string
  fieldType: 'transcript' | 'agentResult'
  fullText: string
  highlightedText: string
  matchIndex: number
}

const notebookStore = useNotebookStore()
const router = useRouter()
const { t } = useI18n()
const searchInput = ref<HTMLInputElement | null>(null)
const resultsContainer = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)
const showNodePopup = ref(false)
const selectedNodeUrl = ref('')

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Focus input when dialog opens
watch(() => props.visible, async (isVisible) => {
  if (isVisible) {
    await nextTick()
    searchInput.value?.focus()
  } else {
    // Reset state when closing
    searchQuery.value = ''
    searchResults.value = []
    showNodePopup.value = false
  }
})

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close()
  }
}

function close() {
  emit('close')
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  searchInput.value?.focus()
}

function handleSearch() {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true

  searchTimeout = setTimeout(() => {
    performSearch()
    isSearching.value = false
  }, 300)
}

function performSearch() {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    searchResults.value = []
    return
  }

  const results: SearchResult[] = []

  for (const notebook of notebookStore.notebooks) {
    if (!notebook.canvases) continue

    for (const canvas of notebook.canvases) {
      if (!canvas.nodes) continue

      for (const node of canvas.nodes) {
        // Search in transcript
        if (node.transcript) {
          const matches = findMatches(node.transcript, query)
          for (const match of matches) {
            results.push({
              notebookId: notebook.id,
              notebookName: notebook.name,
              canvasId: canvas.id,
              canvasName: getCanvasName(canvas, notebook),
              nodeId: node.id,
              nodeTitle: node.title || '',
              fieldType: 'transcript',
              fullText: node.transcript,
              highlightedText: createHighlightedText(node.transcript, query, match.index),
              matchIndex: match.index
            })
          }
        }

        // Search in agentResult
        if (node.agentResult) {
          const matches = findMatches(node.agentResult, query)
          for (const match of matches) {
            results.push({
              notebookId: notebook.id,
              notebookName: notebook.name,
              canvasId: canvas.id,
              canvasName: getCanvasName(canvas, notebook),
              nodeId: node.id,
              nodeTitle: node.title || '',
              fieldType: 'agentResult',
              fullText: node.agentResult,
              highlightedText: createHighlightedText(node.agentResult, query, match.index),
              matchIndex: match.index
            })
          }
        }
      }
    }
  }

  // Sort by notebook name and canvas name
  results.sort((a, b) => {
    if (a.notebookName !== b.notebookName) {
      return a.notebookName.localeCompare(b.notebookName)
    }
    if (a.canvasName !== b.canvasName) {
      return a.canvasName.localeCompare(b.canvasName)
    }
    return a.matchIndex - b.matchIndex
  })

  searchResults.value = results
}

function findMatches(text: string, query: string): { index: number }[] {
  const matches: { index: number }[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // 检查查询是否包含英文字母
  const hasEnglishLetters = /[a-zA-Z]/.test(query)

  if (hasEnglishLetters) {
    // 使用正则表达式匹配完整单词
    const regex = new RegExp(`\\b${escapeRegExp(lowerQuery)}\\b`, 'gi')
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      matches.push({ index: match.index })
    }
  } else {
    // 对于中文等非英文，使用普通匹配
    let index = 0
    while (true) {
      index = lowerText.indexOf(lowerQuery, index)
      if (index === -1) break
      matches.push({ index })
      index += 1
    }
  }

  return matches
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createHighlightedText(text: string, query: string, matchIndex: number): string {
  // CSS line-clamp: 2 大约可显示 70-90 个中文字符或 100 个英文字符
  // 设置较小的长度确保匹配词在 CSS 截断范围内可见
  const visibleLength = 80

  // 计算显示片段的起始位置，让匹配词尽量在片段中间偏前
  const halfVisible = visibleLength / 2
  let start = Math.max(0, matchIndex - halfVisible * 0.6)
  let end = Math.min(text.length, start + visibleLength)

  // 如果末尾不够长，调整起始位置
  if (end - start < visibleLength) {
    start = Math.max(0, end - visibleLength)
  }

  const beforeMatch = escapeHtml(text.slice(start, matchIndex))
  const matchedText = escapeHtml(text.slice(matchIndex, matchIndex + query.length))
  const afterMatch = escapeHtml(text.slice(matchIndex + query.length, end))

  let result = ''

  // 如果截断了开头，添加省略号
  if (start > 0) {
    result += '...'
  }

  result += `${beforeMatch}<mark class="highlight">${matchedText}</mark>${afterMatch}`

  // 如果截断了末尾，添加省略号
  if (end < text.length) {
    result += '...'
  }

  return result
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function getCanvasName(canvas: CanvasPage, notebook: Notebook): string {
  if (canvas.pdfPage !== undefined) {
    return t('common.pageN', { n: canvas.pdfPage })
  }

  // Find canvas index for non-PDF notebooks
  const index = notebook.canvases?.findIndex(c => c.id === canvas.id) ?? 0
  if (notebook.canvases && notebook.canvases.length > 1) {
    return t('common.pageN', { n: index + 1 })
  }
  return t('common.canvas')
}

function openNodeDetail(result: SearchResult) {
  selectedNodeUrl.value = generateDeepLinkUrl(result.nodeId)
  showNodePopup.value = true
}

function closeNodePopup() {
  showNodePopup.value = false
  selectedNodeUrl.value = ''
}

function handleNavigate(data: DeepLinkData) {
  // Navigate to the node first, then close dialogs
  const notebook = notebookStore.notebooks.find(p => p.id === data.notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)

    // Navigate with query parameters to activate the node
    if (notebook.pdfPath) {
      router.push(`/pdf/${data.notebookId}?nodeId=${data.nodeId}`)
    } else {
      router.push(`/multi-chat/${data.notebookId}?canvasId=${data.canvasId}&nodeId=${data.nodeId}`)
    }
  }

  // Close dialogs after navigation
  closeNodePopup()
  close()
}
</script>

<style scoped>
.search-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  z-index: 2500;
}

.search-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.search-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 8px 12px;
}

.search-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-input-wrapper input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
}

.search-input-wrapper input::placeholder {
  color: var(--text-secondary);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: var(--text-secondary);
  color: var(--bg-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.searching-state,
.no-results,
.search-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-icon,
.placeholder-icon {
  color: var(--text-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.searching-state p,
.no-results p,
.search-placeholder p {
  color: var(--text-secondary);
}

.results-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  padding: 0 4px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  background: var(--border-color);
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.notebook-name {
  color: var(--color-primary);
  font-weight: 500;
}

.separator {
  opacity: 0.5;
}

.canvas-info {
  opacity: 0.8;
}

.node-title {
  font-weight: 500;
}

.result-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.text-line {
  word-break: break-all;
}

.result-text :deep(.highlight) {
  background: rgba(255, 200, 0, 0.4);
  color: inherit;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}

.detail-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.detail-btn:hover {
  background: var(--color-primary);
  color: white;
}
</style>