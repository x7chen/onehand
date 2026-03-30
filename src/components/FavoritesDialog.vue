<template>
  <div v-if="visible" class="favorites-dialog-overlay" @click="handleOverlayClick">
    <div class="favorites-dialog" @click.stop>
      <div class="favorites-header">
        <div class="header-title">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" class="favorite-icon">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          <h3>收藏夹</h3>
        </div>
        <button class="close-btn" @click="close" title="关闭">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="favorites-results">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>

        <div v-else-if="favoriteNodes.length === 0" class="no-results">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          <p>暂无收藏的笔记</p>
        </div>

        <div v-else class="results-list">
          <div class="results-count">
            共 {{ favoriteNodes.length }} 个收藏
          </div>
          <div
            v-for="item in favoriteNodes"
            :key="`${item.notebookId}-${item.canvasId}-${item.nodeId}`"
            class="result-item"
          >
            <div class="result-content" @click="openNodeDetail(item)">
              <div class="result-meta">
                <span class="notebook-name">{{ item.notebookName }}</span>
                <span class="separator">·</span>
                <span class="canvas-info">{{ item.canvasName }}</span>
              </div>
              <div class="result-text" :title="item.fullText">
                {{ item.previewText }}
              </div>
            </div>
            <button class="detail-btn" @click="openNodeDetail(item)" title="查看详情">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
              </svg>
            </button>
          </div>
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
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
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

interface FavoriteNodeItem {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  fullText: string
  previewText: string
}

const notebookStore = useNotebookStore()
const router = useRouter()
const loading = ref(false)
const favoriteNodes = ref<FavoriteNodeItem[]>([])
const showNodePopup = ref(false)
const selectedNodeUrl = ref('')

// Load favorites when dialog opens
watch(() => props.visible, async (isVisible) => {
  if (isVisible) {
    loading.value = true
    await loadFavorites()
    loading.value = false
  } else {
    // Reset state when closing
    favoriteNodes.value = []
    showNodePopup.value = false
  }
})

async function loadFavorites() {
  const results: FavoriteNodeItem[] = []

  for (const notebook of notebookStore.notebooks) {
    if (!notebook.canvases) continue

    for (const canvas of notebook.canvases) {
      if (!canvas.nodes) continue

      for (const node of canvas.nodes) {
        // Only include favorited nodes
        if (node.isFavorite) {
          const fullText = node.transcript || node.agentResult || ''
          const previewText = fullText.slice(0, 30)

          results.push({
            notebookId: notebook.id,
            notebookName: notebook.name,
            canvasId: canvas.id,
            canvasName: getCanvasName(canvas, notebook),
            nodeId: node.id,
            fullText,
            previewText: previewText.length < fullText.length ? previewText + '...' : previewText
          })
        }
      }
    }
  }

  // Sort by notebook name
  results.sort((a, b) => {
    if (a.notebookName !== b.notebookName) {
      return a.notebookName.localeCompare(b.notebookName)
    }
    return a.canvasName.localeCompare(b.canvasName)
  })

  favoriteNodes.value = results
}

function getCanvasName(canvas: CanvasPage, notebook: Notebook): string {
  if (canvas.pdfPage !== undefined) {
    return `第 ${canvas.pdfPage} 页`
  }

  // Find canvas index for non-PDF notebooks
  const index = notebook.canvases?.findIndex(c => c.id === canvas.id) ?? 0
  if (notebook.canvases && notebook.canvases.length > 1) {
    return `画布 ${index + 1}`
  }
  return '画布'
}

function handleOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    close()
  }
}

function close() {
  emit('close')
}

function openNodeDetail(item: FavoriteNodeItem) {
  selectedNodeUrl.value = generateDeepLinkUrl(
    item.notebookId,
    item.canvasId,
    item.nodeId
  )
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
      router.push(`/node-list/${data.notebookId}?canvasId=${data.canvasId}&nodeId=${data.nodeId}`)
    }
  }

  // Close dialogs after navigation
  closeNodePopup()
  close()
}
</script>

<style scoped>
.favorites-dialog-overlay {
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

.favorites-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.favorites-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: var(--text-primary);
}

.favorite-icon {
  color: #fbbf24;
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

.favorites-results {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-state,
.no-results {
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
  border-top-color: #fbbf24;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-icon {
  color: var(--text-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.loading-state p,
.no-results p {
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
  color: #fbbf24;
  font-weight: 500;
}

.separator {
  opacity: 0.5;
}

.canvas-info {
  opacity: 0.8;
}

.result-text {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  background: #fbbf24;
  color: white;
}
</style>