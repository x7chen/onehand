<template>
  <div class="canvas-view-panel">
    <!-- 顶部工具栏 -->
    <CanvasHeader
      :static-context-files="staticContextFiles"
      :all-static-context-files="allStaticContextFiles"
      :all-dynamic-context-files="allDynamicContextFiles"
      :dynamic-context-file="dynamicContextFile || undefined"
      :global-hide-ai-result="globalHideAiResult"
      :show-viewport-controls="true"
      :hide-navigation="true"
      @reset-viewport="handleResetViewport"
      @auto-layout="handleAutoLayout"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="handleToggleStaticContext"
      @select-dynamic-context="handleSelectDynamicContext"
      @dynamic-context-drop="handleDynamicContextDrop"
      @update:global-hide-ai-result="globalHideAiResult = $event"
    />

    <!-- 主内容区域 -->
    <div class="panel-body">
      <!-- 左侧：NodeListPanel -->
      <NodeListPanel
        v-if="!isLeftPanelCollapsed"
        ref="nodeListPanelRef"
        class="left-panel"
        :nodes="filteredNodes"
        :notebook-name="currentNotebook?.name || ''"
        :active-node-id="activeNodeId"
        :panel-width="leftPanelWidth"
        @toggle-context="handleToggleContext"
        @toggle-favorite="handleToggleFavorite"
        @activate="handleNodeActivate"
        @batch-delete="handleBatchDelete"
        @batch-select-context="handleBatchSelectContext"
        @visible-nodes-change="handleVisibleNodesChange"
      />

      <!-- 左侧分隔线 -->
      <div
        class="panel-resizer left-resizer"
        :class="{ collapsed: isLeftPanelCollapsed }"
        @mousedown="!isLeftPanelCollapsed && startResizeLeft($event)"
        @dblclick="toggleLeftPanel"
      >
      </div>

      <!-- 右侧：CanvasArea -->
      <CanvasArea
        ref="canvasAreaRef"
        class="right-panel"
        :global-hide-ai-result="globalHideAiResult"
        :ai-answer-enabled="props.aiAnswerEnabled ?? true"
        :auto-select-new-note="props.autoSelectNewNote ?? false"
        :static-context-files="staticContextFiles"
        :dynamic-context-file="dynamicContextFile || undefined"
        :notebook-model-id="currentNotebook?.modelId"
        :filter-node-ids="filteredNodeIds"
      />
    </div>

    <!-- 动态上下文编辑器 -->
    <div v-if="showDynamicContextEditor" class="dialog-overlay" @click="showDynamicContextEditor = false">
      <div class="dialog dynamic-context-editor-dialog" @click.stop>
        <h3>
          <span v-if="dynamicContextFile">{{ dynamicContextFile.name }}</span>
          <span v-else>{{ t('context.dynamic') }}</span>
        </h3>
        <div v-if="!dynamicContextFile" class="no-dynamic-context">
          <p>{{ t('context.noDynamicContext') }}</p>
          <p class="hint">{{ t('context.createHint') }}</p>
        </div>
        <textarea
          v-else
          v-model="dynamicContextEditContent"
          placeholder="动态上下文内容（Markdown 格式）"
          class="content-input"
        ></textarea>
        <div class="dialog-actions" v-if="dynamicContextFile">
          <button @click="showDynamicContextEditor = false" class="cancel-btn">{{ t('common.cancel') }}</button>
          <button @click="saveDynamicContextEdit" class="confirm-btn">{{ t('common.save') }}</button>
        </div>
        <div class="dialog-actions" v-else>
          <button @click="showDynamicContextEditor = false" class="confirm-btn">{{ t('common.close') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useContextStore } from '@/stores/contextStore'
import { useSettingsStore } from '@/stores/settingsStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import CanvasArea from '@/components/CanvasArea.vue'
import NodeListPanel from '@/components/NodeListPanel.vue'
import type { ContextFile } from '@/types/context'
import type { Notebook } from '@/types/notebook'

const props = defineProps<{
  notebookId: string | null
  staticContextFiles: ContextFile[]
  allStaticContextFiles: ContextFile[]
  allDynamicContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile | null
  aiAnswerEnabled?: boolean
  autoSelectNewNote?: boolean
}>()

const emit = defineEmits<{
  'toggle-static-context': [contextId: string]
  'select-dynamic-context': [contextId: string]
  'dynamic-context-drop': [text: string]
}>()

const { t } = useI18n()
const notebookStore = useNotebookStore()
const contextStore = useContextStore()
const settingsStore = useSettingsStore()

// 组件引用
const canvasAreaRef = ref<InstanceType<typeof CanvasArea> | null>(null)
const nodeListPanelRef = ref<InstanceType<typeof NodeListPanel> | null>(null)

// 全局 AI 回答隐藏状态
const globalHideAiResult = ref(false)

// 动态上下文编辑器
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

// 左侧面板宽度
const leftPanelWidth = ref(400)

// 左侧面板折叠状态
const isLeftPanelCollapsed = ref(false)

// 左侧面板拖拽状态
const isResizingLeft = ref(false)
const savedLeftPanelWidth = ref(400)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

// 活跃节点 ID
const activeNodeId = ref<string | null>(null)

// 当前笔记本
const currentNotebook = computed(() => {
  if (!props.notebookId) return null
  return notebookStore.notebooks.find(nb => nb.id === props.notebookId)
})

// 所有节点（笔记本中的所有节点）
const allNodes = computed(() => {
  if (!currentNotebook.value) return []
  return currentNotebook.value.nodes || []
})

// NodeListPanel 中可见的节点 ID 集合（用于过滤 Canvas 显示）
// undefined 表示未初始化，显示全部；空 Set 表示已筛选但无节点
const filteredNodeIds = ref<Set<string> | undefined>(undefined)

// 过滤后的节点
const filteredNodes = computed(() => allNodes.value)

// 处理可见节点变化
function handleVisibleNodesChange(nodeIds: string[]) {
  filteredNodeIds.value = new Set(nodeIds)
}

// 监听笔记本切换
watch(() => props.notebookId, (newId) => {
  if (newId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === newId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
    }
  }
  // 清除活跃节点
  activeNodeId.value = null
}, { immediate: true })

onMounted(async () => {
  await contextStore.loadContextFiles()

  if (props.notebookId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === props.notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
    }
  }

  // 添加拖拽事件监听
  window.addEventListener('mousemove', handleResizeLeftMove)
  window.addEventListener('mouseup', handleResizeLeftEnd)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleResizeLeftMove)
  window.removeEventListener('mouseup', handleResizeLeftEnd)
})

// 节点激活
function handleNodeActivate(nodeId: string) {
  activeNodeId.value = nodeId
  canvasAreaRef.value?.setActiveNodeId(nodeId)
  // 更新全局激活节点（用于StatusBar显示）
  notebookStore.setGlobalActiveNodeId(nodeId)
}

// 切换上下文选择
function handleToggleContext(nodeId: string) {
  if (!currentNotebook.value) return
  const node = allNodes.value.find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNode(nodeId, { selectedAsContext: !node.selectedAsContext }, true)
    notebookStore.saveNotebook(currentNotebook.value)
  }
}

// 切换收藏
function handleToggleFavorite(nodeId: string) {
  if (!currentNotebook.value) return
  const node = allNodes.value.find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNode(nodeId, { isFavorite: !node.isFavorite }, true)
    notebookStore.saveNotebook(currentNotebook.value)
  }
}

// 批量删除
function handleBatchDelete(nodeIds: string[]) {
  if (!currentNotebook.value) return
  for (const nodeId of nodeIds) {
    notebookStore.removeNode(nodeId)
  }
  notebookStore.saveNotebook(currentNotebook.value)
}

// 批量选择上下文
function handleBatchSelectContext(nodeIds: string[], selected: boolean) {
  if (!currentNotebook.value) return
  for (const nodeId of nodeIds) {
    notebookStore.updateNode(nodeId, { selectedAsContext: selected }, true)
  }
  notebookStore.saveNotebook(currentNotebook.value)
}

// 动态上下文编辑
function openDynamicContextEditor() {
  if (props.dynamicContextFile) {
    dynamicContextEditContent.value = props.dynamicContextFile.content
  }
  showDynamicContextEditor.value = true
}

function saveDynamicContextEdit() {
  if (props.dynamicContextFile) {
    contextStore.updateContextFile(props.dynamicContextFile.id, {
      content: dynamicContextEditContent.value
    })
  }
  showDynamicContextEditor.value = false
}

// CanvasHeader 事件处理
function handleResetViewport() {
  canvasAreaRef.value?.handleResetViewport()
}

function handleAutoLayout() {
  canvasAreaRef.value?.handleAutoLayout()
}

function handleToggleStaticContext(contextId: string) {
  emit('toggle-static-context', contextId)
}

function handleSelectDynamicContext(contextId: string) {
  emit('select-dynamic-context', contextId)
}

function handleDynamicContextDrop(text: string) {
  emit('dynamic-context-drop', text)
}

// 折叠/展开左侧 NodeListPanel
function toggleLeftPanel() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
  if (isLeftPanelCollapsed.value) {
    // 折叠时保存当前宽度
    savedLeftPanelWidth.value = leftPanelWidth.value
  } else {
    // 展开时恢复保存的宽度
    leftPanelWidth.value = savedLeftPanelWidth.value
  }
}

// 左侧分隔线拖拽
function startResizeLeft(e: MouseEvent) {
  e.preventDefault()
  isResizingLeft.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = leftPanelWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleResizeLeftMove(e: MouseEvent) {
  if (!isResizingLeft.value) return

  const minWidth = 298  // 匹配 NodeListPanel 的 min-width
  const maxWidth = 600

  const deltaX = e.clientX - resizeStartX.value
  const newWidth = resizeStartWidth.value + deltaX

  leftPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, newWidth))
}

function handleResizeLeftEnd() {
  if (!isResizingLeft.value) return
  isResizingLeft.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 导出方法供父组件调用
defineExpose({
  openDynamicContextEditor,
  setActiveNodeId: (nodeId: string) => {
    activeNodeId.value = nodeId
    canvasAreaRef.value?.setActiveNodeId(nodeId)
  }
})
</script>

<style scoped>
.canvas-view-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  flex-shrink: 0;
}

/* 左侧分隔线 */
.panel-resizer.left-resizer {
  width: 4px;
  background: var(--bg-primary);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer.left-resizer:hover {
  background: var(--border-color);
}

.panel-resizer.left-resizer.collapsed {
  width: 4px;
  cursor: pointer;
}

.right-panel {
  flex: 1;
  min-width: 0;
}

/* 对话框通用样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  min-width: 400px;
  max-width: 500px;
}

.dynamic-context-editor-dialog {
  min-width: 600px;
  max-width: 800px;
}

.dialog h3 {
  margin-bottom: 16px;
  font-size: 20px;
  color: var(--text-primary);
}

.no-dynamic-context {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.no-dynamic-context .hint {
  font-size: 13px;
  margin-top: 8px;
  font-style: italic;
  color: var(--text-secondary);
}

.content-input {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  box-sizing: border-box;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.cancel-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
}

.confirm-btn {
  padding: 8px 16px;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
}
</style>