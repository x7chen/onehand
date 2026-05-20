<template>
  <div class="notebook-sidebar-content" :style="contentStyle">
    <!-- 笔记本部分 -->
    <div
      class="panel-section notebook-section"
      :class="{
        'is-collapsed': notebookCollapsed,
        'fills-space': notebookCollapsed ? false : (noteCollapsed ? true : false)
      }"
    >
      <div
        class="panel-header"
        @click="toggleNotebook"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="expand-icon" :class="{ collapsed: notebookCollapsed }">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
        <span class="panel-title">{{ t('nav.notebooks') }}</span>
        <span class="panel-count">{{ notebooks.length }}</span>
        <!-- 新建笔记本按钮 -->
        <button class="create-btn" @click.stop="showCreateDialog = true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
      </div>
      <div class="panel-body" v-show="!notebookCollapsed">
        <NotebookPanel
          :notebooks="notebooks"
          :active-notebook-id="activeNotebookId"
          :pinned-notebook-ids="pinnedNotebookIds"
          :pinned-all-notebooks="pinnedAllNotebooks"
          @select-notebook="handleSelectNotebook"
          @open-canvas="handleOpenCanvas"
          @open-particle="handleOpenParticle"
          @rename-notebook="handleRenameNotebook"
          @delete-notebook="handleDeleteNotebook"
          @toggle-pin="handleTogglePin"
          @toggle-pin-all="handleTogglePinAll"
          @reorder-pinned="handleReorderPinned"
        />
      </div>
    </div>

    <!-- 拖拽分隔线 -->
    <div
      v-if="!notebookCollapsed && !noteCollapsed"
      class="panel-resizer"
      @mousedown="startResize"
    ></div>

    <!-- 拖拽遮罩层 -->
    <Teleport to="body">
      <div v-if="isResizing" class="resize-overlay"></div>
    </Teleport>

    <!-- 笔记部分 -->
    <div
      class="panel-section note-section"
      :class="{
        'is-collapsed': noteCollapsed
      }"
    >
      <div
        class="panel-header"
        @click="toggleNote"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="expand-icon" :class="{ collapsed: noteCollapsed }">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
        <span class="panel-title">{{ t('nav.notes') }}</span>
        <span class="panel-count">{{ currentNodes.length }}</span>
        <!-- 视图切换按钮 -->
        <button class="view-toggle-btn" @click.stop="toggleViewMenu">
          <svg v-if="viewMode === 'card'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M4 4h7v7H4zm0 9h7v7H4zm9-9h7v7h-7zm0 9h7v7h-7z"/>
          </svg>
          <svg v-else-if="viewMode === 'list'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
          </svg>
        </button>
        <!-- 排序按钮 -->
        <button class="sort-toggle-btn" @click.stop="toggleSortMenu">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
          </svg>
        </button>
      </div>
      <div class="panel-body" v-show="!noteCollapsed">
        <NotePanel
          ref="notePanelRef"
          :nodes="currentNodes"
          :active-node-id="activeNodeId"
          :panel-width="panelWidth"
          @toggle-context="handleToggleContext"
          @toggle-favorite="handleToggleFavorite"
          @activate="handleNodeActivate"
          @batch-delete="handleBatchDelete"
          @batch-move="handleBatchMove"
          @batch-favorite="handleBatchFavorite"
          @batch-select-context="handleBatchSelectContext"
        />
      </div>
    </div>

    <!-- 空白区域（两个都折叠时） -->
    <div v-if="notebookCollapsed && noteCollapsed" class="empty-space"></div>

    <!-- 视图抽屉菜单 -->
    <Teleport to="body">
      <div v-if="showViewMenu" class="menu-overlay" @click="closeViewMenu"></div>
      <div v-if="showViewMenu" class="drawer-menu view-menu" :style="viewMenuStyle">
        <button
          class="drawer-menu-item"
          :class="{ active: viewMode === 'card' }"
          @click="setViewMode('card')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M4 4h7v7H4zm0 9h7v7H4zm9-9h7v7h-7zm0 9h7v7h-7z"/>
          </svg>
          <span>{{ t('nodeList.cardView') }}</span>
        </button>
        <button
          class="drawer-menu-item"
          :class="{ active: viewMode === 'list' }"
          @click="setViewMode('list')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          <span>{{ t('nodeList.listView') }}</span>
        </button>
        <button
          class="drawer-menu-item"
          :class="{ active: viewMode === 'calendar' }"
          @click="setViewMode('calendar')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
          </svg>
          <span>{{ t('nodeList.calendarView') }}</span>
        </button>
      </div>
    </Teleport>

    <!-- 排序抽屉菜单 -->
    <Teleport to="body">
      <div v-if="showSortMenu" class="menu-overlay" @click="closeSortMenu"></div>
      <div v-if="showSortMenu" class="drawer-menu sort-menu" :style="sortMenuStyle">
        <button
          class="drawer-menu-item"
          :class="{ active: currentSortField === 'createdAt' }"
          @click="toggleSortField('createdAt')"
        >
          <span>{{ t('nodeList.sortCreatedAt') }}</span>
          <svg v-if="currentSortField === 'createdAt'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="sort-arrow-icon" :class="{ reversed: currentSortDirection === 'desc' }">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <button
          class="drawer-menu-item"
          :class="{ active: currentSortField === 'updatedAt' }"
          @click="toggleSortField('updatedAt')"
        >
          <span>{{ t('nodeList.sortUpdatedAt') }}</span>
          <svg v-if="currentSortField === 'updatedAt'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="sort-arrow-icon" :class="{ reversed: currentSortDirection === 'desc' }">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
        <button
          class="drawer-menu-item"
          :class="{ active: currentSortField === 'title' }"
          @click="toggleSortField('title')"
        >
          <span>{{ t('nodeList.sortTitle') }}</span>
          <svg v-if="currentSortField === 'title'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="sort-arrow-icon" :class="{ reversed: currentSortDirection === 'desc' }">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
      </div>
    </Teleport>

    <!-- 创建笔记本对话框 -->
    <CreateNotebookDialog
      :visible="showCreateDialog"
      :static-context-files="contextStore.staticContextFiles"
      :dynamic-context-files="contextStore.dynamicContextFiles"
      @close="showCreateDialog = false"
      @create="handleCreateNotebook"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import { useContextStore } from '@/stores/contextStore'
import NotebookPanel from './NotebookPanel.vue'
import NotePanel from './NotePanel.vue'
import CreateNotebookDialog from '@/components/CreateNotebookDialog.vue'
import type { Notebook, CanvasNode } from '@/types/notebook'

const props = defineProps<{
  notebooks: Notebook[]
  activeNotebookId: string | null
  pinnedNotebookIds: string[]
  pinnedAllNotebooks: boolean
}>()

const emit = defineEmits<{
  (e: 'select-notebook', notebookId: string | null): void
  (e: 'create-notebook', data: { name: string; pdfPath?: string; staticContextIds: string[]; dynamicContextId?: string }): void
  (e: 'open-canvas', notebookId: string): void
  (e: 'open-particle', notebookId: string): void
  (e: 'rename-notebook', notebookId: string, newName: string): void
  (e: 'delete-notebook', notebookId: string): void
  (e: 'toggle-pin', notebookId: string): void
  (e: 'toggle-pin-all'): void
  (e: 'reorder-pinned', pinnedIds: string[]): void
  (e: 'activate-node', nodeId: string): void
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()
const contextStore = useContextStore()

const notePanelRef = ref<InstanceType<typeof NotePanel> | null>(null)

// 侧边栏宽度（从 MainSidebar 传入或默认）
const panelWidth = ref(300)

// 折叠状态
const notebookCollapsed = ref(false)
const noteCollapsed = ref(false)

// 笔记本部分高度（用于拖拽调整）
const notebookHeight = ref(150) // 默认 150px

// 容器样式（通过 CSS 变量传递高度）
const contentStyle = computed(() => {
  if (notebookCollapsed.value && noteCollapsed.value) {
    // 两个都折叠
    return {}
  }
  if (notebookCollapsed.value) {
    // 笔记本折叠，笔记填满
    return { '--notebook-height': '36px' }
  }
  if (noteCollapsed.value) {
    // 笔记折叠，笔记本填满
    return { '--notebook-height': 'auto' }
  }
  // 两个都展开：笔记本固定高度，笔记填充剩余
  return { '--notebook-height': `${notebookHeight.value}px` }
})

// 拖拽调整高度
const isResizing = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)

function startResize(e: MouseEvent) {
  isResizing.value = true
  resizeStartY.value = e.clientY
  resizeStartHeight.value = notebookHeight.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value) return

  const container = document.querySelector('.notebook-sidebar-content')
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const headerHeight = 36 // 标题栏高度
  const resizerHeight = 4 // 分隔线高度
  const minHeight = 40
  const maxHeight = containerRect.height - headerHeight * 2 - resizerHeight - minHeight

  // 根据鼠标移动的差值计算新高度
  const deltaY = e.clientY - resizeStartY.value
  const newHeight = resizeStartHeight.value + deltaY

  notebookHeight.value = Math.max(minHeight, Math.min(maxHeight, newHeight))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 折叠切换
function toggleNotebook() {
  notebookCollapsed.value = !notebookCollapsed.value
}

function toggleNote() {
  noteCollapsed.value = !noteCollapsed.value
}

// 视图按钮和菜单状态
const showViewMenu = ref(false)
const viewMenuStyle = ref<{ top?: string; right?: string }>({})

// 排序按钮和菜单状态
const showSortMenu = ref(false)
const sortMenuStyle = ref<{ top?: string; right?: string }>({})

const showCreateDialog = ref(false)

// 视图模式：从设置中读取
const viewMode = computed({
  get: () => settingsStore.settings.general.nodeListViewMode || 'card',
  set: (value) => {
    settingsStore.settings.general.nodeListViewMode = value
    settingsStore.saveSettings()
  }
})

// 排序模式：从设置中读取
const sortOrder = computed({
  get: () => settingsStore.settings.general.nodeListSortOrder || 'createdAtDesc',
  set: (value) => {
    settingsStore.settings.general.nodeListSortOrder = value
    settingsStore.saveSettings()
  }
})

// 当前排序字段
const currentSortField = computed(() => {
  const order = sortOrder.value
  if (order.startsWith('createdAt')) return 'createdAt'
  if (order.startsWith('updatedAt')) return 'updatedAt'
  if (order.startsWith('title')) return 'title'
  return 'createdAt'
})

// 当前排序方向
const currentSortDirection = computed(() => {
  const order = sortOrder.value
  if (order.endsWith('Asc')) return 'asc'
  if (order.endsWith('Desc')) return 'desc'
  return 'desc'
})

// 切换排序字段（点击同一条目切换方向）
function toggleSortField(field: 'createdAt' | 'updatedAt' | 'title') {
  if (currentSortField.value === field) {
    const newDirection = currentSortDirection.value === 'asc' ? 'Desc' : 'Asc'
    sortOrder.value = `${field}${newDirection}`
  } else {
    sortOrder.value = `${field}Desc`
  }
  closeSortMenu()
}

// 当前笔记本的节点
const currentNodes = computed(() => {
  if (!props.activeNotebookId) {
    // 显示所有笔记本的节点
    return notebookStore.notebooks.flatMap(n => n.nodes || [])
  }
  const notebook = notebookStore.notebooks.find(n => n.id === props.activeNotebookId)
  return notebook?.nodes || []
})

// 当前激活的节点 ID（如果有）
const activeNodeId = ref<string | null>(null)

// 监听全局激活节点，同步更新本地 activeNodeId
watch(() => notebookStore.globalActiveNodeId, (newId) => {
  if (newId && newId !== activeNodeId.value) {
    // 检查该节点是否属于当前显示的笔记列表
    const isInCurrentNodes = currentNodes.value.some(n => n.id === newId)
    if (isInCurrentNodes) {
      activeNodeId.value = newId
    }
  }
}, { immediate: true })

// 视图菜单控制
function toggleViewMenu(e: MouseEvent) {
  if (showViewMenu.value) {
    closeViewMenu()
  } else {
    const btn = (e.currentTarget as HTMLElement)
    const rect = btn.getBoundingClientRect()
    viewMenuStyle.value = {
      top: `${rect.bottom + 4}px`,
      right: `${window.innerWidth - rect.right}px`
    }
    showViewMenu.value = true
  }
}

function closeViewMenu() {
  showViewMenu.value = false
}

// 排序菜单控制
function toggleSortMenu(e: MouseEvent) {
  if (showSortMenu.value) {
    closeSortMenu()
  } else {
    const btn = (e.currentTarget as HTMLElement)
    const rect = btn.getBoundingClientRect()
    sortMenuStyle.value = {
      top: `${rect.bottom + 4}px`,
      right: `${window.innerWidth - rect.right}px`
    }
    showSortMenu.value = true
  }
}

function closeSortMenu() {
  showSortMenu.value = false
}

function setViewMode(mode: string) {
  viewMode.value = mode as any
  closeViewMenu()
}

// 笔记本事件处理
function handleSelectNotebook(notebookId: string | null) {
  emit('select-notebook', notebookId)
}

function handleOpenCanvas(notebookId: string) {
  emit('open-canvas', notebookId)
}

function handleOpenParticle(notebookId: string) {
  emit('open-particle', notebookId)
}

function handleRenameNotebook(notebookId: string, newName: string) {
  emit('rename-notebook', notebookId, newName)
}

function handleDeleteNotebook(notebookId: string) {
  emit('delete-notebook', notebookId)
}

function handleTogglePin(notebookId: string) {
  emit('toggle-pin', notebookId)
}

function handleTogglePinAll() {
  emit('toggle-pin-all')
}

function handleReorderPinned(pinnedIds: string[]) {
  emit('reorder-pinned', pinnedIds)
}

function handleCreateNotebook(data: { name: string; pdfPath?: string; staticContextIds: string[]; dynamicContextId?: string }) {
  emit('create-notebook', data)
  showCreateDialog.value = false
}

// 笔记事件处理
function handleToggleContext(nodeId: string) {
  // 找到节点所属的笔记本
  const notebook = findNotebookByNodeId(nodeId)
  const node = notebook?.nodes?.find(n => n.id === nodeId)
  if (notebook && node) {
    node.selectedAsContext = !node.selectedAsContext
    notebookStore.saveNotebook(notebook)
  }
}

function handleToggleFavorite(nodeId: string) {
  // 找到节点所属的笔记本
  const notebook = findNotebookByNodeId(nodeId)
  const node = notebook?.nodes?.find(n => n.id === nodeId)
  if (notebook && node) {
    node.isFavorite = !node.isFavorite
    notebookStore.saveNotebook(notebook)
  }
}

function handleNodeActivate(nodeId: string) {
  activeNodeId.value = nodeId
  emit('activate-node', nodeId)
}

function handleBatchDelete(nodeIds: string[]) {
  // 批量删除节点 - 需要处理可能跨多个笔记本的情况
  const notebookGroups = groupNodesByNotebook(nodeIds)
  for (const [notebookId, ids] of notebookGroups) {
    const notebook = notebookStore.notebooks.find(n => n.id === notebookId)
    if (notebook) {
      notebook.nodes = notebook.nodes?.filter(n => !ids.includes(n.id)) || []
      notebookStore.saveNotebook(notebook)
    }
  }
}

async function handleBatchMove(nodeIds: string[], targetNotebookId: string) {
  // 批量移动节点
  const targetNotebook = notebookStore.notebooks.find(n => n.id === targetNotebookId)
  if (!targetNotebook) return

  const notebookGroups = groupNodesByNotebook(nodeIds)
  for (const [sourceNotebookId, ids] of notebookGroups) {
    if (sourceNotebookId === targetNotebookId) continue // 不能移动到同一个笔记本

    const sourceNotebook = notebookStore.notebooks.find(n => n.id === sourceNotebookId)
    if (!sourceNotebook) continue

    const nodesToMove = sourceNotebook.nodes?.filter(n => ids.includes(n.id)) || []
    if (nodesToMove.length === 0) continue

    // 从源笔记本移除
    sourceNotebook.nodes = sourceNotebook.nodes?.filter(n => !ids.includes(n.id)) || []

    // 添加到目标笔记本
    targetNotebook.nodes = [...(targetNotebook.nodes || []), ...nodesToMove]

    await notebookStore.saveNotebook(sourceNotebook)
  }

  await notebookStore.saveNotebook(targetNotebook)
}

function handleBatchFavorite(nodeIds: string[]) {
  // 批量收藏
  const notebookGroups = groupNodesByNotebook(nodeIds)
  for (const [notebookId, ids] of notebookGroups) {
    const notebook = notebookStore.notebooks.find(n => n.id === notebookId)
    if (notebook) {
      const nodes = notebook.nodes?.filter(n => ids.includes(n.id)) || []
      nodes.forEach(n => n.isFavorite = true)
      notebookStore.saveNotebook(notebook)
    }
  }
}

function handleBatchSelectContext(nodeIds: string[], selected: boolean) {
  // 批量选择上下文
  const notebookGroups = groupNodesByNotebook(nodeIds)
  for (const [notebookId, ids] of notebookGroups) {
    const notebook = notebookStore.notebooks.find(n => n.id === notebookId)
    if (notebook) {
      const nodes = notebook.nodes?.filter(n => ids.includes(n.id)) || []
      nodes.forEach(n => n.selectedAsContext = selected)
      notebookStore.saveNotebook(notebook)
    }
  }
}

// 辅助函数：根据节点ID找到所属笔记本
function findNotebookByNodeId(nodeId: string) {
  for (const notebook of notebookStore.notebooks) {
    if (notebook.nodes?.some(n => n.id === nodeId)) {
      return notebook
    }
  }
  return null
}

// 辅助函数：将节点ID按笔记本分组
function groupNodesByNotebook(nodeIds: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const nodeId of nodeIds) {
    const notebook = findNotebookByNodeId(nodeId)
    if (notebook) {
      const existing = groups.get(notebook.id) || []
      existing.push(nodeId)
      groups.set(notebook.id, existing)
    }
  }
  return groups
}

// 全局事件监听：ESC 关闭菜单
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeViewMenu()
    closeSortMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.notebook-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  --notebook-height: 150px;
}

/* Panel 部分 */
.panel-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 笔记本展开时：默认固定高度 */
.notebook-section:not(.is-collapsed) {
  height: var(--notebook-height);
  flex-shrink: 0;
}

/* 笔记本展开且笔记折叠时：填充剩余空间 */
.notebook-section.fills-space {
  flex: 1;
  height: auto;
  min-height: 0;
}

/* 笔记部分展开时：填充剩余空间 */
.note-section:not(.is-collapsed) {
  flex: 1;
  min-height: 0;
}

/* 笔记折叠时：只显示标题栏 */
.note-section.is-collapsed {
  flex-shrink: 0;
  height: 36px;
}

/* 笔记本折叠时：只显示标题栏 */
.notebook-section.is-collapsed {
  flex-shrink: 0;
  height: 36px;
}

/* 标题栏 */
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  height: 36px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.panel-header:hover {
  background: var(--bg-secondary);
}

.expand-icon {
  transition: transform 0.2s;
}

.expand-icon.collapsed {
  transform: rotate(0deg);
}

.expand-icon:not(.collapsed) {
  transform: rotate(90deg);
}

.panel-title {
  font-size: var(--font-size-body);
  font-weight: 500;
  color: var(--text-primary);
}

.panel-count {
  font-size: var(--font-size-small);
  color: var(--text-tertiary);
  margin-left: 4px;
}

.create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  margin-left: auto;
  transition: all 0.2s;
}

.create-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 视图切换按钮 */
.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  margin-left: auto;
  transition: all 0.2s;
}

.view-toggle-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* 排序按钮 */
.sort-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  margin-left: 8px;
  transition: all 0.2s;
}

.sort-toggle-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* 内容区域 */
.panel-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 拖拽分隔线 */
.panel-resizer {
  height: 4px;
  background: var(--bg-primary);
  cursor: row-resize;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer:hover {
  background: var(--color-primary);
  opacity: 0.5;
}

/* 拖拽遮罩层 */
.resize-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  cursor: row-resize;
}

/* 空白区域 */
.empty-space {
  flex: 1;
  background: var(--bg-primary);
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

/* 抽屉菜单 */
.drawer-menu {
  position: fixed;
  z-index: 2001;
  min-width: 140px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px;
}

.drawer-menu-item {
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

.drawer-menu-item:hover {
  background: var(--bg-hover);
}

.drawer-menu-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.drawer-menu-item .sort-arrow-icon {
  flex-shrink: 0;
  margin-left: auto;
  transition: transform 0.2s;
}

.drawer-menu-item .sort-arrow-icon.reversed {
  transform: rotate(180deg);
}
</style>