<template>
  <div class="multi-chat-view">
    <!-- 顶部工具栏 -->
    <CanvasHeader
      :notebook-name="notebookStore.currentNotebook?.name || ''"
      :static-context-files="staticContextFiles"
      :all-static-context-files="contextStore.staticContextFiles"
      :all-dynamic-context-files="contextStore.dynamicContextFiles"
      :dynamic-context-file="dynamicContextFile || undefined"
      v-model:global-hide-ai-result="globalHideAiResult"
      v-model:ai-answer-enabled="aiAnswerEnabled"
      :is-all-context-selected="isAllContextSelected"
      :show-viewport-controls="false"
      :selected-context-count="selectedContextCount"
      :notebook-model-id="notebookStore.currentNotebook?.modelId"
      :all-profiles="settingsStore.settings.llm.profiles"
      :active-profile-id="settingsStore.settings.llm.activeProfileId"
      @back="goBack"
      @toggle-all-context="handleToggleAllContext"
      @invert-selection="handleInvertSelection"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @select-dynamic-context="selectDynamicContext"
      @dynamic-context-drop="handleDynamicContextDrop"
      @copy-selected-context="handleCopySelectedContext"
      @select-model="handleSelectModel"
    />

    <!-- 主内容区域 -->
    <div class="panel-container">
      <!-- 左侧面板：笔记列表容器 -->
      <NodeListPanel
        v-if="!isLeftPanelCollapsed"
        ref="nodePanelRef"
        :nodes="notebookStore.currentCanvas?.nodes || []"
        :active-node-id="currentActiveNodeId"
        :playing-node-id="playingNodeId"
        :panel-width="leftPanelWidth"
        @delete="handleDeleteNode"
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
        <div class="resizer-line"></div>
      </div>

      <!-- 折叠状态的分隔线 -->
      <div
        v-if="isLeftPanelCollapsed"
        class="panel-resizer-collapsed"
        @dblclick="toggleLeftPanel"
      >
        <div class="resizer-line-collapsed"></div>
      </div>

      <!-- 右侧双 ChatPanel 区域 -->
      <div class="chat-panels-container" :class="{ 'right-collapsed': isRightChatPanelCollapsed }">
        <!-- 左侧 ChatPanel -->
        <ChatPanel
          :active-node="activeNodeLeft"
          :static-context-files="staticContextFiles"
          :dynamic-context-file="dynamicContextFile"
          :ai-answer-enabled="aiAnswerEnabled"
          :editing-node-id="editingNodeIdLeft"
          :editing-text="editingTextLeft"
          :is-active="activePanel === 'left'"
          :panel-id="'left'"
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
          @update-editing-text="editingTextLeft = $event"
          @save-edit="handleSaveEditLeft"
          @cancel-edit="handleCancelEditLeft"
          @start-editing="handleStartEditingLeft"
          @activate="handleChatPanelActivate"
        />

        <!-- 中间分隔线 -->
        <div
          v-if="!isRightChatPanelCollapsed"
          class="chat-resizer"
          @mousedown="startResizeChat"
          @dblclick="toggleRightChatPanel"
        >
          <div class="resizer-line"></div>
        </div>

        <!-- 折叠状态的分隔线 -->
        <div
          v-if="isRightChatPanelCollapsed"
          class="chat-resizer-collapsed"
          @dblclick="toggleRightChatPanel"
        >
          <div class="resizer-line"></div>
        </div>

        <!-- 右侧 ChatPanel -->
        <ChatPanel
          v-if="!isRightChatPanelCollapsed"
          :active-node="activeNodeRight"
          :static-context-files="staticContextFiles"
          :dynamic-context-file="dynamicContextFile"
          :ai-answer-enabled="aiAnswerEnabled"
          :editing-node-id="editingNodeIdRight"
          :editing-text="editingTextRight"
          :is-active="activePanel === 'right'"
          :panel-id="'right'"
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
          @update-editing-text="editingTextRight = $event"
          @save-edit="handleSaveEditRight"
          @cancel-edit="handleCancelEditRight"
          @start-editing="handleStartEditingRight"
          @activate="handleChatPanelActivate"
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

    <!-- 上下文选择工具栏 -->
    <ContextToolbar
      v-if="selectedContextCount > 0"
      :selected-count="selectedContextCount"
      @clear="clearContextSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import NodeListPanel from '@/components/NodeListPanel.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import { extractImagePaths, loadEmbeddedImagesForTranscript, loadImageBase64 } from '@/utils/contextBuilder'
import type { CanvasNode } from '@/types/notebook'

const route = useRoute()
const router = useRouter()
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

// 两个面板各自的激活节点（通过 ID 从 store 中查找）
const activeNodeLeft = computed(() => {
  if (!activeNodeIdLeft.value) return null
  return notebookStore.currentCanvas?.nodes.find(n => n.id === activeNodeIdLeft.value) || null
})

const activeNodeRight = computed(() => {
  if (!activeNodeIdRight.value) return null
  return notebookStore.currentCanvas?.nodes.find(n => n.id === activeNodeIdRight.value) || null
})

// 当前激活节点 ID（用于 NodeListPanel 高亮）
const currentActiveNodeId = computed(() => {
  return activePanel.value === 'left' ? activeNodeIdLeft.value : activeNodeIdRight.value
})

// 音频播放
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

// 两个面板各自的编辑状态
const editingNodeIdLeft = ref<string | null>(null)
const editingTextLeft = ref('')
const editingNodeIdRight = ref<string | null>(null)
const editingTextRight = ref('')

// 全局隐藏 AI 回答
const globalHideAiResult = ref(false)

// AI 回答开关
const aiAnswerEnabled = ref(true)

// 静态上下文
const staticContextFiles = computed(() => {
  const ids = notebookStore.currentNotebook?.context?.staticContextIds || []
  return contextStore.staticContextFiles.filter(f => ids.includes(f.id))
})

// 动态上下文
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')
const dynamicContextFile = computed(() => {
  const id = notebookStore.currentNotebook?.context?.dynamicContextId
  return id ? contextStore.dynamicContextFiles.find(f => f.id === id) : null
})

// 选中的上下文数量
const selectedContextCount = computed(() => {
  return notebookStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.transcriptStatus === 'done').length || 0
})

// 已完成节点数量
const completedNodesCount = computed(() => {
  return notebookStore.currentCanvas?.nodes.filter(n => n.transcriptStatus === 'done').length || 0
})

// 是否全选
const isAllContextSelected = computed(() => {
  return completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
})

// 获取当前笔记本使用的模型配置
const currentModelConfig = computed(() => {
  const modelId = notebookStore.currentNotebook?.modelId || settingsStore.settings.llm.activeProfileId
  return settingsStore.settings.llm.profiles.find(p => p.id === modelId)
})

// 监听画布切换
watch(() => notebookStore.currentCanvas?.id, (newCanvasId, oldCanvasId) => {
  if (newCanvasId && newCanvasId !== oldCanvasId) {
    if (isNavigating.value) return
    nextTick(() => {
      selectFirstNodes()
    })
  }
})

// 监听路由查询参数变化（处理同一页面内的链接跳转）
watch(() => route.query.nodeId, (newNodeId) => {
  if (newNodeId && typeof newNodeId === 'string') {
    const canvasId = route.query.canvasId as string

    // 如果有指定画布，切换到该画布
    if (canvasId && notebookStore.currentNotebook?.canvases) {
      const canvasIndex = notebookStore.currentNotebook.canvases.findIndex(c => c.id === canvasId)
      if (canvasIndex >= 0 && notebookStore.currentNotebook.currentCanvasIndex !== canvasIndex) {
        notebookStore.currentNotebook.currentCanvasIndex = canvasIndex
      }
    }

    // 激活节点
    activeNodeIdLeft.value = newNodeId
    scrollToNode(newNodeId)

    // 清除 URL 中的查询参数
    router.replace({ path: route.path, query: {} })
  }
}, { immediate: false })

// 选中当前画布的前两个节点
function selectFirstNodes() {
  const nodes = notebookStore.currentCanvas?.nodes || []
  if (nodes.length > 0) {
    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    activeNodeIdLeft.value = sortedNodes[0].id
    if (sortedNodes.length > 1) {
      activeNodeIdRight.value = sortedNodes[1].id
    } else {
      activeNodeIdRight.value = null
    }
  } else {
    activeNodeIdLeft.value = null
    activeNodeIdRight.value = null
  }
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
}

// 加载笔记本
onMounted(async () => {
  const notebookId = route.params.notebookId as string
  if (notebookId) {
    await notebookStore.loadNotebooks()
    const notebook = notebookStore.notebooks.find(p => p.id === notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)

      const canvasId = route.query.canvasId as string
      const nodeId = route.query.nodeId as string

      if (nodeId) {
        isNavigating.value = true
      }

      if (canvasId && notebook.canvases) {
        const canvasIndex = notebook.canvases.findIndex(c => c.id === canvasId)
        if (canvasIndex >= 0 && notebook.currentCanvasIndex !== canvasIndex) {
          notebook.currentCanvasIndex = canvasIndex
        }
      }

      if (nodeId) {
        await nextTick()
        activeNodeIdLeft.value = nodeId
        scrollToNode(nodeId)
        router.replace({ path: route.path, query: {} })
        setTimeout(() => {
          isNavigating.value = false
        }, 100)
      }
    }
  }
  await contextStore.loadContextFiles()

  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleClickOutsideEditing)

  initPanelWidths()

  if (!activeNodeIdLeft.value) {
    nextTick(() => {
      selectFirstNodes()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleResizeLeft)
  document.removeEventListener('mousemove', handleResizeChat)
  document.removeEventListener('mouseup', stopResizeLeft)
  document.removeEventListener('mouseup', stopResizeChat)
  document.removeEventListener('click', handleClickOutsideEditing)

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

  const nodes = notebookStore.currentCanvas?.nodes || []

  // 左右键：画布翻页
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (notebookStore.hasPrevPage) {
      notebookStore.goToPrevPage()
      nextTick(() => {
        selectFirstNodes()
      })
    }
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    if (notebookStore.hasNextPage) {
      notebookStore.goToNextPage()
      nextTick(() => {
        selectFirstNodes()
      })
    }
    return
  }

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

// 返回首页
function goBack() {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
  playingNodeId.value = null
  notebookStore.cleanupEmptyPages()
  router.push('/')
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
}

function handleNodeCreatedRight(node: CanvasNode) {
  activeNodeIdRight.value = node.id
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
  editingNodeIdLeft.value = nodeId
  editingTextLeft.value = ''
}

function handleStartEditingRight(nodeId: string) {
  editingNodeIdRight.value = nodeId
  editingTextRight.value = ''
}

function handleSaveEditLeft(nodeId: string, text: string) {
  if (text.trim()) {
    notebookStore.updateNode(nodeId, { transcript: text.trim() })
    if (aiAnswerEnabled.value) {
      handleAgentResponse(nodeId, text.trim())
    }
  } else {
    notebookStore.removeNode(nodeId)
    selectFirstNodes()
  }
  editingNodeIdLeft.value = null
  editingTextLeft.value = ''
}

function handleSaveEditRight(nodeId: string, text: string) {
  if (text.trim()) {
    notebookStore.updateNode(nodeId, { transcript: text.trim() })
    if (aiAnswerEnabled.value) {
      handleAgentResponse(nodeId, text.trim())
    }
  } else {
    notebookStore.removeNode(nodeId)
    selectFirstNodes()
  }
  editingNodeIdRight.value = null
  editingTextRight.value = ''
}

function handleCancelEditLeft(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    notebookStore.removeNode(nodeId)
    selectFirstNodes()
  }
  editingNodeIdLeft.value = null
  editingTextLeft.value = ''
}

function handleCancelEditRight(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    notebookStore.removeNode(nodeId)
    selectFirstNodes()
  }
  editingNodeIdRight.value = null
  editingTextRight.value = ''
}

// 点击外部结束编辑
function handleClickOutsideEditing(e: MouseEvent) {
  // 检查左右面板的编辑状态
  const editingNodeId = editingNodeIdLeft.value || editingNodeIdRight.value
  if (!editingNodeId) return

  const target = e.target as HTMLElement

  if (target.closest('.content-edit') || target.closest('.voice-note')) {
    return
  }

  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === editingNodeId)
  const editingText = editingNodeIdLeft.value ? editingTextLeft.value : editingTextRight.value

  if (node) {
    if (editingText.trim()) {
      notebookStore.updateNode(editingNodeId, { transcript: editingText.trim() })
      if (aiAnswerEnabled.value) {
        handleAgentResponse(editingNodeId, editingText.trim())
      }
    } else {
      notebookStore.removeNode(editingNodeId)
      selectFirstNodes()
    }
  }
  editingNodeIdLeft.value = null
  editingTextLeft.value = ''
  editingNodeIdRight.value = null
  editingTextRight.value = ''
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

async function handlePlayNode(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
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
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const notebook = notebookStore.currentNotebook
    if (!notebook || !node.audioPath) return

    const audioPath = `${appDataPath}/notebooks/${notebook.id}/${node.audioPath}`

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
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    const newSelectedState = !node.selectedAsContext
    notebookStore.updateNode(nodeId, { selectedAsContext: newSelectedState })

    const notebook = notebookStore.currentNotebook
    if (!notebook) return

    if (newSelectedState && node.type === 'image-note' && node.imagePath && !node.imageBase64) {
      const base64 = await loadImageBase64(node.imagePath, notebook.id, window.electronAPI.readFile)
      if (base64) {
        notebookStore.updateNode(nodeId, { imageBase64: base64 })
      }
    }

    if (newSelectedState && (node.type === 'voice-note' || node.type === 'text-note') && node.transcript) {
      const embeddedImages = await loadEmbeddedImagesForTranscript(node.transcript, notebook.id, window.electronAPI.readFile)
      if (embeddedImages && embeddedImages.length > 0) {
        notebookStore.updateNode(nodeId, { embeddedImages })
      }
    }
  }
}

function handleRetryTranscription(nodeId: string) {
  console.log('Retry transcription:', nodeId)
}

function handleRetryAgentLeft(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleRetryAgentRight(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

// NodeListPanel 的 retry-agent，根据当前激活面板处理
function handleRetryAgent(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleRegenerateAgent(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

async function handleAgentResponse(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    notebookStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
    if (!node) return

    let currentEmbeddedImages = node.embeddedImages
    if (!currentEmbeddedImages && transcript) {
      const notebook = notebookStore.currentNotebook
      if (notebook) {
        currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript, notebook.id, window.electronAPI.readFile)
        if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
          notebookStore.updateNode(nodeId, { embeddedImages: currentEmbeddedImages })
        }
      }
    }

    const selectedNodes = notebookStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

    const staticContextContent = staticContextFiles.value
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '', imageBase64: n.imageBase64, embeddedImages: n.embeddedImages })),
      transcript,
      staticContextContent,
      dynamicContextFile.value?.content,
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

function handleToggleFavorite(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNode(nodeId, { isFavorite: !node.isFavorite })
  }
}

function handleDragStart(nodeId: string, offsetX: number, offsetY: number) {
  // 拖动开始
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  notebookStore.updateNode(nodeId, updates)
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

// 动态上下文选择
async function selectDynamicContext(contextId: string) {
  if (!notebookStore.currentNotebook) return

  if (!notebookStore.currentNotebook.context) {
    notebookStore.currentNotebook.context = {}
  }

  if (notebookStore.currentNotebook.context.dynamicContextId === contextId) {
    notebookStore.currentNotebook.context.dynamicContextId = undefined
  } else {
    notebookStore.currentNotebook.context.dynamicContextId = contextId
  }

  await notebookStore.saveNotebook(notebookStore.currentNotebook)
}

// 动态上下文操作
function openDynamicContextEditor() {
  if (dynamicContextFile.value) {
    dynamicContextEditContent.value = dynamicContextFile.value.content || ''
    showDynamicContextEditor.value = true
  }
}

async function saveDynamicContextEdit() {
  if (dynamicContextFile.value) {
    await contextStore.updateContextFile(dynamicContextFile.value.id, {
      content: dynamicContextEditContent.value
    })
    showDynamicContextEditor.value = false
  }
}

// 动态上下文拖拽处理
async function handleDynamicContextDrop(text: string) {
  let file = dynamicContextFile.value
  if (!file) {
    const notebookName = notebookStore.currentNotebook?.name || '动态上下文'
    file = await contextStore.createContextFile(notebookName, 'dynamic')
    if (notebookStore.currentNotebook) {
      notebookStore.currentNotebook.context = {
        ...notebookStore.currentNotebook.context,
        dynamicContextId: file.id
      }
      notebookStore.saveNotebook(notebookStore.currentNotebook)
    }
  }

  const newContent = file.content ? `${file.content}\n\n${text}` : text
  await contextStore.updateContextFile(file.id, { content: newContent })
}

// 模型选择
async function handleSelectModel(modelId: string) {
  if (!notebookStore.currentNotebook) return

  notebookStore.currentNotebook.modelId = modelId
  await notebookStore.saveNotebook(notebookStore.currentNotebook)
}

// 上下文选择操作
function handleToggleAllContext() {
  const nodes = notebookStore.currentCanvas?.nodes || []
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
  const nodes = notebookStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      notebookStore.updateNode(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function clearContextSelection() {
  const nodes = notebookStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.selectedAsContext) {
      notebookStore.updateNode(node.id, { selectedAsContext: false })
    }
  })
}

// 复制已选中节点的内容到剪贴板
async function handleCopySelectedContext() {
  const nodes = notebookStore.currentCanvas?.nodes || []
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
.multi-chat-view {
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
  width: 8px;
  background: var(--bg-primary);
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer:hover {
  background: var(--border-color);
}

.resizer-line {
  width: 2px;
  height: 40px;
  background: var(--border-color);
  border-radius: 1px;
  transition: background 0.2s;
}

.panel-resizer:hover .resizer-line {
  background: var(--color-primary);
}

/* 折叠状态的分隔线 */
.panel-resizer-collapsed {
  width: 8px;
  background: var(--bg-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer-collapsed:hover {
  background: var(--border-color);
}

.resizer-line-collapsed {
  width: 2px;
  height: 40px;
  background: var(--border-color);
  border-radius: 1px;
  transition: background 0.2s;
}

.panel-resizer-collapsed:hover .resizer-line-collapsed {
  background: var(--color-primary);
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
  width: 8px;
  background: var(--bg-primary);
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
  z-index: 10;
}

.chat-resizer:hover {
  background: var(--border-color);
}

.chat-resizer:hover .resizer-line {
  background: var(--color-primary);
}

/* 折叠状态的 ChatPanel 分隔线 */
.chat-resizer-collapsed {
  width: 8px;
  background: var(--bg-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
  z-index: 10;
}

.chat-resizer-collapsed:hover {
  background: var(--border-color);
}

.chat-resizer-collapsed:hover .resizer-line {
  background: var(--color-primary);
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