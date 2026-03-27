<template>
  <div class="node-list-view">
    <!-- 顶部工具栏 -->
    <CanvasHeader
      :notebook-name="notebookStore.currentNotebook?.name || ''"
      :static-context-files="staticContextFiles"
      :all-static-context-files="contextStore.staticContextFiles"
      :dynamic-context-file="dynamicContextFile || undefined"
      v-model:global-hide-ai-result="globalHideAiResult"
      v-model:ai-answer-enabled="aiAnswerEnabled"
      :is-all-context-selected="isAllContextSelected"
      :show-viewport-controls="false"
      :selected-context-count="selectedContextCount"
      @back="goBack"
      @toggle-all-context="handleToggleAllContext"
      @invert-selection="handleInvertSelection"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @dynamic-context-drop="handleDynamicContextDrop"
      @copy-selected-context="handleCopySelectedContext"
    />

    <!-- 主内容区域 -->
    <div class="panel-container">
      <!-- 左侧折叠条 -->
      <div class="collapse-bar">
        <button
          class="collapse-btn"
          :title="isLeftPanelCollapsed ? '展开列表' : '折叠列表'"
          @click="toggleLeftPanel"
        >
          <!-- 折叠状态：展开图标 -->
          <svg v-if="isLeftPanelCollapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <polyline points="14 9 11 12 14 15" />
          </svg>
          <!-- 展开状态：折叠图标 -->
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
            <polyline points="10 9 13 12 10 15" />
          </svg>
        </button>
      </div>

      <!-- 左侧面板：笔记列表容器 -->
      <NodeListPanel
        v-if="!isLeftPanelCollapsed"
        ref="nodePanelRef"
        :nodes="notebookStore.currentCanvas?.nodes || []"
        :active-node-id="activeNode?.id"
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

      <!-- 可拖动分隔线 -->
      <div
        v-if="!isLeftPanelCollapsed"
        class="panel-resizer"
        @mousedown="startResize"
      >
        <div class="resizer-line"></div>
      </div>

      <!-- 右侧面板：聊天栏 -->
      <ChatPanel
        :active-node="activeNode"
        :static-context-files="staticContextFiles"
        :dynamic-context-file="dynamicContextFile"
        :ai-answer-enabled="aiAnswerEnabled"
        :editing-node-id="editingNodeId"
        :editing-text="editingText"
        @delete="handleDeleteNode"
        @play="handlePlayNode"
        @toggle-context="handleToggleContext"
        @retry-transcription="handleRetryTranscription"
        @retry-agent="handleRetryAgent"
        @toggle-favorite="handleToggleFavorite"
        @update-node="handleUpdateNode"
        @node-created="handleNodeCreated"
        @node-updated="handleNodeUpdated"
        @update-editing-text="editingText = $event"
        @save-edit="handleSaveEdit"
        @cancel-edit="handleCancelEdit"
        @start-editing="handleStartEditing"
      />
    </div>

    <!-- 动态上下文编辑器 -->
    <div v-if="showDynamicContextEditor" class="dialog-overlay" @click="showDynamicContextEditor = false">
      <div class="dialog dynamic-context-editor-dialog" @click.stop>
        <h3>
          <span v-if="dynamicContextFile">{{ dynamicContextFile.name }}</span>
          <span v-else>动态上下文</span>
        </h3>
        <div v-if="!dynamicContextFile" class="no-dynamic-context">
          <p>当前笔记未关联动态上下文文件。</p>
          <p class="hint">拖拽文字到 Header 右侧区域可自动创建。</p>
        </div>
        <textarea
          v-else
          v-model="dynamicContextEditContent"
          placeholder="动态上下文内容（Markdown 格式）"
          class="content-input"
        ></textarea>
        <div class="dialog-actions" v-if="dynamicContextFile">
          <button @click="showDynamicContextEditor = false" class="cancel-btn">取消</button>
          <button @click="saveDynamicContextEdit" class="confirm-btn">保存</button>
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
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import NodeListPanel from '@/components/NodeListPanel.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import type { CanvasNode } from '@/types/notebook'

const route = useRoute()
const router = useRouter()
const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const contextStore = useContextStore()

// 面板宽度相关
const leftPanelWidth = ref(600)

// 左侧面板折叠状态
const isLeftPanelCollapsed = ref(false)

// NodeListPanel 组件引用
const nodePanelRef = ref<InstanceType<typeof NodeListPanel> | null>(null)

// 拖拽调整宽度相关
const isResizing = ref(false)
let savePanelRatioTimer: number | null = null

function startResize(e: MouseEvent) {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value) return

  const containerRect = document.querySelector('.panel-container')?.getBoundingClientRect()
  if (!containerRect) return

  const newWidth = e.clientX - containerRect.left
  const minWidth = 298
  const maxWidth = containerRect.width - 400

  leftPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, newWidth))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  savePanelRatio()
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

function initPanelWidth() {
  const containerRect = document.querySelector('.panel-container')?.getBoundingClientRect()
  if (!containerRect) return

  const ratio = settingsStore.settings.view?.nodeListViewLeftPanelRatio || 0.6
  const minWidth = 298
  const maxWidth = containerRect.width - 400

  leftPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, containerRect.width * ratio))
}

// 当前激活的节点 ID
const activeNodeId = ref<string | null>(null)

// 导航模式标志（导航时跳过自动选中第一个节点）
const isNavigating = ref(false)

// 当前激活的节点（通过 ID 从 store 中查找，确保始终获取最新数据）
const activeNode = computed(() => {
  if (!activeNodeId.value) return null
  return notebookStore.currentCanvas?.nodes.find(n => n.id === activeNodeId.value) || null
})

// 音频播放
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

// 文本编辑
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

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

// 监听画布切换，自动选中第一个节点（导航时除外）
watch(() => notebookStore.currentCanvas?.id, (newCanvasId, oldCanvasId) => {
  if (newCanvasId && newCanvasId !== oldCanvasId) {
    // 导航模式下跳过自动选中
    if (isNavigating.value) {
      return
    }
    // 非导航时选中第一个节点
    nextTick(() => {
      selectFirstNode()
    })
  }
})

// 选中当前画布的第一个节点
function selectFirstNode() {
  const nodes = notebookStore.currentCanvas?.nodes || []
  if (nodes.length > 0) {
    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    activeNodeId.value = sortedNodes[0].id
  } else {
    activeNodeId.value = null
  }
}

// 滚动到指定节点
function scrollToNode(nodeId: string) {
  nextTick(() => {
    nodePanelRef.value?.scrollToNode(nodeId)
  })
}

// 加载笔记本
onMounted(async () => {
  const notebookId = route.params.notebookId as string
  if (notebookId) {
    await notebookStore.loadNotebooks()
    const notebook = notebookStore.notebooks.find(p => p.id === notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)

      // 处理深度链接参数：切换到指定画布并激活节点
      const canvasId = route.query.canvasId as string
      const nodeId = route.query.nodeId as string

      if (nodeId) {
        // 进入导航模式，阻止 watch 自动选中第一个节点
        isNavigating.value = true
      }

      if (canvasId && notebook.canvases) {
        const canvasIndex = notebook.canvases.findIndex(c => c.id === canvasId)
        if (canvasIndex >= 0 && notebook.currentCanvasIndex !== canvasIndex) {
          notebook.currentCanvasIndex = canvasIndex
        }
      }

      // 如果有指定节点ID，激活该节点
      if (nodeId) {
        await nextTick()
        activeNodeId.value = nodeId
        // 滚动到该节点
        scrollToNode(nodeId)
        // 清除 URL 中的查询参数，避免后续翻页时误判为导航
        router.replace({ path: route.path, query: {} })
        // 延迟退出导航模式，确保 watch 已经执行完毕
        setTimeout(() => {
          isNavigating.value = false
        }, 100)
      }
    }
  }
  await contextStore.loadContextFiles()

  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleClickOutsideEditing)

  initPanelWidth()

  // 如果没有通过深度链接激活节点，选中第一个节点
  if (!activeNodeId.value) {
    nextTick(() => {
      selectFirstNode()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('click', handleClickOutsideEditing)

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
})

// 键盘事件处理
function handleKeyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    return
  }

  const nodes = notebookStore.currentCanvas?.nodes || []
  if (!nodes || nodes.length === 0) return

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()

    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    const currentIndex = activeNodeId.value
      ? sortedNodes.findIndex(n => n.id === activeNodeId.value)
      : -1

    let newIndex: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      newIndex = currentIndex <= 0 ? sortedNodes.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex >= sortedNodes.length - 1 ? 0 : currentIndex + 1
    }

    activeNodeId.value = sortedNodes[newIndex].id
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

// 节点激活（选中）
function handleNodeActivate(nodeId: string) {
  activeNodeId.value = nodeId
}

// ChatPanel 创建新节点
function handleNodeCreated(node: CanvasNode) {
  activeNodeId.value = node.id
}

// ChatPanel 更新节点
function handleNodeUpdated(node: CanvasNode) {
  // 由于 activeNode 现在是计算属性，会自动获取最新数据
  // 这里不需要手动更新
}

// 编辑相关处理
function handleStartEditing(nodeId: string) {
  editingNodeId.value = nodeId
  editingText.value = ''
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    notebookStore.updateNode(nodeId, { transcript: text.trim() })
    if (aiAnswerEnabled.value) {
      handleAgentResponse(nodeId, text.trim())
    }
  } else {
    // 删除空节点后选中第一个节点
    notebookStore.removeNode(nodeId)
    selectFirstNode()
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleCancelEdit(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    // 删除空节点后选中第一个节点
    notebookStore.removeNode(nodeId)
    selectFirstNode()
  }
  editingNodeId.value = null
  editingText.value = ''
}

// 点击外部结束编辑
function handleClickOutsideEditing(e: MouseEvent) {
  if (!editingNodeId.value) return

  const target = e.target as HTMLElement

  // 点击编辑框或节点本身不结束编辑
  if (target.closest('.content-edit') || target.closest('.voice-note')) {
    return
  }

  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      notebookStore.updateNode(editingNodeId.value, { transcript: editingText.value.trim() })
      if (aiAnswerEnabled.value) {
        handleAgentResponse(editingNodeId.value, editingText.value.trim())
      }
    } else {
      // 删除空节点后选中第一个节点
      notebookStore.removeNode(editingNodeId.value)
      selectFirstNode()
    }
  }
  editingNodeId.value = null
  editingText.value = ''
}

// 节点操作
function handleDeleteNode(nodeId: string) {
  notebookStore.removeNode(nodeId)
  if (activeNodeId.value === nodeId) {
    activeNodeId.value = null
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

function handleToggleContext(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNode(nodeId, { selectedAsContext: !node.selectedAsContext })
  }
}

function handleRetryTranscription(nodeId: string) {
  console.log('Retry transcription:', nodeId)
}

function handleRetryAgent(nodeId: string) {
  console.log('Retry agent:', nodeId)
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

    const selectedNodes = notebookStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

    const staticContextContent = staticContextFiles.value
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '' })),
      transcript,
      staticContextContent,
      dynamicContextFile.value?.content
    )

    let accumulatedContent = ''

    const result = await chatWithLLM(messages, {
      baseUrl: settings.llm.baseUrl,
      apiKey: settings.llm.apiKey,
      model: settings.llm.model
    }, (chunk) => {
      accumulatedContent += chunk
      notebookStore.updateNode(nodeId, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })
      // activeNode 现在是计算属性，会自动获取最新数据
    })

    notebookStore.updateNode(nodeId, {
      agentResult: result,
      agentStatus: 'done'
    })
    // activeNode 现在是计算属性，会自动获取最新数据
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
  // activeNode 现在是计算属性，会自动获取最新数据
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
    file = await contextStore.createContextFile('动态上下文', 'dynamic')
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
    // 可选：显示复制成功提示
    console.log(`已复制 ${selectedNodes.length} 个笔记的内容到剪贴板`)
  } catch (error) {
    console.error('复制失败:', error)
  }
}
</script>

<style scoped>
.node-list-view {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: var(--bg-secondary);
}

.panel-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧折叠条 */
.collapse-bar {
  width: 30px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
}

.collapse-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.collapse-btn svg {
  width: 16px;
  height: 16px;
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
  background: #4299e1;
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
  border-color: #4299e1;
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
  background: #4299e1;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-btn:hover {
  background: #3182ce;
}
</style>