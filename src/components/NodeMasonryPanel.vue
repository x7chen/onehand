<template>
  <div
    ref="panelRef"
    class="node-masonry-panel"
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
            <VoiceNote
              :ref="(el) => { if (el) voiceNoteRefs[item.node.id] = el }"
              :node="item.node"
              :is-playing="playingNodeId === item.node.id"
              :is-editing="editingNodeId === item.node.id"
              :editing-text="editingText"
              :global-hide-ai-result="true"
              :is-active="selectedNodeId === item.node.id"
              :activate-on-hover="false"
              :show-header="false"
              @delete="$emit('delete', $event)"
              @play="$emit('play', $event)"
              @toggle-context="$emit('toggle-context', $event)"
              @retry-transcription="$emit('retry-transcription', $event)"
              @retry-agent="$emit('retry-agent', $event)"
              @regenerate-agent="$emit('regenerate-agent', $event)"
              @toggle-favorite="$emit('toggle-favorite', $event)"
              @drag-start="(nodeId, offsetX, offsetY) => $emit('drag-start', nodeId, offsetX, offsetY)"
              @update-node="(nodeId, updates) => $emit('update-node', nodeId, updates)"
              @save-edit="handleSaveEdit"
              @cancel-edit="handleCancelEdit"
              @update:editing-text="editingText = $event"
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
          title="上一页"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </Transition>
    </div>

    <!-- 右边缘翻页按钮（下一页） -->
    <div
      class="page-nav-zone page-nav-right"
      @mouseenter="isRightZoneHovered = true"
      @mouseleave="isRightZoneHovered = false"
    >
      <Transition name="page-nav-fade">
        <button
          v-if="isRightZoneHovered && hasNextPage"
          class="page-nav-btn"
          @click="handleNextPage"
          title="下一页"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import VoiceNote from '@/components/VoiceNote.vue'
import { useProjectStore } from '@/stores/projectStore'
import type { CanvasNode } from '@/types/project'

interface VirtualNodeItem {
  node: CanvasNode
  top: number
  left: number
  width: number
  height: number
}

const props = withDefaults(defineProps<{
  nodes: CanvasNode[]
  selectedNodeId?: string | null
  playingNodeId?: string | null
  panelWidth: number
}>(), {
  selectedNodeId: null,
  playingNodeId: null,
  panelWidth: 600
})

const projectStore = useProjectStore()

const emit = defineEmits<{
  'delete': [nodeId: string]
  'play': [nodeId: string]
  'toggle-context': [nodeId: string]
  'retry-transcription': [nodeId: string]
  'retry-agent': [nodeId: string]
  'regenerate-agent': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'drag-start': [nodeId: string, offsetX: number, offsetY: number]
  'update-node': [nodeId: string, updates: Partial<CanvasNode>]
  'activate': [nodeId: string]
}>()

const panelRef = ref<HTMLElement | null>(null)
const nodeContainerRef = ref<HTMLElement | null>(null)
const voiceNoteRefs = ref<Record<string, any>>({})

const editingNodeId = ref<string | null>(null)
const editingText = ref('')

// 翻页相关状态
const isPanelHovered = ref(false)
const isLeftZoneHovered = ref(false)
const isRightZoneHovered = ref(false)
const showPageIndicator = ref(false)
let pageIndicatorTimer: ReturnType<typeof setTimeout> | null = null

// 翻页相关计算属性
const hasPrevPage = computed(() => projectStore.hasPrevPage)
const hasNextPage = computed(() => projectStore.hasNextPage)
const currentPageNumber = computed(() => projectStore.currentPageNumber)
const totalPages = computed(() => projectStore.totalPages)

// 翻页方法
function handlePrevPage() {
  projectStore.goToPrevPage()
  showPageIndicatorTemporarily()
}

function handleNextPage() {
  projectStore.goToNextPage()
  showPageIndicatorTemporarily()
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
const virtualItems = ref<Map<string, VirtualNodeItem>>(new Map())
const scrollTop = ref(0)
const containerHeight = ref(600)

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
  const nodes = sortedNodes.value
  const cols = columnCount.value
  const colWidth = columnWidth.value
  const items = new Map<string, VirtualNodeItem>()

  if (!nodes.length) {
    virtualItems.value = items
    return
  }

  const colHeights = new Array(cols).fill(CONTAINER_PADDING)
  const colTops = new Array(cols).fill(CONTAINER_PADDING)

  for (const node of nodes) {
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

    items.set(node.id, {
      node,
      top: colTops[minCol],
      left,
      width: colWidth,
      height: estimatedHeight
    })

    colHeights[minCol] += estimatedHeight + COLUMN_GAP
    colTops[minCol] = colHeights[minCol]
  }

  virtualItems.value = items
}

function updateMeasuredHeights() {
  if (!nodeContainerRef.value) return

  const container = nodeContainerRef.value.querySelector('.masonry-viewport')
  if (!container) return

  let hasChanges = false
  const items = container.querySelectorAll('.masonry-item')

  items.forEach(item => {
    const nodeId = item.getAttribute('data-node-id')
    if (nodeId) {
      const height = (item as HTMLElement).offsetHeight
      if (nodeHeights.value[nodeId] !== height) {
        nodeHeights.value[nodeId] = height
        measuredNodes.value.add(nodeId)
        hasChanges = true
      }
    }
  })

  if (hasChanges) {
    calculateLayout()
  }
}

watch(visibleNodes, () => {
  nextTick(() => {
    updateMeasuredHeights()
  })
}, { deep: true })

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

function handleSaveEdit(nodeId: string, text: string) {
  emit('update-node', nodeId, { transcript: text })
  editingNodeId.value = null
  editingText.value = ''
}

function handleCancelEdit(nodeId: string) {
  editingNodeId.value = null
  editingText.value = ''
}

let scrollAnimationFrameId: number | null = null

watch(() => props.selectedNodeId, (newNodeId) => {
  if (!newNodeId || !panelRef.value) return

  if (scrollAnimationFrameId !== null) {
    cancelAnimationFrame(scrollAnimationFrameId)
    scrollAnimationFrameId = null
  }

  scrollAnimationFrameId = requestAnimationFrame(() => {
    scrollAnimationFrameId = null
    const nodeEl = document.querySelector(`[data-node-id="${newNodeId}"]`) as HTMLElement
    if (!nodeEl) return

    const container = panelRef.value?.querySelector('.node-container') as HTMLElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const nodeRect = nodeEl.getBoundingClientRect()

    const nodeTop = nodeRect.top - containerRect.top + container.scrollTop
    const nodeHeight = nodeRect.height
    const containerHeight = container.clientHeight

    const scrollTo = nodeTop - (containerHeight / 2) + (nodeHeight / 2)
    container.scrollTo({
      top: scrollTo,
      behavior: 'instant'
    })
  })
})

watch(() => props.nodes.length, () => {
  measuredNodes.value.clear()
  nextTick(() => {
    calculateLayout()
    nextTick(() => {
      updateMeasuredHeights()
    })
  })
})

watch(() => props.panelWidth, () => {
  measuredNodes.value.clear()
  nextTick(() => {
    calculateLayout()
  })
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
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
  })
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
})

defineExpose({
  updateNodeHeights: updateMeasuredHeights
})
</script>

<style scoped>
.node-masonry-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-secondary);
  min-width: 298px;
  flex-shrink: 0;
  position: relative;
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

.masonry-item :deep(.voice-note) {
  position: relative !important;
  left: 0 !important;
  top: 0 !important;
  margin: 0;
  width: 100% !important;
}

/* 翻页区域 */
.page-nav-zone {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 60px;
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
  background: var(--accent-color, #4a9eff);
  color: white;
  transform: scale(1.1);
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