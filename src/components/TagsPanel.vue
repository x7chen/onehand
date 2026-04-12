<template>
  <div class="tags-panel">
    <div class="panel-header">
      <div class="header-title">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="tag-icon">
          <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
        </svg>
        <h2>{{ t('nav.tags') }}</h2>
      </div>
    </div>

    <div class="tags-content">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>{{ t('common.loading') }}</p>
      </div>

      <div v-else-if="taggedNodes.length === 0" class="no-results">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
          <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
        </svg>
        <p>{{ t('nav.noTags') }}</p>
      </div>

      <div v-else class="tags-layout">
        <!-- 左侧标签列表 -->
        <div class="tags-sidebar">
          <div
            v-for="tagGroup in taggedNodes"
            :key="tagGroup.tagName"
            class="tag-item"
            :class="{ active: selectedTag?.tagName === tagGroup.tagName }"
            @click="selectTag(tagGroup)"
          >
            <span class="tag-color-dot" :style="{ backgroundColor: tagGroup.tagColor }"></span>
            <span class="tag-name">{{ tagGroup.tagName }}</span>
            <span class="tag-count">{{ tagGroup.nodes.length }}</span>
          </div>
        </div>

        <!-- 右侧节点列表 -->
        <div class="nodes-panel">
          <div v-if="selectedTag" class="nodes-header">
            <span class="nodes-count">
              {{ t('tag.tagNNotes', { count: selectedTag.nodes.length }) }}
            </span>
          </div>
          <div v-if="selectedTag" class="nodes-list">
            <div
              v-for="item in selectedTag.nodes"
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
          <div v-else class="select-hint">
            <p>{{ t('tag.selectTagToView') }}</p>
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
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import NodePopup from '@/components/NodePopup.vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { useTagStore } from '@/stores/tagStore'
import { generateDeepLinkUrl } from '@/composables/useDeepLink'
import type { DeepLinkData } from '@/composables/useDeepLink'
import type { Notebook, CanvasPage } from '@/types/notebook'

const router = useRouter()
const notebookStore = useNotebookStore()
const tagStore = useTagStore()
const { t } = useI18n()
const loading = ref(false)
const taggedNodes = ref<TagGroup[]>([])
const selectedTag = ref<TagGroup | null>(null)
const showNodePopup = ref(false)
const selectedNodeUrl = ref('')

interface TaggedNodeItem {
  notebookId: string
  notebookName: string
  canvasId: string
  canvasName: string
  nodeId: string
  nodeTitle: string
  fullText: string
}

interface TagGroup {
  tagName: string
  tagColor: string
  nodes: TaggedNodeItem[]
}

onMounted(async () => {
  await tagStore.loadTags()
  await loadTaggedNodes()
})

// Reload when notebooks change
watch(() => notebookStore.notebooks, () => {
  loadTaggedNodes()
}, { deep: true })

// Reload when tags change
watch(() => tagStore.tags, () => {
  loadTaggedNodes()
}, { deep: true })

async function loadTaggedNodes() {
  loading.value = true
  const tagMap = new Map<string, TagGroup>()

  for (const notebook of notebookStore.notebooks) {
    if (!notebook.canvases) continue

    for (const canvas of notebook.canvases) {
      if (!canvas.nodes) continue

      for (const node of canvas.nodes) {
        if (node.tags && node.tags.length > 0) {
          const fullText = node.transcript || node.agentResult || ''

          for (const tagName of node.tags) {
            if (!tagMap.has(tagName)) {
              const tag = tagStore.getTagByName(tagName)
              tagMap.set(tagName, {
                tagName,
                tagColor: tag?.color || '#66bb6a',
                nodes: []
              })
            }

            tagMap.get(tagName)!.nodes.push({
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
    }
  }

  // Sort nodes within each tag group by notebook name and canvas name
  for (const group of tagMap.values()) {
    group.nodes.sort((a, b) => {
      if (a.notebookName !== b.notebookName) {
        return a.notebookName.localeCompare(b.notebookName)
      }
      return a.canvasName.localeCompare(b.canvasName)
    })
  }

  // Convert to array and sort by tag name
  taggedNodes.value = Array.from(tagMap.values()).sort((a, b) =>
    a.tagName.localeCompare(b.tagName)
  )

  // Auto-select first tag if available
  if (taggedNodes.value.length > 0 && !selectedTag.value) {
    selectedTag.value = taggedNodes.value[0]
  }

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

function selectTag(tagGroup: TagGroup) {
  selectedTag.value = tagGroup
}

function openNodeDetail(item: TaggedNodeItem) {
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
.tags-panel {
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

.tag-icon {
  color: var(--color-primary);
}

.tags-content {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.loading-state,
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  flex: 1;
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

.empty-icon {
  color: var(--text-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.loading-state p,
.no-results p {
  color: var(--text-secondary);
}

.tags-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧标签栏 */
.tags-sidebar {
  width: 180px;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-item:hover {
  background: var(--bg-hover);
}

.tag-item.active {
  background: var(--color-primary);
  color: white;
}

.tag-item.active .tag-count {
  color: rgba(255, 255, 255, 0.8);
}

.tag-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name {
  flex: 1;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-count {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* 右侧节点面板 */
.nodes-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.nodes-header {
  margin-bottom: 12px;
}

.nodes-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.nodes-list {
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

.select-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>