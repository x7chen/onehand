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
        <!-- 快捷指令气泡 -->
        <div v-if="showQuickCommandSelector && isInputMode" class="quick-command-popover-input">
          <div
            v-for="cmd in quickCommandStore.quickCommands"
            :key="cmd.id"
            class="quick-command-item"
            :style="{ backgroundColor: cmd.color + '20', borderColor: cmd.color }"
            @click="insertQuickCommand(cmd)"
          >
            <span class="quick-command-name" :style="{ color: 'var(--text-primary)' }">{{ cmd.name }}</span>
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
            @keydown.enter.exact="handleSendInputEnter"
            @keydown.shift.enter.exact.stop
            @keydown.escape="handleCancelInput"
            @dragstart="handleInputDragStart"
            @dragend="handleInputDragEnd"
            @dragover.prevent="handleInputDragOver"
            @drop.prevent="handleInputDrop"
            @contextmenu.prevent="handleTextareaContextMenu"
          ></textarea>
          <!-- 右键编辑菜单 -->
          <Teleport to="body">
            <div v-if="showEditMenu" class="edit-menu-overlay" @click="showEditMenu = false"></div>
            <div v-if="showEditMenu" class="edit-menu" :style="editMenuStyle" @click.stop>
              <button class="edit-menu-item" @click="handleCopy" v-if="hasSelection">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                <span>{{ t('common.copy') }}</span>
              </button>
              <button class="edit-menu-item" @click="handlePaste">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
                </svg>
                <span>{{ t('common.paste') }}</span>
              </button>
            </div>
          </Teleport>
          <!-- 菜单栏 -->
          <div class="input-menu-bar">
            <button v-if="quickCommandStore.quickCommands.length > 0" class="menu-btn quick-btn" @click="toggleQuickCommandSelector" :class="{ active: showQuickCommandSelector }" :title="t('quickCommand.title')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
              </svg>
            </button>
            <button class="menu-btn record-btn" :class="{ active: isInputRecording }" @click="toggleInputRecording" :title="isInputRecording ? t('common.stopRecording') : t('common.startRecording')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              <span v-if="isInputRecording" class="record-time">{{ inputRecordingTimeDisplay }}</span>
            </button>
            <!-- 纠正按钮 -->
            <button
              v-if="quickModelConfig"
              class="menu-btn correct-btn"
              :class="{ loading: isCorrecting }"
              @click="handleCorrectText"
              :disabled="!inputText.trim() || isCorrecting"
              :title="t('common.correctText')"
            >
              <!-- 正常状态：铅笔图标 -->
              <svg v-if="!isCorrecting" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.71.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.7-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/>
              </svg>
              <!-- 加载状态：渐隐未闭合圆圈 -->
              <svg v-else class="loading-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
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
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import VoiceNote from '@/components/VoiceNote.vue'
import RecordingIndicator from '@/components/RecordingIndicator.vue'
import MagicInput from '@/components/MagicInput.vue'
import { chatWithLLM, buildFullContextMessages, buildImageAnalysisMessages } from '@/composables/useQwenAgent'
import { loadEmbeddedImagesForTranscript } from '@/utils/contextBuilder'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { getNotebookAudioDir, getNotebookImagesDir, getNotebookDataDir, getPdfDir } from '@/utils/userFilesPath'
import type { CanvasNode } from '@/types/notebook'
import type { ContextFile } from '@/types/context'
import type { QuickCommand } from '@/types/quickCommand'

const props = defineProps<{
  activeNode: CanvasNode | null
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile | null
  aiAnswerEnabled: boolean
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

// 输入模式拖拽相关
const dragCaretPosition = ref<number | null>(null)
const internalDragSelection = ref<{ start: number; end: number; text: string } | null>(null)

// 右键编辑菜单
const showEditMenu = ref(false)
const editMenuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const hasSelection = ref(false)

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

// 输入模式录音相关（文字输入用）
const inputRecorder = createAudioWorkletRecorder()
const isInputRecording = ref(false)
const inputRecordingDuration = ref(0)
let inputRecordingTimer: number | null = null
const INPUT_RECORDING_TIMEOUT = 30000 // 30秒超时
const inputRecordingTimeDisplay = computed(() => {
  const seconds = Math.floor(inputRecordingDuration.value / 1000)
  return `${seconds}s`
})

// 快速模型配置
const quickModelConfig = computed(() => {
  const quickModelId = settingsStore.settings.llm.quickModelProfileId
  if (!quickModelId) return null
  return settingsStore.settings.llm.profiles.find(p => p.id === quickModelId)
})

// 纠正状态
const isCorrecting = ref(false)

// 纠正文本函数
async function handleCorrectText() {
  if (!quickModelConfig.value || !inputText.value.trim()) return

  isCorrecting.value = true

  const messages = [
    { role: 'user' as const, content: `Correct spelling errors and add missing or incorrect punctuation to the text: ${inputText.value}\n\nProvide only the corrected text without any additional explanation.`,}
  ]

  try {
    const result = await chatWithLLM(messages, {
      baseUrl: quickModelConfig.value.baseUrl,
      apiKey: quickModelConfig.value.apiKey,
      model: quickModelConfig.value.model,
      temperature: 0.3  // 低温度确保一致性
    })

    // 用纠正后的内容覆盖输入框
    inputText.value = result.content.trim()
    .replace(/<\/?think>/gi, '')
    .replace(/<\|begin_of_box\|>/gi, '')
    .replace(/<\|end_of_box\|>/gi, '')
  } catch (error) {
    console.error('Text correction failed:', error)
  } finally {
    isCorrecting.value = false
  }
}

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
    inputTextareaRef.value?.focus()
  })
}

// 输入模式 - 取消
function handleCancelInput() {
  // 停止录音
  if (isInputRecording.value) {
    inputRecorder.stop().catch(console.error)
    isInputRecording.value = false
    if (inputRecordingTimer) {
      clearInterval(inputRecordingTimer)
      inputRecordingTimer = null
    }
    inputRecordingDuration.value = 0
  }
  isInputMode.value = false
  inputText.value = ''
  showQuickCommandSelector.value = false
}

// 处理 Enter 键发送（检查输入法组合状态）
function handleSendInputEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  event.preventDefault()
  handleSendInput()
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
  const textarea = inputTextareaRef.value
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = inputText.value
    inputText.value = text.substring(0, start) + cmd.content + text.substring(end)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + cmd.content.length
      textarea.focus()
    })
  } else {
    inputText.value += cmd.content
  }
  showQuickCommandSelector.value = false
}

// 右键菜单处理
function handleTextareaContextMenu(e: MouseEvent) {
  const textarea = inputTextareaRef.value
  const selection = textarea ? textarea.value.substring(textarea.selectionStart, textarea.selectionEnd) : ''

  hasSelection.value = selection.length > 0
  editMenuStyle.value = {
    top: `${e.clientY}px`,
    left: `${e.clientX}px`
  }
  showEditMenu.value = true
}

// 输入模式 - 拖拽开始
function handleInputDragStart(e: DragEvent) {
  const textarea = inputTextareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = textarea.value.substring(start, end)

  if (selectedText && e.dataTransfer) {
    e.dataTransfer.setData('text/plain', selectedText)
    e.dataTransfer.setData('application/x-magic-pad-input', 'true')
    e.dataTransfer.effectAllowed = 'move'

    internalDragSelection.value = {
      start: Math.min(start, end),
      end: Math.max(start, end),
      text: selectedText
    }
  }
}

// 输入模式 - 拖拽结束
function handleInputDragEnd() {
  dragCaretPosition.value = null
  internalDragSelection.value = null
}

// 输入模式 - 拖拽悬停
function handleInputDragOver(e: DragEvent) {
  e.preventDefault()
  const textarea = inputTextareaRef.value
  if (!textarea) return

  const position = getInputCaretPositionFromPoint(e.clientX, e.clientY, textarea)
  if (position !== null) {
    dragCaretPosition.value = position
    textarea.selectionStart = textarea.selectionEnd = position
    textarea.focus()
  }
}

// 根据鼠标坐标计算 textarea 中的字符位置
function getInputCaretPositionFromPoint(x: number, y: number, textarea: HTMLTextAreaElement): number | null {
  const mirror = document.createElement('div')
  const style = window.getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()

  mirror.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    font-family: ${style.fontFamily};
    font-size: ${style.fontSize};
    line-height: ${style.lineHeight};
    letter-spacing: ${style.letterSpacing};
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: ${style.padding};
    border: ${style.border};
    box-sizing: border-box;
    z-index: 9999;
    opacity: 0;
  `

  const styleSheet = document.createElement('style')
  styleSheet.textContent = 'textarea-caret-mirror::-webkit-scrollbar { display: none; }'
  document.head.appendChild(styleSheet)

  mirror.textContent = textarea.value
  document.body.appendChild(mirror)
  mirror.scrollTop = textarea.scrollTop

  try {
    let position: number | null = null

    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y)
      if (range && range.startContainer === mirror) {
        position = range.startOffset
      } else if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        position = findInputTextOffset(mirror, range.startContainer, range.startOffset)
      }
    }

    if (position === null && document.caretPositionFromPoint) {
      const caretPos = document.caretPositionFromPoint(x, y)
      if (caretPos && caretPos.offsetNode === mirror) {
        position = caretPos.offset
      } else if (caretPos && caretPos.offsetNode.nodeType === Node.TEXT_NODE) {
        position = findInputTextOffset(mirror, caretPos.offsetNode, caretPos.offset)
      }
    }

    return position
  } finally {
    mirror.remove()
    styleSheet.remove()
  }
}

// 在镜像元素中找到文本节点的偏移
function findInputTextOffset(mirror: HTMLElement, textNode: Node, localOffset: number): number {
  let offset = 0
  for (const child of mirror.childNodes) {
    if (child === textNode) {
      return offset + localOffset
    }
    if (child.nodeType === Node.TEXT_NODE) {
      offset += (child as Text).length
    }
  }
  return offset + localOffset
}

// 复制选中文本
async function handleCopy() {
  const textarea = inputTextareaRef.value
  if (textarea) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    if (selectedText) {
      try {
        await navigator.clipboard.writeText(selectedText)
      } catch (error) {
        console.error('Copy failed:', error)
      }
    }
  }
  showEditMenu.value = false
}

// 粘贴文本
async function handlePaste() {
  try {
    const clipboardText = await navigator.clipboard.readText()
    if (clipboardText) {
      const textarea = inputTextareaRef.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = inputText.value
        inputText.value = text.substring(0, start) + clipboardText + text.substring(end)
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = start + clipboardText.length
          textarea.focus()
        })
      } else {
        inputText.value += clipboardText
      }
    }
  } catch (error) {
    console.error('Paste failed:', error)
  }
  showEditMenu.value = false
}

// 输入模式 - 切换录音
async function toggleInputRecording() {
  if (isInputRecording.value) {
    // 结束录音
    await stopInputRecording()
  } else {
    // 开始录音
    try {
      await inputRecorder.start()
      isInputRecording.value = true
      inputRecordingDuration.value = 0

      // 开始计时
      inputRecordingTimer = window.setInterval(() => {
        inputRecordingDuration.value += 100
        // 30秒超时自动停止
        if (inputRecordingDuration.value >= INPUT_RECORDING_TIMEOUT) {
          stopInputRecording()
        }
      }, 100)
    } catch (error) {
      console.error('Failed to start input recording:', error)
      isInputRecording.value = false
    }
  }
}

// 输入模式 - 停止录音并转写
async function stopInputRecording() {
  if (!isInputRecording.value) return

  try {
    const audioBlob = await inputRecorder.stop()
    isInputRecording.value = false

    if (inputRecordingTimer) {
      clearInterval(inputRecordingTimer)
      inputRecordingTimer = null
    }

    // 转写音频
    const settings = settingsStore.settings
    if (!settings.stt.sherpaOnnx) {
      console.error('Sherpa-ONNX not configured')
      return
    }

    const transcriptResult = await transcribeWithSherpaOnnx(audioBlob, settings.stt.sherpaOnnx)

    if (transcriptResult.success && transcriptResult.text) {
      // 追加文字到输入框
      const textarea = inputTextareaRef.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = inputText.value
        const insertText = transcriptResult.text

        // 在光标位置插入文字
        inputText.value = text.substring(0, start) + insertText + text.substring(end)

        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length
          textarea.focus()
        })
      } else {
        // 没有textarea时直接追加
        inputText.value += transcriptResult.text
      }
    }
  } catch (error) {
    console.error('Failed to stop input recording:', error)
    isInputRecording.value = false
    if (inputRecordingTimer) {
      clearInterval(inputRecordingTimer)
      inputRecordingTimer = null
    }
  }

  inputRecordingDuration.value = 0
}

// 输入模式 - 处理拖放（文字追加、图片转为链接）
async function handleInputDrop(e: DragEvent) {
  const textarea = inputTextareaRef.value

  // 处理文字拖拽
  const text = e.dataTransfer?.getData('text/plain')
  if (text && text.trim()) {
    if (textarea) {
      const insertPosition = dragCaretPosition.value ?? textarea.selectionStart
      const currentText = inputText.value

      // 判断是否是内部拖拽
      const isInternalDrag = internalDragSelection.value !== null

      if (isInternalDrag && internalDragSelection.value) {
        // 内部拖拽: 先删除选中内容,再插入到目标位置
        const { start: deleteStart, end: deleteEnd } = internalDragSelection.value

        let adjustedInsertPos = insertPosition
        if (insertPosition > deleteEnd) {
          adjustedInsertPos = insertPosition - (deleteEnd - deleteStart)
        } else if (insertPosition >= deleteStart && insertPosition <= deleteEnd) {
          adjustedInsertPos = deleteStart
        }

        const beforeDelete = currentText.substring(0, deleteStart)
        const afterDelete = currentText.substring(deleteEnd)
        const textAfterDelete = beforeDelete + afterDelete

        inputText.value = textAfterDelete.substring(0, adjustedInsertPos) + text + textAfterDelete.substring(adjustedInsertPos)

        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = adjustedInsertPos + text.length
          textarea.focus()
        })

        internalDragSelection.value = null
      } else {
        // 外部拖拽: 直接插入到目标位置
        inputText.value = currentText.substring(0, insertPosition) + text + currentText.substring(insertPosition)
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = insertPosition + text.length
          textarea.focus()
        })
      }

      dragCaretPosition.value = null
    } else {
      inputText.value += text
    }
    return
  }

  // 处理图片文件拖拽
  if (!e.dataTransfer?.files.length) return

  const files = Array.from(e.dataTransfer.files)
  const imageFiles = files.filter(f => f.type.startsWith('image/'))

  if (imageFiles.length === 0) return

  for (const file of imageFiles) {
    const markdownLink = await saveImageToNotebook(file)
    if (markdownLink) {
      const textarea = inputTextareaRef.value
      if (textarea) {
        const insertPosition = dragCaretPosition.value ?? textarea.selectionStart
        const text = inputText.value
        inputText.value = text.substring(0, insertPosition) + markdownLink + text.substring(insertPosition)
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = insertPosition + markdownLink.length
          textarea.focus()
        })
      }
    }
  }

  dragCaretPosition.value = null
}

// 保存图片到笔记本目录并返回markdown链接
async function saveImageToNotebook(file: File): Promise<string | null> {
  const notebook = notebookStore.currentNotebook
  if (!notebook) {
    console.error('[ChatPanel] No current notebook')
    return null
  }

  try {
    const imagesDir = await getNotebookImagesDir(notebook.id)

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
  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const notebookDir = await getNotebookDataDir(notebook.id)
  const imagesDir = `${notebookDir}/images`
  await window.electronAPI.mkdir(imagesDir)

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

  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const audioDir = await getNotebookAudioDir(notebook.id)
  await window.electronAPI.mkdir(audioDir)

  const arrayBuffer = await audioBlob.arrayBuffer()
  await window.electronAPI.saveFileBuffer(`${audioDir}/${nodeId}.${extension}`, arrayBuffer)

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
  border-color: var(--border-color);
  opacity: 1;
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