<template>
  <div class="chat-view">
    <!-- 顶部工具栏 -->
    <div class="canvas-header">
      <!-- 左侧区域 -->
      <div class="header-left">
        <button @click="goBack" class="back-btn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>

        <!-- 静态上下文显示 -->
        <div
          ref="staticContextDisplayRef"
          class="static-context-display"
          @click="toggleStaticContextSelector"
          :class="{ 'active': showStaticContextSelector }"
          :title="staticContextFiles.length > 0 ? '点击管理静态上下文' : '点击选择静态上下文'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="context-icon">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          <div v-if="showStaticContextSelector" class="static-context-tags">
            <span
              v-for="file in contextStore.staticContextFiles"
              :key="file.id"
              class="context-tag-mini"
              :class="{ selected: staticContextFiles.some(f => f.id === file.id) }"
              :style="{
                backgroundColor: staticContextFiles.some(f => f.id === file.id) ? file.color + '40' : 'var(--bg-secondary)',
                borderColor: staticContextFiles.some(f => f.id === file.id) ? file.color : 'var(--border-color)',
                color: staticContextFiles.some(f => f.id === file.id) ? file.color : 'var(--text-secondary)'
              }"
              @click.stop="toggleStaticContext(file.id)"
            >
              {{ file.name }}
            </span>
          </div>
          <div v-else-if="staticContextFiles.length > 0" class="static-context-names">
            <template v-for="(file, index) in staticContextFiles" :key="file.id">
              <span v-if="index < 4" class="context-name-tag" :title="file.name" :style="{ backgroundColor: file.color + '20', borderColor: file.color, color: file.color }">
                {{ file.name }}
              </span>
            </template>
            <span v-if="staticContextFiles.length > 4" class="context-count">+{{ staticContextFiles.length - 4 }}</span>
          </div>
          <span v-else class="context-placeholder">选择静态上下文</span>
        </div>
      </div>

      <!-- 中间标题 -->
      <h2 class="header-title">{{ projectStore.currentProject?.name }}</h2>

      <!-- 右侧区域 -->
      <div class="header-right">
        <!-- 回到原点按钮 -->
        <button
          @click="handleResetViewport"
          class="reset-viewport-btn"
          title="回到原点"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-9h10v2H7l3.5 3.5-1.42 1.42L4.16 13l4.92-4.92L10.5 9.5 7 13z"/>
          </svg>
        </button>

        <!-- 自动排版按钮 -->
        <button
          @click="handleAutoLayout"
          class="auto-layout-btn"
          title="自动排版"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
        </button>

        <!-- 总隐藏 AI 回答开关 -->
        <button
          @click="toggleGlobalHideAiResult"
          class="global-hide-ai-btn"
          :class="{ active: globalHideAiResult }"
          :title="globalHideAiResult ? '显示所有 AI 回答' : '隐藏所有 AI 回答'"
        >
          <svg v-if="!globalHideAiResult" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
          </svg>
        </button>

        <!-- AI 回答开关 -->
        <button
          @click="toggleAiAnswer"
          class="ai-answer-toggle-btn"
          :class="{ active: aiAnswerEnabled }"
          :title="aiAnswerEnabled ? '关闭 AI 回答' : '开启 AI 回答'"
        >
          <span class="ai-icon-text">AI</span>
        </button>

        <!-- 动态上下文显示 -->
        <div class="context-toolbar-group">
          <button @click="handleSelectAllContext" class="context-action-btn" title="全选所有已完成节点">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </button>
          <button @click="handleInvertSelection" class="context-action-btn" title="反选所有已完成节点">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M7 19V5h2v14H7zm4 0V5h2v14h-2zm4 0V5h2v14h-2z"/>
              <path d="M5 19V5H3v14h2zm16 0V5h-2v14h2z"/>
            </svg>
          </button>
          <button @click="handleClearContextSelection" class="context-action-btn" title="清空选择">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div
          class="dynamic-context-display"
          :class="{ 'has-content': dynamicContextFile && dynamicContextFile.content }"
          @dblclick="openDynamicContextEditor"
          @dragover="handleDynamicContextDragOver"
          @dragleave="handleDynamicContextDragLeave"
          @drop="handleDynamicContextDrop"
          :title="dynamicContextFile ? '双击编辑动态上下文' : '拖拽文字到此处加入动态上下文'"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="context-icon">
            <path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z"/>
          </svg>
          <span v-if="dynamicContextFile" class="context-name">
          {{ dynamicContextFile.name }}
          <span class="word-count" v-if="dynamicContextFile.content">{{ dynamicContextFile.content.length }}字</span>
        </span>
          <span v-else class="context-placeholder">拖拽文字到此处</span>
        </div>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="panel-container">
      <!-- 左侧面板：画布视图 -->
      <div class="left-panel">
        <InfiniteCanvas
          ref="infiniteCanvasRef"
          :viewport="projectStore.getCurrentViewport()"
          @viewport-change="handleViewportChange"
          @click="handleCanvasClick"
          @dblclick="handleCanvasDblClick"
        >
          <template #nodes>
            <VoiceNote
              v-for="node in projectStore.currentCanvas?.nodes"
              :key="node.id"
              :ref="(el) => { if (el) voiceNoteRefs[node.id] = el }"
              :node="node"
              :is-playing="playingNodeId === node.id"
              :is-editing="editingNodeId === node.id"
              :editing-text="editingText"
              :global-hide-ai-result="globalHideAiResult"
              :is-active="selectedNode?.id === node.id"
              :activate-on-hover="false"
              @delete="handleDeleteNode"
              @play="handlePlayNode"
              @toggle-context="handleToggleContext"
              @retry-transcription="handleRetryTranscription"
              @retry-agent="handleRetryAgent"
              @regenerate-agent="handleRegenerateAgent"
              @toggle-favorite="handleToggleFavorite"
              @drag-start="handleDragStart"
              @update-node="handleUpdateNode"
              @save-edit="handleSaveEdit"
              @cancel-edit="handleCancelEdit"
              @update:editingText="editingText = $event"
              @activate="handleNodeActivate"
            />
          </template>
        </InfiniteCanvas>
      </div>

      <!-- 右侧面板：聊天栏 -->
      <div class="right-panel">
        <div class="chat-header">
          <span v-if="selectedNode" class="selected-node-title">{{ selectedNode.title || '无标题' }}</span>
        </div>

        <!-- 节点详情区域 -->
        <div class="node-detail-container">
          <div v-if="selectedNode" class="node-detail">
            <VoiceNote
              :node="selectedNode"
              :is-active="true"
              :global-hide-ai-result="false"
              :show-header="true"
              @delete="handleDeleteNode"
              @play="handlePlayNode"
              @toggle-context="handleToggleContext"
              @retry-transcription="handleRetryTranscription"
              @retry-agent="handleRetryAgent"
              @regenerate-agent="handleRegenerateAgent"
              @toggle-favorite="handleToggleFavorite"
              @update-node="handleUpdateNode"
              @save-edit="handleSaveEdit"
              @cancel-edit="handleCancelEdit"
              @activate="() => {}"
            />
          </div>
          <div v-else class="empty-node">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <p>在左侧画布中点击节点查看详情</p>
          </div>
        </div>

        <!-- 对话输入区域 -->
        <div class="chat-input-container">
          <div class="chat-input-wrapper">
            <textarea
              v-model="chatInput"
              placeholder="输入问题，将当前节点作为上下文..."
              @keydown.enter.exact.prevent="sendChat"
              @keydown.shift.enter.exact="() => {}"
              :disabled="isChatting"
            ></textarea>
            <button
              @click="sendChat"
              class="send-btn"
              :disabled="!chatInput.trim() || isChatting || !selectedNode"
            >
              <svg v-if="!isChatting" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
              <span v-else class="loading-spinner"></span>
            </button>
          </div>
          <p class="input-hint">按 Enter 发送，Shift+Enter 换行</p>
        </div>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useContextStore } from '@/stores/contextStore'
import VoiceNote from '@/components/VoiceNote.vue'
import InfiniteCanvas from '@/components/InfiniteCanvas.vue'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import type { CanvasNode } from '@/types/project'
import type { ContextFile } from '@/types/context'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const contextStore = useContextStore()

// 画布相关
const infiniteCanvasRef = ref<any>(null)
const voiceNoteRefs = ref<Record<string, any>>({})

// 选中的节点
const selectedNode = ref<CanvasNode | null>(null)

// 音频播放
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

// 编辑相关
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

// 全局隐藏 AI 回答
const globalHideAiResult = ref(false)

// AI 回答开关
const aiAnswerEnabled = ref(true)

// 对话相关
const chatInput = ref('')
const isChatting = ref(false)

// 拖拽相关
const draggingNodeId = ref<string | null>(null)
const dragOffset = ref({ offsetX: 0, offsetY: 0 })

// 静态上下文
const staticContextDisplayRef = ref<HTMLElement | null>(null)
const showStaticContextSelector = ref(false)
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

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

// 键盘事件处理 - 左右键切换节点
function handleKeyDown(event: KeyboardEvent) {
  // 如果正在输入框中输入，不处理
  const target = event.target as HTMLElement
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    return
  }

  const nodes = projectStore.currentCanvas?.nodes
  if (!nodes || nodes.length === 0) return

  // 按 createdAt 排序的节点列表
  const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()

    const currentIndex = selectedNode.value
      ? sortedNodes.findIndex(n => n.id === selectedNode.value!.id)
      : -1

    let newIndex: number
    if (event.key === 'ArrowLeft') {
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

// 画布点击
function handleCanvasClick(x: number, y: number) {
  // 点击空白处不取消选中
}

// 画布双击
function handleCanvasDblClick(x: number, y: number) {
  const node: CanvasNode = {
    id: `node-${Date.now()}`,
    type: 'text-note',
    position: { x, y },
    transcript: '',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: false,
    createdAt: Date.now()
  }
  projectStore.addNode(node)
  selectedNode.value = node
  editingNodeId.value = node.id
  editingText.value = ''
}

// 视口变化
function handleViewportChange(viewport: { x: number; y: number; zoom: number }) {
  projectStore.updateCurrentViewport(viewport)
}

// 重置视口
function handleResetViewport() {
  if (infiniteCanvasRef.value) {
    infiniteCanvasRef.value.resetViewport()
  }
}

// 自动排版
async function handleAutoLayout() {
  const nodes = projectStore.currentCanvas?.nodes
  if (!nodes || nodes.length === 0) return

  const layoutNodes = nodes.filter(n => n.type === 'voice-note' || n.type === 'text-note')
  if (layoutNodes.length === 0) return

  const sortedNodes = [...layoutNodes].sort((a, b) => a.createdAt - b.createdAt)

  const COLUMN_COUNT = 3
  const NODE_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--node-width')) || 450
  const COLUMN_GAP = 6
  const ROW_GAP = 6
  const START_X = 100
  const START_Y = 100

  const nodeHeights: Record<string, number> = {}
  for (const node of sortedNodes) {
    const el = document.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement
    if (el) {
      nodeHeights[node.id] = el.offsetHeight
    } else {
      nodeHeights[node.id] = 200
    }
  }

  const columnHeights: number[] = Array(COLUMN_COUNT).fill(START_Y)

  for (const node of sortedNodes) {
    let minColumn = 0
    let minHeight = columnHeights[0]
    for (let col = 1; col < COLUMN_COUNT; col++) {
      if (columnHeights[col] < minHeight) {
        minHeight = columnHeights[col]
        minColumn = col
      }
    }

    const x = START_X + minColumn * (NODE_WIDTH + COLUMN_GAP)
    const y = columnHeights[minColumn]

    projectStore.updateNode(node.id, { position: { x, y } })

    const nodeHeight = nodeHeights[node.id] || 200
    columnHeights[minColumn] = y + nodeHeight + ROW_GAP
  }

  if (projectStore.currentProject) {
    projectStore.saveProject(projectStore.currentProject)
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

async function handleRegenerateAgent(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (!node?.transcript) return
  
  await sendAgentRequest(nodeId, node.transcript)
}

function handleToggleFavorite(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.updateNode(nodeId, { isFavorite: !node.isFavorite })
  }
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  projectStore.updateNode(nodeId, updates)
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = { ...selectedNode.value, ...updates }
  }
}

function handleSaveEdit(nodeId: string, text: string) {
  projectStore.updateNode(nodeId, { transcript: text })
  editingNodeId.value = null
  editingText.value = ''
  
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = { ...selectedNode.value, transcript: text }
  }
}

function handleCancelEdit(nodeId: string) {
  editingNodeId.value = null
  editingText.value = ''
}

// 拖拽
function handleDragStart(nodeId: string, offsetX: number, offsetY: number) {
  draggingNodeId.value = nodeId
  dragOffset.value = { offsetX, offsetY }
}

// 静态上下文操作
function toggleStaticContextSelector() {
  showStaticContextSelector.value = !showStaticContextSelector.value
}

function toggleStaticContext(fileId: string) {
  const currentIds = projectStore.currentProject?.context?.staticContextIds || []
  const newIds = currentIds.includes(fileId)
    ? currentIds.filter(id => id !== fileId)
    : [...currentIds, fileId]
  
  if (projectStore.currentProject) {
    projectStore.currentProject.context = {
      ...projectStore.currentProject.context,
      staticContextIds: newIds
    }
    projectStore.saveProject(projectStore.currentProject)
  }
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

function handleDynamicContextDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDynamicContextDragLeave(e: DragEvent) {
  e.preventDefault()
}

async function handleDynamicContextDrop(e: DragEvent) {
  e.preventDefault()
  const text = e.dataTransfer?.getData('text/plain')
  if (!text) return

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
function handleSelectAllContext() {
  const nodes = projectStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      projectStore.updateNode(node.id, { selectedAsContext: true })
    }
  })
}

function handleInvertSelection() {
  const nodes = projectStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      projectStore.updateNode(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function handleClearContextSelection() {
  const nodes = projectStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.selectedAsContext) {
      projectStore.updateNode(node.id, { selectedAsContext: false })
    }
  })
}

// 全局隐藏 AI 回答
function toggleGlobalHideAiResult() {
  globalHideAiResult.value = !globalHideAiResult.value
}

// AI 回答开关
function toggleAiAnswer() {
  aiAnswerEnabled.value = !aiAnswerEnabled.value
}

// 发送对话
async function sendChat() {
  if (!chatInput.value.trim() || isChatting.value || !selectedNode.value) return

  const prompt = chatInput.value.trim()
  chatInput.value = ''
  isChatting.value = true

  try {
    const settings = settingsStore.settings
    const node = selectedNode.value

    // 获取已选择的上下文节点
    const selectedNodes = projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== node.id) || []

    // 合并静态上下文内容
    const staticContextContent = staticContextFiles.value
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    // 构建消息
    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '' })),
      prompt,
      staticContextContent,
      dynamicContextFile.value?.content
    )

    let accumulatedContent = ''

    // 创建新节点显示回答
    const newNodeId = `node-${Date.now()}`
    const newNode: CanvasNode = {
      id: newNodeId,
      type: 'text-note',
      title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
      position: {
        x: node.position.x + 50,
        y: node.position.y + 300
      },
      transcript: prompt,
      transcriptStatus: 'done',
      agentResult: '',
      agentStatus: 'processing',
      selectedAsContext: false,
      createdAt: Date.now()
    }

    projectStore.addNode(newNode)
    selectedNode.value = newNode

    const result = await chatWithLLM(messages, {
      baseUrl: settings.llm.baseUrl,
      apiKey: settings.llm.apiKey,
      model: settings.llm.model
    }, (chunk) => {
      accumulatedContent += chunk
      projectStore.updateNode(newNodeId, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })
      selectedNode.value = projectStore.currentCanvas?.nodes.find(n => n.id === newNodeId) || null
    })

    projectStore.updateNode(newNodeId, {
      agentResult: result,
      agentStatus: 'done'
    })
    selectedNode.value = projectStore.currentCanvas?.nodes.find(n => n.id === newNodeId) || null

  } catch (error) {
    console.error('Chat failed:', error)
    if (selectedNode.value) {
      projectStore.updateNode(selectedNode.value.id, {
        agentResult: `**错误:** ${error}`,
        agentStatus: 'error'
      })
    }
  } finally {
    isChatting.value = false
  }
}

// 发送 AI 请求
async function sendAgentRequest(nodeId: string, transcript: string) {
  try {
    projectStore.updateNode(nodeId, { agentStatus: 'processing' })

    const settings = settingsStore.settings
    const messages = buildFullContextMessages([], transcript, undefined, undefined)

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
    })

    projectStore.updateNode(nodeId, {
      agentResult: result,
      agentStatus: 'done'
    })
  } catch (error) {
    projectStore.updateNode(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}
</script>

<style scoped>
.chat-view {
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

/* 左侧面板 - 画布 */
.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  width: 100%;
  box-sizing: border-box;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.header-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  flex: 1;
  min-width: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* 静态上下文显示 */
.static-context-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  max-width: 200px;
}

.static-context-display:hover {
  background: var(--border-color);
}

.static-context-display.active {
  background: var(--border-color);
}

.context-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.static-context-names {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.context-name-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
  white-space: nowrap;
}

.context-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.context-placeholder {
  font-size: 12px;
  right: 0;
  color: var(--text-secondary);
  white-space: nowrap;
}

.static-context-tags {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  padding: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  z-index: 100;
  min-width: 150px;
}

.context-tag-mini {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  white-space: nowrap;
}

/* Header 按钮 */
.reset-viewport-btn,
.auto-layout-btn,
.global-hide-ai-btn,
.ai-answer-toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.reset-viewport-btn:hover,
.auto-layout-btn:hover,
.global-hide-ai-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.global-hide-ai-btn.active {
  background: rgba(66, 153, 225, 0.2);
  color: #4299e1;
}

.ai-answer-toggle-btn {
  background: var(--bg-secondary);
}

.ai-answer-toggle-btn:hover {
  background: var(--border-color);
}

.ai-answer-toggle-btn.active {
  background: #4299e1;
  color: white;
}

.ai-icon-text {
  font-size: 12px;
  font-weight: 600;
}

/* 上下文工具栏 */
.context-toolbar-group {
  display: flex;
  gap: 4px;
}

.context-action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.context-action-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

/* 动态上下文显示 */
.dynamic-context-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  min-width: 100px;
}

.dynamic-context-display:hover {
  background: var(--border-color);
}

.dynamic-context-display.has-content {
  background: rgba(102, 187, 106, 0.15);
}

.context-name {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
}

.word-count {
  font-size: 10px;
  color: var(--text-secondary);
  margin-left: 4px;
}

/* 右侧面板 - 聊天栏 */
.right-panel {
  width: 650px;
  min-width: 600px;
  max-width: 1000px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.chat-header h3 {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
}

.selected-node-title {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 4px;
}

/* 节点详情区域 */
.node-detail-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.node-detail {
  position: relative;
}

.node-detail :deep(.voice-note) {
  position: relative !important;
  left: 0 !important;
  top: 0 !important;
  width: 100% !important;
  transform: none !important;
}

.empty-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-secondary);
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-node p {
  font-size: 14px;
}

/* 对话输入区域 */
.chat-input-container {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input-wrapper textarea {
  flex: 1;
  min-height: 44px;
  max-height: 150px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
}

.chat-input-wrapper textarea:focus {
  border-color: #4299e1;
}

.chat-input-wrapper textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: #4299e1;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: #3182ce;
}

.send-btn:disabled {
  background: var(--border-color);
  cursor: not-allowed;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.input-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 8px 0 0 0;
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