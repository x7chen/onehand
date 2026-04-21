<template>
  <div class="notebooks-panel">
    <div class="panel-header">
      <h2>{{ t('notebook.myNotebooks') }}</h2>
      <div class="view-toggle-group">
        <button @click="viewMode = 'grid'" class="view-toggle-btn" :class="{ active: viewMode === 'grid' }" :title="t('notebook.gridView')">
          <!-- 网格图标 -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
          </svg>
        </button>
        <button @click="viewMode = 'list'" class="view-toggle-btn" :class="{ active: viewMode === 'list' }" :title="t('notebook.listView')">
          <!-- 列表图标 -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
        </button>
      </div>
      <button @click="$emit('newNotebook')" class="new-notebook-btn">
        + {{ t('notebook.newNotebook') }}
      </button>
    </div>

    <div v-if="notebookStore.notebooks.length === 0" class="empty-state">
      <p>{{ t('notebook.noNotebooks') }}</p>
    </div>

    <!-- 网格视图 -->
    <div v-else-if="viewMode === 'grid'" class="notebooks-container grid">
      <div
        v-for="notebook in notebookStore.notebooks"
        :key="notebook.id"
        class="notebook-card"
        draggable="true"
        @dragstart="handleNotebookDragStart($event, notebook)"
        @dragend="handleNotebookDragEnd"
      >
        <div class="notebook-card-content" @click="openNotebook(notebook.id)">
          <h3>{{ notebook.name }}</h3>
          <p class="notebook-info">
            <span v-if="notebook.pdfPath" class="pdf-badge">PDF</span>
            {{ getCanvasesCount(notebook) }} {{ t('notebook.pages') }} · {{ getTotalNodesCount(notebook) }} {{ t('notebook.notes') }} · {{ formatDate(notebook.updatedAt) }}
            <span v-if="notebook.context?.staticContextIds?.length || notebook.context?.dynamicContextId" class="context-indicator">
              ·
              <span v-if="notebook.context.staticContextIds?.length" :title="t('canvas.staticContextCount', { count: notebook.context.staticContextIds.length })">
                📄{{ notebook.context.staticContextIds.length > 1 ? `(${notebook.context.staticContextIds.length})` : '' }}
              </span>
              <span v-if="notebook.context.dynamicContextId" :title="t('context.dynamic')">📝</span>
            </span>
          </p>
        </div>
        <div class="notebook-card-actions">
          <button class="action-btn canvas-btn" @click.stop="openCanvas(notebook.id)" :title="t('canvas.expandList')">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="2" y="2" width="6" height="5" rx="1"/>
              <rect x="16" y="4" width="6" height="4" rx="1"/>
              <rect x="8" y="10" width="8" height="6" rx="1"/>
              <rect x="2" y="17" width="5" height="5" rx="1"/>
              <rect x="17" y="15" width="5" height="7" rx="1"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-else class="notebooks-container list">
      <!-- 列表视图头部 -->
      <div class="list-header">
        <span class="list-col-name">{{ t('notebook.name') }}</span>
        <span class="list-col-pages">{{ t('notebook.pages') }}</span>
        <span class="list-col-notes">{{ t('notebook.listNotes') }}</span>
        <span class="list-col-static">{{ t('notebook.listStaticContext') }}</span>
        <span class="list-col-dynamic">{{ t('notebook.listDynamicContext') }}</span>
        <span class="list-col-date">{{ t('notebook.modified') }}</span>
        <span class="list-col-action"></span>
      </div>

      <!-- 列表内容 -->
      <div
        v-for="notebook in notebookStore.notebooks"
        :key="notebook.id"
        class="notebook-card list-row"
        draggable="true"
        @dragstart="handleNotebookDragStart($event, notebook)"
        @dragend="handleNotebookDragEnd"
        @click="openNotebook(notebook.id)"
      >
        <div class="notebook-card-content">
          <span class="col-name">
            <span v-if="notebook.pdfPath" class="pdf-badge">PDF</span>
            {{ notebook.name }}
          </span>
          <span class="col-pages">{{ getCanvasesCount(notebook) }}</span>
          <span class="col-notes">{{ getTotalNodesCount(notebook) }}</span>
          <span class="col-static">
            <span v-if="notebook.context?.staticContextIds?.length">
              📄{{ notebook.context.staticContextIds.length }}
            </span>
          </span>
          <span class="col-dynamic">
            <span v-if="notebook.context?.dynamicContextId">📝</span>
          </span>
          <span class="col-date">{{ formatDate(notebook.updatedAt) }}</span>
          <span class="col-action">
            <button class="action-btn canvas-btn" @click.stop="openCanvas(notebook.id)" :title="t('canvas.expandList')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <rect x="2" y="2" width="6" height="5" rx="1"/>
                <rect x="16" y="4" width="6" height="4" rx="1"/>
                <rect x="8" y="10" width="8" height="6" rx="1"/>
                <rect x="2" y="17" width="5" height="5" rx="1"/>
                <rect x="17" y="15" width="5" height="7" rx="1"/>
              </svg>
            </button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Notebook } from '@/types/notebook'

const emit = defineEmits<{
  (e: 'newNotebook'): void
  (e: 'dragStart', event: DragEvent, notebook: Notebook): void
  (e: 'dragEnd', event: DragEvent): void
}>()

const router = useRouter()
const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

// 视图模式：从设置中读取
const viewMode = computed({
  get: () => settingsStore.settings.general.notebooksViewMode || 'grid',
  set: (value) => {
    settingsStore.settings.general.notebooksViewMode = value
    settingsStore.saveSettings()
  }
})

function getTotalNodesCount(notebook: Notebook): number {
  return notebook.nodes?.length || 0
}

function getCanvasesCount(notebook: Notebook): number {
  return notebook.canvases?.length || 0
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return t('notebook.justNow')
  if (diff < 3600000) return t('notebook.minutesAgo', { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('notebook.hoursAgo', { count: Math.floor(diff / 3600000) })
  if (diff < 604800000) return t('notebook.daysAgo', { count: Math.floor(diff / 86400000) })

  return date.toLocaleDateString('zh-CN')
}

function openNotebook(notebookId: string) {
  const notebook = notebookStore.notebooks.find(p => p.id === notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)
    if (notebook.pdfPath) {
      router.push(`/pdf/${notebookId}`)
    } else {
      router.push(`/multi-chat/${notebookId}`)
    }
  }
}

function openCanvas(notebookId: string) {
  const notebook = notebookStore.notebooks.find(p => p.id === notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)
    router.push(`/canvas/${notebookId}`)
  }
}

function handleNotebookDragStart(e: DragEvent, notebook: Notebook) {
  emit('dragStart', e, notebook)
}

function handleNotebookDragEnd(e: DragEvent) {
  emit('dragEnd', e)
}
</script>

<style scoped>
.notebooks-panel {
  height: 100%;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.panel-header h2 {
  font-size: 20px;
  color: var(--text-primary);
}

.view-toggle-group {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 2px;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.view-toggle-btn:hover {
  color: var(--text-primary);
}

.view-toggle-btn.active {
  background: var(--color-primary);
  color: white;
}

.new-notebook-btn {
  padding: 10px 20px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-weight: 500;
  transition: background 0.2s;
}

.new-notebook-btn:hover {
  background: var(--color-primary-hover);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

/* 网格视图 */
.notebooks-container.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.notebook-card {
  background: var(--bg-secondary);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px var(--shadow-color);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
  user-select: none;
}

.notebooks-container.grid .notebook-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.notebook-card-content {
  flex: 1;
  min-width: 0;
}

.notebook-card-actions {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  color: white;
}

.canvas-btn:hover {
  background: var(--color-primary);
}

.pdf-badge {
  display: inline-block;
  padding: 2px 6px;
  background: var(--color-error);
  color: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
}

.notebook-card h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.notebook-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.context-indicator {
  margin-left: 4px;
}

.notebooks-container.grid .notebook-card {
  cursor: grab;
}

.notebooks-container.grid .notebook-card:active {
  cursor: grabbing;
}

/* 列表视图 */
.notebooks-container.list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: var(--bg-primary);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.list-header > span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 列宽比例: 名称:页数:笔记:静态上下文:动态上下文:修改时间:画布按钮 = 5:1:1:1:1:1:1 */
.list-col-name,
.col-name {
  flex: 5;
}

.list-col-pages,
.col-pages,
.list-col-notes,
.col-notes,
.list-col-static,
.col-static,
.list-col-dynamic,
.col-dynamic,
.list-col-date,
.col-date {
  flex: 1;
}

.list-col-action,
.col-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notebooks-container.list .notebook-card.list-row {
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-radius: 0;
  box-shadow: none;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.notebooks-container.list .notebook-card.list-row:last-child {
  border-bottom: none;
}

.notebooks-container.list .notebook-card.list-row:hover {
  background: var(--bg-primary);
  transform: none;
}

.notebooks-container.list .notebook-card-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.notebooks-container.list .notebook-card-content > span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: var(--text-primary);
}

.notebooks-container.list .col-name {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.notebooks-container.list .col-pages,
.notebooks-container.list .col-notes,
.notebooks-container.list .col-static,
.notebooks-container.list .col-dynamic,
.notebooks-container.list .col-date {
  color: var(--text-secondary);
}

.notebooks-container.list .col-action .action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.notebooks-container.list .col-action .action-btn:hover {
  background: var(--color-primary);
  color: white;
}

.notebook-card[draggable="true"] {
  -webkit-user-drag: element;
}
</style>