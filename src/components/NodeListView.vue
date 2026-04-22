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
        <!-- 创建日期 -->
        <span class="node-date">
          {{ formatDate(node.createdAt) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CanvasNode } from '@/types/notebook'

const props = withDefaults(defineProps<{
  nodes: CanvasNode[]
  activeNodeId?: string | null
}>(), {
  activeNodeId: null
})

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
  'batch-select-context': [nodeIds: string[], selected: boolean]
}>()

const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)
const nodeContainerRef = ref<HTMLElement | null>(null)

// 拖拽多选状态
const isDragSelecting = ref(false)
const dragSelectedIds = ref<Set<string>>(new Set())
const dragStartY = ref(0)
const dragStartX = ref(0)
const isSelecting = ref(true) // true表示选取，false表示取消选取
const isDragStarted = ref(false) // 是否已进入拖拽模式
const startNodeId = ref<string | null>(null) // 开始时的节点ID

const DRAG_THRESHOLD = 5 // 拖拽阈值，超过此距离才进入拖拽模式

const sortedNodes = computed(() => {
  return [...props.nodes].sort((a, b) => a.createdAt - b.createdAt)
})

function handleScroll() {
  // 可扩展虚拟滚动，但列表视图一般节点数量较少，暂不实现
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

  // 处理当前位置的节点
  processNodeAtPosition(e.clientX, e.clientY)
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
})

onUnmounted(() => {
  if (nodeContainerRef.value) {
    nodeContainerRef.value.removeEventListener('mousedown', handleDragStart)
  }
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
})

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
  background: var(--color-primary-bg);
  border-left: 3px solid var(--color-primary);
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
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.node-date {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
</style>