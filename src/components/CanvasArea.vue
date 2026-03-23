<template>
  <div class="canvas-area">
    <InfiniteCanvas
      ref="infiniteCanvasRef"
      :viewport="viewport"
      :is-recording="isRecording"
      :recording-position="recordingPosition"
      :recording-duration="recordingDuration"
      :has-prev-page="projectStore.hasPrevPage"
      :has-next-page="projectStore.hasNextPage"
      :is-current-canvas-empty="projectStore.isCurrentCanvasEmpty"
      :current-page-number="projectStore.currentPageNumber"
      :total-pages="projectStore.totalPages"
      @viewport-change="handleViewportChange"
      @long-press="handleLongPress"
      @long-press-end="handleLongPressEnd($event)"
      @click="handleCanvasClick"
      @dbl-click="handleDblClick"
      @drop-text="handleDropText"
      @prev-page="handlePrevPage"
      @next-page="handleNextPage"
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
          :is-active="activeNodeId === node.id"
          :show-header="activeNodeId === node.id"
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
          @update:editing-text="editingText = $event"
          @activate="handleActivateNode"
        />
      </template>
    </InfiniteCanvas>

    <ContextToolbar
      v-if="selectedContextCount > 0"
      :selected-count="selectedContextCount"
      @clear="clearContextSelection"
      @ask="handleAskWithNewRecording"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import InfiniteCanvas from '@/components/InfiniteCanvas.vue'
import VoiceNote from '@/components/VoiceNote.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import type { CanvasNode, Viewport } from '@/types/project'
import type { ContextFile } from '@/types/context'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'

const props = defineProps<{
  globalHideAiResult: boolean
  aiAnswerEnabled: boolean
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile
}>()

const emit = defineEmits<{
  'reset-viewport': []
  'auto-layout': []
  'prev-page': []
  'next-page': []
}>()

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// 录音实例
const simpleRecorder = createAudioWorkletRecorder()

const viewport = ref<Viewport>({ x: 0, y: 0, zoom: 1 })
const isRecording = ref(false)
const recordingPosition = ref<{ x: number; y: number } | undefined>(undefined)
const recordingDuration = ref(0)
const recordingStartPosition = ref<{ x: number; y: number } | null>(null)
let recordingTimer: number | null = null

// 节点拖动相关
const isDraggingNode = ref(false)
const draggingNodeId = ref<string | null>(null)
const dragOffset = ref({ offsetX: 0, offsetY: 0 })

// VoiceNote组件引用
const voiceNoteRefs = ref<Record<string, any>>({})

// InfiniteCanvas组件引用
const infiniteCanvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null)

// 当前激活的节点ID
const activeNodeId = ref<string | null>(null)

// 监听激活节点变化，移动画布视口到节点位置
watch(activeNodeId, (newNodeId) => {
  if (!newNodeId) return

  const node = projectStore.currentCanvas?.nodes.find(n => n.id === newNodeId)
  if (!node) return

  nextTick(() => {
    if (!infiniteCanvasRef.value) return

    const canvasEl = infiniteCanvasRef.value.canvasRef
    if (!canvasEl) return

    const rect = canvasEl.getBoundingClientRect()
    const zoom = viewport.value.zoom

    // 节点尺寸
    const nodeWidth = 450 // --node-width

    // 节点在屏幕上的位置
    const nodeScreenLeft = node.position.x * zoom + viewport.value.x
    const nodeScreenRight = nodeScreenLeft + nodeWidth * zoom

    // 计算目标X：只调整到让节点完全可见，不居中
    let targetX = viewport.value.x
    const padding = 20 // 边距

    if (nodeScreenLeft < padding) {
      // 节点左边超出，向右移动
      targetX = padding - node.position.x * zoom
    } else if (nodeScreenRight > rect.width - padding) {
      // 节点右边超出，向左移动
      targetX = rect.width - padding - (node.position.x + nodeWidth) * zoom
    }

    // 计算目标Y：节点顶部居中
    const centerY = rect.height / 2
    const targetY = centerY - node.position.y * zoom

    // 平滑动画移动视口
    animateViewportTo(targetX, targetY, zoom)
  })
})

// 平滑动画移动视口
function animateViewportTo(targetX: number, targetY: number, zoom: number) {
  const startX = viewport.value.x
  const startY = viewport.value.y
  const duration = 300 // 动画持续时间（毫秒）
  const startTime = performance.now()

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)

    // 使用 easeOutCubic 缓动函数
    const easeProgress = 1 - Math.pow(1 - progress, 3)

    const newX = startX + (targetX - startX) * easeProgress
    const newY = startY + (targetY - startY) * easeProgress

    const newViewport = { x: newX, y: newY, zoom }
    viewport.value = newViewport
    projectStore.updateCurrentViewport(newViewport)

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

// 音频播放相关
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

// 文本框编辑相关
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

const selectedContextCount = computed(() =>
  projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext).length || 0
)

// 初始化 viewport
function initViewport() {
  viewport.value = projectStore.getCurrentViewport()
}

onMounted(() => {
  initViewport()
  window.addEventListener('mousemove', handleNodeDragMove)
  window.addEventListener('mouseup', handleNodeDragEnd)
  document.addEventListener('click', handleClickOutsideEditing)
})

onUnmounted(() => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  window.removeEventListener('mousemove', handleNodeDragMove)
  window.removeEventListener('mouseup', handleNodeDragEnd)
  document.removeEventListener('click', handleClickOutsideEditing)
})

function handleViewportChange(newViewport: Viewport) {
  viewport.value = newViewport
  projectStore.updateCurrentViewport(newViewport)
}

function handleResetViewport() {
  const resetViewport: Viewport = { x: 0, y: 0, zoom: 1 }
  viewport.value = resetViewport
  projectStore.updateCurrentViewport(resetViewport)
}

function handlePrevPage() {
  cancelTextEdit()
  projectStore.goToPrevPage()
  viewport.value = projectStore.getCurrentViewport()
  emit('prev-page')
}

function handleNextPage() {
  cancelTextEdit()
  if (projectStore.hasNextPage) {
    projectStore.goToNextPage()
    viewport.value = projectStore.getCurrentViewport()
  } else {
    const success = projectStore.addNewPage()
    if (success) {
      viewport.value = projectStore.getCurrentViewport()
    }
  }
  emit('next-page')
}

async function handleLongPress(x: number, y: number) {
  try {
    await simpleRecorder.start()
    isRecording.value = true
    recordingPosition.value = { x, y }
    recordingStartPosition.value = { x, y }
    recordingDuration.value = 0

    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)
  } catch (error) {
    console.error('Failed to start recording:', error)
    isRecording.value = false
    recordingPosition.value = undefined
  }
}

async function handleLongPressEnd(isCancel = false) {
  if (!recordingTimer) return

  clearInterval(recordingTimer)
  recordingTimer = null

  if (isCancel) {
    try {
      await simpleRecorder.stop()
    } catch (error) {
      console.error('Failed to stop recorder:', error)
    }
    isRecording.value = false
    recordingPosition.value = undefined
    recordingStartPosition.value = null
    recordingDuration.value = 0
    return
  }

  try {
    const audioBlob = await simpleRecorder.stop()
    const extension = audioBlob.type === 'audio/wav' ? 'wav' : 'webm'

    const nodeId = `node-${Date.now()}`
    const audioPath = `audio/${nodeId}.${extension}`

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const projectDir = `${appDataPath}/projects/${project.id}`
    await window.electronAPI.mkdir(`${projectDir}/audio`)

    const arrayBuffer = await audioBlob.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)

    const startX = recordingStartPosition.value?.x || 100
    const startY = recordingStartPosition.value?.y || 100

    const node: CanvasNode = {
      id: nodeId,
      type: 'voice-note',
      position: { x: startX, y: startY },
      audioPath,
      transcript: null,
      transcriptStatus: 'pending',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: false,
      createdAt: Date.now(),
      duration: recordingDuration.value
    }

    projectStore.addNode(node)
    isRecording.value = false
    recordingPosition.value = undefined
    recordingStartPosition.value = null

    handleTranscription(node)
  } catch (error) {
    console.error('Recording failed:', error)
    isRecording.value = false
    recordingPosition.value = undefined
    recordingStartPosition.value = null
  }
}

function handleCanvasClick(x: number, y: number) {
  deactivateNode()
}

function handleDblClick(x: number, y: number) {
  const node: CanvasNode = {
    id: `node-${Date.now()}`,
    type: 'text-note',
    position: { x: x, y },
    transcript: '',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: false,
    createdAt: Date.now()
  }

  projectStore.addNode(node)
  editingNodeId.value = node.id
  editingText.value = ''
}

function cancelTextEdit() {
  if (editingNodeId.value) {
    const node = projectStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
    if (node && !node.transcript) {
      projectStore.removeNode(editingNodeId.value)
    }
    editingNodeId.value = null
    editingText.value = ''
  }
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    projectStore.updateNode(nodeId, { transcript: text.trim() })
    if (props.aiAnswerEnabled) {
      handleAgentResponse(nodeId, text.trim())
    }
  } else {
    projectStore.removeNode(nodeId)
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleCancelEdit(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    projectStore.removeNode(nodeId)
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleClickOutsideEditing(e: MouseEvent) {
  if (!editingNodeId.value) return

  const target = e.target as HTMLElement

  if (target.closest('.content-edit') || target.closest('.voice-note')) {
    return
  }

  const node = projectStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      projectStore.updateNode(editingNodeId.value, { transcript: editingText.value.trim() })
      if (props.aiAnswerEnabled) {
        handleAgentResponse(editingNodeId.value, editingText.value.trim())
      }
    } else {
      projectStore.removeNode(editingNodeId.value)
    }
  }
  editingNodeId.value = null
  editingText.value = ''
}

async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }

  if (!settings.stt.sherpaOnnx) {
    projectStore.updateNode(node.id, {
      transcript: '语音识别配置错误，请检查设置',
      transcriptStatus: 'error'
    })
    return
  }

  try {
    projectStore.updateNode(node.id, { transcriptStatus: 'processing' })

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project || !node.audioPath) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const extension = node.audioPath.split('.').pop()?.toLowerCase()
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/webm'

      const blob = new Blob([result.data], { type: mimeType })
      const transcriptResult = await transcribeWithSherpaOnnx(blob, settings.stt.sherpaOnnx)

      if (transcriptResult.success && transcriptResult.text) {
        const title = transcriptResult.text.slice(0, 10)
        projectStore.updateNode(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done',
          title
        })

        if (props.aiAnswerEnabled) {
          handleAgentResponse(node.id, transcriptResult.text)
        }
      } else {
        throw new Error(transcriptResult.error || '转写失败')
      }
    }
  } catch (error) {
    projectStore.updateNode(node.id, {
      transcript: String(error),
      transcriptStatus: 'error'
    })
  }
}

async function handleAgentResponse(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
    if (!node) return

    const selectedNodes = projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

    const staticContextContent = props.staticContextFiles
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '' })),
      transcript,
      staticContextContent,
      props.dynamicContextFile?.content
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
      }, true)
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

function handleDeleteNode(nodeId: string) {
  projectStore.removeNode(nodeId)
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
    const project = projectStore.currentProject
    if (!project) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')
    if (!result.success || !result.data) return

    const blob = new Blob([result.data], { type: 'audio/webm' })
    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)

    audio.onended = () => {
      playingNodeId.value = null
      currentAudio.value = null
      URL.revokeObjectURL(audioUrl)
    }

    audio.onerror = () => {
      playingNodeId.value = null
      currentAudio.value = null
      URL.revokeObjectURL(audioUrl)
    }

    currentAudio.value = audio
    playingNodeId.value = nodeId

    audio.play().catch(err => {
      console.error('播放失败:', err)
      playingNodeId.value = null
      currentAudio.value = null
      URL.revokeObjectURL(audioUrl)
    })
  } catch (error) {
    console.error('加载音频失败:', error)
    playingNodeId.value = null
  }
}

function handleToggleContext(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcriptStatus === 'done') {
    projectStore.updateNode(nodeId, {
      selectedAsContext: !node.selectedAsContext
    })
  }
}

function clearContextSelection() {
  if (!projectStore.currentProject || !projectStore.currentCanvas) return

  for (const node of projectStore.currentCanvas.nodes) {
    node.selectedAsContext = false
  }
  projectStore.saveProject(projectStore.currentProject)
}

function handleRetryTranscription(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    handleTranscription(node)
  }
}

function handleRetryAgent(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleRegenerateAgent(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleToggleFavorite(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.updateNode(nodeId, {
      isFavorite: !node.isFavorite
    })
  }
}

async function handleAutoLayout() {
  const nodes = projectStore.currentCanvas?.nodes
  if (!nodes || nodes.length === 0) return

  const layoutNodes = nodes.filter(n => n.type === 'voice-note' || n.type === 'text-note')
  if (layoutNodes.length === 0) return

  const sortedNodes = [...layoutNodes].sort((a, b) => a.createdAt - b.createdAt)

  const COLUMN_COUNT = 3
  const NODE_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--node-width'))
  const COLUMN_GAP = 5
  const ROW_GAP = 5
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

function handleActivateNode(nodeId: string) {
  activeNodeId.value = nodeId
}

function deactivateNode() {
  activeNodeId.value = null
}

function handleDragStart(nodeId: string, offsetX: number, offsetY: number) {
  draggingNodeId.value = nodeId
  dragOffset.value = { offsetX, offsetY }
  isDraggingNode.value = true
}

function handleNodeDragMove(e: MouseEvent) {
  if (!isDraggingNode.value || !draggingNodeId.value) return

  const canvas = document.querySelector('.infinite-canvas') as HTMLElement
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const canvasX = (e.clientX - rect.left - dragOffset.value.offsetX - viewport.value.x) / viewport.value.zoom
  const canvasY = (e.clientY - rect.top - dragOffset.value.offsetY - viewport.value.y) / viewport.value.zoom

  projectStore.updateNode(draggingNodeId.value, {
    position: { x: canvasX, y: canvasY }
  })
}

function handleNodeDragEnd() {
  isDraggingNode.value = false
  draggingNodeId.value = null
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  projectStore.updateNode(nodeId, updates)
}

async function handleDropText(x: number, y: number, text: string) {
  const node: CanvasNode = {
    id: `node-${Date.now()}`,
    type: 'text-note',
    position: { x, y },
    transcript: text,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: false,
    createdAt: Date.now()
  }

  projectStore.addNode(node)

  if (props.aiAnswerEnabled) {
    await handleAgentResponse(node.id, text)
  }
}

async function handleAskWithNewRecording() {
  try {
    await simpleRecorder.start()

    isRecording.value = true
    recordingPosition.value = { x: 100, y: 100 }
    recordingDuration.value = 0

    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)

    setTimeout(async () => {
      const audioBlob = await simpleRecorder.stop()
      const extension = audioBlob.type === 'audio/wav' ? 'wav' : 'webm'

      const nodeId = `node-${Date.now()}`
      const audioPath = `audio/${nodeId}.${extension}`

      const appDataPath = await window.electronAPI.getAppPath('userData')
      const project = projectStore.currentProject
      if (!project) return

      const projectDir = `${appDataPath}/projects/${project.id}`
      await window.electronAPI.mkdir(`${projectDir}/audio`)

      const arrayBuffer = await audioBlob.arrayBuffer()
      await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)

      const node: CanvasNode = {
        id: nodeId,
        type: 'voice-note',
        position: { x: 100, y: 100 },
        audioPath,
        transcript: null,
        transcriptStatus: 'pending',
        agentResult: null,
        agentStatus: 'pending',
        selectedAsContext: false,
        createdAt: Date.now(),
        duration: recordingDuration.value
      }

      projectStore.addNode(node)
      isRecording.value = false
      recordingPosition.value = undefined

      handleTranscription(node)
    }, 3000)
  } catch (error) {
    console.error('Recording failed:', error)
    isRecording.value = false
    recordingPosition.value = undefined
  }
}

// 设置激活节点
function setActiveNodeId(nodeId: string | null) {
  activeNodeId.value = nodeId
}

// 暴露方法给父组件
defineExpose({
  handleResetViewport,
  handleAutoLayout,
  initViewport,
  cancelTextEdit,
  activeNodeId,
  setActiveNodeId
})
</script>

<style scoped>
.canvas-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>