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
      <!-- CanvasArea -->
      <CanvasArea
        ref="canvasAreaRef"
        :global-hide-ai-result="globalHideAiResult"
        :ai-answer-enabled="props.aiAnswerEnabled ?? true"
        :auto-select-new-note="props.autoSelectNewNote ?? false"
        :static-context-files="staticContextFiles"
        :dynamic-context-file="dynamicContextFile || undefined"
        :notebook-model-id="currentNotebook?.modelId"
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

// 全局 AI 回答隐藏状态
const globalHideAiResult = ref(false)

// 动态上下文编辑器
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

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

// 监听笔记本切换
watch(() => props.notebookId, (newId) => {
  if (newId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === newId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
    }
  }
}, { immediate: true })

onMounted(async () => {
  await contextStore.loadContextFiles()

  if (props.notebookId) {
    const notebook = notebookStore.notebooks.find(nb => nb.id === props.notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
    }
  }
})

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

// 导出方法供父组件调用
defineExpose({
  openDynamicContextEditor,
  setActiveNodeId: (nodeId: string) => {
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
  font-size: var(--font-size-title);
  color: var(--text-primary);
}

.no-dynamic-context {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.no-dynamic-context .hint {
  font-size: var(--font-size-body);
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
  font-size: var(--font-size-heading);
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