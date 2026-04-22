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
      <div class="view-toggle-group">
        <button
          class="view-toggle-btn"
          :class="{ active: viewMode === 'card' }"
          @click="viewMode = 'card'"
        >
          <!-- 卡片图标 -->
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M4 4h7v7H4zm0 9h7v7H4zm9-9h7v7h-7zm0 9h7v7h-7z"/>
          </svg>
        </button>
        <button
          class="view-toggle-btn"
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
        >
          <!-- 列表图标 -->
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
        </button>
        <button
          class="view-toggle-btn"
          :class="{ active: viewMode === 'calendar' }"
          @click="viewMode = 'calendar'"
        >
          <!-- 日历图标 -->
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 视图内容区域 -->
    <div class="view-content">
      <!-- 卡片视图 -->
      <NodeCardView
        v-if="viewMode === 'card'"
        ref="cardViewRef"
        :nodes="nodes"
        :active-node-id="activeNodeId"
        :panel-width="panelWidth"
        @toggle-context="$emit('toggle-context', $event)"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @activate="handleNodeActivate"
        @batch-select-context="handleBatchSelectContext"
      />

      <!-- 列表视图 -->
      <NodeListView
        v-if="viewMode === 'list'"
        ref="listViewRef"
        :nodes="nodes"
        :active-node-id="activeNodeId"
        @toggle-context="$emit('toggle-context', $event)"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @activate="handleNodeActivate"
        @batch-select-context="handleBatchSelectContext"
      />

      <!-- 日历视图 -->
      <NodeCalendarView
        v-if="viewMode === 'calendar'"
        ref="calendarViewRef"
        :nodes="nodes"
        :active-node-id="activeNodeId"
        @toggle-context="$emit('toggle-context', $event)"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @activate="handleNodeActivate"
        @visible-nodes-change="handleVisibleNodesChange"
        @batch-select-context="handleBatchSelectContext"
      />
    </div>

    <!-- 底部批量管理栏 -->
    <div class="batch-management-bar">
      <button class="batch-btn" @click="isAllSelected ? deselectAll() : selectAll()">
        {{ isAllSelected ? t('common.deselectAll') : t('common.selectAll') }}
      </button>
      <span class="selected-count">{{ t('common.selectedCount', { count: selectedCount }) }}</span>
      <button
        class="batch-btn delete-btn"
        :disabled="selectedCount === 0"
        @click="handleBatchDelete"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        {{ t('common.delete') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
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

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
  'batch-delete': [nodeIds: string[]]
  'batch-select-context': [nodeIds: string[], selected: boolean]
  'visible-nodes-change': [nodeIds: string[]]
}>()

const panelRef = ref<HTMLElement | null>(null)
const cardViewRef = ref<InstanceType<typeof NodeCardView> | null>(null)
const listViewRef = ref<InstanceType<typeof NodeListView> | null>(null)
const calendarViewRef = ref<InstanceType<typeof NodeCalendarView> | null>(null)

// 日历视图当前可见的节点
const calendarVisibleNodes = ref<CanvasNode[]>([])

// 视图模式：从设置中读取
const viewMode = computed({
  get: () => settingsStore.settings.general.nodeListViewMode || 'card',
  set: (value) => {
    settingsStore.settings.general.nodeListViewMode = value
    settingsStore.saveSettings()
  }
})

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

// 批量删除（删除所有选中作为上下文的节点，日历视图时只删除当前可见的选中节点）
function handleBatchDelete() {
  if (selectedCount.value === 0) return
  let nodesToDelete: CanvasNode[]
  if (viewMode.value === 'calendar') {
    nodesToDelete = calendarVisibleNodes.value.filter(n => n.selectedAsContext)
  } else {
    nodesToDelete = selectedNodes.value
  }
  emit('batch-delete', nodesToDelete.map(n => n.id))
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
  // 卡片视图和列表视图显示所有节点
  return props.nodes.map(n => n.id)
})

// emit 可见节点变化（卡片/列表视图）
function emitVisibleNodes() {
  if (viewMode.value !== 'calendar') {
    emit('visible-nodes-change', visibleNodeIds.value)
  }
}

// 监听视图模式变化和节点变化（卡片/列表视图）
watch([viewMode, () => props.nodes], () => {
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
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-count {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.view-toggle-group {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 2px;
  margin-left: auto;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
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
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.batch-btn:hover {
  background: var(--bg-hover);
}

.batch-btn.delete-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-error);
  border-color: var(--color-error);
}

.batch-btn.delete-btn:hover {
  background: rgba(255, 68, 68, 0.1);
}

.batch-btn.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.selected-count {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>