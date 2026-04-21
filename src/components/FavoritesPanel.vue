<template>
  <div class="favorites-panel">
    <div class="panel-header">
      <div class="header-title">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="favorite-icon">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
        <h2>{{ t('nav.favorites') }}</h2>
      </div>
    </div>

    <div class="favorites-content">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="favoriteNodes.length === 0" class="no-results">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
        <p>{{ t('nav.noFavorites') }}</p>
      </div>

      <div v-else class="results-list">
        <div class="results-count">
          {{ t('common.totalFavorites', { count: favoriteNodes.length }) }}
        </div>
        <div
          v-for="item in favoriteNodes"
          :key="`${item.notebookId}-${item.canvasId}-${item.nodeId}`"
          class="node-item"
        >
          <div class="node-content" @click="openNodeDetail(item)">
            <div class="node-meta">
              <span class="notebook-name">{{ item.notebookName }}</span>
              <span class="separator">·</span>
              <span class="canvas-info">{{ item.canvasName }}</span>
              <template v-if="item.nodeTitle">
                <span class="separator">·</span>
                <span class="node-title">{{ item.nodeTitle }}</span>
              </template>
            </div>
            <div class="node-text" :title="item.fullText">
              {{ item.fullText }}
            </div>
          </div>
          <button class="detail-btn" @click="openNodeDetail(item)" :title="t('voiceNote.viewDetails')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
            </svg>
          </button>
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
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NodePopup from '@/components/NodePopup.vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { generateDeepLinkUrl } from '@/composables/useDeepLink'
import type { DeepLinkData } from '@/composables/useDeepLink'
import type { Notebook, CanvasPage } from '@/types/notebook'

const router = useRouter()
const notebookStore = useNotebookStore()
const { t } = useI18n()
const loading = ref(false)
const favoriteNodes = ref<FavoriteNodeItem[]>([])
const showNodePopup = ref(false)
const selectedNodeUrl = ref('')

interface FavoriteNodeItem {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  nodeTitle: string
  fullText: string
}

onMounted(async () => {
  await loadFavorites()
})

// Reload when notebooks change
watch(() => notebookStore.notebooks, () => {
  loadFavorites()
}, { deep: true })

async function loadFavorites() {
  loading.value = true
  const results: FavoriteNodeItem[] = []

  for (const notebook of notebookStore.notebooks) {
    if (!notebook.canvases || !notebook.nodes) continue

    for (const node of notebook.nodes) {
      if (node.isFavorite) {
        const canvas = notebook.canvases.find(c => c.id === node.canvasId)
        if (!canvas) continue

        const fullText = node.transcript || node.agentResult || ''

        results.push({
          notebookId: notebook.id,
          notebookName: notebook.name,
          canvasId: canvas.id,
          canvasName: getCanvasName(canvas, notebook),
          nodeId: node.id,
          nodeTitle: node.title || '',
          fullText
        })
      }
    }
  }

  results.sort((a, b) => {
    if (a.notebookName !== b.notebookName) {
      return a.notebookName.localeCompare(b.notebookName)
    }
    return a.canvasName.localeCompare(b.canvasName)
  })

  favoriteNodes.value = results
  loading.value = false
}

function getCanvasName(canvas: CanvasPage, notebook: Notebook): string {
  if (canvas.pdfPage !== undefined) {
    return t('common.pageN', { n: canvas.pdfPage })
  }
  const index = notebook.canvases?.findIndex(c => c.id === canvas.id) ?? 0
  if (notebook.canvases && notebook.canvases.length > 1) {
    return t('common.pageN', { n: index + 1 })
  }
  return t('common.canvas')
}

function openNodeDetail(item: FavoriteNodeItem) {
  selectedNodeUrl.value = generateDeepLinkUrl(item.nodeId)
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
      router.push(`/multi-chat/${data.notebookId}?canvasId=${data.canvasId}&nodeId=${data.nodeId}`)
    }
  }
  closeNodePopup()
}
</script>

<style scoped>
.favorites-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  color: var(--text-primary);
}

.favorite-icon {
  color: var(--color-favorite);
}

.favorites-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
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
  border-top-color: var(--color-favorite);
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

.node-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.node-item:hover {
  background: var(--border-color);
}

.node-content {
  flex: 1;
  min-width: 0;
}

.node-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
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

.node-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
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
  background: var(--color-primary);
  color: white;
}
</style>