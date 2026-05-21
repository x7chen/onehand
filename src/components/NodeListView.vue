<template>
  <div ref="panelRef" class="node-list-view">
    <div ref="nodeContainerRef" class="node-container" @scroll="handleScroll">
      <div
        v-for="node in sortedNodes"
        :key="node.id"
        class="node-list-item"
        :class="{ active: activeNodeId === node.id }"
        :data-node-id="node.id"
        @click="handleNodeClick(node.id)"
        @contextmenu.prevent="handleContextMenu(node, $event)"
      >
        <!-- 勾选框 -->
        <input
          type="checkbox"
          class="node-checkbox"
          :checked="node.selectedAsContext"
          :disabled="node.transcriptStatus !== 'done'"
          @change="toggleContext(node.id)"
          @click.stop
        />
        <!-- 收藏按钮 -->
        <button
          class="node-favorite-btn"
          :class="{ active: node.isFavorite }"
          @click.stop="toggleFavorite(node.id)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </button>
        <!-- AI状态指示器 -->
        <div
          class="node-ai-indicator"
          :class="{
            'has-ai': node.agentStatus === 'done' || node.agentStatus === 'processing',
            'processing': node.agentStatus === 'processing'
          }"
        ></div>
        <!-- 标题 -->
        <span class="node-title">
          {{ getNodeTitle(node) }}
        </span>
        <!-- 日期（根据排序方式显示创建时间或更新时间） -->
        <span class="node-date">
          {{ formatDate(useUpdatedAt ? (node.updatedAt || node.createdAt) : node.createdAt) }}
        </span>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div v-if="showContextMenu" class="menu-overlay" @click="closeContextMenu"></div>
      <div v-if="showContextMenu" class="context-menu" :style="contextMenuStyle">
        <button
          class="context-menu-item favorite"
          :class="{ active: contextMenuNode?.isFavorite }"
          @click="handleContextFavorite"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          <span>{{ contextMenuNode?.isFavorite ? t('nodeList.unfavorite') : t('nodeList.favorite') }}</span>
        </button>
        <button
          class="context-menu-item move"
          @click="handleContextMove"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 12H6v-2h8v2zm4-4H6v-2h12v2z"/>
          </svg>
          <span>{{ t('nodeList.moveTo') }}</span>
        </button>
        <button
          class="context-menu-item delete"
          @click="handleContextDelete"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
          <span>{{ t('common.delete') }}</span>
        </button>
      </div>

      <!-- 移动笔记本菜单 -->
      <div v-if="showMoveNotebookMenu" class="context-menu move-notebook-menu" :style="moveNotebookMenuStyle">
        <button
          v-for="notebook in availableNotebooks"
          :key="notebook.id"
          class="context-menu-item notebook-item"
          @click="selectMoveNotebook(notebook.id)"
        >
          <svg v-if="notebook.pdfPath" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
          </svg>
          <span>{{ notebook.name }}</span>
        </button>
        <div v-if="availableNotebooks.length === 0" class="empty-notebooks">
          {{ t('nodeList.noAvailableNotebooks') }}
        </div>
      </div>

      <!-- 删除确认对话框 -->
      <div v-if="showDeleteConfirmDialog" class="delete-dialog-overlay" @click="showDeleteConfirmDialog = false">
        <div class="delete-dialog" @click.stop>
          <div class="dialog-header">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="warning-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <h3>{{ t('nodeList.deleteConfirmTitle') }}</h3>
          </div>
          <div class="dialog-body">
            <p>{{ t('nodeList.deleteConfirmMessage', { count: 1 }) }}</p>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="showDeleteConfirmDialog = false">
              {{ t('common.cancel') }}
            </button>
            <button class="delete-btn" @click="confirmDelete">
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import type { CanvasNode, Notebook } from '@/types/notebook'

const props = withDefaults(defineProps<{
  nodes: CanvasNode[]
  activeNodeId?: string | null
  sortOrder?: 'createdAtAsc' | 'createdAtDesc' | 'updatedAtAsc' | 'updatedAtDesc' | 'titleAsc' | 'titleDesc'
}>(), {
  activeNodeId: null,
  sortOrder: 'createdAtDesc'
})

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
  'batch-select-context': [nodeIds: string[], selected: boolean]
  'batch-delete': [nodeIds: string[]]
  'batch-move': [nodeIds: string[], targetNotebookId: string]
  'batch-favorite': [nodeIds: string[], isFavorite: boolean]
}>()

const { t } = useI18n()
const notebookStore = useNotebookStore()

const panelRef = ref<HTMLElement | null>(null)
const nodeContainerRef = ref<HTMLElement | null>(null)

// 拖拽多选状态
const isDragSelecting = ref(false)
const dragSelectedIds = ref<Set<string>>(new Set())
const dragStartY = ref(0)
const dragStartX = ref(0)
const lastDragY = ref(0) // 上一次拖拽位置的 Y 坐标
const isSelecting = ref(true) // true表示选取，false表示取消选取
const isDragStarted = ref(false) // 是否已进入拖拽模式
const startNodeId = ref<string | null>(null) // 开始时的节点ID

const DRAG_THRESHOLD = 5 // 拖拽阈值，超过此距离才进入拖拽模式

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuStyle = ref<{ top?: string; left?: string }>({})
const contextMenuNode = ref<CanvasNode | null>(null)

// 移动笔记本菜单状态
const showMoveNotebookMenu = ref(false)
const moveNotebookMenuStyle = ref<{ top?: string; left?: string }>({})

// 删除确认对话框状态
const showDeleteConfirmDialog = ref(false)

// 可移动的笔记本列表（排除当前笔记本）
const availableNotebooks = computed<Notebook[]>(() => {
  return notebookStore.notebooks.filter(n => n.id !== notebookStore.currentNotebook?.id)
})

// 判断是否使用更新时间
const useUpdatedAt = computed(() => {
  return props.sortOrder === 'updatedAtAsc' || props.sortOrder === 'updatedAtDesc'
})

// 直接使用 props.nodes（已由父组件排序）
const sortedNodes = computed(() => props.nodes)

// 滚动条自动隐藏逻辑
let scrollbarTimer: ReturnType<typeof setTimeout> | null = null

function handleScroll() {
  // 可扩展虚拟滚动，但列表视图一般节点数量较少，暂不实现

  // 滚动条显示逻辑
  if (!nodeContainerRef.value) return
  nodeContainerRef.value.classList.add('is-scrolling')
  if (scrollbarTimer !== null) {
    clearTimeout(scrollbarTimer)
  }
  scrollbarTimer = setTimeout(() => {
    nodeContainerRef.value?.classList.remove('is-scrolling')
    scrollbarTimer = null
  }, 1000)
}

function toggleContext(nodeId: string) {
  emit('toggle-context', nodeId)
}

function toggleFavorite(nodeId: string) {
  emit('toggle-favorite', nodeId)
}

function handleNodeClick(nodeId: string) {
  emit('activate', nodeId)
}

// 右键菜单处理
function handleContextMenu(node: CanvasNode, e: MouseEvent) {
  contextMenuNode.value = node
  const x = e.clientX
  const y = e.clientY

  // 确保菜单不超出屏幕
  const menuWidth = 140
  const menuHeight = 120
  const left = Math.min(x, window.innerWidth - menuWidth - 8)
  const top = Math.min(y, window.innerHeight - menuHeight - 8)

  contextMenuStyle.value = {
    left: `${left}px`,
    top: `${top}px`
  }
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  showMoveNotebookMenu.value = false
  contextMenuNode.value = null
}

function handleContextFavorite() {
  if (!contextMenuNode.value) return
  const isFavorite = !contextMenuNode.value.isFavorite
  emit('batch-favorite', [contextMenuNode.value.id], isFavorite)
  closeContextMenu()
}

function handleContextMove(e: MouseEvent) {
  if (!contextMenuNode.value) return

  const target = e.currentTarget as HTMLElement
  if (target) {
    const rect = target.getBoundingClientRect()
    const left = Math.min(rect.right + 4, window.innerWidth - 160 - 8)
    const top = Math.min(rect.top, window.innerHeight - 300 - 8)
    moveNotebookMenuStyle.value = {
      left: `${left}px`,
      top: `${top}px`
    }
  }
  showMoveNotebookMenu.value = true
}

function selectMoveNotebook(notebookId: string) {
  if (!contextMenuNode.value) return
  emit('batch-move', [contextMenuNode.value.id], notebookId)
  closeContextMenu()
}

function handleContextDelete() {
  if (!contextMenuNode.value) return
  showDeleteConfirmDialog.value = true
}

function confirmDelete() {
  if (!contextMenuNode.value) return
  emit('batch-delete', [contextMenuNode.value.id])
  showDeleteConfirmDialog.value = false
  closeContextMenu()
}

// 格式化日期（年-月-日 时:分）
function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 获取节点标题（无标题时取transcript前10个字）
function getNodeTitle(node: CanvasNode) {
  if (node.title) return node.title
  if (node.transcript) {
    // 去除markdown图片等特殊内容，取纯文本前10字
    const plainText = node.transcript.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\n/g, ' ').trim()
    return plainText.slice(0, 10) || t('nodeList.noTitle')
  }
  return t('nodeList.noTitle')
}

// 滚动到激活节点
watch(() => props.activeNodeId, (newNodeId) => {
  if (!newNodeId || !nodeContainerRef.value) return

  nextTick(() => {
    const nodeEl = nodeContainerRef.value?.querySelector(`[data-node-id="${newNodeId}"]`) as HTMLElement
    if (nodeEl) {
      scrollNodeToVisible(nodeEl)
    }
  })
})

function scrollNodeToVisible(nodeEl: HTMLElement) {
  if (!nodeContainerRef.value) return

  const container = nodeContainerRef.value
  const containerRect = container.getBoundingClientRect()
  const nodeRect = nodeEl.getBoundingClientRect()

  const nodeTop = nodeRect.top - containerRect.top + container.scrollTop
  const nodeBottom = nodeTop + nodeRect.height

  const viewTop = container.scrollTop + 4
  const viewBottom = container.scrollTop + container.clientHeight - 4

  if (nodeTop >= viewTop && nodeBottom <= viewBottom) {
    return
  }

  let scrollTo: number
  if (nodeTop < viewTop) {
    scrollTo = nodeTop - 10
  } else {
    scrollTo = nodeBottom - container.clientHeight + 10
  }

  container.scrollTo({
    top: Math.max(0, scrollTo),
    behavior: 'smooth'
  })
}

// 拖拽多选：开始拖拽
function handleDragStart(e: MouseEvent) {
  // 只响应左键，排除checkbox、favorite按钮等交互元素
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.node-checkbox, .node-favorite-btn, .node-ai-indicator')) return

  isDragSelecting.value = true
  isDragStarted.value = false
  dragSelectedIds.value.clear()
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  lastDragY.value = e.clientY

  // 记录起始位置的节点
  const node = getNodeAtPosition(e.clientX, e.clientY)
  startNodeId.value = node?.id || null

  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
}

// 拖拽多选：移动时处理经过的节点
function handleDragMove(e: MouseEvent) {
  if (!isDragSelecting.value) return

  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  // 只有超过阈值才进入拖拽选择模式
  if (!isDragStarted.value && distance > DRAG_THRESHOLD) {
    isDragStarted.value = true
    dragSelectedIds.value.clear()
  }

  if (!isDragStarted.value) return

  // 根据当前方向更新选择模式
  if (e.clientY < dragStartY.value) {
    // 从下到上（向上拖）：取消选取
    isSelecting.value = false
  } else {
    // 从上到下（向下拖）：选取
    isSelecting.value = true
  }

  // 处理起始位置的节点（根据当前方向决定）
  const startNode = getNodeAtPosition(dragStartX.value, dragStartY.value)
  if (startNode && startNode.transcriptStatus === 'done' && !dragSelectedIds.value.has(startNode.id)) {
    dragSelectedIds.value.add(startNode.id)
    if (isSelecting.value && !startNode.selectedAsContext) {
      emit('batch-select-context', [startNode.id], true)
    } else if (!isSelecting.value && startNode.selectedAsContext) {
      emit('batch-select-context', [startNode.id], false)
    }
  }

  // 处理从上次位置到当前位置之间的所有节点
  processNodesBetweenYPositions(lastDragY.value, e.clientY, e.clientX)
  lastDragY.value = e.clientY
}

// 拖拽多选：结束拖拽
function handleDragEnd(e: MouseEvent) {
  // 如果没有进入拖拽模式，视为点击，只激活笔记
  if (!isDragStarted.value && startNodeId.value) {
    emit('activate', startNodeId.value)
  }

  isDragSelecting.value = false
  isDragStarted.value = false
  dragSelectedIds.value.clear()
  startNodeId.value = null
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
}

// 获取指定位置的节点
function getNodeAtPosition(x: number, y: number): CanvasNode | null {
  const container = nodeContainerRef.value
  if (!container) return null

  const elements = document.elementsFromPoint(x, y)
  for (const el of elements) {
    const nodeItem = (el as HTMLElement).closest('.node-list-item')
    if (nodeItem && container.contains(nodeItem)) {
      const nodeId = nodeItem.getAttribute('data-node-id')
      if (nodeId) {
        return props.nodes.find(n => n.id === nodeId) || null
      }
      break
    }
  }
  return null
}

// 处理两个 Y 坐标之间的所有节点（用于快速拖动时不漏选）
function processNodesBetweenYPositions(startY: number, endY: number, x: number) {
  const container = nodeContainerRef.value
  if (!container) return

  // 获取所有节点元素
  const nodeItems = container.querySelectorAll('.node-list-item')

  // 确定处理的 Y 范围
  const minY = Math.min(startY, endY)
  const maxY = Math.max(startY, endY)

  for (const item of nodeItems) {
    const rect = item.getBoundingClientRect()
    // 检查节点是否在 Y 范围内（使用中心点判断）
    const nodeCenterY = rect.top + rect.height / 2

    if (nodeCenterY >= minY && nodeCenterY <= maxY) {
      const nodeId = item.getAttribute('data-node-id')
      if (!nodeId) continue

      const node = props.nodes.find(n => n.id === nodeId)
      if (!node || node.transcriptStatus !== 'done') continue

      if (!dragSelectedIds.value.has(nodeId)) {
        dragSelectedIds.value.add(nodeId)

        if (isSelecting.value) {
          if (!node.selectedAsContext) {
            emit('batch-select-context', [nodeId], true)
          }
        } else {
          if (node.selectedAsContext) {
            emit('batch-select-context', [nodeId], false)
          }
        }
      }
    }
  }
}

// 拖拽多选：处理指定位置的节点
function processNodeAtPosition(x: number, y: number) {
  const node = getNodeAtPosition(x, y)
  if (!node) return

  const nodeId = node.id
  // 检查节点是否可选中（转录完成）
  if (node.transcriptStatus !== 'done') return

  if (!dragSelectedIds.value.has(nodeId)) {
    dragSelectedIds.value.add(nodeId)

    if (isSelecting.value) {
      // 选取模式：选中未选中的节点
      if (!node.selectedAsContext) {
        emit('batch-select-context', [nodeId], true)
      }
    } else {
      // 取消模式：取消已选中的节点
      if (node.selectedAsContext) {
        emit('batch-select-context', [nodeId], false)
      }
    }
  }
}

onMounted(() => {
  if (nodeContainerRef.value) {
    nodeContainerRef.value.addEventListener('mousedown', handleDragStart)
  }
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (nodeContainerRef.value) {
    nodeContainerRef.value.removeEventListener('mousedown', handleDragStart)
  }
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
  document.removeEventListener('keydown', handleKeydown)
  if (scrollbarTimer) {
    clearTimeout(scrollbarTimer)
    scrollbarTimer = null
  }
})

// ESC 关闭菜单
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeContextMenu()
    showDeleteConfirmDialog.value = false
  }
}

defineExpose({
  scrollToNode: (nodeId: string) => {
    const nodeEl = nodeContainerRef.value?.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    if (nodeEl) {
      scrollNodeToVisible(nodeEl)
    }
  }
})
</script>

<style scoped>
.node-list-view {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
}

.node-container {
  flex: 1;
  overflow-y: auto;
  position: relative;
  scrollbar-color: transparent transparent;
}

.node-container.is-scrolling {
  scrollbar-color: rgba(128, 128, 128, 0.4) transparent;
}

.node-container::-webkit-scrollbar-track {
  background: transparent;
}

.node-container::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.node-container.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
}

:root.dark .node-container.is-scrolling {
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

:root.dark .node-container.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.node-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  user-select: none;
}

.node-list-item:hover {
  background: var(--bg-hover);
}

.node-list-item.active {
  background: var(--bg-secondary);
}

.node-checkbox {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
}

.node-checkbox:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.node-favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.2s;
}

.node-favorite-btn:hover {
  color: var(--text-primary);
}

.node-favorite-btn.active {
  color: var(--color-favorite);
}

.node-ai-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.2s;
}

.node-ai-indicator.has-ai {
  background: var(--color-success);
}

.node-ai-indicator.processing {
  background: var(--color-primary);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.node-title {
  font-size: var(--font-size-heading);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.node-date {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* 菜单遮罩层 */
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 2001;
  min-width: 140px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  background: transparent;
  border: none;
  font-size: var(--font-size-body);
  text-align: left;
  transition: background 0.2s;
}

.context-menu-item:hover {
  background: var(--bg-hover);
}

.context-menu-item.favorite.active {
  color: var(--color-favorite);
}

.context-menu-item.favorite.active:hover {
  background: rgba(251, 191, 36, 0.1);
}

.context-menu-item.delete:hover {
  background: rgba(255, 68, 68, 0.1);
}

/* 移动笔记本菜单 */
.move-notebook-menu {
  min-width: 160px;
  max-height: 300px;
  overflow-y: auto;
}

.move-notebook-menu .notebook-item {
  font-size: var(--font-size-body);
}

.empty-notebooks {
  padding: 12px;
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  text-align: center;
}

/* 删除确认对话框 */
.delete-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2600;
}

.delete-dialog {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px var(--shadow-color);
  overflow: hidden;
}

.delete-dialog .dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.delete-dialog .dialog-header h3 {
  margin: 0;
  font-size: var(--font-size-title);
  font-weight: 500;
  color: var(--text-primary);
}

.delete-dialog .warning-icon {
  color: var(--color-error);
}

.delete-dialog .dialog-body {
  padding: 16px;
}

.delete-dialog .dialog-body p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-heading);
  line-height: 1.5;
}

.delete-dialog .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.delete-dialog .cancel-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-heading);
  cursor: pointer;
  transition: all 0.2s;
}

.delete-dialog .cancel-btn:hover {
  background: var(--bg-hover);
}

.delete-dialog .delete-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--color-error);
  color: white;
  font-size: var(--font-size-heading);
  cursor: pointer;
  transition: all 0.2s;
}

.delete-dialog .delete-btn:hover {
  opacity: 0.9;
}
</style>