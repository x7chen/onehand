<template>
  <div class="search-dropdown">
    <!-- 搜索输入框 -->
    <div class="search-input-wrapper">
      <input
        ref="searchInputRef"
        v-model="dropdownStore.filterText"
        class="search-input"
        type="text"
        :placeholder="searchMode === 'semantic' ? t('common.semanticSearchPlaceholder') : t('common.searchPlaceholder')"
        @keydown.escape="closeDropdown"
      />
      <button v-if="dropdownStore.filterText" class="clear-btn" @click="clearSearch">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    <!-- 搜索头部：模式切换 + 索引状态 -->
    <div class="search-header">
      <div class="search-mode-toggle">
        <button
          :class="['mode-btn', { active: searchMode === 'keyword' }]"
          @click="setSearchMode('keyword')"
          :title="t('common.keywordSearch')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <span>{{ t('common.keywordSearch') }}</span>
        </button>
        <button
          :class="['mode-btn', { active: searchMode === 'semantic' }]"
          @click="setSearchMode('semantic')"
          :title="t('common.semanticSearch')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span>{{ t('common.semanticSearch') }}</span>
        </button>
      </div>

      <!-- 索引状态栏（语义模式） -->
      <div v-if="searchMode === 'semantic'" class="index-status-bar">
        <div v-if="vectorStore.isIndexing" class="indexing-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${vectorStore.indexProgress}%` }"></div>
          </div>
          <span class="progress-text">{{ t('common.indexingProgress', { progress: vectorStore.indexProgress }) }}</span>
        </div>
        <div v-else-if="indexStatus.outdatedNodes > 0" class="update-hint">
          <span>{{ t('common.indexNeedsUpdate', { count: indexStatus.outdatedNodes }) }}</span>
          <button class="update-btn" @click="updateIndex">{{ t('common.updateIndex') }}</button>
          <button v-if="hasFailedNodes" class="view-btn" @click="showSkippedDialog = true">
            {{ t('common.viewSkipped') }} ({{ lastFailedCount }})
          </button>
        </div>
        <div v-else class="index-ready">
          <span>{{ t('common.indexReady', { count: indexStatus.indexedNodes }) }}</span>
          <button v-if="hasFailedNodes" class="view-btn" @click="showSkippedDialog = true">
            {{ t('common.viewSkipped') }} ({{ lastFailedCount }})
          </button>
        </div>
      </div>
    </div>

    <!-- 过滤器区域 -->
    <div class="filter-bar">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">{{ t('common.notebook') }}</label>
          <div class="multi-select-wrapper" ref="notebookSelectRef">
            <button class="multi-select-btn" @click="toggleNotebookSelect">
              <span class="multi-select-text">{{ selectedNotebooksText }}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="multi-select-arrow" :class="{ open: showNotebookSelect }">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
            <div v-if="showNotebookSelect" class="multi-select-dropdown">
              <div class="multi-select-item" @click="toggleAllNotebooks">
                <input type="checkbox" :checked="isAllNotebooksSelected" class="multi-select-checkbox" />
                <span>{{ t('common.allNotebooks') }}</span>
              </div>
              <div
                v-for="nb in notebooks"
                :key="nb.id"
                class="multi-select-item"
                @click="toggleNotebookFilter(nb.id)"
              >
                <input type="checkbox" :checked="filterNotebookIds.includes(nb.id)" class="multi-select-checkbox" />
                <span>{{ nb.name }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-label">{{ t('common.timeFilter') }}</label>
          <select v-model="filterTimeType" class="filter-select" @change="handleFilterChange">
            <option value="">{{ t('common.allTime') }}</option>
            <option value="createdAt">{{ t('common.createdAt') }}</option>
            <option value="updatedAt">{{ t('common.updatedAt') }}</option>
          </select>
        </div>
        <div v-if="filterTimeType" class="filter-group date-range">
          <input
            type="text"
            v-model="filterDateStart"
            class="filter-date-input"
            :placeholder="t('common.startDate')"
            @change="handleFilterChange"
            onfocus="this.type='date'"
            onblur="if(!this.value)this.type='text'"
          />
          <input
            type="text"
            v-model="filterDateEnd"
            class="filter-date-input"
            :placeholder="t('common.endDate')"
            @change="handleFilterChange"
            onfocus="this.type='date'"
            onblur="if(!this.value)this.type='text'"
          />
        </div>
      </div>
    </div>

    <!-- 搜索历史区域（无查询时显示） -->
    <div v-if="!filterText && recentHistory.length > 0" class="search-history-section">
      <div class="search-history-list">
        <div
          v-for="(item, index) in allHistoryList"
          :key="item.timestamp"
          class="search-history-item"
          @click="selectHistoryItem(item)"
        >
          <div class="history-item-content">
            <div class="history-query">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="history-icon">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <span class="history-query-text">{{ item.query }}</span>
              <span class="history-separator">·</span>
              <span class="history-time">{{ searchHistoryStore.formatTime(item.timestamp) }}</span>
              <span class="history-mode-badge" :class="item.searchMode">
                {{ item.searchMode === 'keyword' ? t('common.keywordSearch') : t('common.semanticSearch') }}
              </span>
            </div>
          </div>
          <button class="remove-history-btn" @click.stop="removeHistoryItemFromList(index)" :title="t('common.removeHistory')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="search-history-header">
        <button v-if="searchHistoryStore.historyItems.length > 5" class="more-history-btn" @click="toggleShowAll">
          {{ showAllHistory ? t('common.collapse') : t('common.more') }}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="more-icon" :class="{ 'is-expanded': showAllHistory }">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </button>
        <button class="clear-history-btn" @click="handleClearHistory" :title="t('common.clearHistory')">
          {{ t('common.clearHistory') }}
        </button>
      </div>
    </div>

    <!-- 搜索结果区域 -->
    <div class="search-results" ref="resultsContainer" v-if="filterText || recentHistory.length === 0">
      <div v-if="isSearching" class="searching-state">
        <div class="loading-spinner"></div>
        <p>{{ t('common.searching') }}</p>
      </div>

      <div v-else-if="filterText && searchResults.length === 0" class="no-results">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" class="empty-icon">
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
              <template v-if="result.pdfPage">
                <span class="separator">·</span>
                <span class="canvas-info">{{ t('common.pageN', { n: result.pdfPage }) }}</span>
              </template>
              <template v-if="result.nodeTitle">
                <span class="separator">·</span>
                <span class="node-title">{{ result.nodeTitle }}</span>
              </template>
              <template v-if="result.similarity">
                <span class="separator">·</span>
                <span class="similarity-score">{{ Math.round(result.similarity * 100) }}%</span>
              </template>
            </div>
            <div class="result-text" :title="result.fullText">
              <span class="text-line" v-html="result.highlightedText || escapeHtml(result.fullText.slice(0, 100)) + (result.fullText.length > 100 ? '...' : '')"></span>
            </div>
          </div>
          <button class="detail-btn" @click="openNodeDetail(result)" :title="t('voiceNote.viewDetails')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-else-if="!filterText && recentHistory.length === 0" class="search-placeholder">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" class="placeholder-icon">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <p>{{ searchMode === 'semantic' ? t('common.semanticSearchPlaceholder') : t('common.searchPlaceholder') }}</p>
      </div>
    </div>

    <!-- Node Popup for detail view -->
    <NodePopup
      :visible="showNodePopup"
      :url="selectedNodeUrl"
      @close="closeNodePopup"
      @navigate="handleNavigate"
    />

    <!-- Skipped Nodes Dialog -->
    <SkippedNodesDialog
      :visible="showSkippedDialog"
      :skippedNodes="skippedNodes"
      @close="closeSkippedDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NodePopup from '@/components/NodePopup.vue'
import SkippedNodesDialog from '@/components/SkippedNodesDialog.vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { useVectorStore } from '@/stores/vectorStore'
import { useSearchHistoryStore } from '@/stores/searchHistoryStore'
import { useDropdownStore } from '@/stores/dropdownStore'
import { generateDeepLinkUrl } from '@/composables/useDeepLink'
import type { DeepLinkData } from '@/composables/useDeepLink'
import type { CanvasNode } from '@/types/notebook'
import type { IndexStatus, SkippedIndexNode } from '@/types/embedding'
import { keywordSearch, semanticSearch, checkIndexNeedsUpdate, type UnifiedSearchResult, type SearchMode } from '@/services/semanticSearch'
import { updateIndex as updateVectorIndex } from '@/services/semanticSearch'
import type { SearchHistoryItem } from '@/stores/searchHistoryStore'

interface SearchResult {
  notebookId: string
  notebookName: string
  nodeId: string
  nodeTitle: string
  pdfPage?: number
  fieldType: 'transcript' | 'agentResult'
  fullText: string
  highlightedText: string
  matchIndex: number
  similarity?: number
}

const notebookStore = useNotebookStore()
const vectorStore = useVectorStore()
const searchHistoryStore = useSearchHistoryStore()
const dropdownStore = useDropdownStore()
const router = useRouter()
const { t } = useI18n()
const resultsContainer = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)
const showNodePopup = ref(false)
const selectedNodeUrl = ref('')
const searchMode = ref<SearchMode>('keyword')

// 用于条件判断
const filterText = computed(() => dropdownStore.filterText)

// 清空搜索
function clearSearch() {
  dropdownStore.updateFilterText('')
  searchResults.value = []
  searchInputRef.value?.focus()
}

// 关闭下拉框
function closeDropdown() {
  dropdownStore.closeDropdown()
}
const indexStatus = ref<IndexStatus>({
  totalNodes: 0,
  indexedNodes: 0,
  outdatedNodes: 0,
  isIndexing: false
})

// 过滤状态
const filterNotebookIds = ref<string[]>([])
const filterTimeType = ref<'createdAt' | 'updatedAt' | ''>('')
const filterDateStart = ref('')
const filterDateEnd = ref('')
const showNotebookSelect = ref(false)
const notebookSelectRef = ref<HTMLElement | null>(null)

// 笔记本列表
const notebooks = computed(() => notebookStore.notebooks.filter(nb => !nb.isTrash))

// 选中笔记本的显示文本
const selectedNotebooksText = computed(() => {
  if (filterNotebookIds.value.length === 0) {
    return t('common.allNotebooks')
  }
  if (filterNotebookIds.value.length === notebooks.value.length) {
    return t('common.allNotebooks')
  }
  if (filterNotebookIds.value.length <= 3) {
    const names = filterNotebookIds.value.map(id => {
      const nb = notebooks.value.find(n => n.id === id)
      return nb?.name || ''
    })
    return names.join(', ')
  }
  return t('common.selectedNotebooksCount', { count: filterNotebookIds.value.length })
})

// 是否选中了全部笔记本
const isAllNotebooksSelected = computed(() => {
  return filterNotebookIds.value.length === notebooks.value.length
})

// 切换笔记本选择下拉菜单
function toggleNotebookSelect() {
  showNotebookSelect.value = !showNotebookSelect.value
}

// 全选/取消全选笔记本
function toggleAllNotebooks() {
  if (isAllNotebooksSelected.value || filterNotebookIds.value.length === 0) {
    filterNotebookIds.value = []
  } else {
    filterNotebookIds.value = notebooks.value.map(nb => nb.id)
  }
  handleFilterChange()
}

// 切换单个笔记本选择
function toggleNotebookFilter(notebookId: string) {
  const index = filterNotebookIds.value.indexOf(notebookId)
  if (index === -1) {
    filterNotebookIds.value.push(notebookId)
  } else {
    filterNotebookIds.value.splice(index, 1)
  }
  handleFilterChange()
}

// Skipped nodes state
const showSkippedDialog = ref(false)
const skippedNodes = ref<SkippedIndexNode[]>([])
const lastFailedCount = ref(0)

// Computed property for explicit debugging
const hasFailedNodes = computed(() => {
  return lastFailedCount.value > 0
})

// Search history
const recentHistory = computed(() => searchHistoryStore.recentHistory)
const showAllHistory = ref(false)

const allHistoryList = computed(() => {
  if (showAllHistory.value) {
    return searchHistoryStore.historyItems
  }
  return searchHistoryStore.recentHistory
})

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Load search history on mount
onMounted(async () => {
  await searchHistoryStore.loadHistory()
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})

// 监听搜索查询变化触发搜索
watch(filterText, (text) => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (!text.trim()) {
    searchResults.value = []
    isSearching.value = false
    return
  }

  isSearching.value = true

  searchTimeout = setTimeout(async () => {
    await performSearch()
    isSearching.value = false
  }, searchMode.value === 'semantic' ? 500 : 300)
})

// 监听搜索下拉打开时聚焦输入框并检查索引状态
watch(() => dropdownStore.showDropdown && dropdownStore.dropdownType === 'search', async (isSearchOpen) => {
  if (isSearchOpen) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
    if (searchMode.value === 'semantic') {
      await checkAndUpdateIndexStatus()
    }
  }
})

// 点击外部关闭笔记本下拉菜单
function handleDocumentClick(e: MouseEvent) {
  if (showNotebookSelect.value && notebookSelectRef.value) {
    const target = e.target as Node
    if (!notebookSelectRef.value.contains(target)) {
      showNotebookSelect.value = false
    }
  }
}

// 过滤变化处理
function handleFilterChange() {
  if (filterText.value.trim()) {
    // 重新触发搜索
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    isSearching.value = true
    searchTimeout = setTimeout(async () => {
      await performSearch()
      isSearching.value = false
    }, searchMode.value === 'semantic' ? 500 : 300)
  }
}

// 检查节点是否符合时间过滤条件
function matchesTimeFilter(node: CanvasNode): boolean {
  if (!filterTimeType.value) return true

  const timestamp = filterTimeType.value === 'createdAt' ? node.createdAt : (node.updatedAt || node.createdAt)
  if (!timestamp) return true

  const nodeDate = new Date(timestamp)
  const startDate = filterDateStart.value ? new Date(filterDateStart.value) : null
  const endDate = filterDateEnd.value ? new Date(filterDateEnd.value + 'T23:59:59') : null

  if (startDate && nodeDate < startDate) return false
  if (endDate && nodeDate > endDate) return false

  return true
}

// Search history functions
function selectHistoryItem(item: SearchHistoryItem) {
  dropdownStore.updateFilterText(item.query)
  searchMode.value = item.searchMode
}

function removeHistoryItemFromList(index: number) {
  const actualIndex = showAllHistory.value ? index : index
  searchHistoryStore.removeHistoryItem(actualIndex)
}

async function handleClearHistory() {
  await searchHistoryStore.clearHistory()
  showAllHistory.value = false
}

function toggleShowAll() {
  showAllHistory.value = !showAllHistory.value
}

async function setSearchMode(mode: SearchMode) {
  searchMode.value = mode

  if (mode === 'semantic') {
    if (!vectorStore.isInitialized) {
      await vectorStore.initVectorDb()
    }
    await checkAndUpdateIndexStatus()
  }

  // 如果有查询，重新搜索
  if (filterText.value.trim()) {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    isSearching.value = true
    searchTimeout = setTimeout(async () => {
      await performSearch()
      isSearching.value = false
    }, searchMode.value === 'semantic' ? 500 : 300)
  }
}

async function checkAndUpdateIndexStatus() {
  const status = await vectorStore.getIndexStatus()
  indexStatus.value = status
}

async function updateIndex() {
  if (vectorStore.isIndexing) {
    console.warn('Already indexing')
    return
  }

  try {
    if (!vectorStore.isInitialized) {
      const success = await vectorStore.initVectorDb()
      if (!success) {
        console.error('Failed to initialize vector database')
        return
      }
    }

    const result = await vectorStore.indexAllNotebooks((progress) => {
      indexStatus.value.progress = progress
    })

    if (result.indexedCount > 0) {
      indexStatus.value.indexedNodes += result.indexedCount
      indexStatus.value.outdatedNodes = 0
    }

    if (result.failedNodes && result.failedNodes.length > 0) {
      lastFailedCount.value = result.failedNodes.length
      skippedNodes.value = result.failedNodes
    } else {
      lastFailedCount.value = 0
      skippedNodes.value = []
    }
  } catch (error) {
    console.error('Update index error:', error)
  } finally {
    await checkAndUpdateIndexStatus()
  }
}

function closeSkippedDialog() {
  showSkippedDialog.value = false
}

async function performSearch() {
  const query = filterText.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }

  // Save to search history
  await searchHistoryStore.addHistoryItem(query, searchMode.value)

  let results: UnifiedSearchResult[]

  if (searchMode.value === 'semantic') {
    results = await semanticSearch(query)
  } else {
    results = keywordSearch(query)
  }

  // 应用过滤条件
  results = results.filter(result => {
    if (filterNotebookIds.value.length > 0 && !filterNotebookIds.value.includes(result.notebookId)) {
      return false
    }

    if (filterTimeType.value) {
      const notebook = notebookStore.notebooks.find(nb => nb.id === result.notebookId)
      const node = notebook?.nodes?.find(n => n.id === result.nodeId)
      if (node && !matchesTimeFilter(node)) {
        return false
      }
    }

    return true
  })

  searchResults.value = results.map(r => ({
    ...r,
    matchIndex: r.matchIndex || 0,
    highlightedText: r.highlightedText || escapeHtml(r.fullText.slice(0, 100)) + (r.fullText.length > 100 ? '...' : '')
  })) as SearchResult[]
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
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
  const notebook = notebookStore.notebooks.find(p => p.id === data.notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)

    if (notebook.pdfPath) {
      router.push(`/pdf/${data.notebookId}?nodeId=${data.nodeId}`)
    } else {
      router.push(`/multi-chat/${data.notebookId}?nodeId=${data.nodeId}`)
    }
  }

  closeNodePopup()
  dropdownStore.closeDropdown()
}
</script>

<style scoped>
.search-dropdown {
  background: var(--bg-primary);
  padding: 8px;
  border-radius: 8px;
  width: 600px;
  max-height: 500px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 16px var(--shadow-color);
  /* 确保不受 Electron 拖拽区域影响 */
  -webkit-app-region: no-drag;
}

/* 搜索输入框容器 */
.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-body);
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  box-sizing: border-box;
  margin-bottom: 8px;
}

.search-input {
  flex: 1;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-heading);
  outline: none;
  /* 确保可以接收输入 */
  pointer-events: auto;
  user-select: text;
  /* 确保不受 Electron 拖拽区域影响 */
  -webkit-app-region: no-drag;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
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

/* 搜索头部 */
.search-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}

.search-mode-toggle {
  display: flex;
  gap: 8px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: var(--font-size-body);
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: var(--border-color);
}

.mode-btn.active {
  background: var(--color-primary);
  color: white;
}

/* 索引状态栏 */
.index-status-bar {
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: var(--font-size-small);
}

.indexing-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}

.progress-text {
  color: var(--text-secondary);
}

.update-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.update-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: var(--color-primary);
  color: white;
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s;
}

.update-btn:hover {
  opacity: 0.9;
}

.index-ready {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.view-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-primary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn:hover {
  background: rgba(255, 152, 0, 0.3);
}

/* 过滤器区域 */
.filter-bar {
  padding: 8px 12px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-group.date-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-label {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  white-space: nowrap;
}

.filter-select {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  cursor: pointer;
  min-width: 100px;
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.filter-date-input {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  cursor: pointer;
  width: 110px;
}

.filter-date-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Multi select */
.multi-select-wrapper {
  position: relative;
}

.multi-select-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  cursor: pointer;
  min-width: 120px;
  max-width: 200px;
}

.multi-select-btn:hover {
  border-color: var(--color-primary);
}

.multi-select-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-small);
}

.multi-select-arrow {
  color: var(--text-secondary);
  transition: transform 0.2s;
  width: 12px;
  height: 12px;
}

.multi-select-arrow.open {
  transform: rotate(180deg);
}

.multi-select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 150px;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  font-size: var(--font-size-small);
}

.multi-select-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: var(--font-size-small);
}

.multi-select-item:hover {
  background: var(--bg-secondary);
}

.multi-select-checkbox {
  width: 12px;
  height: 12px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* 搜索历史区域 */
.search-history-section {
  padding: 8px 12px;
  background: transparent;
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.clear-history-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s;
}

.clear-history-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.search-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.search-history-item:hover {
  background: var(--bg-secondary);
}

.history-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-query {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-small);
  color: var(--text-primary);
}

.history-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.history-query-text {
  flex: 0 1 auto;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-separator {
  color: var(--text-secondary);
  opacity: 0.5;
}

.history-time {
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
}

.history-mode-badge {
  font-size: var(--font-size-mini);
  padding: 2px 4px;
  border-radius: 3px;
  background: var(--border-color);
  color: var(--text-secondary);
  margin-left: auto;
  flex-shrink: 0;
}

.history-mode-badge.keyword {
  background: rgba(255, 152, 0, 0.2);
  color: var(--color-primary);
}

.history-mode-badge.semantic {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.remove-history-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
  padding: 4px;
}

.search-history-item:hover .remove-history-btn {
  opacity: 1;
}

.remove-history-btn:hover {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

/* 搜索结果区域 */
.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.searching-state,
.no-results,
.search-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  text-align: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-icon,
.placeholder-icon {
  color: var(--text-secondary);
  margin-bottom: 12px;
  opacity: 0.5;
}

.searching-state p,
.no-results p,
.search-placeholder p {
  color: var(--text-secondary);
  font-size: var(--font-size-body);
}

.results-count {
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding: 0 4px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
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
  gap: 4px;
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
  margin-bottom: 4px;
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

.similarity-score {
  color: var(--color-primary);
  font-weight: 500;
}

.result-text {
  font-size: var(--font-size-small);
  color: var(--text-primary);
  line-height: 1.4;
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
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.detail-btn:hover {
  background: var(--color-primary);
  color: white;
}

/* More history button */
.more-history-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s;
}

.more-history-btn:hover {
  background: var(--border-color);
  color: var(--color-primary);
}

.more-icon {
  opacity: 0.7;
  transition: transform 0.2s;
}

.more-icon.is-expanded {
  transform: rotate(180deg);
}
</style>