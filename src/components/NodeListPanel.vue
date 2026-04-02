<template>
  <div
    ref="panelRef"
    class="node-list-panel"
    :style="{ width: panelWidth + 'px' }"
    @mouseenter="isPanelHovered = true"
    @mouseleave="isPanelHovered = false"
  >
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

    <!-- 左边缘翻页按钮（上一页） -->
    <div
      class="page-nav-zone page-nav-left"
      @mouseenter="isLeftZoneHovered = true"
      @mouseleave="isLeftZoneHovered = false"
    >
      <Transition name="page-nav-fade">
        <button
          v-if="isLeftZoneHovered && hasPrevPage"
          class="page-nav-btn"
          @click="handlePrevPage"
          :title="t('pdf.prevPage')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </Transition>
    </div>

    <!-- 右边缘翻页按钮（下一页/新增页面） -->
    <div
      class="page-nav-zone page-nav-right"
      @mouseenter="isRightZoneHovered = true"
      @mouseleave="isRightZoneHovered = false"
    >
      <Transition name="page-nav-fade">
        <button
          v-if="isRightZoneHovered && (hasNextPage || canAddNewPage)"
          class="page-nav-btn"
          :class="{ 'add-new-page': !hasNextPage }"
          @click="handleNextOrAddPage"
          :title="hasNextPage ? t('pdf.nextPage') : t('notebook.newNotebook')"
        >
          <svg v-if="hasNextPage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </Transition>
    </div>

    <!-- 页码指示器 -->
    <Transition name="page-indicator-fade">
      <div v-if="showPageIndicator" class="page-indicator">
        {{ currentPageNumber }} / {{ totalPages }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, nextTick, onMounted, onUnmounted, triggerRef } from 'vue'
import { useI18n } from 'vue-i18n'
import VoiceNoteSmall from '@/components/VoiceNoteSmall.vue'
import { useNotebookStore } from '@/stores/notebookStore'
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

const notebookStore = useNotebookStore()
const { t } = useI18n()

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
}>()

const panelRef = ref<HTMLElement | null>(null)
const nodeContainerRef = ref<HTMLElement | null>(null)
const voiceNoteRefs = ref<Record<string, any>>({})

// 翻页相关状态
const isPanelHovered = ref(false)
const isLeftZoneHovered = ref(false)
const isRightZoneHovered = ref(false)
const showPageIndicator = ref(false)
let pageIndicatorTimer: ReturnType<typeof setTimeout> | null = null

// 翻页相关计算属性
const hasPrevPage = computed(() => notebookStore.hasPrevPage)
const hasNextPage = computed(() => notebookStore.hasNextPage)
const currentPageNumber = computed(() => notebookStore.currentPageNumber)
const totalPages = computed(() => notebookStore.totalPages)

// 是否可以新增页面（当前页有节点时可以新增）
const canAddNewPage = computed(() => {
  const currentCanvas = notebookStore.currentCanvas
  return currentCanvas && currentCanvas.nodes && currentCanvas.nodes.length > 0
})

// 翻页方法
function handlePrevPage() {
  notebookStore.goToPrevPage()
  showPageIndicatorTemporarily()
}

// 下一页或新增页面
function handleNextOrAddPage() {
  if (hasNextPage.value) {
    notebookStore.goToNextPage()
    showPageIndicatorTemporarily()
  } else if (canAddNewPage.value) {
    notebookStore.addNewPage()
    showPageIndicatorTemporarily()
  }
}

function showPageIndicatorTemporarily() {
  showPageIndicator.value = true
  if (pageIndicatorTimer) {
    clearTimeout(pageIndicatorTimer)
  }
  pageIndicatorTimer = setTimeout(() => {
    showPageIndicator.value = false
  }, 1500)
}

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

// 防止布局计算冲突的标志
let isLayoutCalculating = false
// 是否正在处理翻页（翻页期间不响应选中状态变化触发的布局更新）
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
  }
  // 初始渲染后延迟测量高度
  scheduleMeasureHeights(100)
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (pageIndicatorTimer) {
    clearTimeout(pageIndicatorTimer)
    pageIndicatorTimer = null
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
}

:root.dark .node-list-panel {
  background: var(--bg-primary);
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

/* 翻页区域 */
.page-nav-zone {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 150px;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: auto;
}

.page-nav-left {
  left: 0;
}

.page-nav-right {
  right: 0;
}

/* 翻页按钮 */
.page-nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.page-nav-btn:hover {
  background: var(--accent-color, var(--color-primary));
  color: white;
  transform: scale(1.1);
}

/* 新增页面按钮样式 */
.page-nav-btn.add-new-page {
  background: var(--bg-primary);
  border: 2px dashed var(--accent-color, var(--color-primary));
  color: var(--accent-color, var(--color-primary));
}

.page-nav-btn.add-new-page:hover {
  background: var(--accent-color, var(--color-primary));
  color: white;
  border-style: solid;
}

.page-nav-btn svg {
  width: 20px;
  height: 20px;
}

/* 页码指示器 */
.page-indicator {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 6px 16px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
  pointer-events: none;
}

/* 翻页按钮过渡动画 */
.page-nav-fade-enter-active,
.page-nav-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-nav-fade-enter-from,
.page-nav-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 页码指示器过渡动画 */
.page-indicator-fade-enter-active,
.page-indicator-fade-leave-active {
  transition: opacity 0.3s ease;
}

.page-indicator-fade-enter-from,
.page-indicator-fade-leave-to {
  opacity: 0;
}
</style>