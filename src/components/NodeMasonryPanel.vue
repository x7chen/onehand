<template>
  <div
    ref="panelRef"
    class="node-masonry-panel"
    :style="{ width: panelWidth + 'px' }"
  >
    <div ref="nodeContainerRef" class="node-container">
      <div
        v-for="col in masonryColumns"
        :key="col.index"
        class="masonry-column"
      >
        <div
          v-for="node in col.nodes"
          :key="node.id"
          class="masonry-item"
          :data-node-id="node.id"
        >
          <VoiceNote
            :ref="(el) => { if (el) voiceNoteRefs[node.id] = el }"
            :node="node"
            :is-playing="playingNodeId === node.id"
            :is-editing="editingNodeId === node.id"
            :editing-text="editingText"
            :global-hide-ai-result="true"
            :is-active="selectedNodeId === node.id"
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import VoiceNote from '@/components/VoiceNote.vue'
import type { CanvasNode } from '@/types/project'

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

// 面板引用
const panelRef = ref<HTMLElement | null>(null)
const nodeContainerRef = ref<HTMLElement | null>(null)

// 节点引用
const voiceNoteRefs = ref<Record<string, any>>({})

// 编辑相关
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

// 瀑布流布局参数
const NODE_MIN_WIDTH = 250
const COLUMN_GAP = 6
const CONTAINER_PADDING = 24

// 响应式列数计算
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

// 瀑布流列数据
interface MasonryColumn {
  index: number
  nodes: CanvasNode[]
  height: number
}

// 节点高度缓存
const nodeHeights = ref<Record<string, number>>({})

// 按创建时间排序的节点列表
const sortedNodes = computed(() => {
  return [...props.nodes].sort((a, b) => a.createdAt - b.createdAt)
})

// 瀑布流列计算
const masonryColumns = computed(() => {
  const nodes = sortedNodes.value
  const cols = columnCount.value

  if (!nodes.length) {
    return Array.from({ length: cols }, (_, i) => ({ index: i, nodes: [], height: 0 }))
  }

  const columns: MasonryColumn[] = Array.from({ length: cols }, (_, i) => ({
    index: i,
    nodes: [] as CanvasNode[],
    height: 0
  }))

  for (const node of nodes) {
    let minHeight = columns[0].height
    let minCol = 0
    for (let i = 1; i < cols; i++) {
      if (columns[i].height < minHeight) {
        minHeight = columns[i].height
        minCol = i
      }
    }

    columns[minCol].nodes.push(node)
    const height = nodeHeights.value[node.id] || 200
    columns[minCol].height += height
  }

  return columns
})

// 更新节点高度缓存
function updateNodeHeights() {
  if (!nodeContainerRef.value) return

  const items = nodeContainerRef.value.querySelectorAll('.masonry-item')
  items.forEach(item => {
    const nodeId = item.getAttribute('data-node-id')
    if (nodeId) {
      const height = (item as HTMLElement).offsetHeight
      nodeHeights.value[nodeId] = height
    }
  })
}

// 节点激活
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

// 监听选中节点变化，自动滚动到中央
watch(() => props.selectedNodeId, (newNodeId) => {
  if (!newNodeId || !panelRef.value) return

  nextTick(() => {
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
      behavior: 'smooth'
    })
  })
})

// 监听节点数量变化
watch(() => props.nodes.length, () => {
  nextTick(() => {
    updateNodeHeights()
  })
})

// 监听面板宽度变化
watch(() => props.panelWidth, () => {
  nextTick(() => {
    updateNodeHeights()
  })
})

onMounted(() => {
  nextTick(() => {
    updateNodeHeights()
  })
})

// 暴露方法
defineExpose({
  updateNodeHeights
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
}

.node-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  gap: 6px;
}

.masonry-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.masonry-item {
  width: 100%;
}

.masonry-item :deep(.voice-note) {
  position: relative !important;
  left: 0 !important;
  top: 0 !important;
  margin: 0;
  width: 100% !important;
}
</style>