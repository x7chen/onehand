<template>
  <div class="canvas-area">
    <InfiniteCanvas
      ref="infiniteCanvasRef"
      :viewport="viewport"
      :is-recording="isRecording"
      :recording-position="recordingPosition"
      :recording-duration="recordingDuration"
      @viewport-change="handleViewportChange"
      @long-press="handleLongPress"
      @long-press-end="handleLongPressEnd($event)"
      @click="handleCanvasClick"
      @dbl-click="handleDblClick"
      @drop-text="handleDropText"
      @drop-image="handleDropImage"
    >
      <template #nodes>
        <VoiceNote
          v-for="node in visibleNodes"
          :key="node.id"
          :ref="(el) => { if (el) voiceNoteRefs[node.id] = el }"
          :node="node"
          :notebook-id="notebookStore.currentNotebook?.id"
          :is-playing="playingNodeId === node.id"
          :global-hide-ai-result="globalHideAiResult"
          :is-active="activeNodeId === node.id"
          :show-header="true"
          @delete="handleDeleteNode"
          @play="handlePlayNode"
          @toggle-context="handleToggleContext"
          @retry-transcription="handleRetryTranscription"
          @retry-agent="handleRetryAgent"
          @regenerate-agent="handleRegenerateAgent"
          @toggle-favorite="handleToggleFavorite"
          @drag-start="handleDragStart"
          @update-node="handleUpdateNode"
          @edit-transcript="handleEditTranscript"
          @edit-agent="handleEditAgent"
          @activate="handleActivateNode"
          @copy-link="handleCopyLink"
        />
      </template>
    </InfiniteCanvas>

    <ContextToolbar
      v-if="selectedContextCount > 0"
      :selected-count="selectedContextCount"
      @clear="clearContextSelection"
      @ask="handleAskWithNewRecording"
    />

    <!-- MagicInput 弹出框 -->
    <MagicInput
      :is-open="magicInputState.isOpen"
      :initial-text="magicInputInitialText"
      :show-correct="!!quickModelConfig"
      :node-id="magicInputState.nodeId"
      @save="handleMagicInputSave"
      @cancel="handleMagicInputCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import InfiniteCanvas from '@/components/InfiniteCanvas.vue'
import VoiceNote from '@/components/VoiceNote.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import MagicInput from '@/components/MagicInput.vue'
import type { CanvasNode, Viewport, DisplayNode } from '@/types/notebook'
import type { ContextFile } from '@/types/context'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import { extractImagePaths, loadEmbeddedImagesForTranscript, loadImageBase64 } from '@/utils/contextBuilder'
import { getNotebookAudioDir, getNotebookDataDir, getNotebookImagesDir } from '@/utils/userFilesPath'

const props = defineProps<{
  globalHideAiResult: boolean
  aiAnswerEnabled: boolean
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile
  notebookModelId?: string
  filterNodeIds?: Set<string>
}>()

const emit = defineEmits<{
  'reset-viewport': []
  'auto-layout': []
}>()

const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

// 录音实例
const simpleRecorder = createAudioWorkletRecorder()

// 布局参数
const LAYOUT_CONFIG = {
  DEFAULT_NODE_WIDTH: 450,
  DEFAULT_NODE_HEIGHT: 200,
  COLUMN_COUNT: 3,
  COLUMN_GAP: 5,
  ROW_GAP: 5,
  START_X: 100,
  START_Y: 100
}

// 计算节点布局位置
function calculateNodePositions(nodes: CanvasNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) return positions

  // 按创建时间升序排序
  const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)

  // 使用瀑布流布局算法
  const columnHeights: number[] = Array(LAYOUT_CONFIG.COLUMN_COUNT).fill(LAYOUT_CONFIG.START_Y)
  const nodeColumns: Record<string, number> = {}

  // 第一遍：确定每个节点所在的列
  for (const node of sortedNodes) {
    // 找最短列
    let minColumn = 0
    let minHeight = columnHeights[0]
    for (let col = 1; col < LAYOUT_CONFIG.COLUMN_COUNT; col++) {
      if (columnHeights[col] < minHeight) {
        minHeight = columnHeights[col]
        minColumn = col
      }
    }

    nodeColumns[node.id] = minColumn
    const nodeHeight = node.width ? Math.max(150, node.width * 0.4) : LAYOUT_CONFIG.DEFAULT_NODE_HEIGHT
    columnHeights[minColumn] = minHeight + nodeHeight + LAYOUT_CONFIG.ROW_GAP
  }

  // 计算每列的宽度
  const columnWidths: number[] = Array(LAYOUT_CONFIG.COLUMN_COUNT).fill(LAYOUT_CONFIG.DEFAULT_NODE_WIDTH)
  for (const node of sortedNodes) {
    const col = nodeColumns[node.id]
    const nodeWidth = node.width || LAYOUT_CONFIG.DEFAULT_NODE_WIDTH
    if (nodeWidth > columnWidths[col]) {
      columnWidths[col] = nodeWidth
    }
  }

  // 计算每列的起始 X 位置
  const columnStartX: number[] = [LAYOUT_CONFIG.START_X]
  for (let col = 1; col < LAYOUT_CONFIG.COLUMN_COUNT; col++) {
    columnStartX[col] = columnStartX[col - 1] + columnWidths[col - 1] + LAYOUT_CONFIG.COLUMN_GAP
  }

  // 第二遍：设置节点位置
  const columnY: number[] = Array(LAYOUT_CONFIG.COLUMN_COUNT).fill(LAYOUT_CONFIG.START_Y)
  for (const node of sortedNodes) {
    const col = nodeColumns[node.id]
    const x = columnStartX[col]
    const y = columnY[col]

    positions.set(node.id, { x, y })

    const nodeHeight = node.width ? Math.max(150, node.width * 0.4) : LAYOUT_CONFIG.DEFAULT_NODE_HEIGHT
    columnY[col] = y + nodeHeight + LAYOUT_CONFIG.ROW_GAP
  }

  return positions
}

// 过滤后的节点（如果 filterNodeIds 已设置则按其筛选，空 Set 表示无节点）
const filteredNodes = computed(() => {
  const allNodes = notebookStore.getAllNodes()
  // 如果 filterNodeIds 未定义，显示全部节点
  if (props.filterNodeIds === undefined) {
    return allNodes
  }
  // 如果 filterNodeIds 已定义（即使是空 Set），按其内容筛选
  return allNodes.filter(node => props.filterNodeIds!.has(node.id))
})

// 用户手动拖拽的位置覆盖（临时状态，不保存）
const manualPositions = ref<Map<string, { x: number; y: number }>>(new Map())

// 布局位置（响应式计算，优先使用手动位置）
const nodePositions = computed(() => {
  const basePositions = calculateNodePositions(filteredNodes.value)
  // 如果有手动位置，覆盖计算的位置
  for (const [nodeId, pos] of manualPositions.value) {
    basePositions.set(nodeId, pos)
  }
  return basePositions
})

// 显示节点（包含计算后的位置）
const displayNodes = computed<DisplayNode[]>(() => {
  return filteredNodes.value.map(node => ({
    ...node,
    displayPosition: nodePositions.value.get(node.id) || { x: 100, y: 100 }
  }))
})

// 画布尺寸（用于计算可见区域）
const canvasSize = ref({ width: 800, height: 600 })

// 当前激活的节点ID（需要在 visibleNodes 之前定义）
const activeNodeId = ref<string | null>(null)

// 可见节点（虚拟滚动：只渲染视口内的节点 + 激活的节点）
const visibleNodes = computed<DisplayNode[]>(() => {
  const nodes = displayNodes.value
  if (nodes.length === 0) return []

  const { width, height } = canvasSize.value
  const { x, y, zoom } = viewport.value

  // 计算视口在画布坐标系中的可见区域
  const visibleLeft = -x / zoom
  const visibleTop = -y / zoom
  const visibleRight = visibleLeft + width / zoom
  const visibleBottom = visibleTop + height / zoom

  // 扩展可见区域边界（预留一定缓冲区，避免节点刚进入视口时闪烁）
  const buffer = 100 / zoom
  const extendedLeft = visibleLeft - buffer
  const extendedTop = visibleTop - buffer
  const extendedRight = visibleRight + buffer
  const extendedBottom = visibleBottom + buffer

  // 节点默认尺寸
  const nodeWidth = 450
  const nodeHeight = 200

  return nodes.filter(node => {
    // 激活的节点始终显示
    if (node.id === activeNodeId.value) return true

    const pos = node.displayPosition
    const w = node.width || nodeWidth

    // 判断节点是否在可见区域内
    return pos.x + w >= extendedLeft &&
           pos.x <= extendedRight &&
           pos.y + nodeHeight >= extendedTop &&
           pos.y <= extendedBottom
  })
})

// 节点拖动相关
const isDraggingNode = ref(false)
const draggingNodeId = ref<string | null>(null)
const dragOffset = ref({ offsetX: 0, offsetY: 0 })

const viewport = ref<Viewport>({ x: 0, y: 0, zoom: 1 })
const isRecording = ref(false)
const recordingPosition = ref<{ x: number; y: number } | undefined>(undefined)
const recordingDuration = ref(0)
const recordingStartPosition = ref<{ x: number; y: number } | null>(null)
let recordingTimer: number | null = null

// 获取当前笔记本使用的模型配置
const currentModelConfig = computed(() => {
  const modelId = props.notebookModelId || settingsStore.settings.llm.activeProfileId
  return settingsStore.settings.llm.profiles.find(p => p.id === modelId)
})

// 快速模型配置（用于纠正文本）
const quickModelConfig = computed(() => {
  const quickModelId = settingsStore.settings.llm.quickModelProfileId
  if (!quickModelId) return null
  return settingsStore.settings.llm.profiles.find(p => p.id === quickModelId)
})

// MagicInput 初始文本
const magicInputInitialText = computed(() => {
  if (!magicInputState.value.nodeId) return ''
  const node = notebookStore.getAllNodes().find(n => n.id === magicInputState.value.nodeId)
  if (!node) return ''
  if (magicInputState.value.mode === 'transcript') {
    return node.transcript || ''
  } else if (magicInputState.value.mode === 'agent') {
    return node.agentResult || ''
  }
  return ''
})

// VoiceNote组件引用
const voiceNoteRefs = ref<Record<string, any>>({})

// InfiniteCanvas组件引用
const infiniteCanvasRef = ref<InstanceType<typeof InfiniteCanvas> | null>(null)

// 拖拽处理函数
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

  // 更新临时位置
  manualPositions.value.set(draggingNodeId.value, { x: canvasX, y: canvasY })
}

function handleNodeDragEnd() {
  isDraggingNode.value = false
  draggingNodeId.value = null
}

// MagicInput 状态
interface MagicInputState {
  isOpen: boolean
  mode: 'create' | 'transcript' | 'agent'
  nodeId?: string
  position?: { x: number; y: number }
}

const magicInputState = ref<MagicInputState>({
  isOpen: false,
  mode: 'create'
})

// 监听激活节点变化，移动画布视口到节点位置
watch(activeNodeId, (newNodeId) => {
  if (!newNodeId) return

  const node = displayNodes.value.find(n => n.id === newNodeId)
  if (!node) return

  nextTick(() => {
    if (!infiniteCanvasRef.value) return

    const canvasEl = infiniteCanvasRef.value.canvasRef
    if (!canvasEl) return

    const rect = canvasEl.getBoundingClientRect()
    const zoom = viewport.value.zoom

    // 节点尺寸（使用节点的自定义宽度或默认值）
    const nodeWidth = node.width || 450

    // 节点在屏幕上的位置
    const nodeScreenLeft = node.displayPosition.x * zoom + viewport.value.x
    const nodeScreenRight = nodeScreenLeft + nodeWidth * zoom

    // 计算目标X：只调整到让节点完全可见，不居中
    let targetX = viewport.value.x
    const padding = 20 // 边距

    if (nodeScreenLeft < padding) {
      // 节点左边超出，向右移动
      targetX = padding - node.displayPosition.x * zoom
    } else if (nodeScreenRight > rect.width - padding) {
      // 节点右边超出，向左移动
      targetX = rect.width - padding - (node.displayPosition.x + nodeWidth) * zoom
    }

    // 计算目标Y：节点标题栏在可视区域从上开始8分之一位置
    const targetY = rect.height / 8 - node.displayPosition.y * zoom

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
    notebookStore.updateCurrentViewport(newViewport)

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

// 音频播放相关
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

const selectedContextCount = computed(() =>
  notebookStore.getAllNodes().filter(n => n.selectedAsContext).length
)

// ResizeObserver 引用
let resizeObserver: ResizeObserver | null = null

// 初始化 viewport
function initViewport() {
  viewport.value = notebookStore.getCurrentViewport()
}

// 更新画布尺寸
function updateCanvasSize() {
  if (infiniteCanvasRef.value?.canvasRef) {
    const rect = infiniteCanvasRef.value.canvasRef.getBoundingClientRect()
    canvasSize.value = { width: rect.width, height: rect.height }
  }
}

onMounted(() => {
  initViewport()
  window.addEventListener('mousemove', handleNodeDragMove)
  window.addEventListener('mouseup', handleNodeDragEnd)

  // 监听画布尺寸变化
  nextTick(() => {
    updateCanvasSize()
    if (infiniteCanvasRef.value?.canvasRef) {
      resizeObserver = new ResizeObserver(() => {
        updateCanvasSize()
      })
      resizeObserver.observe(infiniteCanvasRef.value.canvasRef)
    }
  })
})

onUnmounted(() => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  window.removeEventListener('mousemove', handleNodeDragMove)
  window.removeEventListener('mouseup', handleNodeDragEnd)
  // 清除临时拖拽位置
  manualPositions.value.clear()
  // 清除 ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

function handleViewportChange(newViewport: Viewport) {
  viewport.value = newViewport
  notebookStore.updateCurrentViewport(newViewport)
}

function handleResetViewport() {
  const resetViewport: Viewport = { x: 0, y: 0, zoom: 1 }
  viewport.value = resetViewport
  notebookStore.updateCurrentViewport(resetViewport)
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

    const nodeId = uuidv4()
    const audioPath = `audio/${nodeId}.${extension}`

    const notebook = notebookStore.currentNotebook
    if (!notebook) return

    const audioDir = await getNotebookAudioDir(notebook.id)
    await window.electronAPI.mkdir(audioDir)

    const arrayBuffer = await audioBlob.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${audioDir}/${nodeId}.${extension}`, arrayBuffer)

    const node: CanvasNode = {
      id: nodeId,
      type: 'voice-note',
      audioPath,
      transcript: null,
      transcriptStatus: 'pending',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: false,
      createdAt: Date.now(),
      duration: recordingDuration.value
    }

    notebookStore.addNode(node)
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
  magicInputState.value = {
    isOpen: true,
    mode: 'create',
    position: { x, y }
  }
}

async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }

  if (!settings.stt.sherpaOnnx) {
    notebookStore.updateNode(node.id, {
      transcript: t('canvas.sttConfigError'),
      transcriptStatus: 'error'
    })
    return
  }

  try {
    notebookStore.updateNode(node.id, { transcriptStatus: 'processing' })

    const notebook = notebookStore.currentNotebook
    if (!notebook || !node.audioPath) return

    const notebookDir = await getNotebookDataDir(notebook.id)
    const audioPath = `${notebookDir}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const extension = node.audioPath.split('.').pop()?.toLowerCase()
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/webm'

      const blob = new Blob([result.data], { type: mimeType })
      const transcriptResult = await transcribeWithSherpaOnnx(blob, settings.stt.sherpaOnnx)

      if (transcriptResult.success && transcriptResult.text) {
        const title = transcriptResult.text.slice(0, 10)
        notebookStore.updateNode(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done',
          title
        })

        if (props.aiAnswerEnabled) {
          handleAgentResponse(node.id, transcriptResult.text)
        }
      } else {
        throw new Error(transcriptResult.error || t('canvas.transcribeFailed'))
      }
    }
  } catch (error) {
    notebookStore.updateNode(node.id, {
      transcript: String(error),
      transcriptStatus: 'error'
    })
  }
}

async function handleAgentResponse(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    notebookStore.updateNode(nodeId, { agentStatus: 'processing', thinkingStatus: 'pending' })

    const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
    if (!node) return

    // 加载当前节点的内嵌图片（如果尚未加载）
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

    const selectedNodes = notebookStore.getAllNodes().filter(n => n.selectedAsContext && n.id !== nodeId)

    const staticContextContent = props.staticContextFiles
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '', imageBase64: n.imageBase64, embeddedImages: n.embeddedImages })),
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
        agentResult: t('canvas.llmConfigError'),
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
      }, true)
    }, (thinkingChunk) => {
      accumulatedThinking += thinkingChunk
      notebookStore.updateNode(nodeId, {
        thinkingContent: accumulatedThinking,
        thinkingStatus: 'processing'
      }, true)
    })

    notebookStore.updateNode(nodeId, {
      agentResult: result.content,
      agentStatus: 'done',
      thinkingContent: result.thinking || accumulatedThinking || undefined,
      thinkingStatus: result.thinking || accumulatedThinking ? 'done' : undefined
    })
  } catch (error) {
    notebookStore.updateNode(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

function handleDeleteNode(nodeId: string) {
  notebookStore.removeNode(nodeId)
}

async function handlePlayNode(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
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
    const notebook = notebookStore.currentNotebook
    if (!notebook) return

    const notebookDir = await getNotebookDataDir(notebook.id)
    const audioPath = `${notebookDir}/${node.audioPath}`
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

async function handleToggleContext(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
  if (node && node.transcriptStatus === 'done') {
    const newSelectedState = !node.selectedAsContext
    notebookStore.updateNode(nodeId, {
      selectedAsContext: newSelectedState
    })

    const notebook = notebookStore.currentNotebook
    if (!notebook) return

    // 如果是图片节点且被勾选，加载base64
    if (newSelectedState && node.type === 'image-note' && node.imagePath && !node.imageBase64) {
      const base64 = await loadImageBase64(node.imagePath, notebook.id, window.electronAPI.readFile)
      if (base64) {
        notebookStore.updateNode(nodeId, { imageBase64: base64 })
      }
    }

    // 如果是文本节点且被勾选，加载内嵌图片的base64
    if (newSelectedState && (node.type === 'voice-note' || node.type === 'text-note') && node.transcript) {
      const embeddedImages = await loadEmbeddedImagesForTranscript(node.transcript, notebook.id, window.electronAPI.readFile)
      if (embeddedImages && embeddedImages.length > 0) {
        notebookStore.updateNode(nodeId, { embeddedImages })
      }
    }
  }
}

function clearContextSelection() {
  if (!notebookStore.currentNotebook) return

  for (const node of notebookStore.getAllNodes()) {
    notebookStore.updateNode(node.id, { selectedAsContext: false }, true)
  }
  notebookStore.saveNotebook(notebookStore.currentNotebook)
}

function handleRetryTranscription(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
  if (node) {
    handleTranscription(node)
  }
}

function handleRetryAgent(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleRegenerateAgent(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleCopyLink(nodeId: string) {
  console.log('Link copied for node:', nodeId)
}

function handleToggleFavorite(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNode(nodeId, {
      isFavorite: !node.isFavorite
    })
  }
}

async function handleAutoLayout() {
  // 清除手动拖拽的位置
  manualPositions.value.clear()
  // 增加布局版本号，触发重新布局
  layoutVersion.value++
  // 重置视口到布局起始位置
  const resetViewport: Viewport = { x: 0, y: 0, zoom: 1 }
  viewport.value = resetViewport
  notebookStore.updateCurrentViewport(resetViewport)
}

function handleActivateNode(nodeId: string) {
  activeNodeId.value = nodeId
}

function deactivateNode() {
  activeNodeId.value = null
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  notebookStore.updateNode(nodeId, updates)
}

// 编辑转写内容
function handleEditTranscript(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
  if (node) {
    magicInputState.value = {
      isOpen: true,
      mode: 'transcript',
      nodeId
    }
  }
}

// 编辑AI回答
function handleEditAgent(nodeId: string) {
  const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
  if (node) {
    magicInputState.value = {
      isOpen: true,
      mode: 'agent',
      nodeId
    }
  }
}

// MagicInput 保存
function handleMagicInputSave(text: string) {
  const state = magicInputState.value

  if (state.mode === 'create') {
    // 创建新节点
    const node: CanvasNode = {
      id: uuidv4(),
      type: 'text-note',
      transcript: text,
      transcriptStatus: 'done',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: false,
      createdAt: Date.now()
    }
    notebookStore.addNode(node)

    if (props.aiAnswerEnabled) {
      handleAgentResponse(node.id, text)
    }
  } else if (state.mode === 'transcript' && state.nodeId) {
    // 更新转写内容
    notebookStore.updateNode(state.nodeId, { transcript: text })
  } else if (state.mode === 'agent' && state.nodeId) {
    // 更新AI回答
    notebookStore.updateNode(state.nodeId, { agentResult: text, agentStatus: 'done' })
  }

  // 关闭弹出框
  magicInputState.value = { isOpen: false, mode: 'create' }
}

// MagicInput 取消
function handleMagicInputCancel() {
  magicInputState.value = { isOpen: false, mode: 'create' }
}

async function handleDropText(x: number, y: number, text: string) {
  const node: CanvasNode = {
    id: uuidv4(),
    type: 'text-note',
    transcript: text,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: false,
    createdAt: Date.now()
  }

  notebookStore.addNode(node)

  if (props.aiAnswerEnabled) {
    await handleAgentResponse(node.id, text)
  }
}

async function handleDropImage(x: number, y: number, files: File[]) {
  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const imagesDir = await getNotebookImagesDir(notebook.id)
  await window.electronAPI.mkdir(imagesDir)

  for (const file of files) {
    const nodeId = uuidv4()
    const ext = file.name.split('.').pop() || 'png'
    const imagePath = `images/${nodeId}.${ext}`

    // 保存图片到笔记本目录
    const arrayBuffer = await file.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${imagesDir}/${nodeId}.${ext}`, arrayBuffer)

    // 创建图片节点
    const node: CanvasNode = {
      id: nodeId,
      type: 'image-note',
      imagePath,
      transcript: `![${file.name}](${imagePath})`,
      transcriptStatus: 'done',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: false,
      createdAt: Date.now()
    }

    notebookStore.addNode(node)
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

      const nodeId = uuidv4()
      const audioPath = `audio/${nodeId}.${extension}`

      const notebook = notebookStore.currentNotebook
      if (!notebook) return

      const audioDir = await getNotebookAudioDir(notebook.id)
      await window.electronAPI.mkdir(audioDir)

      const arrayBuffer = await audioBlob.arrayBuffer()
      await window.electronAPI.saveFileBuffer(`${audioDir}/${nodeId}.${extension}`, arrayBuffer)

      const node: CanvasNode = {
        id: nodeId,
        type: 'voice-note',
        audioPath,
        transcript: null,
        transcriptStatus: 'pending',
        agentResult: null,
        agentStatus: 'pending',
        selectedAsContext: false,
        createdAt: Date.now(),
        duration: recordingDuration.value
      }

      notebookStore.addNode(node)
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