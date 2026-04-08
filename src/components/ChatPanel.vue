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
          :notebook-id="notebookId"
          :canvas-id="canvasId"
          :is-active="true"
          :is-editing="isCurrentNodeEditing"
          :editing-text="currentEditingText"
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
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
          @update:editing-text="(text) => $emit('update-editing-text', text)"
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
        <!-- 快捷指令气泡 -->
        <div v-if="showQuickCommandSelector && isInputMode" class="quick-command-popover-input">
          <div
            v-for="cmd in quickCommandStore.quickCommands"
            :key="cmd.id"
            class="quick-command-item"
            :style="{ backgroundColor: cmd.color + '20', borderColor: cmd.color }"
            @click="insertQuickCommand(cmd)"
          >
            <span class="quick-command-name" :style="{ color: cmd.color }">{{ cmd.name }}</span>
          </div>
        </div>

        <!-- 虚线提示框（正常模式） -->
        <div v-if="!isInputMode" class="magic-pad-hint"></div>

        <!-- 输入模式容器 -->
        <div v-else class="magic-pad-input-mode">
          <textarea
            ref="inputTextareaRef"
            v-model="inputText"
            class="magic-pad-input"
            :placeholder="t('common.inputContent')"
            @keydown.ctrl.enter.exact.prevent="handleSendInput"
            @keydown.meta.enter.exact.prevent="handleSendInput"
            @keydown.escape="handleCancelInput"
            @dragover.prevent
            @drop.prevent="handleInputDrop"
          ></textarea>
          <!-- 菜单栏 -->
          <div class="input-menu-bar">
            <button v-if="quickCommandStore.quickCommands.length > 0" class="menu-btn quick-btn" @click="toggleQuickCommandSelector" :class="{ active: showQuickCommandSelector }" :title="t('quickCommand.title')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
              </svg>
            </button>
            <div class="menu-spacer"></div>
            <button class="menu-btn cancel-btn" @click="handleCancelInput" :title="t('common.cancel')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            <button class="menu-btn send-btn" @click="handleSendInput" :disabled="!inputText.trim()" :title="t('common.send')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import VoiceNote from '@/components/VoiceNote.vue'
import RecordingIndicator from '@/components/RecordingIndicator.vue'
import { chatWithLLM, buildFullContextMessages, buildImageAnalysisMessages } from '@/composables/useQwenAgent'
import { loadEmbeddedImagesForTranscript } from '@/utils/contextBuilder'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import type { CanvasNode } from '@/types/notebook'
import type { ContextFile } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const props = defineProps<{
  activeNode: CanvasNode | null
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile | null
  aiAnswerEnabled: boolean
  editingNodeId?: string | null
  editingText?: string
  currentPage?: number
  includedPageImage?: { imageBase64: string; pageNumber: number } | null
  isActive?: boolean
  panelId?: 'left' | 'right'
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
  'update-editing-text': [text: string]
  'save-edit': [nodeId: string, text: string]
  'cancel-edit': [nodeId: string]
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

// 快捷指令选择器
const showQuickCommandSelector = ref(false)

// 点击外部关闭快捷指令气泡
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.quick-command-popover-input') && !target.closest('.quick-btn')) {
    showQuickCommandSelector.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  // 清理调整高度事件监听器
  if (isResizingMagicPad) {
    document.removeEventListener('mousemove', handleResizeMagicPadMove)
    document.removeEventListener('mouseup', handleResizeMagicPadEnd)
  }
})

// 切换快捷指令选择器
function toggleQuickCommandSelector() {
  showQuickCommandSelector.value = !showQuickCommandSelector.value
}

// Get notebookId and canvasId from notebookStore
const notebookId = computed(() => notebookStore.currentNotebook?.id)
const canvasId = computed(() => notebookStore.currentCanvas?.id)

// 获取当前笔记本使用的模型配置
const currentModelConfig = computed(() => {
  const modelId = notebookStore.currentNotebook?.modelId || settingsStore.settings.llm.activeProfileId
  return settingsStore.settings.llm.profiles.find(p => p.id === modelId)
})

// MagicPad 相关
const magicPadRef = ref<HTMLElement | null>(null)
let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

// 输入模式相关
const isInputMode = ref(false)
const inputText = ref('')
const inputTextareaRef = ref<HTMLTextAreaElement | null>(null)

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

// 编辑状态计算属性
const isCurrentNodeEditing = computed((): boolean => {
  return !!(props.editingNodeId && props.activeNode && props.editingNodeId === props.activeNode.id)
})

const currentEditingText = computed((): string => {
  return isCurrentNodeEditing.value ? (props.editingText || '') : ''
})

// MagicPad 录音相关
const simpleRecorder = createAudioWorkletRecorder()
const isRecording = ref(false)
const recordingDuration = ref(0)
const recordingPosition = ref({ x: 0, y: 0 })
const recordingStartPosition = ref<{ x: number; y: number } | null>(null)
let recordingTimer: number | null = null

// 当选中节点变化时，重置自动滚动状态
watch(() => props.activeNode, () => {
  shouldAutoScroll.value = true
  nextTick(() => {
    scrollToBottom()
  })
})

function handleSaveEdit(nodeId: string, text: string) {
  emit('save-edit', nodeId, text)
}

function handleCancelEdit(nodeId: string) {
}

// MagicPad - 双击进入输入模式
function handleMagicPadDblClick(e: MouseEvent) {
  isInputMode.value = true
  inputText.value = ''
  nextTick(() => {
    inputTextareaRef.value?.focus()
  })
}

// 输入模式 - 取消
function handleCancelInput() {
  isInputMode.value = false
  inputText.value = ''
  showQuickCommandSelector.value = false
}

// 输入模式 - 发送
async function handleSendInput() {
  const text = inputText.value.trim()
  if (!text) return

  const newNodeId = `node-${Date.now()}`
  const newNode: CanvasNode = {
    id: newNodeId,
    type: 'text-note',
    position: { x: 100, y: 100 },
    transcript: text,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: props.aiAnswerEnabled ? 'pending' : 'pending',
    selectedAsContext: false,
    createdAt: Date.now(),
    pdfPage: props.currentPage,
    pdfPosition: { x: 100, y: 100 }
  }

  if (props.currentPage) {
    notebookStore.addNodeToPdfPage(newNode, props.currentPage)
  } else {
    notebookStore.addNode(newNode)
  }
  emit('node-created', newNode)

  // 重置输入模式
  isInputMode.value = false
  inputText.value = ''
  showQuickCommandSelector.value = false

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

// 输入模式 - 插入快捷指令
function insertQuickCommand(cmd: QuickCommand) {
  inputText.value = cmd.content
  showQuickCommandSelector.value = false
  nextTick(() => {
    inputTextareaRef.value?.focus()
  })
}

// 输入模式 - 处理拖放
async function handleInputDrop(e: DragEvent) {
  if (!e.dataTransfer?.files.length) return

  const files = Array.from(e.dataTransfer.files)
  const imageFiles = files.filter(f => f.type.startsWith('image/'))

  if (imageFiles.length === 0) return

  for (const file of imageFiles) {
    const markdownLink = await saveImageToNotebook(file)
    if (markdownLink) {
      const textarea = inputTextareaRef.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = inputText.value
        inputText.value = text.substring(0, start) + markdownLink + text.substring(end)
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = start + markdownLink.length
          textarea.focus()
        })
      }
    }
  }
}

// 保存图片到笔记本目录并返回markdown链接
async function saveImageToNotebook(file: File): Promise<string | null> {
  const notebook = notebookStore.currentNotebook
  if (!notebook) {
    console.error('[ChatPanel] No current notebook')
    return null
  }

  try {
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const notebookDir = `${appDataPath}/notebooks/${notebook.id}`
    const imagesDir = `${notebookDir}/images`

    await window.electronAPI.mkdir(imagesDir)

    const ext = file.name.split('.').pop() || 'png'
    const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const filename = `${imageId}.${ext}`
    const imagePath = `${imagesDir}/${filename}`
    const relativePath = `images/${filename}`

    const arrayBuffer = await file.arrayBuffer()
    await window.electronAPI.saveFileBuffer(imagePath, arrayBuffer)

    console.log('[ChatPanel] Image saved:', relativePath)
    return `\n![${file.name}](${relativePath})\n`
  } catch (error) {
    console.error('[ChatPanel] Failed to save image:', error)
    return null
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

  const newNodeId = `node-${Date.now()}`

  const newNode: CanvasNode = {
    id: newNodeId,
    type: 'text-note',
    position: { x, y },
    transcript: text,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: false,
    createdAt: Date.now(),
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
    const newNode: CanvasNode = {
      id: nodeId,
      type: 'image-note',
      position: { x: 100, y: 100 },
      imagePath,
      transcript: `![${file.name}](${imagePath})`,
      transcriptStatus: 'done',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: false,
      createdAt: Date.now(),
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
    if (pdfPage) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { agentStatus: 'processing' })
    } else {
      notebookStore.updateNode(nodeId, { agentStatus: 'processing' })
    }

    const canvas = pdfPage ? notebookStore.getCanvasByPdfPage(pdfPage) : notebookStore.currentCanvas
    const node = canvas?.nodes.find(n => n.id === nodeId)

    // 加载当前节点的内嵌图片（如果尚未加载）
    let currentEmbeddedImages = node?.embeddedImages
    if (!currentEmbeddedImages && transcript) {
      const notebook = notebookStore.currentNotebook
      if (notebook) {
        currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript, notebook.id, window.electronAPI.readFile)
        if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
          if (pdfPage) {
            notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { embeddedImages: currentEmbeddedImages })
          } else {
            notebookStore.updateNode(nodeId, { embeddedImages: currentEmbeddedImages })
          }
        }
      }
    }

    const selectedNodes = canvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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

  const pdfPage = props.currentPage

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
  if (!notebookStore.currentNotebook?.canvases) return undefined
  for (const canvas of notebookStore.currentNotebook.canvases) {
    const node = canvas.nodes.find(n => n.id === nodeId)
    if (node) return node
  }
  return undefined
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
    // 重置状态
    if (node.pdfPage !== undefined && node.pdfPage !== null) {
      notebookStore.updateNodeInPdfPage(nodeId, node.pdfPage, {
        agentResult: null,
        agentStatus: 'processing'
      })
    } else {
      notebookStore.updateNode(nodeId, {
        agentResult: null,
        agentStatus: 'processing'
      })
    }

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
    if (pdfPage !== undefined && pdfPage !== null) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { agentStatus: 'processing' })
    } else {
      notebookStore.updateNode(nodeId, { agentStatus: 'processing' })
    }

    const canvas = pdfPage !== undefined && pdfPage !== null
      ? notebookStore.getCanvasByPdfPage(pdfPage)
      : notebookStore.currentCanvas
    const node = canvas?.nodes.find(n => n.id === nodeId)

    // 加载当前节点的内嵌图片（如果尚未加载）
    let currentEmbeddedImages = node?.embeddedImages
    if (!currentEmbeddedImages && transcript) {
      const notebook = notebookStore.currentNotebook
      if (notebook) {
        currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript, notebook.id, window.electronAPI.readFile)
        if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
          if (pdfPage !== undefined && pdfPage !== null) {
            notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { embeddedImages: currentEmbeddedImages })
          } else {
            notebookStore.updateNode(nodeId, { embeddedImages: currentEmbeddedImages })
          }
        }
      }
    }

    const selectedNodes = canvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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

    const result = await chatWithLLM(messages, {
      baseUrl: currentModelConfig.value?.baseUrl || '',
      apiKey: currentModelConfig.value?.apiKey || '',
      model: currentModelConfig.value?.model || '',
      enableThinking: currentModelConfig.value?.enableThinking,
      temperature: currentModelConfig.value?.temperature
    }, (chunk) => {
      accumulatedContent += chunk
      if (pdfPage !== undefined && pdfPage !== null) {
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

      if (shouldAutoScroll.value) {
        nextTick(() => scrollToBottom())
      }
    }, (thinkingChunk) => {
      accumulatedThinking += thinkingChunk
      if (pdfPage !== undefined && pdfPage !== null) {
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

    if (pdfPage !== undefined && pdfPage !== null) {
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
    if (pdfPage !== undefined && pdfPage !== null) {
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
</script>

<style scoped>
.chat-panel {
  position: relative;
  flex: 1;
  min-width: 400px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.chat-panel.is-active {
  border-top: 3px solid var(--color-primary);
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
  border-color: var(--primary-color);
  opacity: 0.7;
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
</style>