<template>
  <div
    class="chat-panel"
    :class="{ 'is-active': props.isActive }"
  >
    <!-- 笔记详情区域 -->
    <div
      ref="nodeDetailContainerRef"
      class="node-detail-container"
      @scroll="handleNodeDetailScroll"
      @wheel="handleUserWheel"
      @mousedown="handleMouseDown"
      @click="handleContentClick"
    >
      <div v-if="activeNode" class="node-detail">
        <VoiceNote
          :node="activeNode"
          :notebook-id="effectiveNotebookId"
          :is-active="true"
          :global-hide-ai-result="false"
          :show-header="true"
          @delete="$emit('delete', $event)"
          @play="$emit('play', $event)"
          @toggle-context="$emit('toggle-context', $event)"
          @retry-transcription="$emit('retry-transcription', $event)"
          @retry-agent="handleRetryAgent"
          @regenerate-agent="handleRegenerateAgent"
          @toggle-favorite="$emit('toggle-favorite', $event)"
          @update-node="(nodeId, updates) => $emit('update-node', nodeId, updates)"
          @edit-transcript="handleEditTranscript"
          @edit-agent="handleEditAgent"
          @activate="() => {}"
          @copy-link="handleCopyLink"
        />
      </div>
      <div v-else class="empty-node" @click="handleEmptyClick">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <p>{{ t('canvas.clickToView') }}</p>
      </div>
    </div>

    <!-- MagicPad 区域 -->
    <div class="magic-pad-container" :style="{ height: magicPadHeight + 'px' }">
      <!-- 调整高度手柄 -->
      <div
        class="resize-handle"
        @mousedown="startResizeMagicPad"
      ></div>

      <!-- magicpad 主体 -->
      <div
        class="magic-pad"
        @click="handleMagicPadClick"
        @dblclick="handleMagicPadDblClick"
        @mousedown="handleMagicPadMouseDown"
        @mouseup="handleMagicPadMouseUp"
        @mouseleave="handleMagicPadMouseLeave"
        @dragover.prevent
        @drop="handleMagicPadDrop"
      >
        <!-- 虚线提示框（正常模式） -->
        <div v-if="!isInputMode" class="magic-pad-hint">
          <span class="magic-pad-hint-text">{{ t('canvas.magicPadHint') }}</span>
        </div>

        <!-- 输入模式 - 使用 MagicInputCore -->
        <div v-else class="magic-pad-input-mode">
          <MagicInputCore
            ref="magicInputCoreRef"
            v-model="inputText"
            :show-correct="!!quickModelConfig"
            :show-cancel="true"
            :send-mode="true"
            @send="handleSendInput"
            @cancel="handleCancelInput"
          />
        </div>
      </div>
    </div>

    <!-- 录音指示器 -->
    <RecordingIndicator
      v-if="isRecording"
      :x="recordingPosition.x"
      :y="recordingPosition.y"
      :duration="recordingDuration"
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { v4 as uuidv4 } from 'uuid'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import VoiceNote from '@/components/VoiceNote.vue'
import RecordingIndicator from '@/components/RecordingIndicator.vue'
import MagicInput from '@/components/MagicInput.vue'
import MagicInputCore from '@/components/MagicInputCore.vue'
import { chatWithLLM, buildFullContextMessages, buildImageAnalysisMessages } from '@/composables/useQwenAgent'
import { loadEmbeddedImagesForTranscript } from '@/utils/contextBuilder'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { getNotebookAudioDir, getNotebookImagesDir, getNotebookDataDir, getPdfDir } from '@/utils/userFilesPath'
import type { CanvasNode } from '@/types/notebook'
import type { ContextFile } from '@/types/context'

const props = defineProps<{
  activeNode: CanvasNode | null
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile | null
  aiAnswerEnabled: boolean
  autoSelectNewNote?: boolean
  currentPage?: number
  includedPageImage?: { imageBase64: string; pageNumber: number } | null
  isActive?: boolean
  panelId?: 'left' | 'right'
  targetNotebookId?: string | null
}>()

const emit = defineEmits<{
  'delete': [nodeId: string]
  'play': [nodeId: string]
  'toggle-context': [nodeId: string]
  'retry-transcription': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'update-node': [nodeId: string, updates: Partial<CanvasNode>]
  'node-created': [node: CanvasNode]
  'node-updated': [node: CanvasNode]
  'start-editing': [nodeId: string]
  'activate': [panelId: 'left' | 'right']
}>()

// 处理内容区域点击激活
function handleContentClick(e: MouseEvent) {
  // 如果点击的是交互元素，不触发激活
  const target = e.target as HTMLElement
  if (target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('a') || target.closest('.content-edit')) {
    return
  }
  if (props.panelId) {
    emit('activate', props.panelId)
  }
}

// 处理空节点区域点击激活
function handleEmptyClick() {
  if (props.panelId) {
    emit('activate', props.panelId)
  }
}

// 处理 MagicPad 区域点击激活
function handleMagicPadClick(e: MouseEvent) {
  // 如果是双击或长按触发的操作，不触发激活
  if (e.detail > 1) return
  if (props.panelId) {
    emit('activate', props.panelId)
  }
}

const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const quickCommandStore = useQuickCommandStore()
const { t } = useI18n()

// 加载快捷指令
onMounted(() => {
  quickCommandStore.loadQuickCommands()
})

onUnmounted(() => {
  // 清理调整高度事件监听器
  if (isResizingMagicPad) {
    document.removeEventListener('mousemove', handleResizeMagicPadMove)
    document.removeEventListener('mouseup', handleResizeMagicPadEnd)
  }
})

// Get notebookId - use targetNotebookId prop if provided, otherwise use currentNotebook
// For all notebooks view, targetNotebookId is null, so we use default notebook from settings
const effectiveNotebookId = computed(() => {
  if (props.targetNotebookId) {
    return props.targetNotebookId
  }
  // If targetNotebookId is null (all notebooks view), use default notebook from settings
  const defaultNotebookId = settingsStore.settings.general.defaultNotebookId
  if (defaultNotebookId) {
    return defaultNotebookId
  }
  // Fallback to current notebook
  return notebookStore.currentNotebook?.id
})

// Get the effective notebook object
const effectiveNotebook = computed(() => {
  const id = effectiveNotebookId.value
  if (!id) return null
  return notebookStore.notebooks.find(nb => nb.id === id) || null
})

// 获取当前笔记本使用的模型配置
const currentModelConfig = computed(() => {
  const modelId = effectiveNotebook.value?.modelId || settingsStore.settings.llm.activeProfileId
  return settingsStore.settings.llm.profiles.find(p => p.id === modelId)
})

// MagicPad 相关
const magicPadRef = ref<HTMLElement | null>(null)
let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

// 输入模式相关（根据设置初始化）
const isInputMode = ref(settingsStore.settings.general.magicPadDefaultMode === 'edit')
const inputText = ref('')
const magicInputCoreRef = ref<InstanceType<typeof MagicInputCore> | null>(null)

// MagicPad 高度调整
const magicPadHeight = ref(120)
const MIN_MAGIC_PAD_HEIGHT = 80
const MAX_MAGIC_PAD_HEIGHT = 400
let isResizingMagicPad = false
let resizeStartY = 0
let resizeStartHeight = 0

function startResizeMagicPad(e: MouseEvent) {
  e.preventDefault()
  isResizingMagicPad = true
  resizeStartY = e.clientY
  resizeStartHeight = magicPadHeight.value

  document.addEventListener('mousemove', handleResizeMagicPadMove)
  document.addEventListener('mouseup', handleResizeMagicPadEnd)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

function handleResizeMagicPadMove(e: MouseEvent) {
  if (!isResizingMagicPad) return

  const deltaY = resizeStartY - e.clientY // 向上拖动增加高度
  const newHeight = Math.max(MIN_MAGIC_PAD_HEIGHT, Math.min(MAX_MAGIC_PAD_HEIGHT, resizeStartHeight + deltaY))
  magicPadHeight.value = newHeight
}

function handleResizeMagicPadEnd() {
  if (!isResizingMagicPad) return

  isResizingMagicPad = false
  document.removeEventListener('mousemove', handleResizeMagicPadMove)
  document.removeEventListener('mouseup', handleResizeMagicPadEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 节点详情区域滚动相关
const nodeDetailContainerRef = ref<HTMLElement | null>(null)
const shouldAutoScroll = ref(true)
let isProgrammaticScroll = false  // 标记是否为程序触发的滚动

// 检查是否在滚动条上点击（用于检测拖拽滚动条）
function handleMouseDown(e: MouseEvent) {
  if (!nodeDetailContainerRef.value) return
  const container = nodeDetailContainerRef.value
  const rect = container.getBoundingClientRect()
  // 检查是否点击在滚动条区域（右侧或底部）
  const scrollbarWidth = rect.width - container.clientWidth
  const scrollbarHeight = rect.height - container.clientHeight
  const isOnScrollbar = e.clientX > rect.right - scrollbarWidth || e.clientY > rect.bottom - scrollbarHeight
  if (isOnScrollbar) {
    shouldAutoScroll.value = false
  }
}

// 用户滚轮操作时中断自动滚动
function handleUserWheel(e: WheelEvent) {
  // 如果向下滚动，检查是否到底
  if (e.deltaY > 0) {
    // 向下滚动，保持当前状态（handleNodeDetailScroll 会处理）
    return
  }
  // 向上滚动时，立即中断自动滚动
  shouldAutoScroll.value = false
}

// 节点详情区域滚动处理
function handleNodeDetailScroll() {
  // 如果是程序触发的滚动，忽略
  if (isProgrammaticScroll) {
    isProgrammaticScroll = false
    return
  }

  if (!nodeDetailContainerRef.value) return

  const container = nodeDetailContainerRef.value
  const { scrollTop, scrollHeight, clientHeight } = container
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 50

  // 用户滚动到底部时恢复自动滚动
  shouldAutoScroll.value = isNearBottom
}

function scrollToBottom() {
  if (!nodeDetailContainerRef.value) return
  isProgrammaticScroll = true
  nodeDetailContainerRef.value.scrollTop = nodeDetailContainerRef.value.scrollHeight
}

// MagicInput 状态
interface MagicInputState {
  isOpen: boolean
  mode: 'transcript' | 'agent'
  nodeId?: string
}

const magicInputState = ref<MagicInputState>({
  isOpen: false,
  mode: 'transcript'
})

// MagicInput 初始文本
const magicInputInitialText = computed(() => {
  if (!magicInputState.value.nodeId) return ''
  const node = props.activeNode
  if (!node || node.id !== magicInputState.value.nodeId) return ''
  if (magicInputState.value.mode === 'transcript') {
    return node.transcript || ''
  } else if (magicInputState.value.mode === 'agent') {
    return node.agentResult || ''
  }
  return ''
})

// 编辑处理方法
function handleEditTranscript(nodeId: string) {
  magicInputState.value = {
    isOpen: true,
    mode: 'transcript',
    nodeId
  }
}

function handleEditAgent(nodeId: string) {
  magicInputState.value = {
    isOpen: true,
    mode: 'agent',
    nodeId
  }
}

// MagicInput 保存
function handleMagicInputSave(text: string) {
  const state = magicInputState.value
  if (state.nodeId) {
    if (state.mode === 'transcript') {
      emit('update-node', state.nodeId, { transcript: text })
    } else if (state.mode === 'agent') {
      emit('update-node', state.nodeId, { agentResult: text, agentStatus: 'done' })
    }
  }
  magicInputState.value = { isOpen: false, mode: 'transcript' }
}

// MagicInput 取消
function handleMagicInputCancel() {
  magicInputState.value = { isOpen: false, mode: 'transcript' }
}

// MagicPad 录音相关
const simpleRecorder = createAudioWorkletRecorder()
const isRecording = ref(false)
const recordingDuration = ref(0)
const recordingPosition = ref({ x: 0, y: 0 })
const recordingStartPosition = ref<{ x: number; y: number } | null>(null)
let recordingTimer: number | null = null

// 快速模型配置
const quickModelConfig = computed(() => {
  const quickModelId = settingsStore.settings.llm.quickModelProfileId
  if (!quickModelId) return null
  return settingsStore.settings.llm.profiles.find(p => p.id === quickModelId)
})

// 当选中节点变化时，重置自动滚动状态
watch(() => props.activeNode, () => {
  shouldAutoScroll.value = true
  nextTick(() => {
    scrollToBottom()
  })
})

// MagicPad - 双击进入输入模式
function handleMagicPadDblClick(e: MouseEvent) {
  isInputMode.value = true
  inputText.value = ''
  nextTick(() => {
    magicInputCoreRef.value?.textareaRef?.focus()
  })
}

// 输入模式 - 取消（切换到拖拽模式）
function handleCancelInput() {
  isInputMode.value = false
  inputText.value = ''
}

// 输入模式 - 发送
async function handleSendInput(sendText?: string) {
  const text = (sendText || inputText.value).trim()
  if (!text) return

  // 确保有目标笔记本
  const targetNotebook = effectiveNotebook.value
  if (!targetNotebook) {
    console.error('No notebook to save note to')
    return
  }

  // 如果当前笔记本不是目标笔记本，临时切换
  const needSwitchNotebook = notebookStore.currentNotebook?.id !== targetNotebook.id
  if (needSwitchNotebook) {
    notebookStore.setCurrentNotebook(targetNotebook)
  }

  const newNodeId = uuidv4()
  const newNode: CanvasNode = {
    id: newNodeId,
    type: 'text-note',
    transcript: text,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: props.aiAnswerEnabled ? 'pending' : 'pending',
    selectedAsContext: props.autoSelectNewNote ?? false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pdfPage: props.currentPage,
    pdfPosition: { x: 100, y: 100 }
  }

  if (props.currentPage) {
    notebookStore.addNodeToPdfPage(newNode, props.currentPage)
  } else {
    notebookStore.addNode(newNode)
  }
  emit('node-created', newNode)

  // 重置输入状态（根据设置决定是否保持编辑模式）
  inputText.value = ''
  if (settingsStore.settings.general.magicPadDefaultMode !== 'edit') {
    isInputMode.value = false
  }

  // 触发 AI 回答
  if (props.aiAnswerEnabled) {
    const hasIncludedImage = props.includedPageImage && props.includedPageImage.pageNumber === props.currentPage
    if (hasIncludedImage) {
      await handleImageAnalysisResponse(newNodeId, props.includedPageImage!.imageBase64, text)
    } else {
      await handleAgentResponseForText(newNodeId, text)
    }
  }
}

// MagicPad - 长按开始录音
function handleMagicPadMouseDown(e: MouseEvent) {
  // 输入模式下屏蔽录音
  if (isInputMode.value) return
  if (isRecording.value) return

  const target = e.target as HTMLElement
  const rect = target.getBoundingClientRect()
  recordingStartPosition.value = {
    x: e.clientX,
    y: e.clientY
  }
  recordingPosition.value = {
    x: e.clientX,
    y: e.clientY
  }

  longPressTimer = window.setTimeout(async () => {
    if (isRecording.value) return

    try {
      await simpleRecorder.start()
      isRecording.value = true
      recordingDuration.value = 0

      recordingTimer = window.setInterval(() => {
        recordingDuration.value += 100
      }, 100)
    } catch (error) {
      console.error('Failed to start recording:', error)
      isRecording.value = false
      recordingPosition.value = { x: 0, y: 0 }
    }
  }, LONG_PRESS_DURATION)
}

// MagicPad - 松开鼠标
async function handleMagicPadMouseUp(e: MouseEvent) {
  // 输入模式下不处理
  if (isInputMode.value) return

  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }

  if (!isRecording.value) {
    return
  }

  await stopVoiceRecording()
}

// MagicPad - 鼠标离开取消长按
function handleMagicPadMouseLeave() {
  // 输入模式下不处理
  if (isInputMode.value) return

  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }

  if (isRecording.value) {
    simpleRecorder.stop().catch(console.error)
    isRecording.value = false
    recordingPosition.value = { x: 0, y: 0 }
    recordingStartPosition.value = null
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
    recordingDuration.value = 0
  }
}

// MagicPad - 拖拽文本创建节点
async function handleMagicPadDrop(e: DragEvent) {
  // 输入模式下屏蔽拖拽创建节点
  if (isInputMode.value) return

  // 确保有目标笔记本
  const targetNotebook = effectiveNotebook.value
  if (!targetNotebook) {
    console.error('No notebook to save note to')
    return
  }

  // 如果当前笔记本不是目标笔记本，临时切换
  const needSwitchNotebook = notebookStore.currentNotebook?.id !== targetNotebook.id
  if (needSwitchNotebook) {
    notebookStore.setCurrentNotebook(targetNotebook)
  }

  e.preventDefault()
  e.stopPropagation()

  // 检测是否有图片文件
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const imageFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    )
    if (imageFiles.length > 0) {
      await handleMagicPadImageDrop(imageFiles)
      return
    }
  }

  const text = e.dataTransfer?.getData('text/plain')
  if (!text) return

  const rect = (e.target as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const newNodeId = uuidv4()

  const newNode: CanvasNode = {
    id: newNodeId,
    type: 'text-note',
    transcript: text,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: props.autoSelectNewNote ?? false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pdfPage: props.currentPage,
    pdfPosition: { x, y }
  }

  if (props.currentPage) {
    notebookStore.addNodeToPdfPage(newNode, props.currentPage)
  } else {
    notebookStore.addNode(newNode)
  }
  emit('node-created', newNode)

  if (props.aiAnswerEnabled) {
    // 检查是否有当前勾选的附图且是同一页面
    const hasIncludedImage = props.includedPageImage && props.includedPageImage.pageNumber === props.currentPage

    if (hasIncludedImage) {
      await handleImageAnalysisResponse(newNodeId, props.includedPageImage!.imageBase64, text)
    } else {
      await handleAgentResponseForText(newNodeId, text)
    }
  }
}

// MagicPad - 拖拽图片创建节点
async function handleMagicPadImageDrop(files: File[]) {
  // 确保有目标笔记本
  const targetNotebook = effectiveNotebook.value
  if (!targetNotebook) {
    console.error('No notebook to save note to')
    return
  }

  // 如果当前笔记本不是目标笔记本，临时切换
  const needSwitchNotebook = notebookStore.currentNotebook?.id !== targetNotebook.id
  if (needSwitchNotebook) {
    notebookStore.setCurrentNotebook(targetNotebook)
  }

  const notebookDir = await getNotebookDataDir(targetNotebook.id)
  const imagesDir = `${notebookDir}/images`
  await window.electronAPI.mkdir(imagesDir)

  for (const file of files) {
    const nodeId = uuidv4()
    const ext = file.name.split('.').pop() || 'png'
    const imagePath = `images/${nodeId}.${ext}`

    // 保存图片到笔记本目录
    const arrayBuffer = await file.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${notebookDir}/${imagePath}`, arrayBuffer)

    // 创建图片节点
    const newNode: CanvasNode = {
      id: nodeId,
      type: 'image-note',
      imagePath,
      transcript: `![${file.name}](${imagePath})`,
      transcriptStatus: 'done',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: props.autoSelectNewNote ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pdfPage: props.currentPage,
      pdfPosition: { x: 100, y: 100 }
    }

    if (props.currentPage) {
      notebookStore.addNodeToPdfPage(newNode, props.currentPage)
    } else {
      notebookStore.addNode(newNode)
    }
    emit('node-created', newNode)
  }
}

async function handleAgentResponseForText(nodeId: string, transcript: string) {
  const settings = settingsStore.settings
  const pdfPage = props.currentPage

  try {
    notebookStore.updateNode(nodeId, { agentStatus: 'processing' })

    const canvasNodes = pdfPage ? notebookStore.getNodesByPdfPage(pdfPage) : notebookStore.getAllNodes()
    const node = canvasNodes.find(n => n.id === nodeId)

    // 加载当前节点的内嵌图片（如果尚未加载）
    let currentEmbeddedImages = node?.embeddedImages
    if (!currentEmbeddedImages && transcript) {
      const notebook = effectiveNotebook.value
      if (notebook) {
        currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript, notebook.id, window.electronAPI.readFile)
        if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
          notebookStore.updateNode(nodeId, { embeddedImages: currentEmbeddedImages })
        }
      }
    }

    // 获取上下文节点：在全部笔记本视图下使用跨笔记本方法
    let selectedNodes: { transcript: string; agentResult: string; imageBase64?: string; embeddedImages?: string[] }[]

    if (props.targetNotebookId === null) {
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
      // 单个笔记本视图：使用当前笔记本的节点
      selectedNodes = canvasNodes
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

    const result = await chatWithLLM(messages, {
      baseUrl: currentModelConfig.value?.baseUrl || '',
      apiKey: currentModelConfig.value?.apiKey || '',
      model: currentModelConfig.value?.model || '',
      enableThinking: currentModelConfig.value?.enableThinking,
      temperature: currentModelConfig.value?.temperature
    }, (chunk) => {
      accumulatedContent += chunk
      if (pdfPage) {
        notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      } else {
        notebookStore.updateNode(nodeId, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      }
    }, (thinkingChunk) => {
      accumulatedThinking += thinkingChunk
      if (pdfPage) {
        notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
          thinkingContent: accumulatedThinking,
          thinkingStatus: 'processing'
        })
      } else {
        notebookStore.updateNode(nodeId, {
          thinkingContent: accumulatedThinking,
          thinkingStatus: 'processing'
        })
      }
    })

    if (pdfPage) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: result.content,
        agentStatus: 'done',
        thinkingContent: result.thinking,
        thinkingStatus: result.thinking ? 'done' : undefined
      })
    } else {
      notebookStore.updateNode(nodeId, {
        agentResult: result.content,
        agentStatus: 'done',
        thinkingContent: result.thinking,
        thinkingStatus: result.thinking ? 'done' : undefined
      })
    }
  } catch (error) {
    if (pdfPage) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    } else {
      notebookStore.updateNode(nodeId, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    }
  }
}

// 处理图片分析响应
async function handleImageAnalysisResponse(nodeId: string, imageBase64: string, prompt: string, nodePdfPage?: number) {
  // 使用传入的节点页面，否则使用当前页面
  const pdfPage = nodePdfPage ?? props.currentPage

  try {
    if (pdfPage) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { agentStatus: 'processing' })
    } else {
      notebookStore.updateNode(nodeId, { agentStatus: 'processing' })
    }

    // 获取已选中的节点作为上下文（跨画布）
    const selectedNodes = notebookStore.getAllSelectedContextNodes(nodeId)

    const staticContextContent = props.staticContextFiles
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildImageAnalysisMessages(
      imageBase64,
      prompt,
      staticContextContent,
      props.dynamicContextFile?.content,
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '', imageBase64: n.imageBase64, embeddedImages: n.embeddedImages }))
    )

    let accumulatedContent = ''
    let accumulatedThinking = ''

    const result = await chatWithLLM(messages, {
      baseUrl: currentModelConfig.value?.baseUrl || '',
      apiKey: currentModelConfig.value?.apiKey || '',
      model: currentModelConfig.value?.model || '',
      enableThinking: currentModelConfig.value?.enableThinking,
      temperature: currentModelConfig.value?.temperature
    }, (chunk) => {
      accumulatedContent += chunk
      if (pdfPage) {
        notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      } else {
        notebookStore.updateNode(nodeId, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      }
    }, (thinkingChunk) => {
      accumulatedThinking += thinkingChunk
      if (pdfPage) {
        notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
          thinkingContent: accumulatedThinking,
          thinkingStatus: 'processing'
        })
      } else {
        notebookStore.updateNode(nodeId, {
          thinkingContent: accumulatedThinking,
          thinkingStatus: 'processing'
        })
      }
    })

    if (pdfPage) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: result.content,
        agentStatus: 'done',
        thinkingContent: result.thinking,
        thinkingStatus: result.thinking ? 'done' : undefined
      })
    } else {
      notebookStore.updateNode(nodeId, {
        agentResult: result.content,
        agentStatus: 'done',
        thinkingContent: result.thinking,
        thinkingStatus: result.thinking ? 'done' : undefined
      })
    }
  } catch (error) {
    if (pdfPage) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    } else {
      notebookStore.updateNode(nodeId, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    }
  }
}

// 停止语音录音
async function stopVoiceRecording() {
  if (!isRecording.value) return

  try {
    const audioBlob = await simpleRecorder.stop()
    isRecording.value = false

    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }

    await createVoiceNode(audioBlob, recordingDuration.value)
  } catch (error) {
    console.error('Failed to stop recording:', error)
    isRecording.value = false
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
  }

  recordingPosition.value = { x: 0, y: 0 }
  recordingStartPosition.value = null
}

// 创建语音节点
async function createVoiceNode(audioBlob: Blob, duration: number) {
  // 确保有目标笔记本
  const targetNotebook = effectiveNotebook.value
  if (!targetNotebook) {
    console.error('No notebook to save note to')
    return
  }

  // 如果当前笔记本不是目标笔记本，临时切换
  const needSwitchNotebook = notebookStore.currentNotebook?.id !== targetNotebook.id
  if (needSwitchNotebook) {
    notebookStore.setCurrentNotebook(targetNotebook)
  }

  const extension = audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
  const nodeId = uuidv4()
  const audioPath = `audio/${nodeId}.${extension}`

  const audioDir = await getNotebookAudioDir(targetNotebook.id)
  await window.electronAPI.mkdir(audioDir)

  const arrayBuffer = await audioBlob.arrayBuffer()
  await window.electronAPI.saveFileBuffer(`${audioDir}/${nodeId}.${extension}`, arrayBuffer)

  const pdfPage = props.currentPage

  const node: CanvasNode = {
    id: nodeId,
    type: 'voice-note',
    audioPath,
    transcript: null,
    transcriptStatus: 'pending',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: props.autoSelectNewNote ?? false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    duration,
    pdfPage,
    pdfPosition: { x: 100, y: 100 }
  }

  if (pdfPage) {
    notebookStore.addNodeToPdfPage(node, pdfPage)
  } else {
    notebookStore.addNode(node)
  }
  emit('node-created', node)

  const updatedNode = findNodeById(nodeId)
  if (updatedNode) {
    await handleTranscription(updatedNode)
  }
}

// 处理语音转写
async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }

  if (!settings.stt.sherpaOnnx) {
    updateNodeWithPage(node.id, {
      transcript: '语音识别配置错误，请检查设置',
      transcriptStatus: 'error'
    })
    return
  }

  try {
    updateNodeWithPage(node.id, { transcriptStatus: 'processing' })

    const notebook = effectiveNotebook.value
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
        updateNodeWithPage(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done',
          title
        })

        if (props.aiAnswerEnabled) {
          // 检查是否有当前勾选的附图且是同一页面
          const hasIncludedImage = props.includedPageImage && props.includedPageImage.pageNumber === node.pdfPage

          if (hasIncludedImage) {
            await handleImageAnalysisResponse(node.id, props.includedPageImage!.imageBase64, transcriptResult.text, node.pdfPage)
          } else {
            await handleAgentResponseForVoice(node.id, transcriptResult.text, node.pdfPage)
          }
        }
      } else {
        throw new Error(transcriptResult.error || '转写失败')
      }
    }
  } catch (error) {
    updateNodeWithPage(node.id, {
      transcript: String(error),
      transcriptStatus: 'error'
    })
  }
}

function updateNodeWithPage(nodeId: string, updates: Partial<CanvasNode>) {
  const node = findNodeById(nodeId)
  if (node?.pdfPage !== undefined && node.pdfPage !== null) {
    notebookStore.updateNodeInPdfPage(nodeId, node.pdfPage, updates)
  } else {
    notebookStore.updateNode(nodeId, updates)
  }
}

function findNodeById(nodeId: string): CanvasNode | undefined {
  // 如果有指定的目标笔记本，只在该笔记本中查找
  if (props.targetNotebookId) {
    return effectiveNotebook.value?.nodes?.find(n => n.id === nodeId)
  }
  // 在全部笔记本视图中，在所有笔记本中查找节点
  return notebookStore.getAllNotebooksNodes().find(n => n.id === nodeId)
}

// 重新生成 AI 回答
function handleRegenerateAgent(nodeId: string) {
  const node = findNodeById(nodeId)
  if (node && node.transcript) {
    // 如果有勾选附图，就使用附图
    if (props.includedPageImage) {
      handleImageAnalysisResponse(nodeId, props.includedPageImage.imageBase64, node.transcript, node.pdfPage)
    } else {
      // 普通文本响应
      handleAgentResponseForVoice(nodeId, node.transcript, node.pdfPage)
    }
  }
}

// 处理 retry-agent 事件
function handleRetryAgent(nodeId: string) {
  const node = findNodeById(nodeId)
  if (node && node.transcript) {
    // 重置状态（使用跨笔记本更新）
    notebookStore.updateNodeInAnyNotebook(nodeId, {
      agentResult: null,
      agentStatus: 'processing'
    })

    // 如果有勾选附图，就使用附图
    if (props.includedPageImage) {
      handleImageAnalysisResponse(nodeId, props.includedPageImage.imageBase64, node.transcript, node.pdfPage)
    } else {
      // 普通文本响应
      handleAgentResponseForVoice(nodeId, node.transcript, node.pdfPage)
    }
  }
}

// 复制链接
function handleCopyLink(nodeId: string) {
  console.log('Link copied for node:', nodeId)
}

// 语音节点的 AI 回答
async function handleAgentResponseForVoice(nodeId: string, transcript: string, pdfPage?: number) {
  const settings = settingsStore.settings

  try {
    // 使用跨笔记本更新节点状态
    notebookStore.updateNodeInAnyNotebook(nodeId, { agentStatus: 'processing' })

    // 在全部笔记本视图下使用跨笔记本方法获取节点
    const canvasNodes = pdfPage !== undefined && pdfPage !== null
      ? notebookStore.getNodesByPdfPage(pdfPage)
      : (props.targetNotebookId ? notebookStore.getAllNodes() : notebookStore.getAllNotebooksNodes())
    const node = canvasNodes.find(n => n.id === nodeId)

    // 找到节点所属的笔记本
    const nodeNotebook = props.targetNotebookId
      ? effectiveNotebook.value
      : notebookStore.notebooks.find(nb => nb.nodes?.some(n => n.id === nodeId))

    // 加载当前节点的内嵌图片（如果尚未加载）
    let currentEmbeddedImages = node?.embeddedImages
    if (!currentEmbeddedImages && transcript && nodeNotebook) {
      currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript, nodeNotebook.id, window.electronAPI.readFile)
      if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
        notebookStore.updateNodeInAnyNotebook(nodeId, { embeddedImages: currentEmbeddedImages })
      }
    }

    // 获取上下文节点：在全部笔记本视图下使用跨笔记本方法
    let selectedNodes: { transcript: string; agentResult: string; imageBase64?: string; embeddedImages?: string[] }[]

    if (props.targetNotebookId === null) {
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
      // 单个笔记本视图：使用当前笔记本的节点
      selectedNodes = canvasNodes
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

    const result = await chatWithLLM(messages, {
      baseUrl: currentModelConfig.value?.baseUrl || '',
      apiKey: currentModelConfig.value?.apiKey || '',
      model: currentModelConfig.value?.model || '',
      enableThinking: currentModelConfig.value?.enableThinking,
      temperature: currentModelConfig.value?.temperature
    }, (chunk) => {
      accumulatedContent += chunk
      notebookStore.updateNodeInAnyNotebook(nodeId, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })

      if (shouldAutoScroll.value) {
        nextTick(() => scrollToBottom())
      }
    }, (thinkingChunk) => {
      accumulatedThinking += thinkingChunk
      notebookStore.updateNodeInAnyNotebook(nodeId, {
        thinkingContent: accumulatedThinking,
        thinkingStatus: 'processing'
      })
    })

    notebookStore.updateNodeInAnyNotebook(nodeId, {
      agentResult: result.content,
      agentStatus: 'done',
      thinkingContent: result.thinking,
      thinkingStatus: result.thinking ? 'done' : undefined
    })
  } catch (error) {
    notebookStore.updateNodeInAnyNotebook(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

// 暴露方法给父组件调用
function triggerInputMode() {
  isInputMode.value = true
  inputText.value = ''
  nextTick(() => {
    magicInputCoreRef.value?.textareaRef?.focus()
  })
}

defineExpose({
  triggerInputMode
})
</script>

<style scoped>
.chat-panel {
  position: relative;
  flex: 1;
  min-width: 400px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.chat-panel.is-active {
  border-top: 3px solid var(--color-primary);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}

/* 笔记详情区域 */
.node-detail-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
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
  box-shadow: 0 2px 8px var(--shadow-color) !important;
  border: none !important;
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

/* MagicPad 区域 */
.magic-pad-container {
  position: relative;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
  min-height: 180px;
}

/* 调整高度手柄 */
.magic-pad-container .resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  cursor: ns-resize;
  z-index: 10;
  transition: background-color 0.2s;
}

.magic-pad-container .resize-handle:hover {
  background-color: var(--color-primary-light);
}

.magic-pad {
  position: relative;
  height: 100%;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.magic-pad-hint {
  width: 100%;
  height: 100%;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 12px;
  opacity: 0.6;
  transition: all 0.2s;
}

.magic-pad:hover .magic-pad-hint {
  border-color: var(--border-color);
  opacity: 1;
}

.magic-pad-hint-text {
  font-weight: 500;
  white-space: nowrap;
  user-select: none;
  color: var(--border-color);
  opacity: 0.6;
}

/* 输入模式容器 */
.magic-pad-input-mode {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-sizing: border-box;
}

.magic-pad-input {
  flex: 1;
  min-height: 0;
  padding: 12px;
  border: none;
  background: var(--bg-primary) !important;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.magic-pad-input::placeholder {
  color: var(--text-secondary);
}

/* 输入模式菜单栏 */
.input-menu-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  height: 32px;
}

.input-menu-bar .menu-spacer {
  flex: 1;
}

.input-menu-bar .menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.input-menu-bar .menu-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.input-menu-bar .menu-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.input-menu-bar .menu-btn:disabled:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.input-menu-bar .menu-btn:not(:disabled):hover {
  background: var(--color-primary);
  color: white;
}

.input-menu-bar .menu-btn:not(:disabled) {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.input-menu-bar .send-btn:disabled {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
  opacity: 0.6;
}

.input-menu-bar .send-btn:disabled:hover {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
}

/* 纠正按钮样式（与发送按钮一致） */
.input-menu-bar .correct-btn:disabled {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
  opacity: 0.6;
}

.input-menu-bar .correct-btn:disabled:hover {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
}

/* 快捷指令气泡 */
.quick-command-popover-input {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 56px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  max-height: 150px;
  overflow-y: auto;
  z-index: 1000;
}

.quick-command-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.quick-command-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px var(--shadow-color);
}

.quick-command-name {
  font-size: 13px;
  font-weight: 500;
}

/* 录音按钮 */
.input-menu-bar .record-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 32px;
}

.input-menu-bar .record-btn.active {
  background: var(--color-danger);
  color: white;
}

.input-menu-bar .record-btn.active:hover {
  background: var(--color-danger);
  opacity: 0.9;
}

.input-menu-bar .record-btn .record-time {
  font-size: 12px;
  font-weight: 500;
}

/* 纠正按钮加载动画 */
.correct-btn .loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 右键编辑菜单 */
.edit-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
}

.edit-menu {
  position: fixed;
  z-index: 2001;
  min-width: 100px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px;
}

.edit-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;
  transition: background 0.2s;
}

.edit-menu-item:hover {
  background: var(--bg-hover);
}
</style>