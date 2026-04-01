<template>
  <div class="notebooks-panel">
    <div class="panel-header">
      <h2>我的笔记本</h2>
      <button @click="$emit('newNotebook')" class="new-notebook-btn">
        + 新建笔记本
      </button>
    </div>

    <div v-if="notebookStore.notebooks.length === 0" class="empty-state">
      <p>暂无笔记本，创建一个新笔记本开始记录吧！</p>
    </div>

    <div v-else class="notebooks-grid">
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
            {{ getCanvasesCount(notebook) }} 页 · {{ getTotalNodesCount(notebook) }} 个笔记 · {{ formatDate(notebook.updatedAt) }}
            <span v-if="notebook.context?.staticContextIds?.length || notebook.context?.dynamicContextId" class="context-indicator">
              ·
              <span v-if="notebook.context.staticContextIds?.length" :title="`静态上下文 (${notebook.context.staticContextIds.length}个)`">
                📄{{ notebook.context.staticContextIds.length > 1 ? `(${notebook.context.staticContextIds.length})` : '' }}
              </span>
              <span v-if="notebook.context.dynamicContextId" title="动态上下文">📝</span>
            </span>
          </p>
        </div>
        <div class="notebook-card-actions">
          <button class="action-btn canvas-btn" @click.stop="openCanvas(notebook.id)" title="画布视图">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useNotebookStore } from '@/stores/notebookStore'
import type { Notebook } from '@/types/notebook'

const emit = defineEmits<{
  (e: 'newNotebook'): void
  (e: 'dragStart', event: DragEvent, notebook: Notebook): void
  (e: 'dragEnd', event: DragEvent): void
}>()

const router = useRouter()
const notebookStore = useNotebookStore()

function getTotalNodesCount(notebook: Notebook): number {
  if (notebook.canvases && notebook.canvases.length > 0) {
    return notebook.canvases.reduce((total, canvas) => total + (canvas.nodes?.length || 0), 0)
  }
  return notebook.canvas?.nodes?.length || 0
}

function getCanvasesCount(notebook: Notebook): number {
  if (notebook.canvases && notebook.canvases.length > 0) {
    return notebook.canvases.length
  }
  return notebook.canvas ? 1 : 0
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

  return date.toLocaleDateString('zh-CN')
}

function openNotebook(notebookId: string) {
  const notebook = notebookStore.notebooks.find(p => p.id === notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)
    if (notebook.pdfPath) {
      router.push(`/pdf/${notebookId}`)
    } else {
      router.push(`/node-list/${notebookId}`)
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

.notebooks-grid {
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
}

.notebook-card:hover {
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

.notebook-card {
  cursor: grab;
  user-select: none;
}

.notebook-card:active {
  cursor: grabbing;
}

.notebook-card[draggable="true"] {
  -webkit-user-drag: element;
}
</style>