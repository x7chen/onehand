<template>
  <div ref="panelRef" class="node-card-view">
    <div ref="nodeContainerRef" class="node-container" @scroll="handleScroll">
      <div
        class="masonry-viewport"
        :style="{ height: totalHeight + 'px' }"
      >
        <template v-for="item in visibleNodes" :key="item.node.id">
          <div
            class="masonry-item"
            :style="{
              position: 'absolute',
              top: item.top + 'px',
              left: item.left + 'px',
              width: item.width + 'px'
            }"
            :data-node-id="item.node.id"
          >
            <VoiceNoteSmall
              :ref="(el) => { if (el) voiceNoteRefs[item.node.id] = el }"
              :node="item.node"
              :is-active="activeNodeId === item.node.id"
              @toggle-context="$emit('toggle-context', $event)"
              @toggle-favorite="$emit('toggle-favorite', $event)"
              @activate="handleNodeActivate"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, nextTick, onMounted, onUnmounted, triggerRef } from 'vue'
import VoiceNoteSmall from '@/components/VoiceNoteSmall.vue'
import type { CanvasNode } from '@/types/notebook'

interface VirtualNodeItem {
  node: CanvasNode
  top: number
  left: number
  width: number
  height: number
}

const props = withDefaults(defineProps<{
  nodes: CanvasNode[]
  activeNodeId?: string | null
  panelWidth: number
}>(), {
  activeNodeId: null,
  panelWidth: 600
})

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
  'batch-select-context': [nodeIds: string[], selected: boolean]
}>()

const panelRef = ref<HTMLElement | null>(null)
const nodeContainerRef = ref<HTMLElement | null>(null)
const voiceNoteRefs = ref<Record<string, any>>({})

const NODE_MIN_WIDTH = 250
const COLUMN_GAP = 6
const CONTAINER_PADDING = 24
const BUFFER_SIZE = 5
const SCROLL_THRESHOLD = 100

const nodeHeights = ref<Record<string, number>>({})
const measuredNodes = ref<Set<string>>(new Set())
const virtualItems = shallowRef<Map<string, VirtualNodeItem>>(new Map())
const scrollTop = ref(0)
const containerHeight = ref(600)

// 拖拽多选状态
const isDragSelecting = ref(false)
const dragSelectedIds = ref<Set<string>>(new Set())
const dragStartY = ref(0)
const dragStartX = ref(0)
const isSelecting = ref(true) // true表示选取，false表示取消选取
const isDragStarted = ref(false) // 是否已进入拖拽模式
const startNodeId = ref<string | null>(null) // 开始时的节点ID

const DRAG_THRESHOLD = 5 // 拖拽阈值，超过此距离才进入拖拽模式

// 防止布局计算冲突的标志
let isLayoutCalculating = false
// 是否正在处理节点变化
let isPageChanging = false
// 测量定时器
let measureTimer: ReturnType<typeof setTimeout> | null = null

const sortedNodes = computed(() => {
  return [...props.nodes].sort((a, b) => a.createdAt - b.createdAt)
})

const columnCount = computed(() => {
  const panelWidth = props.panelWidth - CONTAINER_PADDING * 2
  for (let cols = 3; cols >= 1; cols--) {
    const availableWidth = panelWidth - (cols - 1) * COLUMN_GAP
    const nodeWidth = availableWidth / cols
    if (nodeWidth >= NODE_MIN_WIDTH) {
      return cols
    }
  }
  return 1
})

const columnWidth = computed(() => {
  const availableWidth = props.panelWidth - CONTAINER_PADDING * 2 - (columnCount.value - 1) * COLUMN_GAP
  return availableWidth / columnCount.value
})

const totalHeight = computed(() => {
  let maxHeight = 0
  virtualItems.value.forEach(item => {
    const bottom = item.top + item.height
    if (bottom > maxHeight) {
      maxHeight = bottom
    }
  })
  return maxHeight + CONTAINER_PADDING
})

const visibleNodes = computed(() => {
  const viewTop = scrollTop.value - SCROLL_THRESHOLD
  const viewBottom = scrollTop.value + containerHeight.value + SCROLL_THRESHOLD
  const result: VirtualNodeItem[] = []

  virtualItems.value.forEach(item => {
    const itemBottom = item.top + item.height
    if (itemBottom >= viewTop && item.top <= viewBottom) {
      result.push(item)
    }
  })

  return result.sort((a, b) => a.top - b.top)
})

function calculateLayout() {
  isLayoutCalculating = true
  try {
    const nodes = sortedNodes.value
    const cols = columnCount.value
    const colWidth = columnWidth.value
    const items = new Map<string, VirtualNodeItem>()

    if (!nodes.length) {
      virtualItems.value = items
      triggerRef(virtualItems)
      return
    }

    // 每列当前的累积高度（下一个节点应该放置的 top 位置）
    const colHeights = new Array(cols).fill(CONTAINER_PADDING)

    for (const node of nodes) {
      // 找最短的列
      let minCol = 0
      let minHeight = colHeights[0]

      for (let i = 1; i < cols; i++) {
        if (colHeights[i] < minHeight) {
          minHeight = colHeights[i]
          minCol = i
        }
      }

      const estimatedHeight = nodeHeights.value[node.id] || 200
      const left = CONTAINER_PADDING + minCol * (colWidth + COLUMN_GAP)

      // 当前节点的 top 就是该列当前的高度
      items.set(node.id, {
        node,
        top: colHeights[minCol],
        left,
        width: colWidth,
        height: estimatedHeight
      })

      // 更新该列的累积高度
      colHeights[minCol] += estimatedHeight + COLUMN_GAP
    }

    virtualItems.value = items
    triggerRef(virtualItems)
  } finally {
    isLayoutCalculating = false
  }
}

function updateMeasuredHeights(forceLayout = false) {
  if (!nodeContainerRef.value) return

  const container = nodeContainerRef.value.querySelector('.masonry-viewport')
  if (!container) return

  let hasChanges = false
  const items = container.querySelectorAll('.masonry-item')

  items.forEach(item => {
    const nodeId = item.getAttribute('data-node-id')
    if (nodeId) {
      const height = (item as HTMLElement).offsetHeight
      // 只有高度变化超过阈值才记录变化，避免选中状态变化（边框等）导致的小幅高度变化触发布局
      const oldHeight = nodeHeights.value[nodeId]
      const heightDiff = Math.abs((oldHeight || 0) - height)
      if (!oldHeight || heightDiff > 5) {
        nodeHeights.value[nodeId] = height
        measuredNodes.value.add(nodeId)
        hasChanges = true
      }
    }
  })

  // 只有强制布局或非翻页期间且有变化时才重新计算布局
  if ((forceLayout || !isPageChanging) && hasChanges) {
    calculateLayout()
  }
}

// 延迟测量高度，确保节点完全渲染
function scheduleMeasureHeights(delay = 50) {
  if (measureTimer) {
    clearTimeout(measureTimer)
  }
  measureTimer = setTimeout(() => {
    measureTimer = null
    updateMeasuredHeights(true)
    // 如果还在翻页状态，继续延迟测量
    if (isPageChanging) {
      scheduleMeasureHeights(100)
    }
  }, delay)
}

watch(visibleNodes, () => {
  // 如果正在计算布局或翻页，跳过
  if (isLayoutCalculating || isPageChanging) return
  nextTick(() => {
    updateMeasuredHeights()
  })
})

function handleScroll() {
  if (!nodeContainerRef.value) return
  const newScrollTop = nodeContainerRef.value.scrollTop
  if (Math.abs(newScrollTop - scrollTop.value) > 5) {
    scrollTop.value = newScrollTop
  }
}

function handleNodeActivate(nodeId: string) {
  emit('activate', nodeId)
}

let scrollAnimationFrameId: number | null = null
let scrollTimer: ReturnType<typeof setTimeout> | null = null
let scrollRetryCount = 0

watch(() => props.activeNodeId, (newNodeId) => {
  if (!newNodeId) return

  if (scrollAnimationFrameId !== null) {
    cancelAnimationFrame(scrollAnimationFrameId)
    scrollAnimationFrameId = null
  }
  if (scrollTimer !== null) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }
  scrollRetryCount = 0

  nextTick(() => {
    tryScrollToNode(newNodeId)
  })
})

function tryScrollToNode(nodeId: string) {
  const container = panelRef.value?.querySelector('.node-container') as HTMLElement
  if (!container) {
    scheduleScrollToNode(nodeId)
    return
  }

  const nodeEl = container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
  if (nodeEl) {
    scrollNodeToVisible(nodeEl)
  } else {
    const item = virtualItems.value.get(nodeId)
    if (item) {
      scrollToVisibleByVirtualItem(container, item)
    }
    scheduleScrollToNode(nodeId)
  }
}

function scrollToVisibleByVirtualItem(container: HTMLElement, item: { top: number; height: number }) {
  const viewTop = container.scrollTop + 4
  const viewBottom = container.scrollTop + container.clientHeight - 4
  const itemTop = item.top
  const itemBottom = itemTop + (item.height || 200)

  if (itemTop >= viewTop && itemBottom <= viewBottom) {
    return
  }

  let scrollTo: number
  if (itemTop < viewTop) {
    scrollTo = itemTop - 10
  } else {
    scrollTo = itemBottom - container.clientHeight + 10
  }

  container.scrollTo({
    top: Math.max(0, scrollTo),
    behavior: 'smooth'
  })
}

function scheduleScrollToNode(nodeId: string) {
  scrollAnimationFrameId = requestAnimationFrame(() => {
    scrollAnimationFrameId = null
    const container = panelRef.value?.querySelector('.node-container') as HTMLElement
    if (!container) return

    const nodeEl = container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    if (!nodeEl) {
      if (scrollRetryCount < 10) {
        scrollRetryCount++
        scrollTimer = setTimeout(() => {
          scheduleScrollToNode(nodeId)
        }, 100)
      }
      return
    }
    scrollNodeToVisible(nodeEl)
  })
}

function scrollNodeToVisible(nodeEl: HTMLElement) {
  const container = panelRef.value?.querySelector('.node-container') as HTMLElement
  if (!container) return

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

// 记录上一次的节点 ID 集合，用于判断是否是翻页
let lastNodeIds = new Set<string>()

watch(() => props.nodes, (nodes) => {
  // 计算当前节点 ID 集合
  const currentNodeIds = new Set(nodes.map(n => n.id))

  // 检查是否是翻页（节点 ID 集合完全不同）
  let isPageChange = false
  if (currentNodeIds.size !== lastNodeIds.size) {
    isPageChange = true
  } else {
    // 检查是否有任何 ID 不同
    for (const id of currentNodeIds) {
      if (!lastNodeIds.has(id)) {
        isPageChange = true
        break
      }
    }
  }

  // 更新记录
  lastNodeIds = currentNodeIds

  // 只有翻页时才重置所有状态
  if (isPageChange) {
    // 标记正在翻页，防止期间触发布局更新
    isPageChanging = true
    measuredNodes.value.clear()
    nodeHeights.value = {}
    scrollTop.value = 0
    voiceNoteRefs.value = {}
    // 重置滚动位置
    if (nodeContainerRef.value) {
      nodeContainerRef.value.scrollTop = 0
    }
    // 先清空 virtualItems，确保旧节点不显示
    virtualItems.value = new Map()
    triggerRef(virtualItems)
  }

  // 立即计算初始布局
  calculateLayout()

  // 延迟测量高度，确保节点完全渲染
  scheduleMeasureHeights(isPageChange ? 100 : 50)

  // 翻页时需要多次测量确保稳定
  if (isPageChange) {
    // 多次延迟测量，确保异步内容加载完成后也能正确布局
    setTimeout(() => {
      updateMeasuredHeights(true)
      // 翻页完成后重置标志
      isPageChanging = false
    }, 300)
  }
})

watch(() => props.panelWidth, () => {
  measuredNodes.value.clear()
  calculateLayout()
  scheduleMeasureHeights(100)
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  calculateLayout()
  if (nodeContainerRef.value) {
    containerHeight.value = nodeContainerRef.value.clientHeight
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === nodeContainerRef.value) {
          containerHeight.value = entry.contentRect.height
        }
      }
    })
    if (nodeContainerRef.value) {
      resizeObserver.observe(nodeContainerRef.value)
    }
    // 添加拖拽多选事件监听
    nodeContainerRef.value.addEventListener('mousedown', handleDragStart)
  }
  // 初始渲染后延迟测量高度
  scheduleMeasureHeights(100)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (measureTimer) {
    clearTimeout(measureTimer)
    measureTimer = null
  }
  if (scrollTimer) {
    clearTimeout(scrollTimer)
    scrollTimer = null
  }
  if (scrollAnimationFrameId !== null) {
    cancelAnimationFrame(scrollAnimationFrameId)
    scrollAnimationFrameId = null
  }
  // 移除拖拽多选事件监听
  if (nodeContainerRef.value) {
    nodeContainerRef.value.removeEventListener('mousedown', handleDragStart)
  }
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
})

defineExpose({
  updateNodeHeights: updateMeasuredHeights,
  scrollToNode
})

// 滚动到指定节点
function scrollToNode(nodeId: string) {
  const item = virtualItems.value.get(nodeId)
  if (!item || !nodeContainerRef.value) return

  const targetTop = item.top - CONTAINER_PADDING
  nodeContainerRef.value.scrollTo({
    top: targetTop,
    behavior: 'smooth'
  })
}

// 拖拽多选：开始拖拽
function handleDragStart(e: MouseEvent) {
  // 只响应左键，排除checkbox、favorite按钮等交互元素
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.small-checkbox, .small-favorite-btn, .small-indicator')) return

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
    const nodeItem = (el as HTMLElement).closest('.masonry-item')
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
</script>

<style scoped>
.node-card-view {
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

.masonry-viewport {
  position: relative;
  width: 100%;
}

.masonry-item {
  box-sizing: border-box;
}

.masonry-item :deep(.voice-note-small) {
  position: relative !important;
  left: 0 !important;
  top: 0 !important;
  margin: 0;
  width: 100% !important;
}
</style>