<template>
  <div class="node-list-view">
    <!-- 顶部工具栏 -->
    <CanvasHeader
      :project-name="projectStore.currentProject?.name || ''"
      :static-context-files="staticContextFiles"
      :all-static-context-files="contextStore.staticContextFiles"
      :dynamic-context-file="dynamicContextFile || undefined"
      v-model:global-hide-ai-result="globalHideAiResult"
      v-model:ai-answer-enabled="aiAnswerEnabled"
      :is-all-context-selected="isAllContextSelected"
      :show-viewport-controls="false"
      @back="goBack"
      @toggle-all-context="handleToggleAllContext"
      @invert-selection="handleInvertSelection"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @dynamic-context-drop="handleDynamicContextDrop"
    />

    <!-- 主内容区域 -->
    <div class="panel-container">
      <!-- 左侧面板：瀑布流节点容器 -->
      <NodeMasonryPanel
        ref="nodePanelRef"
        :nodes="projectStore.currentCanvas?.nodes || []"
        :selected-node-id="selectedNode?.id"
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
        class="panel-resizer"
        @mousedown="startResize"
      >
        <div class="resizer-line"></div>
      </div>

      <!-- 右侧面板：聊天栏 -->
      <ChatPanel
        :selected-node="selectedNode"
        :static-context-files="staticContextFiles"
        :dynamic-context-file="dynamicContextFile"
        :ai-answer-enabled="aiAnswerEnabled"
        @delete="handleDeleteNode"
        @play="handlePlayNode"
        @toggle-context="handleToggleContext"
        @retry-transcription="handleRetryTranscription"
        @retry-agent="handleRetryAgent"
        @toggle-favorite="handleToggleFavorite"
        @update-node="handleUpdateNode"
        @node-created="handleNodeCreated"
        @node-updated="handleNodeUpdated"
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
          <p>当前项目未关联动态上下文文件。</p>
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
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import NodeMasonryPanel from '@/components/NodeMasonryPanel.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import type { CanvasNode } from '@/types/project'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const contextStore = useContextStore()

// 面板宽度相关
const leftPanelWidth = ref(600)

// NodeMasonryPanel 组件引用
const nodePanelRef = ref<InstanceType<typeof NodeMasonryPanel> | null>(null)

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

// 选中的节点
const selectedNode = ref<CanvasNode | null>(null)

// 音频播放
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

// 全局隐藏 AI 回答
const globalHideAiResult = ref(false)

// AI 回答开关
const aiAnswerEnabled = ref(true)

// 静态上下文
const staticContextFiles = computed(() => {
  const ids = projectStore.currentProject?.context?.staticContextIds || []
  return contextStore.staticContextFiles.filter(f => ids.includes(f.id))
})

// 动态上下文
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')
const dynamicContextFile = computed(() => {
  const id = projectStore.currentProject?.context?.dynamicContextId
  return id ? contextStore.dynamicContextFiles.find(f => f.id === id) : null
})

// 选中的上下文数量
const selectedContextCount = computed(() => {
  return projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.transcriptStatus === 'done').length || 0
})

// 已完成节点数量
const completedNodesCount = computed(() => {
  return projectStore.currentCanvas?.nodes.filter(n => n.transcriptStatus === 'done').length || 0
})

// 是否全选
const isAllContextSelected = computed(() => {
  return completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
})

// 监听画布切换，自动选中第一个节点
watch(() => projectStore.currentCanvas?.id, (newCanvasId, oldCanvasId) => {
  if (newCanvasId && newCanvasId !== oldCanvasId) {
    nextTick(() => {
      selectFirstNode()
    })
  }
})

// 选中当前画布的第一个节点
function selectFirstNode() {
  const nodes = projectStore.currentCanvas?.nodes || []
  if (nodes.length > 0) {
    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    selectedNode.value = sortedNodes[0]
  } else {
    selectedNode.value = null
  }
}

// 加载项目
onMounted(async () => {
  const projectId = route.params.projectId as string
  if (projectId) {
    await projectStore.loadProjects()
    const project = projectStore.projects.find(p => p.id === projectId)
    if (project) {
      projectStore.setCurrentProject(project)
    }
  }
  await contextStore.loadContextFiles()

  window.addEventListener('keydown', handleKeyDown)

  initPanelWidth()

  // 初始化时选中第一个节点
  nextTick(() => {
    selectFirstNode()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)

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

  const nodes = projectStore.currentCanvas?.nodes || []
  if (!nodes || nodes.length === 0) return

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()

    const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
    const currentIndex = selectedNode.value
      ? sortedNodes.findIndex(n => n.id === selectedNode.value!.id)
      : -1

    let newIndex: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      newIndex = currentIndex <= 0 ? sortedNodes.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex >= sortedNodes.length - 1 ? 0 : currentIndex + 1
    }

    selectedNode.value = sortedNodes[newIndex]
  }
}

// 返回首页
function goBack() {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
  playingNodeId.value = null
  router.push('/')
}

// 节点激活（选中）
function handleNodeActivate(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    selectedNode.value = node
  }
}

// ChatPanel 创建新节点
function handleNodeCreated(node: CanvasNode) {
  selectedNode.value = node
}

// ChatPanel 更新节点
function handleNodeUpdated(node: CanvasNode) {
  if (selectedNode.value?.id === node.id) {
    selectedNode.value = node
  }
}

// 节点操作
function handleDeleteNode(nodeId: string) {
  projectStore.removeNode(nodeId)
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = null
  }
}

async function handlePlayNode(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
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
    const audioPath = `${appDataPath}/${node.audioPath}`

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
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.updateNode(nodeId, { selectedAsContext: !node.selectedAsContext })
  }
}

function handleRetryTranscription(nodeId: string) {
  console.log('Retry transcription:', nodeId)
}

function handleRetryAgent(nodeId: string) {
  console.log('Retry agent:', nodeId)
}

function handleRegenerateAgent(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

async function handleAgentResponse(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
    if (!node) return

    const selectedNodes = projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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
      projectStore.updateNode(nodeId, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })

      // 更新选中的节点引用
      const updatedNode = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
      if (updatedNode && selectedNode.value?.id === nodeId) {
        selectedNode.value = { ...updatedNode }
      }
    })

    projectStore.updateNode(nodeId, {
      agentResult: result,
      agentStatus: 'done'
    })

    // 更新选中的节点引用
    const updatedNode = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
    if (updatedNode && selectedNode.value?.id === nodeId) {
      selectedNode.value = { ...updatedNode }
    }
  } catch (error) {
    projectStore.updateNode(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

function handleToggleFavorite(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.updateNode(nodeId, { isFavorite: !node.isFavorite })
  }
}

function handleDragStart(nodeId: string, offsetX: number, offsetY: number) {
  // 拖动开始
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  projectStore.updateNode(nodeId, updates)
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = { ...selectedNode.value, ...updates }
  }
}

// 静态上下文选择
async function toggleStaticContext(contextId: string) {
  if (!projectStore.currentProject) return

  const currentIds = projectStore.currentProject.context?.staticContextIds || []
  const newIds = currentIds.includes(contextId)
    ? currentIds.filter(id => id !== contextId)
    : [...currentIds, contextId]

  if (!projectStore.currentProject.context) {
    projectStore.currentProject.context = {}
  }

  if (newIds.length > 0) {
    if (!projectStore.currentProject.context.staticContextIds) {
      projectStore.currentProject.context.staticContextIds = []
    }
    projectStore.currentProject.context.staticContextIds.splice(0, projectStore.currentProject.context.staticContextIds.length, ...newIds)
  } else {
    projectStore.currentProject.context.staticContextIds = undefined
  }

  await projectStore.saveProject(projectStore.currentProject)
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
    if (projectStore.currentProject) {
      projectStore.currentProject.context = {
        ...projectStore.currentProject.context,
        dynamicContextId: file.id
      }
      projectStore.saveProject(projectStore.currentProject)
    }
  }

  const newContent = file.content ? `${file.content}\n\n${text}` : text
  await contextStore.updateContextFile(file.id, { content: newContent })
}

// 上下文选择操作
function handleToggleAllContext() {
  const nodes = projectStore.currentCanvas?.nodes || []
  if (isAllContextSelected.value) {
    nodes.forEach(node => {
      if (node.selectedAsContext) {
        projectStore.updateNode(node.id, { selectedAsContext: false })
      }
    })
  } else {
    nodes.forEach(node => {
      if (node.transcriptStatus === 'done') {
        projectStore.updateNode(node.id, { selectedAsContext: true })
      }
    })
  }
}

function handleInvertSelection() {
  const nodes = projectStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      projectStore.updateNode(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function clearContextSelection() {
  const nodes = projectStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.selectedAsContext) {
      projectStore.updateNode(node.id, { selectedAsContext: false })
    }
  })
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