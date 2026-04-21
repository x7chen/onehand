<template>
  <div class="canvas-view">
    <CanvasHeader
      :static-context-files="staticContextFiles"
      :all-static-context-files="contextStore.staticContextFiles"
      :all-dynamic-context-files="contextStore.dynamicContextFiles"
      :dynamic-context-file="dynamicContextFile"
      v-model:global-hide-ai-result="globalHideAiResult"
      v-model:ai-answer-enabled="aiAnswerEnabled"
      :is-all-context-selected="isAllContextSelected"
      :selected-context-count="selectedContextCount"
      :notebook-model-id="notebookStore.currentNotebook?.modelId"
      :all-profiles="settingsStore.settings.llm.profiles"
      :active-profile-id="settingsStore.settings.llm.activeProfileId"
      :all-notebooks="notebookStore.notebooks"
      :current-notebook-id="notebookStore.currentNotebook?.id || null"
      @back="goBack"
      @reset-viewport="handleResetViewport"
      @auto-layout="handleAutoLayout"
      @toggle-all-context="handleToggleAllContext"
      @invert-selection="handleInvertSelection"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @select-dynamic-context="selectDynamicContext"
      @dynamic-context-drop="handleDynamicContextDrop"
      @copy-selected-context="handleCopySelectedContext"
      @select-model="handleSelectModel"
      @select-notebook="handleSelectNotebook"
      @create-notebook="handleCreateNotebook"
    />

    <CanvasArea
      ref="canvasAreaRef"
      :global-hide-ai-result="globalHideAiResult"
      :ai-answer-enabled="aiAnswerEnabled"
      :static-context-files="staticContextFiles"
      :dynamic-context-file="dynamicContextFile"
      :notebook-model-id="notebookStore.currentNotebook?.modelId"
    />

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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useContextStore } from '@/stores/contextStore'
import { useSettingsStore } from '@/stores/settingsStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import CanvasArea from '@/components/CanvasArea.vue'
import type { ContextFile } from '@/types/context'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const notebookStore = useNotebookStore()
const contextStore = useContextStore()
const settingsStore = useSettingsStore()

// CanvasArea 组件引用
const canvasAreaRef = ref<InstanceType<typeof CanvasArea> | null>(null)

// 全局 AI 回答隐藏状态
const globalHideAiResult = ref(false)

// AI 回答开关状态（默认开启）
const aiAnswerEnabled = ref(true)

// 动态上下文编辑器
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

// 静态上下文
const staticContextFiles = computed(() => {
  const staticContextIds = notebookStore.currentNotebook?.context?.staticContextIds || []
  return staticContextIds.map(id => contextStore.getContextFileById(id)).filter(Boolean) as ContextFile[]
})

// 动态上下文
const dynamicContextFile = computed(() => {
  const dynamicContextId = notebookStore.currentNotebook?.context?.dynamicContextId
  if (dynamicContextId) {
    return contextStore.getContextFileById(dynamicContextId)
  }
  return undefined
})

// 已选择上下文数量
const selectedContextCount = computed(() =>
  notebookStore.currentCanvasNodes.filter(n => n.selectedAsContext).length
)

// 已完成节点数量
const completedNodesCount = computed(() =>
  notebookStore.currentCanvasNodes.filter(n => n.transcriptStatus === 'done').length
)

// 是否全选
const isAllContextSelected = computed(() =>
  completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
)

onMounted(async () => {
  await contextStore.loadContextFiles()

  const notebookId = route.params.notebookId as string
  const notebook = notebookStore.notebooks.find(p => p.id === notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 键盘事件处理 - 上下键选择节点，左右键翻页
function handleKeyDown(event: KeyboardEvent) {
  // 如果正在输入框中输入，不处理
  const target = event.target as HTMLElement
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    return
  }

  // 左右键：画布翻页
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (notebookStore.hasPrevPage) {
      notebookStore.goToPrevPage()
      nextTick(() => {
        selectFirstNode()
      })
    }
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    if (notebookStore.hasNextPage) {
      notebookStore.goToNextPage()
      nextTick(() => {
        selectFirstNode()
      })
    }
    return
  }

  // 上下键：节点导航
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const nodes = notebookStore.currentCanvasNodes
    if (!nodes || nodes.length === 0) return

    event.preventDefault()

    // 按创建时间排序
    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)

    const currentActiveId = canvasAreaRef.value?.activeNodeId
    const currentIndex = currentActiveId
      ? sortedNodes.findIndex(n => n.id === currentActiveId)
      : -1

    let newIndex: number
    if (event.key === 'ArrowUp') {
      newIndex = currentIndex <= 0 ? sortedNodes.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex >= sortedNodes.length - 1 ? 0 : currentIndex + 1
    }

    const newActiveNode = sortedNodes[newIndex]
    canvasAreaRef.value?.setActiveNodeId(newActiveNode.id)
  }
}

// 选中当前画布的第一个节点
function selectFirstNode() {
  const nodes = notebookStore.currentCanvasNodes
  if (nodes.length > 0) {
    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    canvasAreaRef.value?.setActiveNodeId(sortedNodes[0].id)
  }
}

function goBack() {
  notebookStore.cleanupEmptyPages()
  router.push('/')
}

function handleResetViewport() {
  canvasAreaRef.value?.handleResetViewport()
}

function handleAutoLayout() {
  canvasAreaRef.value?.handleAutoLayout()
}

function handleToggleAllContext() {
  if (!notebookStore.currentNotebook) return

  const nodes = notebookStore.currentCanvasNodes
  if (isAllContextSelected.value) {
    for (const node of nodes) {
      notebookStore.updateNode(node.id, { selectedAsContext: false }, true)
    }
  } else {
    for (const node of nodes) {
      if (node.transcriptStatus === 'done') {
        notebookStore.updateNode(node.id, { selectedAsContext: true }, true)
      }
    }
  }
  notebookStore.saveNotebook(notebookStore.currentNotebook)
}

function handleInvertSelection() {
  if (!notebookStore.currentNotebook) return

  const nodes = notebookStore.currentCanvasNodes
  for (const node of nodes) {
    if (node.transcriptStatus === 'done') {
      notebookStore.updateNode(node.id, { selectedAsContext: !node.selectedAsContext }, true)
    }
  }
  notebookStore.saveNotebook(notebookStore.currentNotebook)
}

// 复制已选中节点的内容到剪贴板
async function handleCopySelectedContext() {
  const selectedNodes = notebookStore.currentCanvasNodes
    .filter(n => n.selectedAsContext && n.transcript)
    .sort((a, b) => a.createdAt - b.createdAt)

  if (selectedNodes.length === 0) return

  // 格式化内容：每个节点包含转录文本和 AI 回答（如果有）
  const content = selectedNodes.map(node => {
    let text = `[${node.title || 'node'}]\n\n${node.transcript || ''}`
    if (node.agentResult) {
      text += `\n\n--- AI answer ---\n\n${node.agentResult}`
    }
    return text
  }).join('\n\n---\n\n')

  try {
    await navigator.clipboard.writeText(content)
    console.log(`已复制 ${selectedNodes.length} 个笔记的内容到剪贴板`)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 静态上下文选择
async function toggleStaticContext(contextId: string) {
  if (!notebookStore.currentNotebook) return

  const currentIds = notebookStore.currentNotebook.context?.staticContextIds || []
  const newIds = currentIds.includes(contextId)
    ? currentIds.filter(id => id !== contextId)
    : [...currentIds, contextId]

  if (!notebookStore.currentNotebook.context) {
    notebookStore.currentNotebook.context = {}
  }

  if (newIds.length > 0) {
    if (!notebookStore.currentNotebook.context.staticContextIds) {
      notebookStore.currentNotebook.context.staticContextIds = []
    }
    notebookStore.currentNotebook.context.staticContextIds.splice(0, notebookStore.currentNotebook.context.staticContextIds.length, ...newIds)
  } else {
    notebookStore.currentNotebook.context.staticContextIds = undefined
  }

  await notebookStore.saveNotebook(notebookStore.currentNotebook)
}

// 动态上下文选择（单选）
async function selectDynamicContext(contextId: string) {
  if (!notebookStore.currentNotebook) return

  if (!notebookStore.currentNotebook.context) {
    notebookStore.currentNotebook.context = {}
  }

  // 如果点击的是当前已选的，则取消选择；否则选择新的
  if (notebookStore.currentNotebook.context.dynamicContextId === contextId) {
    notebookStore.currentNotebook.context.dynamicContextId = undefined
  } else {
    notebookStore.currentNotebook.context.dynamicContextId = contextId
  }

  await notebookStore.saveNotebook(notebookStore.currentNotebook)
}

// 动态上下文编辑
function openDynamicContextEditor() {
  if (dynamicContextFile.value) {
    dynamicContextEditContent.value = dynamicContextFile.value.content
  }
  showDynamicContextEditor.value = true
}

function saveDynamicContextEdit() {
  if (dynamicContextFile.value) {
    contextStore.updateContextFile(dynamicContextFile.value.id, {
      content: dynamicContextEditContent.value
    })
  }
  showDynamicContextEditor.value = false
}

// 动态上下文拖拽处理
async function handleDynamicContextDrop(text: string) {
  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  if (!notebook.context?.dynamicContextId) {
    const newContext = await contextStore.createContextFile(
      `${notebook.name}`,
      'dynamic',
      text,
      notebook.id
    )

    notebook.context = {
      ...notebook.context,
      dynamicContextId: newContext.id
    }
    await notebookStore.saveNotebook(notebook)
  } else {
    await contextStore.appendToDynamicContext(
      notebook.context.dynamicContextId,
      text
    )
  }
}

// 模型选择
async function handleSelectModel(modelId: string) {
  if (!notebookStore.currentNotebook) return

  notebookStore.currentNotebook.modelId = modelId
  await notebookStore.saveNotebook(notebookStore.currentNotebook)
}

// 选择笔记本
function handleSelectNotebook(notebookId: string | null) {
  if (notebookId === null) {
    // 选择"全部笔记本"，跳转到首页
    router.push('/')
  } else {
    const notebook = notebookStore.notebooks.find(nb => nb.id === notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)
      // 根据笔记本类型跳转到不同视图
      if (notebook.pdfPath) {
        router.push(`/pdf/${notebookId}`)
      } else {
        router.push(`/canvas/${notebookId}`)
      }
    }
  }
}

// 创建笔记本
async function handleCreateNotebook(data: {
  name: string
  pdfPath?: string
  staticContextIds: string[]
  dynamicContextId?: string
}) {
  const notebook = await notebookStore.createNotebook(data.name, undefined, data.pdfPath)

  // 设置上下文
  if (data.staticContextIds.length > 0 || data.dynamicContextId) {
    const contextData: { staticContextIds?: string[]; dynamicContextId?: string } = {}
    if (data.staticContextIds.length > 0) {
      contextData.staticContextIds = data.staticContextIds
    }
    if (data.dynamicContextId) {
      contextData.dynamicContextId = data.dynamicContextId
    }
    notebook.context = contextData
    await notebookStore.saveNotebook(notebook)
  }

  notebookStore.setCurrentNotebook(notebook)

  // 根据笔记本类型跳转到不同视图
  if (notebook.pdfPath) {
    router.push(`/pdf/${notebook.id}`)
  } else {
    router.push(`/canvas/${notebook.id}`)
  }
}
</script>

<style scoped>
.canvas-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
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