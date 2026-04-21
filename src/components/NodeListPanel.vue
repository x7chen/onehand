<template>
  <div
    ref="panelRef"
    class="node-list-panel"
    :style="{ width: panelWidth + 'px' }"
    @mouseenter="isPanelHovered = true"
    @mouseleave="isPanelHovered = false"
  >
    <!-- 视图切换头部 -->
    <div class="view-header">
      <div class="view-toggle-group">
        <button
          class="view-toggle-btn"
          :class="{ active: viewMode === 'card' }"
          @click="viewMode = 'card'"
          :title="t('nodeList.cardView')"
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
          :title="t('nodeList.listView')"
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
          :title="t('nodeList.calendarView')"
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

    <!-- 左边缘翻页按钮（上一页 + 插入） -->
    <div
      class="page-nav-zone page-nav-left"
      @mouseenter="isLeftZoneHovered = true"
      @mouseleave="isLeftZoneHovered = false"
    >
      <Transition name="page-nav-fade">
        <div v-if="isLeftZoneHovered" class="page-nav-buttons">
          <button
            class="page-nav-btn insert-btn"
            @click="handleInsertBefore"
            :title="t('canvas.insertBefore')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            v-if="hasPrevPage"
            class="page-nav-btn"
            @click="handlePrevPage"
            :title="t('pdf.prevPage')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>
      </Transition>
    </div>

    <!-- 右边缘翻页按钮（下一页/新增 + 插入） -->
    <div
      class="page-nav-zone page-nav-right"
      @mouseenter="isRightZoneHovered = true"
      @mouseleave="isRightZoneHovered = false"
    >
      <Transition name="page-nav-fade">
        <div v-if="isRightZoneHovered" class="page-nav-buttons">
          <button
            class="page-nav-btn insert-btn"
            @click="handleInsertAfter"
            :title="t('canvas.insertAfter')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            v-if="hasNextPage"
            class="page-nav-btn"
            @click="handleNextOrAddPage"
            :title="t('pdf.nextPage')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </Transition>
    </div>

    <!-- 页码指示器 -->
    <Transition name="page-indicator-fade">
      <div v-if="showPageIndicator || isLeftZoneHovered || isRightZoneHovered" class="page-indicator">
        {{ currentPageNumber }} / {{ totalPages }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
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

const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

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

// 在当前页之前插入
function handleInsertBefore() {
  notebookStore.insertPageBefore()
  showPageIndicatorTemporarily()
}

// 在当前页之后插入
function handleInsertAfter() {
  notebookStore.insertPageAfter()
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

function handleNodeActivate(nodeId: string) {
  emit('activate', nodeId)
}

onUnmounted(() => {
  if (pageIndicatorTimer) {
    clearTimeout(pageIndicatorTimer)
    pageIndicatorTimer = null
  }
})

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

/* 按钮容器 */
.page-nav-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 插入按钮样式 */
.page-nav-btn.insert-btn {
  background: var(--bg-primary);
  border: 2px dashed var(--color-primary);
  color: var(--color-primary);
}

.page-nav-btn.insert-btn:hover {
  background: var(--color-primary);
  color: white;
  border-style: solid;
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