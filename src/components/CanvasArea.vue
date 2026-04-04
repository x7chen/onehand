<template>
  <div class="canvas-area">
    <InfiniteCanvas
      ref="infiniteCanvasRef"
      :viewport="viewport"
      :is-recording="isRecording"
      :recording-position="recordingPosition"
      :recording-duration="recordingDuration"
      :has-prev-page="notebookStore.hasPrevPage"
      :has-next-page="notebookStore.hasNextPage"
      :is-current-canvas-empty="notebookStore.isCurrentCanvasEmpty"
      :current-page-number="notebookStore.currentPageNumber"
      :total-pages="notebookStore.totalPages"
      @viewport-change="handleViewportChange"
      @long-press="handleLongPress"
      @long-press-end="handleLongPressEnd($event)"
      @click="handleCanvasClick"
      @dbl-click="handleDblClick"
      @drop-text="handleDropText"
      @drop-image="handleDropImage"
      @prev-page="handlePrevPage"
      @next-page="handleNextPage"
    >
      <template #nodes>
        <VoiceNote
          v-for="node in notebookStore.currentCanvas?.nodes"
          :key="node.id"
          :ref="(el) => { if (el) voiceNoteRefs[node.id] = el }"
          :node="node"
          :notebook-id="notebookStore.currentNotebook?.id"
          :canvas-id="notebookStore.currentCanvas?.id"
          :is-playing="playingNodeId === node.id"
          :is-editing="editingNodeId === node.id"
          :editing-text="editingText"
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
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
          @update:editing-text="editingText = $event"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import InfiniteCanvas from '@/components/InfiniteCanvas.vue'
import VoiceNote from '@/components/VoiceNote.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import type { CanvasNode, Viewport } from '@/types/notebook'
import type { ContextFile } from '@/types/context'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import { extractImagePaths, loadEmbeddedImagesForTranscript, loadImageBase64 } from '@/utils/contextBuilder'

const props = defineProps<{
  globalHideAiResult: boolean
  aiAnswerEnabled: boolean
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile
  notebookModelId?: string
}>()

const emit = defineEmits<{
  'reset-viewport': []
  'auto-layout': []
  'prev-page': []
  'next-page': []
}>()

const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

// 录音实例
const simpleRecorder = createAudioWorkletRecorder()

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

  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === newNodeId)
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

// 文本框编辑相关
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

const selectedContextCount = computed(() =>
  notebookStore.currentCanvas?.nodes.filter(n => n.selectedAsContext).length || 0
)

// 初始化 viewport
function initViewport() {
  viewport.value = notebookStore.getCurrentViewport()
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
  notebookStore.updateCurrentViewport(newViewport)
}

function handleResetViewport() {
  const resetViewport: Viewport = { x: 0, y: 0, zoom: 1 }
  viewport.value = resetViewport
  notebookStore.updateCurrentViewport(resetViewport)
}

function handlePrevPage() {
  cancelTextEdit()
  notebookStore.goToPrevPage()
  viewport.value = notebookStore.getCurrentViewport()
  // 切换后选中第一个节点
  selectFirstNode()
  emit('prev-page')
}

function handleNextPage() {
  cancelTextEdit()
  if (notebookStore.hasNextPage) {
    notebookStore.goToNextPage()
    viewport.value = notebookStore.getCurrentViewport()
  } else {
    const success = notebookStore.addNewPage()
    if (success) {
      viewport.value = notebookStore.getCurrentViewport()
    }
  }
  // 切换后选中第一个节点
  selectFirstNode()
  emit('next-page')
}

// 选中当前画布的第一个节点
function selectFirstNode() {
  nextTick(() => {
    const nodes = notebookStore.currentCanvas?.nodes || []
    if (nodes.length > 0) {
      // 按创建时间排序，选中最早的节点
      const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
      activeNodeId.value = sortedNodes[0].id
    } else {
      activeNodeId.value = null
    }
  })
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
    const notebook = notebookStore.currentNotebook
    if (!notebook) return

    const notebookDir = `${appDataPath}/notebooks/${notebook.id}`
    await window.electronAPI.mkdir(`${notebookDir}/audio`)

    const arrayBuffer = await audioBlob.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${notebookDir}/${audioPath}`, arrayBuffer)

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

  notebookStore.addNode(node)
  editingNodeId.value = node.id
  editingText.value = ''
}

function cancelTextEdit() {
  if (editingNodeId.value) {
    const node = notebookStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
    if (node && !node.transcript) {
      notebookStore.removeNode(editingNodeId.value)
    }
    editingNodeId.value = null
    editingText.value = ''
  }
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    notebookStore.updateNode(nodeId, { transcript: text.trim() })
    if (props.aiAnswerEnabled) {
      handleAgentResponse(nodeId, text.trim())
    }
  } else {
    notebookStore.removeNode(nodeId)
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleCancelEdit(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    notebookStore.removeNode(nodeId)
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

  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      notebookStore.updateNode(editingNodeId.value, { transcript: editingText.value.trim() })
      if (props.aiAnswerEnabled) {
        handleAgentResponse(editingNodeId.value, editingText.value.trim())
      }
    } else {
      notebookStore.removeNode(editingNodeId.value)
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
    notebookStore.updateNode(node.id, {
      transcript: t('canvas.sttConfigError'),
      transcriptStatus: 'error'
    })
    return
  }

  try {
    notebookStore.updateNode(node.id, { transcriptStatus: 'processing' })

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const notebook = notebookStore.currentNotebook
    if (!notebook || !node.audioPath) return

    const audioPath = `${appDataPath}/notebooks/${notebook.id}/${node.audioPath}`
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

    const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
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

    const selectedNodes = notebookStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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
    if (!notebook) return

    const audioPath = `${appDataPath}/notebooks/${notebook.id}/${node.audioPath}`
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
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
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
  if (!notebookStore.currentNotebook || !notebookStore.currentCanvas) return

  for (const node of notebookStore.currentCanvas.nodes) {
    node.selectedAsContext = false
  }
  notebookStore.saveNotebook(notebookStore.currentNotebook)
}

function handleRetryTranscription(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    handleTranscription(node)
  }
}

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

function handleCopyLink(nodeId: string) {
  console.log('Link copied for node:', nodeId)
}

function handleToggleFavorite(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNode(nodeId, {
      isFavorite: !node.isFavorite
    })
  }
}

async function handleAutoLayout() {
  const nodes = notebookStore.currentCanvas?.nodes
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

    notebookStore.updateNode(node.id, { position: { x, y } })

    const nodeHeight = nodeHeights[node.id] || 200
    columnHeights[minColumn] = y + nodeHeight + ROW_GAP
  }

  if (notebookStore.currentNotebook) {
    notebookStore.saveNotebook(notebookStore.currentNotebook)
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

  notebookStore.updateNode(draggingNodeId.value, {
    position: { x: canvasX, y: canvasY }
  })
}

function handleNodeDragEnd() {
  isDraggingNode.value = false
  draggingNodeId.value = null
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  notebookStore.updateNode(nodeId, updates)
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

  notebookStore.addNode(node)

  if (props.aiAnswerEnabled) {
    await handleAgentResponse(node.id, text)
  }
}

async function handleDropImage(x: number, y: number, files: File[]) {
  const appDataPath = await window.electronAPI.getAppPath('userData')
  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const notebookDir = `${appDataPath}/notebooks/${notebook.id}`
  await window.electronAPI.mkdir(`${notebookDir}/images`)

  for (const file of files) {
    const nodeId = `node-${Date.now()}`
    const ext = file.name.split('.').pop() || 'png'
    const imagePath = `images/${nodeId}.${ext}`

    // 保存图片到笔记本目录
    const arrayBuffer = await file.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${notebookDir}/${imagePath}`, arrayBuffer)

    // 创建图片节点
    const node: CanvasNode = {
      id: nodeId,
      type: 'image-note',
      position: { x, y },
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

      const nodeId = `node-${Date.now()}`
      const audioPath = `audio/${nodeId}.${extension}`

      const appDataPath = await window.electronAPI.getAppPath('userData')
      const notebook = notebookStore.currentNotebook
      if (!notebook) return

      const notebookDir = `${appDataPath}/notebooks/${notebook.id}`
      await window.electronAPI.mkdir(`${notebookDir}/audio`)

      const arrayBuffer = await audioBlob.arrayBuffer()
      await window.electronAPI.saveFileBuffer(`${notebookDir}/${audioPath}`, arrayBuffer)

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