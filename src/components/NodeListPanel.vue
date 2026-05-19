<template>
  <div
    ref="panelRef"
    class="node-list-panel"
    :style="{ width: panelWidth + 'px' }"
  >
    <!-- 标题栏 -->
    <div class="panel-title-bar">
      <h2 class="panel-title">{{ notebookName }}</h2>
      <span class="note-count">{{ nodes.length }} {{ t('notebook.notes') }}</span>
      <!-- 按钮组 -->
      <div class="btn-group">
        <!-- 视图切换按钮 -->
        <button
          class="view-toggle-btn"
          @click="toggleViewMenu"
        >
          <!-- 卡片图标 -->
          <svg v-if="viewMode === 'card'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M4 4h7v7H4zm0 9h7v7H4zm9-9h7v7h-7zm0 9h7v7h-7z"/>
          </svg>
          <!-- 列表图标 -->
          <svg v-else-if="viewMode === 'list'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          <!-- 日历图标 -->
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
          </svg>
        </button>
        <!-- 排序按钮 -->
        <button
          class="sort-toggle-btn"
          @click="toggleSortMenu"
        >
          <!-- 排序图标 -->
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
          </svg>
        </button>
      </div>
    </div>

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

    <!-- 视图内容区域 -->
    <div class="view-content">
      <!-- 卡片视图 -->
      <NodeCardView
        v-if="viewMode === 'card'"
        ref="cardViewRef"
        :nodes="sortedNodes"
        :active-node-id="activeNodeId"
        :panel-width="panelWidth"
        :sort-order="sortOrder"
        @toggle-context="$emit('toggle-context', $event)"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @activate="handleNodeActivate"
        @batch-select-context="handleBatchSelectContext"
      />

      <!-- 列表视图 -->
      <NodeListView
        v-if="viewMode === 'list'"
        ref="listViewRef"
        :nodes="sortedNodes"
        :active-node-id="activeNodeId"
        :sort-order="sortOrder"
        @toggle-context="$emit('toggle-context', $event)"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @activate="handleNodeActivate"
        @batch-select-context="handleBatchSelectContext"
      />

      <!-- 日历视图 -->
      <NodeCalendarView
        v-if="viewMode === 'calendar'"
        ref="calendarViewRef"
        :nodes="sortedNodes"
        :active-node-id="activeNodeId"
        :sort-order="sortOrder"
        @toggle-context="$emit('toggle-context', $event)"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @activate="handleNodeActivate"
        @visible-nodes-change="handleVisibleNodesChange"
        @batch-select-context="handleBatchSelectContext"
      />
    </div>

    <!-- 底部批量管理栏 -->
    <div v-if="selectedCount > 0" class="batch-management-bar">
      <button class="batch-btn" @click="isAllSelected ? deselectAll() : selectAll()">
        {{ isAllSelected ? t('common.deselectAll') : t('common.selectAll') }}
      </button>
      <span class="selected-count">{{ t('common.selectedCount', { count: selectedCount }) }}</span>
      <!-- 抽屉菜单按钮 -->
      <div class="batch-menu-wrapper">
        <button
          ref="batchMenuBtnRef"
          class="batch-menu-btn"
          @click="toggleBatchMenu"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 批量操作抽屉菜单 -->
    <Teleport to="body">
      <div v-if="showBatchMenu" class="menu-overlay" @click="closeBatchMenu"></div>
      <div v-if="showBatchMenu" class="drawer-menu batch-menu" :style="batchMenuStyle">
        <button
          class="drawer-menu-item favorite"
          @click="handleBatchFavorite"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          <span>{{ t('nodeList.favorite') }}</span>
        </button>
        <button
          class="drawer-menu-item move"
          @click="handleBatchMove"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 12H6v-2h8v2zm4-4H6v-2h12v2z"/>
          </svg>
          <span>{{ t('nodeList.moveTo') }}</span>
        </button>
        <button
          class="drawer-menu-item delete"
          @click="handleBatchDelete"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
          <span>{{ t('common.delete') }}</span>
        </button>
      </div>

      <!-- 移动笔记本菜单 -->
      <div v-if="showMoveNotebookMenu" class="drawer-menu move-notebook-menu" :style="moveNotebookMenuStyle">
        <button
          v-for="notebook in availableNotebooks"
          :key="notebook.id"
          class="drawer-menu-item notebook-item"
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
    </Teleport>

    <!-- 批量删除确认对话框 -->
    <Teleport to="body">
      <div v-if="showDeleteConfirmDialog" class="delete-dialog-overlay" @click="showDeleteConfirmDialog = false">
        <div class="delete-dialog" @click.stop>
          <div class="dialog-header">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="warning-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <h3>{{ t('nodeList.deleteConfirmTitle') }}</h3>
          </div>
          <div class="dialog-body">
            <p>{{ t('nodeList.deleteConfirmMessage', { count: pendingDeleteCount }) }}</p>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="showDeleteConfirmDialog = false">
              {{ t('common.cancel') }}
            </button>
            <button class="delete-btn" @click="confirmBatchDelete">
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import NodeCardView from '@/components/NodeCardView.vue'
import NodeListView from '@/components/NodeListView.vue'
import NodeCalendarView from '@/components/NodeCalendarView.vue'
import type { CanvasNode } from '@/types/notebook'

const props = withDefaults(defineProps<{
  nodes: CanvasNode[]
  notebookName: string
  activeNodeId?: string | null
  panelWidth: number
}>(), {
  activeNodeId: null,
  panelWidth: 600
})

const { t } = useI18n()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
  'batch-delete': [nodeIds: string[]]
  'batch-move': [nodeIds: string[], targetNotebookId: string]
  'batch-favorite': [nodeIds: string[]]
  'batch-select-context': [nodeIds: string[], selected: boolean]
  'visible-nodes-change': [nodeIds: string[]]
}>()

const panelRef = ref<HTMLElement | null>(null)
const cardViewRef = ref<InstanceType<typeof NodeCardView> | null>(null)
const listViewRef = ref<InstanceType<typeof NodeListView> | null>(null)
const calendarViewRef = ref<InstanceType<typeof NodeCalendarView> | null>(null)

// 排序按钮和菜单状态
const sortBtnRef = ref<HTMLElement | null>(null)
const showSortMenu = ref(false)
const sortMenuStyle = ref<{ top?: string; right?: string }>({})

// 视图按钮和菜单状态
const viewBtnRef = ref<HTMLElement | null>(null)
const showViewMenu = ref(false)
const viewMenuStyle = ref<{ top?: string; right?: string }>({})

// 批量操作菜单状态
const batchMenuBtnRef = ref<HTMLElement | null>(null)
const showBatchMenu = ref(false)
const batchMenuStyle = ref<{ top?: string; bottom?: string; right?: string }>({})

// 移动笔记本菜单状态
const showMoveNotebookMenu = ref(false)
const moveNotebookMenuStyle = ref<{ top?: string; bottom?: string; right?: string }>({})
const pendingMoveIds = ref<string[]>([])

// 日历视图当前可见的节点
const calendarVisibleNodes = ref<CanvasNode[]>([])

// 批量删除确认对话框状态
const showDeleteConfirmDialog = ref(false)
const pendingDeleteIds = ref<string[]>([])
const pendingDeleteCount = computed(() => pendingDeleteIds.value.length)

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
    // 同一字段，切换方向
    const newDirection = currentSortDirection.value === 'asc' ? 'Desc' : 'Asc'
    sortOrder.value = `${field}${newDirection}`
  } else {
    // 不同字段，默认倒序
    sortOrder.value = `${field}Desc`
  }
  closeSortMenu()
}

// 排序后的节点列表
const sortedNodes = computed(() => {
  const nodes = [...props.nodes]
  switch (sortOrder.value) {
    case 'createdAtAsc':
      return nodes.sort((a, b) => a.createdAt - b.createdAt)
    case 'createdAtDesc':
      return nodes.sort((a, b) => b.createdAt - a.createdAt)
    case 'updatedAtAsc':
      return nodes.sort((a, b) => (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt))
    case 'updatedAtDesc':
      return nodes.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    case 'titleAsc':
      return nodes.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'))
    case 'titleDesc':
      return nodes.sort((a, b) => (b.title || '').localeCompare(a.title || '', 'zh-CN'))
  }
  return nodes
})

// 可移动的笔记本列表（排除当前笔记本）
const availableNotebooks = computed(() => {
  return notebookStore.notebooks.filter(n => n.id !== notebookStore.currentNotebook?.id)
})

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

// 批量操作菜单控制
function toggleBatchMenu() {
  if (showBatchMenu.value) {
    closeBatchMenu()
  } else {
    const btn = batchMenuBtnRef.value
    if (btn) {
      const rect = btn.getBoundingClientRect()
      batchMenuStyle.value = {
        bottom: `${window.innerHeight - rect.top + 4}px`,
        right: `${window.innerWidth - rect.right}px`
      }
      showBatchMenu.value = true
    }
  }
}

function closeBatchMenu() {
  showBatchMenu.value = false
  showMoveNotebookMenu.value = false
}

function setViewMode(mode: string) {
  viewMode.value = mode as any
  closeViewMenu()
}

// 选中的节点（复用上下文选择）
const selectedNodes = computed(() => {
  return props.nodes.filter(n => n.selectedAsContext && n.transcriptStatus === 'done')
})

// 选中的节点数量（日历视图时只计算当前可见的选中节点）
const selectedCount = computed(() => {
  if (viewMode.value === 'calendar') {
    return calendarVisibleNodes.value.filter(n => n.selectedAsContext).length
  }
  return selectedNodes.value.length
})

// 可选择的节点（只考虑转录完成的节点）
const selectableNodes = computed(() => {
  return props.nodes.filter(n => n.transcriptStatus === 'done')
})

// 是否全选（日历视图时只考虑当前可见的节点）
const isAllSelected = computed(() => {
  if (viewMode.value === 'calendar') {
    const selectableVisible = calendarVisibleNodes.value.filter(n => n.transcriptStatus === 'done')
    return selectableVisible.length > 0 && selectableVisible.every(n => n.selectedAsContext)
  }
  return selectableNodes.value.length > 0 && selectedCount.value === selectableNodes.value.length
})

// 全选（选中所有转录完成的节点，日历视图时只选中当前可见的）
function selectAll() {
  if (viewMode.value === 'calendar') {
    const nodeIds = calendarVisibleNodes.value
      .filter(n => n.transcriptStatus === 'done' && !n.selectedAsContext)
      .map(n => n.id)
    if (nodeIds.length > 0) {
      emit('batch-select-context', nodeIds, true)
    }
  } else {
    const nodeIds = selectableNodes.value
      .filter(n => !n.selectedAsContext)
      .map(n => n.id)
    if (nodeIds.length > 0) {
      emit('batch-select-context', nodeIds, true)
    }
  }
}

// 取消全选（日历视图时只取消当前可见的选中节点）
function deselectAll() {
  if (viewMode.value === 'calendar') {
    const nodeIds = calendarVisibleNodes.value
      .filter(n => n.selectedAsContext)
      .map(n => n.id)
    if (nodeIds.length > 0) {
      emit('batch-select-context', nodeIds, false)
    }
  } else {
    const nodeIds = selectedNodes.value.map(n => n.id)
    if (nodeIds.length > 0) {
      emit('batch-select-context', nodeIds, false)
    }
  }
}

// 批量收藏
function handleBatchFavorite() {
  closeBatchMenu()
  if (selectedCount.value === 0) return
  let nodesToFavorite: CanvasNode[]
  if (viewMode.value === 'calendar') {
    nodesToFavorite = calendarVisibleNodes.value.filter(n => n.selectedAsContext)
  } else {
    nodesToFavorite = selectedNodes.value
  }
  emit('batch-favorite', nodesToFavorite.map(n => n.id))
}

// 批量删除（显示确认对话框）
function handleBatchDelete() {
  closeBatchMenu()
  if (selectedCount.value === 0) return
  let nodesToDelete: CanvasNode[]
  if (viewMode.value === 'calendar') {
    nodesToDelete = calendarVisibleNodes.value.filter(n => n.selectedAsContext)
  } else {
    nodesToDelete = selectedNodes.value
  }
  pendingDeleteIds.value = nodesToDelete.map(n => n.id)
  showDeleteConfirmDialog.value = true
}

// 确认批量删除
function confirmBatchDelete() {
  emit('batch-delete', pendingDeleteIds.value)
  showDeleteConfirmDialog.value = false
  pendingDeleteIds.value = []
}

// 批量移动（打开笔记本列表菜单）
function handleBatchMove(e: MouseEvent) {
  if (selectedCount.value === 0) return
  let nodesToMove: CanvasNode[]
  if (viewMode.value === 'calendar') {
    nodesToMove = calendarVisibleNodes.value.filter(n => n.selectedAsContext)
  } else {
    nodesToMove = selectedNodes.value
  }
  pendingMoveIds.value = nodesToMove.map(n => n.id)

  // 计算移动笔记本菜单的位置（在移动按钮右侧，底部对齐）
  const target = e.currentTarget as HTMLElement
  if (target) {
    const rect = target.getBoundingClientRect()
    moveNotebookMenuStyle.value = {
      bottom: `${window.innerHeight - rect.bottom}px`,
      right: `${window.innerWidth - rect.left + 4}px`
    }
  }
  showMoveNotebookMenu.value = true
}

// 选择目标笔记本进行移动
function selectMoveNotebook(notebookId: string) {
  emit('batch-move', pendingMoveIds.value, notebookId)
  closeMoveNotebookMenu()
  closeBatchMenu()
  pendingMoveIds.value = []
}

// 关闭移动笔记本菜单
function closeMoveNotebookMenu() {
  showMoveNotebookMenu.value = false
}

// 处理日历视图可见节点变化
function handleVisibleNodesChange(nodes: CanvasNode[]) {
  calendarVisibleNodes.value = nodes
  // 直接emit收到的节点ID，不依赖computed
  emit('visible-nodes-change', nodes.map(n => n.id))
}

// 计算当前可见的节点 ID 列表（用于卡片/列表视图）
const visibleNodeIds = computed(() => {
  if (viewMode.value === 'calendar') {
    // 日历视图由handleVisibleNodesChange单独emit
    return calendarVisibleNodes.value.map(n => n.id)
  }
  // 卡片视图和列表视图显示所有排序后的节点
  return sortedNodes.value.map(n => n.id)
})

// emit 可见节点变化（卡片/列表视图）
function emitVisibleNodes() {
  if (viewMode.value !== 'calendar') {
    emit('visible-nodes-change', visibleNodeIds.value)
  }
}

// 监听视图模式变化和节点变化（卡片/列表视图）
watch([viewMode, () => props.nodes.length, () => props.nodes.map(n => n.id).join(',')], () => {
  emitVisibleNodes()
}, { immediate: true })

function handleNodeActivate(nodeId: string) {
  emit('activate', nodeId)
}

function handleBatchSelectContext(nodeIds: string[], selected: boolean) {
  emit('batch-select-context', nodeIds, selected)
}

defineExpose({
  updateNodeHeights: () => {
    cardViewRef.value?.updateNodeHeights()
  },
  scrollToNode: (nodeId: string) => {
    if (viewMode.value === 'card') {
      cardViewRef.value?.scrollToNode(nodeId)
    } else if (viewMode.value === 'list') {
      listViewRef.value?.scrollToNode(nodeId)
    }
  }
})

// 全局事件监听：ESC 关闭菜单
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeSortMenu()
    closeViewMenu()
    closeBatchMenu()
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
.node-list-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-secondary);
  min-width: 298px;
  flex-shrink: 0;
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

:root.dark .node-list-panel {
  background: var(--bg-primary);
}

/* 标题栏 */
.panel-title-bar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-count {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  white-space: nowrap;
}

/* 按钮组 */
.btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* 视图切换按钮 */
.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
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
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.sort-toggle-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
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

.drawer-menu-item .check-icon {
  flex-shrink: 0;
}

.drawer-menu-item .check-placeholder {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.drawer-menu-item .sort-arrow-icon {
  flex-shrink: 0;
  margin-left: auto;
  transition: transform 0.2s;
}

.drawer-menu-item .sort-arrow-icon.reversed {
  transform: rotate(180deg);
}

/* 视图内容区域 */
.view-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 底部批量管理栏 */
.batch-management-bar {
  padding: 8px 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-primary);
}

.batch-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-body);
  cursor: pointer;
  transition: all 0.2s;
}

.batch-btn:hover {
  background: var(--bg-hover);
}

.selected-count {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
  flex: 1;
}

/* 批量操作菜单按钮 */
.batch-menu-wrapper {
  position: relative;
  margin-left: auto;
}

.batch-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.batch-menu-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.batch-menu {
  min-width: 120px;
}

.batch-menu .drawer-menu-item.delete:hover {
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