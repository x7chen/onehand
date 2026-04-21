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
import { ref, computed, watch, nextTick, onMounted } from 'vue'
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
}>()

const { t } = useI18n()

const panelRef = ref<HTMLElement | null>(null)
const nodeContainerRef = ref<HTMLElement | null>(null)

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