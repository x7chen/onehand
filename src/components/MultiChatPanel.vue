<template>
  <div class="multi-chat-panel">
    <!-- 顶部工具栏 -->
    <CanvasHeader
      :static-context-files="staticContextFiles"
      :all-static-context-files="allStaticContextFiles"
      :all-dynamic-context-files="allDynamicContextFiles"
      :dynamic-context-file="dynamicContextFile || undefined"
      v-model:global-hide-ai-result="globalHideAiResult"
      v-model:ai-answer-enabled="aiAnswerEnabled"
      v-model:auto-select-new-note="autoSelectNewNote"
      :show-viewport-controls="false"
      :notebook-model-id="currentNotebook?.modelId"
      :all-profiles="allProfiles"
      :active-profile-id="activeProfileId"
      :hide-navigation="true"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @select-dynamic-context="selectDynamicContext"
      @dynamic-context-drop="handleDynamicContextDrop"
      @select-model="handleSelectModel"
    />

    <!-- 主内容区域 -->
    <div class="panel-container">
      <!-- 左侧面板：笔记列表容器 -->
      <NodeListPanel
        v-if="!isLeftPanelCollapsed"
        ref="nodePanelRef"
        :nodes="displayNodes"
        :notebook-name="props.notebookId ? (currentNotebook?.name || '') : t('canvas.allNotebooks')"
        :active-node-id="currentActiveNodeId"
        :playing-node-id="playingNodeId"
        :panel-width="leftPanelWidth"
        @delete="handleDeleteNode"
        @batch-delete="handleBatchDeleteNodes"
        @batch-move="handleBatchMoveNodes"
        @batch-favorite="handleBatchFavoriteNodes"
        @batch-select-context="handleBatchSelectContext"
        @play="handlePlayNode"
        @toggle-context="handleToggleContext"
        @retry-transcription="handleRetryTranscription"
        @retry-agent="handleRetryAgent"
        @regenerate-agent="handleRegenerateAgent"
        @toggle-favorite="handleToggleFavorite"
        @drag-start="handleDragStart"
        @update-node="handleUpdateNode"
        @activate="handleNodeActivate"
      />

      <!-- 可拖动分隔线（展开状态） -->
      <div
        v-if="!isLeftPanelCollapsed"
        class="panel-resizer"
        @mousedown="startResizeLeft"
        @dblclick="toggleLeftPanel"
      >
      </div>

      <!-- 折叠状态的分隔线 -->
      <div
        v-if="isLeftPanelCollapsed"
        class="panel-resizer-collapsed"
        @dblclick="toggleLeftPanel"
      >
      </div>

      <!-- 右侧双 ChatPanel 区域 -->
      <div class="chat-panels-container" :class="{ 'right-collapsed': isRightChatPanelCollapsed }">
        <!-- 左侧 ChatPanel -->
        <ChatPanel
          ref="chatPanelRef"
          :active-node="activeNodeLeft"
          :static-context-files="staticContextFiles"
          :dynamic-context-file="dynamicContextFile"
          :ai-answer-enabled="aiAnswerEnabled"
          :auto-select-new-note="autoSelectNewNote"
          :is-active="activePanel === 'left'"
          :panel-id="'left'"
          :target-notebook-id="notebookId"
          class="left-chat-panel"
          :class="{ 'full-width': isRightChatPanelCollapsed }"
          :style="isRightChatPanelCollapsed ? {} : { width: leftChatPanelWidth + 'px' }"
          @delete="handleDeleteNode"
          @play="handlePlayNode"
          @toggle-context="handleToggleContext"
          @retry-transcription="handleRetryTranscription"
          @retry-agent="handleRetryAgentLeft"
          @toggle-favorite="handleToggleFavorite"
          @update-node="handleUpdateNode"
          @node-created="handleNodeCreatedLeft"
          @node-updated="handleNodeUpdatedLeft"
          @start-editing="handleStartEditingLeft"
          @activate="handleChatPanelActivate"
          @quote-click="handleQuoteClick"
        />

        <!-- 中间分隔线 -->
        <div
          v-if="!isRightChatPanelCollapsed"
          class="chat-resizer"
          @mousedown="startResizeChat"
          @dblclick="toggleRightChatPanel"
        >
        </div>

        <!-- 折叠状态的分隔线 -->
        <div
          v-if="isRightChatPanelCollapsed"
          class="chat-resizer-collapsed"
          @dblclick="toggleRightChatPanel"
        >
        </div>

        <!-- 右侧 ChatPanel -->
        <ChatPanel
          v-if="!isRightChatPanelCollapsed"
          :active-node="activeNodeRight"
          :static-context-files="staticContextFiles"
          :dynamic-context-file="dynamicContextFile"
          :ai-answer-enabled="aiAnswerEnabled"
          :auto-select-new-note="autoSelectNewNote"
          :is-active="activePanel === 'right'"
          :panel-id="'right'"
          :target-notebook-id="notebookId"
          class="right-chat-panel"
          @delete="handleDeleteNode"
          @play="handlePlayNode"
          @toggle-context="handleToggleContext"
          @retry-transcription="handleRetryTranscription"
          @retry-agent="handleRetryAgentRight"
          @toggle-favorite="handleToggleFavorite"
          @update-node="handleUpdateNode"
          @node-created="handleNodeCreatedRight"
          @node-updated="handleNodeUpdatedRight"
          @start-editing="handleStartEditingRight"
          @activate="handleChatPanelActivate"
          @quote-click="handleQuoteClick"
        />
      </div>
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
      </div>
    </div>

    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import NodeListPanel from '@/components/NodeListPanel.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import { loadEmbeddedImagesForTranscript, loadImageBase64 } from '@/utils/contextBuilder'
import { getNotebookDataDir } from '@/utils/userFilesPath'
import type { CanvasNode, Notebook } from '@/types/notebook'
import type { ContextFile } from '@/types/context'
import type { LLMProfile } from '@/types/settings'

const props = withDefaults(defineProps<{
  notebookId: string | null
  staticContextFiles: ContextFile[]
  allStaticContextFiles: ContextFile[]
  allDynamicContextFiles: ContextFile[]
  dynamicContextFile: ContextFile | null
  allProfiles: LLMProfile[]
  activeProfileId: string
  activateNodeId?: string | null
  triggerCreateNote?: boolean
}>(), {
  notebookId: null,
  staticContextFiles: () => [],
  allStaticContextFiles: () => [],
  allDynamicContextFiles: () => [],
  dynamicContextFile: null,
  allProfiles: () => [],
  activeProfileId: '',
  activateNodeId: null,
  triggerCreateNote: false
})

const emit = defineEmits<{
  'notebook-changed': [notebookId: string | null]
  'node-activated': []
  'create-note-triggered': []
}>()

const { t } = useI18n()
const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const contextStore = useContextStore()

// 面板宽度相关
const leftPanelWidth = ref(600)
const leftChatPanelWidth = ref(400)

// 左侧面板折叠状态
const isLeftPanelCollapsed = ref(false)

// 右侧 ChatPanel 折叠状态（默认折叠）
const isRightChatPanelCollapsed = ref(true)

// NodeListPanel 组件引用
const nodePanelRef = ref<InstanceType<typeof NodeListPanel> | null>(null)

// ChatPanel 组件引用
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null)

// 当前笔记本
const currentNotebook = computed(() => {
  if (!props.notebookId) return null
  return notebookStore.notebooks.find(nb => nb.id === props.notebookId)
})

// 计算要显示的节点
const displayNodes = computed(() => {
  if (!props.notebookId) {
    // 显示所有笔记本的所有节点
    return notebookStore.notebooks.flatMap(nb => nb.nodes || [])
  } else {
    // 显示当前笔记本的所有节点
    return currentNotebook.value?.nodes || []
  }
})

// 拖拽调整宽度相关
const isResizingLeft = ref(false)
const isResizingChat = ref(false)
let savePanelRatioTimer: number | null = null

// 当前激活的面板
const activePanel = ref<'left' | 'right'>('left')

// 两个面板各自的激活节点 ID
const activeNodeIdLeft = ref<string | null>(null)
const activeNodeIdRight = ref<string | null>(null)

// 导航模式标志
const isNavigating = ref(false)

// 两个面板各自的激活节点
const activeNodeLeft = computed(() => {
  if (!activeNodeIdLeft.value) return null
  return displayNodes.value.find(n => n.id === activeNodeIdLeft.value) || null
})

const activeNodeRight = computed(() => {
  if (!activeNodeIdRight.value) return null
  return displayNodes.value.find(n => n.id === activeNodeIdRight.value) || null
})

// 当前激活节点 ID（用于 NodeListPanel 高亮）
const currentActiveNodeId = computed(() => {
  return activePanel.value === 'left' ? activeNodeIdLeft.value : activeNodeIdRight.value
})

// 音频播放
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

// 全局隐藏 AI 回答
const globalHideAiResult = ref(false)

// AI 回答开关（从设置中读取默认值）
const aiAnswerEnabled = ref(settingsStore.settings.general.autoAiAnswer ?? true)

// 自动勾选新笔记开关
const autoSelectNewNote = ref(false)

// 动态上下文
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

// 选中的上下文数量
const selectedContextCount = computed(() => {
  return displayNodes.value.filter(n => n.selectedAsContext && n.transcriptStatus === 'done').length
})

// 已完成节点数量
const completedNodesCount = computed(() => {
  return displayNodes.value.filter(n => n.transcriptStatus === 'done').length
})

// 是否全选
const isAllContextSelected = computed(() => {
  return completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
})

// 获取当前笔记本使用的模型配置
const currentModelConfig = computed(() => {
  const modelId = currentNotebook.value?.modelId || props.activeProfileId
  return props.allProfiles.find(p => p.id === modelId)
})

// 监听笔记本变化
watch(() => props.notebookId, (newId, oldId) => {
  if (newId !== oldId) {
    nextTick(() => {
      // 切换笔记本时清空节点选择
      clearNodeSelection()
    })
  }
})

// 清空节点选择（切换笔记本时使用）
function clearNodeSelection() {
  activeNodeIdLeft.value = null
  activeNodeIdRight.value = null
}

// 滚动到指定节点
function scrollToNode(nodeId: string) {
  nextTick(() => {
    nodePanelRef.value?.scrollToNode(nodeId)
  })
}

// ChatPanel 激活处理
function handleChatPanelActivate(panelId: 'left' | 'right') {
  activePanel.value = panelId
}

// 节点激活（从 NodeListPanel）
function handleNodeActivate(nodeId: string) {
  if (activePanel.value === 'left') {
    activeNodeIdLeft.value = nodeId
  } else {
    activeNodeIdRight.value = nodeId
  }
  // 更新全局激活节点（用于StatusBar显示）
  notebookStore.setGlobalActiveNodeId(nodeId)
}

// 点击引用项（从 ChatPanel quote-container）
function handleQuoteClick(nodeId: string) {
  handleNodeActivate(nodeId)
  // 滚动到该节点
  scrollToNode(nodeId)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  initPanelWidths()
  // 不自动选择节点，等待用户点击
})

// 监听 activateNodeId prop 变化，用于跳转链接激活节点
watch(() => props.activateNodeId, (nodeId) => {
  if (nodeId) {
    // 检查节点是否存在于当前笔记本
    const node = displayNodes.value.find(n => n.id === nodeId)
    if (node) {
      handleNodeActivate(nodeId)
      emit('node-activated')
    }
  }
}, { immediate: true })

// 监听 triggerCreateNote prop 变化，用于触发创建笔记输入
watch(() => props.triggerCreateNote, (shouldTrigger) => {
  if (shouldTrigger) {
    nextTick(() => {
      chatPanelRef.value?.triggerInputMode()
      emit('create-note-triggered')
    })
  }
}, { immediate: true })

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleResizeLeft)
  document.removeEventListener('mousemove', handleResizeChat)
  document.removeEventListener('mouseup', stopResizeLeft)
  document.removeEventListener('mouseup', stopResizeChat)

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
})

// 初始化面板宽度
function initPanelWidths() {
  const containerRect = document.querySelector('.panel-container')?.getBoundingClientRect()
  if (!containerRect) return

  const leftRatio = settingsStore.settings.view?.nodeListViewLeftPanelRatio || 0.4
  const minWidth = 298
  const maxWidth = containerRect.width - 600

  leftPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, containerRect.width * leftRatio))

  // 初始化 ChatPanel 宽度
  const chatContainerWidth = containerRect.width - leftPanelWidth.value - 8
  leftChatPanelWidth.value = chatContainerWidth / 2
}

// 左侧面板拖拽调整
function startResizeLeft(e: MouseEvent) {
  isResizingLeft.value = true
  document.addEventListener('mousemove', handleResizeLeft)
  document.addEventListener('mouseup', stopResizeLeft)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleResizeLeft(e: MouseEvent) {
  if (!isResizingLeft.value) return

  const containerRect = document.querySelector('.panel-container')?.getBoundingClientRect()
  if (!containerRect) return

  const newWidth = e.clientX - containerRect.left
  const minWidth = 298
  const maxWidth = containerRect.width - 600

  leftPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, newWidth))
}

function stopResizeLeft() {
  isResizingLeft.value = false
  document.removeEventListener('mousemove', handleResizeLeft)
  document.removeEventListener('mouseup', stopResizeLeft)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  savePanelRatio()
}

// ChatPanel 分隔线拖拽调整
function startResizeChat(e: MouseEvent) {
  isResizingChat.value = true
  document.addEventListener('mousemove', handleResizeChat)
  document.addEventListener('mouseup', stopResizeChat)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleResizeChat(e: MouseEvent) {
  if (!isResizingChat.value) return

  const chatContainerRect = document.querySelector('.chat-panels-container')?.getBoundingClientRect()
  if (!chatContainerRect) return

  const newWidth = e.clientX - chatContainerRect.left
  const minWidth = 300
  const maxWidth = chatContainerRect.width - 300 - 8

  leftChatPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, newWidth))
}

function stopResizeChat() {
  isResizingChat.value = false
  document.removeEventListener('mousemove', handleResizeChat)
  document.removeEventListener('mouseup', stopResizeChat)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function savePanelRatio() {
  if (savePanelRatioTimer) {
    clearTimeout(savePanelRatioTimer)
  }
  savePanelRatioTimer = window.setTimeout(() => {
    const containerRect = document.querySelector('.panel-container')?.getBoundingClientRect()
    if (!containerRect) return

    const ratio = leftPanelWidth.value / containerRect.width
    settingsStore.updateSettings({
      view: {
        ...settingsStore.settings.view,
        nodeListViewLeftPanelRatio: ratio
      }
    })
    savePanelRatioTimer = null
  }, 500)
}

// 键盘事件处理
function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    return
  }

  const nodes = displayNodes.value

  // Tab 键：切换激活面板
  if (event.key === 'Tab') {
    event.preventDefault()
    activePanel.value = activePanel.value === 'left' ? 'right' : 'left'
    return
  }

  // 上下键：节点导航
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (!nodes || nodes.length === 0) return

    event.preventDefault()

    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    const currentActiveId = currentActiveNodeId.value
    const currentIndex = currentActiveId
      ? sortedNodes.findIndex(n => n.id === currentActiveId)
      : -1

    let newIndex: number
    if (event.key === 'ArrowUp') {
      newIndex = currentIndex <= 0 ? sortedNodes.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex >= sortedNodes.length - 1 ? 0 : currentIndex + 1
    }

    handleNodeActivate(sortedNodes[newIndex].id)
  }
}

// 折叠/展开左侧面板
function toggleLeftPanel() {
  isLeftPanelCollapsed.value = !isLeftPanelCollapsed.value
}

// 折叠/展开右侧 ChatPanel
function toggleRightChatPanel() {
  isRightChatPanelCollapsed.value = !isRightChatPanelCollapsed.value
}

// ChatPanel 创建节点
function handleNodeCreatedLeft(node: CanvasNode) {
  activeNodeIdLeft.value = node.id
  // 更新全局激活节点（用于StatusBar显示）
  notebookStore.setGlobalActiveNodeId(node.id)
}

function handleNodeCreatedRight(node: CanvasNode) {
  activeNodeIdRight.value = node.id
  // 更新全局激活节点（用于StatusBar显示）
  notebookStore.setGlobalActiveNodeId(node.id)
}

// ChatPanel 更新节点
function handleNodeUpdatedLeft(node: CanvasNode) {
  // activeNodeLeft 是计算属性，自动更新
}

function handleNodeUpdatedRight(node: CanvasNode) {
  // activeNodeRight 是计算属性，自动更新
}

// 编辑相关处理
function handleStartEditingLeft(nodeId: string) {
  // 编辑处理已移至 ChatPanel 内部
}

function handleStartEditingRight(nodeId: string) {
  // 编辑处理已移至 ChatPanel 内部
}

// 节点操作
function handleDeleteNode(nodeId: string) {
  notebookStore.removeNode(nodeId)
  if (activeNodeIdLeft.value === nodeId) {
    activeNodeIdLeft.value = null
  }
  if (activeNodeIdRight.value === nodeId) {
    activeNodeIdRight.value = null
  }
}

// 批量删除节点
function handleBatchDeleteNodes(nodeIds: string[]) {
  for (const nodeId of nodeIds) {
    notebookStore.removeNode(nodeId)
    if (activeNodeIdLeft.value === nodeId) {
      activeNodeIdLeft.value = null
    }
    if (activeNodeIdRight.value === nodeId) {
      activeNodeIdRight.value = null
    }
  }
}

// 批量移动节点到目标笔记本
function handleBatchMoveNodes(nodeIds: string[], targetNotebookId: string) {
  for (const nodeId of nodeIds) {
    notebookStore.moveNodeToNotebook(nodeId, targetNotebookId)
    if (activeNodeIdLeft.value === nodeId) {
      activeNodeIdLeft.value = null
    }
    if (activeNodeIdRight.value === nodeId) {
      activeNodeIdRight.value = null
    }
  }
}

// 批量收藏节点
function handleBatchFavoriteNodes(nodeIds: string[]) {
  for (const nodeId of nodeIds) {
    notebookStore.updateNodeFavorite(nodeId, true)
  }
}

// 批量选择上下文
async function handleBatchSelectContext(nodeIds: string[], selected: boolean) {
  await notebookStore.batchUpdateContextSelection(nodeIds, selected)
}

async function handlePlayNode(nodeId: string) {
  const node = displayNodes.value.find(n => n.id === nodeId)
  if (!node?.audioPath) return

  if (playingNodeId.value === nodeId && currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
    playingNodeId.value = null
    return
  }

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }

  try {
    const notebook = currentNotebook.value
    if (!notebook || !node.audioPath) return

    const notebookDir = await getNotebookDataDir(notebook.id)
    const audioPath = `${notebookDir}/${node.audioPath}`

    currentAudio.value = new Audio(`file://${audioPath}`)
    await currentAudio.value.play()
    playingNodeId.value = nodeId

    currentAudio.value.onended = () => {
      playingNodeId.value = null
      currentAudio.value = null
    }
  } catch (error) {
    console.error('Failed to play audio:', error)
    playingNodeId.value = null
  }
}

async function handleToggleContext(nodeId: string) {
  const node = displayNodes.value.find(n => n.id === nodeId)
  if (node) {
    const newSelectedState = !node.selectedAsContext

    // 使用跨笔记本更新方法
    notebookStore.batchUpdateContextSelection([nodeId], newSelectedState)

    // 如果需要加载图片，找到节点所属的笔记本
    if (newSelectedState) {
      // 找到节点所属的笔记本
      const notebook = props.notebookId
        ? currentNotebook.value
        : notebookStore.notebooks.find(nb => nb.nodes?.some(n => n.id === nodeId))

      if (notebook) {
        if (node.type === 'image-note' && node.imagePath && !node.imageBase64) {
          const base64 = await loadImageBase64(node.imagePath, notebook.id, window.electronAPI.readFile)
          if (base64) {
            notebookStore.updateNode(nodeId, { imageBase64: base64 })
          }
        }

        if ((node.type === 'voice-note' || node.type === 'text-note') && node.transcript) {
          const embeddedImages = await loadEmbeddedImagesForTranscript(node.transcript, notebook.id, window.electronAPI.readFile)
          if (embeddedImages && embeddedImages.length > 0) {
            notebookStore.updateNode(nodeId, { embeddedImages })
          }
        }
      }
    }
  }
}

function handleRetryTranscription(nodeId: string) {
  console.log('Retry transcription:', nodeId)
}

function handleRetryAgentLeft(nodeId: string) {
  const node = displayNodes.value.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleRetryAgentRight(nodeId: string) {
  const node = displayNodes.value.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleRetryAgent(nodeId: string) {
  const node = displayNodes.value.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleRegenerateAgent(nodeId: string) {
  const node = displayNodes.value.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

async function handleAgentResponse(nodeId: string, transcript: string) {
  try {
    notebookStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = displayNodes.value.find(n => n.id === nodeId)
    if (!node) return

    // 找到当前节点所属的笔记本
    const currentNodeNotebook = props.notebookId
      ? currentNotebook.value
      : notebookStore.notebooks.find(nb => nb.nodes?.some(n => n.id === nodeId))

    let currentEmbeddedImages = node.embeddedImages
    if (!currentEmbeddedImages && transcript && currentNodeNotebook) {
      currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript, currentNodeNotebook.id, window.electronAPI.readFile)
      if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
        notebookStore.updateNode(nodeId, { embeddedImages: currentEmbeddedImages })
      }
    }

    // 获取上下文节点：在全部笔记本视图下使用跨笔记本方法加载图片
    let selectedNodes: { transcript: string; agentResult: string; imageBase64?: string; embeddedImages?: string[] }[]

    if (props.notebookId === null) {
      // 全部笔记本视图：获取所有笔记本中被选中的节点及其笔记本ID
      const selectedNodesWithNotebookId = notebookStore.getAllNotebooksSelectedContextNodesWithNotebookId(nodeId)

      // 加载每个节点的内嵌图片（如果尚未加载）
      selectedNodes = await Promise.all(selectedNodesWithNotebookId.map(async ({ node, notebookId }) => {
        let embeddedImages = node.embeddedImages
        if (!embeddedImages && node.transcript) {
          embeddedImages = await loadEmbeddedImagesForTranscript(node.transcript, notebookId, window.electronAPI.readFile)
        }
        return {
          transcript: node.transcript || '',
          agentResult: node.agentResult || '',
          imageBase64: node.imageBase64,
          embeddedImages
        }
      }))
    } else {
      // 单个笔记本视图：使用 displayNodes
      selectedNodes = displayNodes.value
        .filter(n => n.selectedAsContext && n.id !== nodeId)
        .map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '', imageBase64: n.imageBase64, embeddedImages: n.embeddedImages }))
    }

    const staticContextContent = props.staticContextFiles
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildFullContextMessages(
      selectedNodes,
      transcript,
      staticContextContent,
      props.dynamicContextFile?.content,
      currentEmbeddedImages
    )

    let accumulatedContent = ''
    let accumulatedThinking = ''

    const modelConfig = currentModelConfig.value
    if (!modelConfig) {
      notebookStore.updateNode(nodeId, {
        agentResult: '模型配置错误，请检查设置',
        agentStatus: 'error'
      })
      return
    }

    const result = await chatWithLLM(messages, {
      baseUrl: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey,
      model: modelConfig.model,
      enableThinking: modelConfig.enableThinking,
      temperature: modelConfig.temperature
    }, (chunk) => {
      accumulatedContent += chunk
      notebookStore.updateNode(nodeId, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })
    }, (thinkingChunk) => {
      accumulatedThinking += thinkingChunk
      notebookStore.updateNode(nodeId, {
        thinkingContent: accumulatedThinking,
        thinkingStatus: 'processing'
      })
    })

    notebookStore.updateNode(nodeId, {
      agentResult: result.content,
      agentStatus: 'done',
      thinkingContent: result.thinking,
      thinkingStatus: result.thinking ? 'done' : undefined
    })
  } catch (error) {
    notebookStore.updateNode(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

async function handleToggleFavorite(nodeId: string) {
  const node = displayNodes.value.find(n => n.id === nodeId)
  if (node) {
    const newFavoriteState = !node.isFavorite
    // 使用跨笔记本更新方法
    await notebookStore.updateNodeFavorite(nodeId, newFavoriteState)
  }
}

function handleDragStart(nodeId: string, offsetX: number, offsetY: number) {
  // 拖动开始
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  // 使用跨笔记本更新方法，支持全部笔记本视图
  notebookStore.updateNodeInAnyNotebook(nodeId, updates)
}

// 静态上下文选择
async function toggleStaticContext(contextId: string) {
  if (!currentNotebook.value) return

  const currentIds = currentNotebook.value.context?.staticContextIds || []
  const newIds = currentIds.includes(contextId)
    ? currentIds.filter(id => id !== contextId)
    : [...currentIds, contextId]

  if (!currentNotebook.value.context) {
    currentNotebook.value.context = {}
  }

  if (newIds.length > 0) {
    if (!currentNotebook.value.context.staticContextIds) {
      currentNotebook.value.context.staticContextIds = []
    }
    currentNotebook.value.context.staticContextIds.splice(0, currentNotebook.value.context.staticContextIds.length, ...newIds)
  } else {
    currentNotebook.value.context.staticContextIds = undefined
  }

  await notebookStore.saveNotebook(currentNotebook.value)
}

// 动态上下文选择
async function selectDynamicContext(contextId: string) {
  if (!currentNotebook.value) return

  if (!currentNotebook.value.context) {
    currentNotebook.value.context = {}
  }

  if (currentNotebook.value.context.dynamicContextId === contextId) {
    currentNotebook.value.context.dynamicContextId = undefined
  } else {
    currentNotebook.value.context.dynamicContextId = contextId
  }

  await notebookStore.saveNotebook(currentNotebook.value)
}

// 动态上下文操作
function openDynamicContextEditor() {
  if (props.dynamicContextFile) {
    dynamicContextEditContent.value = props.dynamicContextFile.content || ''
    showDynamicContextEditor.value = true
  }
}

async function saveDynamicContextEdit() {
  if (props.dynamicContextFile) {
    await contextStore.updateContextFile(props.dynamicContextFile.id, {
      content: dynamicContextEditContent.value
    })
    showDynamicContextEditor.value = false
  }
}

// 动态上下文拖拽处理
async function handleDynamicContextDrop(text: string) {
  let file = props.dynamicContextFile
  if (!file) {
    const notebookName = currentNotebook.value?.name || '动态上下文'
    file = await contextStore.createContextFile(notebookName, 'dynamic')
    if (currentNotebook.value) {
      currentNotebook.value.context = {
        ...currentNotebook.value.context,
        dynamicContextId: file.id
      }
      notebookStore.saveNotebook(currentNotebook.value)
    }
  }

  const newContent = file.content ? `${file.content}\n\n${text}` : text
  await contextStore.updateContextFile(file.id, { content: newContent })
}

// 模型选择
async function handleSelectModel(modelId: string) {
  if (!currentNotebook.value) return

  currentNotebook.value.modelId = modelId
  await notebookStore.saveNotebook(currentNotebook.value)
}

// 上下文选择操作
function handleToggleAllContext() {
  const nodes = displayNodes.value
  if (isAllContextSelected.value) {
    nodes.forEach(node => {
      if (node.selectedAsContext) {
        notebookStore.updateNode(node.id, { selectedAsContext: false })
      }
    })
  } else {
    nodes.forEach(node => {
      if (node.transcriptStatus === 'done') {
        notebookStore.updateNode(node.id, { selectedAsContext: true })
      }
    })
  }
}

function handleInvertSelection() {
  const nodes = displayNodes.value
  nodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      notebookStore.updateNode(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function clearContextSelection() {
  const nodes = displayNodes.value
  nodes.forEach(node => {
    if (node.selectedAsContext) {
      notebookStore.updateNode(node.id, { selectedAsContext: false })
    }
  })
}

// 复制已选中节点的内容到剪贴板
async function handleCopySelectedContext() {
  const nodes = displayNodes.value
  const selectedNodes = nodes
    .filter(n => n.selectedAsContext && n.transcript)
    .sort((a, b) => a.createdAt - b.createdAt)

  if (selectedNodes.length === 0) return

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
</script>

<style scoped>
.multi-chat-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
}

.panel-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 可拖动分隔线 */
.panel-resizer {
  width: 4px;
  background: var(--bg-primary);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer:hover {
  background: var(--border-color);
}

/* 折叠状态的分隔线 */
.panel-resizer-collapsed {
  width: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer-collapsed:hover {
  background: var(--border-color);
}

/* 双 ChatPanel 容器 */
.chat-panels-container {
  flex: 1;
  display: flex;
  min-width: 300px;
  overflow: hidden;
}

/* 左侧 ChatPanel 固定宽度 */
.left-chat-panel {
  flex: none !important;
  min-width: 300px !important;
}

/* 右侧折叠时左侧填充整个空间 */
.left-chat-panel.full-width {
  flex: 1 !important;
  width: auto !important;
}

/* 右侧 ChatPanel 自动填充 */
.right-chat-panel {
  flex: 1 !important;
  min-width: 300px !important;
}

/* ChatPanel 分隔线 */
.chat-resizer {
  width: 4px;
  background: var(--bg-primary);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
  z-index: 10;
}

.chat-resizer:hover {
  background: var(--border-color);
}

/* 折叠状态的 ChatPanel 分隔线 */
.chat-resizer-collapsed {
  width: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
  z-index: 10;
}

.chat-resizer-collapsed:hover {
  background: var(--border-color);
}

/* 对话框 */
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
  max-width: 600px;
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
}

.content-input {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  resize: vertical;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}

.content-input:focus {
  border-color: var(--color-primary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.cancel-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: var(--border-color);
}

.confirm-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn:hover {
  background: var(--color-primary-hover);
}
</style>