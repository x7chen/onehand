<template>
  <div
    ref="panelRef"
    class="node-list-panel"
    :style="{ width: panelWidth + 'px' }"
  >
    <!-- 视图切换头部 -->
    <div class="view-header">
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
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import NodeCardView from '@/components/NodeCardView.vue'
import NodeListView from '@/components/NodeListView.vue'
import NodeCalendarView from '@/components/NodeCalendarView.vue'
import type { CanvasNode } from '@/types/notebook'

const props = withDefaults(defineProps<{
  nodes: CanvasNode[]
  activeNodeId?: string | null
  panelWidth: number
}>(), {
  activeNodeId: null,
  panelWidth: 600
})

const settingsStore = useSettingsStore()

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
}>()

const panelRef = ref<HTMLElement | null>(null)
const cardViewRef = ref<InstanceType<typeof NodeCardView> | null>(null)
const listViewRef = ref<InstanceType<typeof NodeListView> | null>(null)
const calendarViewRef = ref<InstanceType<typeof NodeCalendarView> | null>(null)

// 视图模式：从设置中读取
const viewMode = computed({
  get: () => settingsStore.settings.general.nodeListViewMode || 'card',
  set: (value) => {
    settingsStore.settings.general.nodeListViewMode = value
    settingsStore.saveSettings()
  }
})

function handleNodeActivate(nodeId: string) {
  emit('activate', nodeId)
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

/* 视图切换头部 */
.view-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: center;
}

.view-toggle-group {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 2px;
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
</style>