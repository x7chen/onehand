<template>
  <div class="pdf-reader-panel">
    <CanvasHeader
      :static-context-files="staticContextFiles"
      :all-static-context-files="allStaticContextFiles"
      :all-dynamic-context-files="allDynamicContextFiles"
      :dynamic-context-file="dynamicContextFile || undefined"
      v-model:global-hide-ai-result="globalHideAiResult"
      :show-viewport-controls="false"
      :notebook-model-id="currentNotebook?.modelId"
      :all-profiles="allProfiles"
      :active-profile-id="activeProfileId"
      :hide-navigation="true"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @select-dynamic-context="selectDynamicContext"
      @dynamic-context-drop="handleDynamicContextDrop"
      @select-model="handleSelectModel"
    />

    <div class="panel-container">
      <div v-if="!isPdfPanelCollapsed" class="pdf-panel" :style="{ width: leftPanelWidth + 'px' }">
        <PdfViewer
          v-if="currentNotebook?.pdfPath"
          ref="pdfViewerRef"
          :pdf-path="fullPdfPath"
          :nodes="currentPdfPageNodes"
          :active-node-id="activeNode?.id"
          @page-change="handlePageChange"
          @create-node="handleCreateNode"
          @recording-complete="handleRecordingComplete"
          @node-click="handleNodeClick"
          @node-position-change="handleNodePositionChange"
          @analyze-page="handleAnalyzePage"
          @explain-selection="handleExplainSelection"
          @include-page-change="handleIncludePageChange"
        />
        <div v-else class="no-pdf">
          <p>{{ t('canvas.pdfNotFound') }}</p>
        </div>
      </div>

      <!-- 分割线 -->
      <div
        v-if="!isPdfPanelCollapsed"
        class="panel-resizer"
        @mousedown="startResize"
        @dblclick="togglePdfPanel"
      >
      </div>

      <!-- 折叠状态的分隔线 -->
      <div
        v-if="isPdfPanelCollapsed"
        class="panel-resizer-collapsed"
        @dblclick="togglePdfPanel"
      >
      </div>

      <ChatPanel
        :active-node="activeNode"
        :static-context-files="staticContextFiles"
        :dynamic-context-file="dynamicContextFile"
        :ai-answer-enabled="aiAnswerEnabled"
        :context-mode="contextMode"
        :editing-node-id="editingNodeId"
        :editing-text="editingText"
        :current-page="currentPageNumber"
        :included-page-image="includedPageImage"
        :target-notebook-id="notebookId"
        @delete="handleDeleteNode"
        @play="handlePlayNode"
        @toggle-context="handleToggleContext"
        @retry-transcription="handleRetryTranscription"
        @toggle-favorite="handleToggleFavorite"
        @update-node="handleUpdateNode"
        @node-created="handleNodeCreated"
        @node-updated="handleNodeUpdated"
        @update-editing-text="editingText = $event"
        @save-edit="handleSaveEdit"
        @cancel-edit="handleCancelEdit"
        @start-editing="handleStartEditing"
        @quote-click="handleQuoteClick"
      />
    </div>

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
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import PdfViewer from '@/components/PdfViewer.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import MagicInput from '@/components/MagicInput.vue'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages, buildImageAnalysisMessages } from '@/composables/useQwenAgent'
import { loadEmbeddedImagesForTranscript, loadImageBase64 } from '@/utils/contextBuilder'
import { getNotebookAudioDir, getNotebookDataDir, getFullPdfPath } from '@/utils/userFilesPath'
import { semanticSearch } from '@/services/semanticSearch'
import type { CanvasNode, Notebook } from '@/types/notebook'
import type { ContextFile } from '@/types/context'
import type { LLMProfile } from '@/types/settings'
import type { UnifiedSearchResult } from '@/services/semanticSearch'

const props = withDefaults(defineProps<{
  notebookId: string
  staticContextFiles: ContextFile[]
  allStaticContextFiles: ContextFile[]
  allDynamicContextFiles: ContextFile[]
  dynamicContextFile: ContextFile | null
  allProfiles: LLMProfile[]
  activeProfileId: string
  activateNodeId?: string | null
  contextMode?: 'off' | 'auto' | 'rag'
}>(), {
  notebookId: '',
  staticContextFiles: () => [],
  allStaticContextFiles: () => [],
  allDynamicContextFiles: () => [],
  dynamicContextFile: null,
  allProfiles: () => [],
  activeProfileId: '',
  activateNodeId: null,
  contextMode: 'off'
})

const emit = defineEmits<{
  'node-activated': []
}>()

const { t } = useI18n()
const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const contextStore = useContextStore()

const leftPanelWidth = ref(800)
const pdfViewerRef = ref<InstanceType<typeof PdfViewer> | null>(null)

// PDF面板折叠状态
const isPdfPanelCollapsed = ref(false)

// 当前笔记本
const currentNotebook = computed(() => {
  return notebookStore.notebooks.find(nb => nb.id === props.notebookId)
})

// 完整的 PDF 路径（处理相对路径）
const fullPdfPath = ref('')

// 监听笔记本变化，更新完整 PDF 路径和重置页码
watch(currentNotebook, async (notebook, oldNotebook) => {
  if (notebook?.pdfPath) {
    fullPdfPath.value = await getFullPdfPath(notebook.pdfPath, notebook.id)
  } else {
    fullPdfPath.value = ''
  }

  // 当笔记本切换时，重置页码
  if (notebook && oldNotebook && notebook.id !== oldNotebook.id) {
    const lastPage = notebook.lastPdfPage || 1
    currentPageNumber.value = lastPage
    nextTick(() => {
      pdfViewerRef.value?.goToPage(lastPage)
      selectFirstNode()
    })
  }
}, { immediate: true })

const isResizing = ref(false)
let savePanelRatioTimer: number | null = null

const activeNodeId = ref<string | null>(null)
const activeNode = computed(() => {
  if (!activeNodeId.value) return null
  return notebookStore.getAllNodes().find(n => n.id === activeNodeId.value) || null
})
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

const globalHideAiResult = ref(false)

// AI 回答开关状态（从设置中读取默认值）
const aiAnswerEnabled = ref(settingsStore.settings.general.autoAiAnswer ?? true)

// 使用 props 的 contextMode
const contextMode = computed(() => props.contextMode ?? 'off')

// 判断是否自动勾选新笔记（只有 'auto' 模式才自动勾选）
const shouldAutoSelectNewNote = computed(() => contextMode.value === 'auto')

// 判断是否使用 RAG 上下文
const shouldUseRagContext = computed(() => contextMode.value === 'rag')

const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

const isInitialized = ref(false)

const includedPageImage = ref<{ imageBase64: string; pageNumber: number } | null>(null)

const selectedContextCount = computed(() => {
  return notebookStore.countAllSelectedContext()
})

const completedNodesCount = computed(() => {
  return notebookStore.countAllSelectableNodes()
})

const isAllContextSelected = computed(() => {
  return completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
})

const currentModelConfig = computed(() => {
  const modelId = currentNotebook.value?.modelId || props.activeProfileId
  return props.allProfiles.find(p => p.id === modelId)
})

const quickModelConfig = computed(() => {
  const quickModelId = settingsStore.settings.llm.quickModelProfileId
  if (!quickModelId) return null
  return props.allProfiles.find(p => p.id === quickModelId)
})

interface MagicInputState {
  isOpen: boolean
  mode: 'create' | 'transcript' | 'agent'
  nodeId?: string
  position?: { x: number; y: number }
  pdfPage?: number
}

const magicInputState = ref<MagicInputState>({
  isOpen: false,
  mode: 'create'
})

const magicInputInitialText = computed(() => {
  if (!magicInputState.value.nodeId) return ''
  const pdfPage = notebookStore.findNodePdfPage(magicInputState.value.nodeId)
  if (pdfPage === null) return ''
  const nodes = notebookStore.getNodesByPdfPage(pdfPage)
  const node = nodes.find(n => n.id === magicInputState.value.nodeId)
  if (!node) return ''
  if (magicInputState.value.mode === 'transcript') {
    return node.transcript || ''
  } else if (magicInputState.value.mode === 'agent') {
    return node.agentResult || ''
  }
  return ''
})

const currentPageNumber = ref(1)

const currentPdfPageNodes = computed(() => {
  return notebookStore.getNodesByPdfPage(currentPageNumber.value)
    .sort((a, b) => a.createdAt - b.createdAt)
})

const currentPageNodes = computed(() => {
  return notebookStore.getAllNodes()
    .filter(n => n.pdfPage === currentPageNumber.value)
    .sort((a, b) => a.createdAt - b.createdAt)
})

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
  const minWidth = 300
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
        pdfReaderViewLeftPanelRatio: ratio
      }
    })
    savePanelRatioTimer = null
  }, 500)
}

function initPanelWidth() {
  const containerRect = document.querySelector('.panel-container')?.getBoundingClientRect()
  if (!containerRect) return

  const ratio = settingsStore.settings.view?.pdfReaderViewLeftPanelRatio || 0.6
  const minWidth = 300
  const maxWidth = containerRect.width - 400

  leftPanelWidth.value = Math.max(minWidth, Math.min(maxWidth, containerRect.width * ratio))
}

// 折叠/展开 PDF 面板
function togglePdfPanel() {
  isPdfPanelCollapsed.value = !isPdfPanelCollapsed.value
}

// 监听 activateNodeId prop 变化，用于跳转链接激活节点
watch(() => props.activateNodeId, (nodeId) => {
  if (nodeId) {
    // 检查节点是否存在于当前笔记本
    const node = notebookStore.getAllNodes().find(n => n.id === nodeId)
    if (node) {
      activeNodeId.value = nodeId
      // 如果节点有 pdfPage，跳转到对应页面
      if (node.pdfPage) {
        currentPageNumber.value = node.pdfPage
      }
      emit('node-activated')
    }
  }
}, { immediate: true })

onMounted(async () => {
  if (props.notebookId) {
    await notebookStore.loadNotebooks()
    const notebook = notebookStore.notebooks.find(p => p.id === props.notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)

      const lastPage = notebook.lastPdfPage || 1
      currentPageNumber.value = lastPage
    }
  }
  await contextStore.loadContextFiles()
  initPanelWidth()
  document.addEventListener('click', handleClickOutsideEditing)
  window.addEventListener('keydown', handleKeyDown)

  if (!activeNodeId.value) {
    nextTick(() => {
      selectFirstNode()
    })
  }

  isInitialized.value = true
})

onUnmounted(() => {
  if (currentNotebook.value && currentPageNumber.value) {
    currentNotebook.value.lastPdfPage = currentPageNumber.value
    notebookStore.saveNotebook(currentNotebook.value)
  }

  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('click', handleClickOutsideEditing)
  window.removeEventListener('keydown', handleKeyDown)

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
})

async function handlePageChange(page: number) {
  currentPageNumber.value = page
  selectFirstNode()

  if (currentNotebook.value) {
    currentNotebook.value.lastPdfPage = page
    notebookStore.saveNotebook(currentNotebook.value)
  }

  if (includedPageImage.value && pdfViewerRef.value) {
    try {
      const imageBase64 = await pdfViewerRef.value.exportPageAsImage()
      includedPageImage.value = {
        imageBase64,
        pageNumber: page
      }
    } catch (error) {
      console.error('Failed to export page image on page change:', error)
    }
  }
}

function selectFirstNode() {
  nextTick(() => {
    const nodes = notebookStore.getNodesByPdfPage(currentPageNumber.value)
    if (nodes.length > 0) {
      const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
      activeNodeId.value = sortedNodes[0]?.id || null
    } else {
      activeNodeId.value = null
    }
  })
}

watch(currentPageNumber, (newPage) => {
  nextTick(() => {
    pdfViewerRef.value?.goToPage(newPage)
  })
})

function handleKeyDown(e: KeyboardEvent) {
  if (editingNodeId.value) return

  const activeElement = document.activeElement
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)) {
    return
  }

  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    pdfViewerRef.value?.prevPage()
    return
  }

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    pdfViewerRef.value?.nextPage()
    return
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const nodes = currentPageNodes.value
    if (nodes.length === 0) return

    e.preventDefault()

    const currentIndex = activeNodeId.value
      ? nodes.findIndex(n => n.id === activeNodeId.value)
      : -1

    let newIndex = currentIndex
    if (e.key === 'ArrowUp') {
      newIndex = currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex >= nodes.length - 1 ? 0 : currentIndex + 1
    }

    activeNodeId.value = nodes[newIndex]?.id || null
  }
}

function handleNodePositionChange(data: { nodeId: string; position: { x: number; y: number } }) {
  notebookStore.updateNodeAuto(data.nodeId, { pdfPosition: data.position })
}

function handleCreateNode(data: { type: 'text-note' | 'voice-note'; page: number; x: number; y: number }) {
  if (data.type === 'voice-note') return

  magicInputState.value = {
    isOpen: true,
    mode: 'create',
    position: { x: data.x, y: data.y },
    pdfPage: data.page
  }
}

function handleMagicInputSave(text: string) {
  const state = magicInputState.value

  if (state.mode === 'create') {
    const position = state.position || { x: 100, y: 100 }
    const pdfPage = state.pdfPage || currentPageNumber.value
    const nodeId = uuidv4()
    const title = text.slice(0, 10)

    const node: CanvasNode = {
      id: nodeId,
      type: 'text-note',
      title,
      transcript: text,
      transcriptStatus: 'done',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: shouldAutoSelectNewNote.value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pdfPage,
      pdfPosition: position
    }

    notebookStore.addNodeToPdfPage(node, pdfPage)
    activeNodeId.value = nodeId

    if (aiAnswerEnabled.value) {
      callAIWithOptionalImage(nodeId, text, pdfPage)
    }
  } else if (state.mode === 'transcript' && state.nodeId) {
    const pdfPage = notebookStore.findNodePdfPage(state.nodeId)
    const title = text.slice(0, 10)
    if (pdfPage !== null) {
      notebookStore.updateNode(state.nodeId, { transcript: text, title })
    } else {
      notebookStore.updateNode(state.nodeId, { transcript: text, title })
    }
  } else if (state.mode === 'agent' && state.nodeId) {
    const pdfPage = notebookStore.findNodePdfPage(state.nodeId)
    if (pdfPage !== null) {
      notebookStore.updateNode(state.nodeId, { agentResult: text, agentStatus: 'done' })
    } else {
      notebookStore.updateNode(state.nodeId, { agentResult: text, agentStatus: 'done' })
    }
  }

  magicInputState.value = { isOpen: false, mode: 'create' }
}

function handleMagicInputCancel() {
  magicInputState.value = { isOpen: false, mode: 'create' }
}

async function handleRecordingComplete(data: { audioBlob: Blob; duration: number; page: number; x: number; y: number }) {
  const nodeId = uuidv4()
  const title = `第 ${data.page} 页录音`

  const node: CanvasNode = {
    id: nodeId,
    type: 'voice-note',
    title,
    transcript: '',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: shouldAutoSelectNewNote.value,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pdfPage: data.page,
    pdfPosition: { x: data.x, y: data.y },
    duration: data.duration
  }

  notebookStore.addNodeToPdfPage(node, data.page)
  activeNodeId.value = nodeId

  try {
    const extension = data.audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
    const audioPath = `audio/${nodeId}.${extension}`

    const notebook = currentNotebook.value
    if (!notebook) return

    const audioDir = await getNotebookAudioDir(notebook.id)
    await window.electronAPI.mkdir(audioDir)

    const arrayBuffer = await data.audioBlob.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${audioDir}/${nodeId}.${extension}`, arrayBuffer)

    notebookStore.updateNode(nodeId, { audioPath })

    notebookStore.updateNode(nodeId, { transcriptStatus: 'processing' })
    const transcriptResult = await transcribeWithSherpaOnnx(data.audioBlob, settingsStore.settings.stt.sherpaOnnx)

    if (transcriptResult.success && transcriptResult.text) {
      notebookStore.updateNode(nodeId, {
        transcript: transcriptResult.text,
        transcriptStatus: 'done',
        title: transcriptResult.text.slice(0, 10)
      })

      if (aiAnswerEnabled.value) {
        callAIWithOptionalImage(nodeId, transcriptResult.text, data.page)
      }
    } else {
      notebookStore.updateNode(nodeId, {
        transcript: '',
        transcriptStatus: 'error'
      })
    }
  } catch (error) {
    console.error('Failed to process recording:', error)
    notebookStore.updateNode(nodeId, { transcriptStatus: 'error' })
  }
}

function handleNodeClick(node: CanvasNode) {
  activeNodeId.value = node.id
  // 更新全局激活节点（用于StatusBar显示）
  notebookStore.setGlobalActiveNodeId(node.id)
}

// 点击引用项（从 ChatPanel quote-container）
function handleQuoteClick(nodeId: string) {
  activeNodeId.value = nodeId
  notebookStore.setGlobalActiveNodeId(nodeId)
  // 查找节点所在的PDF页面并跳转
  const node = currentNotebook.value?.nodes?.find((n: CanvasNode) => n.id === nodeId)
  if (node?.pdfPage) {
    currentPageNumber.value = node.pdfPage
  }
}

function handleNodeCreated(node: CanvasNode) {
  activeNodeId.value = node.id
  // 更新全局激活节点（用于StatusBar显示）
  notebookStore.setGlobalActiveNodeId(node.id)
}

function handleStartEditing(nodeId: string) {
  editingNodeId.value = nodeId
  editingText.value = ''
}

function handleNodeUpdated(node: CanvasNode) {
  // activeNode 是 computed 属性，自动更新
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    const pdfPage = notebookStore.findNodePdfPage(nodeId)
    const title = text.trim().slice(0, 10)

    notebookStore.updateNodeAuto(nodeId, { transcript: text.trim(), title })

    if (aiAnswerEnabled.value && pdfPage !== null) {
      callAIWithOptionalImage(nodeId, text.trim(), pdfPage)
    }
  } else {
    notebookStore.removeNodeAuto(nodeId)
    activeNodeId.value = null
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleCancelEdit(nodeId: string) {
  const nodes = notebookStore.getAllNodes()
  const node = nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    notebookStore.removeNodeAuto(nodeId)
    activeNodeId.value = null
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

  const pdfPage = notebookStore.findNodePdfPage(editingNodeId.value)
  const nodes = pdfPage !== null ? notebookStore.getNodesByPdfPage(pdfPage) : notebookStore.getAllNodes()
  const node = nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      notebookStore.updateNodeAuto(editingNodeId.value, { transcript: editingText.value.trim() })
      if (aiAnswerEnabled.value && pdfPage !== null) {
        callAIWithOptionalImage(editingNodeId.value, editingText.value.trim(), pdfPage)
      }
    } else {
      notebookStore.removeNodeAuto(editingNodeId.value)
      activeNodeId.value = null
    }
  }
  editingNodeId.value = null
  editingText.value = ''
}

function callAIWithOptionalImage(nodeId: string, transcript: string, pdfPage: number) {
  if (!aiAnswerEnabled.value) return

  const hasIncludedImage = includedPageImage.value && includedPageImage.value.pageNumber === pdfPage

  if (hasIncludedImage) {
    callImageAnalysisAI(nodeId, includedPageImage.value!.imageBase64, transcript, pdfPage)
  } else {
    handleAgentResponse(nodeId, transcript, pdfPage)
  }
}

async function handleAgentResponse(nodeId: string, transcript: string, pdfPage: number) {
  const settings = settingsStore.settings

  try {
    notebookStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = notebookStore.getNodesByPdfPage(pdfPage).find(n => n.id === nodeId)
    if (!node) return

    let currentEmbeddedImages = node.embeddedImages
    if (!currentEmbeddedImages && transcript) {
      const notebook = currentNotebook.value
      if (notebook) {
        currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript, notebook.id, window.electronAPI.readFile)
        if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
          notebookStore.updateNode(nodeId, { embeddedImages: currentEmbeddedImages })
        }
      }
    }

    // 获取上下文节点
    let selectedNodes: { transcript: string; agentResult: string; imageBase64?: string; embeddedImages?: string[] }[]

    // RAG 模式：使用语义搜索获取前10条相关笔记作为上下文
    if (shouldUseRagContext.value && transcript.trim()) {
      console.log('[RAG] Performing semantic search for:', transcript.slice(0, 50))
      try {
        const ragResults = await semanticSearch(transcript, 10)
        console.log('[RAG] Found', ragResults.length, 'results')

        // 将搜索结果转换为上下文节点格式
        selectedNodes = await Promise.all(ragResults.map(async (result: UnifiedSearchResult) => {
          // 根据搜索结果找到对应节点
          const ragNotebook = notebookStore.notebooks.find(nb => nb.id === result.notebookId)
          const ragNode = ragNotebook?.nodes?.find(n => n.id === result.nodeId)

          let embeddedImages = ragNode?.embeddedImages
          if (!embeddedImages && ragNode?.transcript) {
            embeddedImages = await loadEmbeddedImagesForTranscript(ragNode.transcript, result.notebookId, window.electronAPI.readFile)
          }

          return {
            transcript: result.fieldType === 'transcript' ? result.fullText : (ragNode?.transcript || ''),
            agentResult: result.fieldType === 'agentResult' ? result.fullText : (ragNode?.agentResult || ''),
            imageBase64: ragNode?.imageBase64,
            embeddedImages
          }
        }))
      } catch (e) {
        console.error('[RAG] Semantic search failed:', e)
        selectedNodes = []
      }
    } else {
      // 非 RAG 模式：使用手动勾选的节点
      selectedNodes = notebookStore.getAllSelectedContextNodes(nodeId)
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

    const modelConfig = currentModelConfig.value
    if (!modelConfig) {
      notebookStore.updateNode(nodeId, {
        agentResult: '模型配置错误，请检查设置',
        agentStatus: 'error'
      })
      return
    }

    chatWithLLM(messages, {
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
    }).then(result => {
      notebookStore.updateNode(nodeId, {
        agentResult: result.content,
        agentStatus: 'done',
        thinkingContent: result.thinking,
        thinkingStatus: result.thinking ? 'done' : undefined
      })
    }).catch(error => {
      notebookStore.updateNode(nodeId, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    })
  } catch (error) {
    notebookStore.updateNode(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

function handleDeleteNode(nodeId: string) {
  notebookStore.removeNodeAuto(nodeId)
  if (activeNodeId.value === nodeId) {
    activeNodeId.value = null
  }
}

async function handlePlayNode(nodeId: string) {
  const nodes = notebookStore.getAllNodes()
  const node = nodes.find(n => n.id === nodeId)
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
    const notebook = currentNotebook.value
    if (!notebook || !node.audioPath) return

    const notebookDir = await getNotebookDataDir(notebook.id)
    const audioPath = `${notebookDir}/${node.audioPath}`

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
  const nodes = notebookStore.getAllNodes()
  const node = nodes.find(n => n.id === nodeId)
  if (node) {
    const newSelectedState = !node.selectedAsContext
    notebookStore.updateNode(nodeId, { selectedAsContext: newSelectedState })

    const notebook = currentNotebook.value
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

async function handleRetryTranscription(nodeId: string) {
  const nodes = notebookStore.getAllNodes()
  const node = nodes.find(n => n.id === nodeId)
  if (!node || !node.audioPath) return

  notebookStore.updateNode(nodeId, { transcriptStatus: 'processing' })

  try {
    const notebook = currentNotebook.value
    if (!notebook) return

    const notebookDir = await getNotebookDataDir(notebook.id)
    const audioPath = `${notebookDir}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const extension = node.audioPath.split('.').pop()?.toLowerCase()
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/webm'
      const blob = new Blob([result.data], { type: mimeType })

      const transcriptResult = await transcribeWithSherpaOnnx(blob, settingsStore.settings.stt.sherpaOnnx)

      if (transcriptResult.success && transcriptResult.text) {
        notebookStore.updateNode(nodeId, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done',
          title: transcriptResult.text.slice(0, 10)
        })
      } else {
        throw new Error(transcriptResult.error || '转写失败')
      }
    }
  } catch (error) {
    console.error('Transcription failed:', error)
    notebookStore.updateNode(nodeId, { transcriptStatus: 'error' })
  }
}

function handleToggleFavorite(nodeId: string) {
  const nodes = notebookStore.getAllNodes()
  const node = nodes.find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNode(nodeId, { isFavorite: !node.isFavorite })
  }
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  notebookStore.updateNodeAuto(nodeId, updates)
}

async function toggleStaticContext(contextId: string) {
  if (!currentNotebook.value) return

  const currentIds = currentNotebook.value.context?.staticContextIds || []
  const newIds = currentIds.includes(contextId)
    ? currentIds.filter(id => id !== contextId)
    : [...currentIds, contextId]

  if (!currentNotebook.value.context) {
    currentNotebook.value.context = {}
  }

  if (newIds.length > 0) {
    if (!currentNotebook.value.context.staticContextIds) {
      currentNotebook.value.context.staticContextIds = []
    }
    currentNotebook.value.context.staticContextIds.splice(0, currentNotebook.value.context.staticContextIds.length, ...newIds)
  } else {
    currentNotebook.value.context.staticContextIds = undefined
  }

  await notebookStore.saveNotebook(currentNotebook.value)
}

async function selectDynamicContext(contextId: string) {
  if (!currentNotebook.value) return

  if (!currentNotebook.value.context) {
    currentNotebook.value.context = {}
  }

  if (currentNotebook.value.context.dynamicContextId === contextId) {
    currentNotebook.value.context.dynamicContextId = undefined
  } else {
    currentNotebook.value.context.dynamicContextId = contextId
  }

  await notebookStore.saveNotebook(currentNotebook.value)
}

function openDynamicContextEditor() {
  if (props.dynamicContextFile) {
    dynamicContextEditContent.value = props.dynamicContextFile.content || ''
    showDynamicContextEditor.value = true
  }
}

async function saveDynamicContextEdit() {
  if (props.dynamicContextFile) {
    await contextStore.updateContextFile(props.dynamicContextFile.id, {
      content: dynamicContextEditContent.value
    })
    showDynamicContextEditor.value = false
  }
}

async function handleDynamicContextDrop(text: string) {
  let file = props.dynamicContextFile
  if (!file) {
    const notebookName = currentNotebook.value?.name || '动态上下文'
    file = await contextStore.createContextFile(notebookName, 'dynamic')
    if (currentNotebook.value) {
      currentNotebook.value.context = {
        ...currentNotebook.value.context,
        dynamicContextId: file.id
      }
      notebookStore.saveNotebook(currentNotebook.value)
    }
  }

  const newContent = file.content ? `${file.content}\n\n${text}` : text
  await contextStore.updateContextFile(file.id, { content: newContent })
}

async function handleSelectModel(modelId: string) {
  if (!currentNotebook.value) return

  currentNotebook.value.modelId = modelId
  await notebookStore.saveNotebook(currentNotebook.value)
}

function handleToggleAllContext() {
  const allNodes = notebookStore.getAllNodes()
  if (isAllContextSelected.value) {
    allNodes.forEach(node => {
      if (node.selectedAsContext) {
        notebookStore.updateNodeAuto(node.id, { selectedAsContext: false })
      }
    })
  } else {
    allNodes.forEach(node => {
      if (node.transcriptStatus === 'done') {
        notebookStore.updateNodeAuto(node.id, { selectedAsContext: true })
      }
    })
  }
}

function handleInvertSelection() {
  const allNodes = notebookStore.getAllNodes()
  allNodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      notebookStore.updateNodeAuto(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function clearContextSelection() {
  const allNodes = notebookStore.getAllNodes()
  allNodes.forEach(node => {
    if (node.selectedAsContext) {
      notebookStore.updateNodeAuto(node.id, { selectedAsContext: false })
    }
  })
}

async function handleCopySelectedContext() {
  const selectedNodes = notebookStore.getAllSelectedContextNodes()
    .filter(n => n.transcript)
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

async function handleAnalyzePage(data: { imageBase64: string; pageNumber: number; position: { x: number; y: number } }) {
  const nodeId = uuidv4()
  const title = `第 ${data.pageNumber} 页分析`

  const node: CanvasNode = {
    id: nodeId,
    type: 'text-note',
    title,
    transcript: '分析当前页面',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'processing',
    selectedAsContext: shouldAutoSelectNewNote.value,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pdfPage: data.pageNumber,
    pdfPosition: data.position
  }

  notebookStore.addNodeToPdfPage(node, data.pageNumber)
  activeNodeId.value = nodeId

  await callImageAnalysisAI(nodeId, data.imageBase64, '请分析这个 PDF 页面的内容，总结主要信息。', data.pageNumber)
}

async function handleExplainSelection(data: { imageBase64: string; selectedText: string; pageNumber: number; position: { x: number; y: number } }) {
  const nodeId = uuidv4()
  const title = data.selectedText.length > 10 ? data.selectedText.slice(0, 10) + '...' : data.selectedText

  const node: CanvasNode = {
    id: nodeId,
    type: 'text-note',
    title,
    transcript: data.selectedText,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'processing',
    selectedAsContext: shouldAutoSelectNewNote.value,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pdfPage: data.pageNumber,
    pdfPosition: data.position
  }

  notebookStore.addNodeToPdfPage(node, data.pageNumber)
  activeNodeId.value = nodeId

  await callImageAnalysisAI(nodeId, data.imageBase64, `请解释以下内容：\n\n${data.selectedText}`, data.pageNumber)
}

async function callImageAnalysisAI(
  nodeId: string,
  imageBase64: string,
  prompt: string,
  pdfPage: number
) {
  const settings = settingsStore.settings

  try {
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
    console.error('Image analysis failed:', error)
    notebookStore.updateNode(nodeId, {
      agentResult: `分析失败: ${error}`,
      agentStatus: 'error'
    })
  }
}

function handleIncludePageChange(data: { include: boolean; imageBase64?: string; pageNumber: number }) {
  if (data.include && data.imageBase64) {
    includedPageImage.value = {
      imageBase64: data.imageBase64,
      pageNumber: data.pageNumber
    }
  } else {
    includedPageImage.value = null
  }
}
</script>

<style scoped>
.pdf-reader-panel {
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

.pdf-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-secondary);
  min-width: 300px;
  flex-shrink: 0;
}

.no-pdf {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}

.panel-resizer {
  width: 4px;
  background: var(--bg-primary);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer:hover {
  background: var(--color-primary);
  opacity: 0.5;
}

.panel-resizer-collapsed {
  width: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s;
}

.panel-resizer-collapsed:hover {
  background: var(--border-color);
}

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
  font-size: var(--font-size-title);
  color: var(--text-primary);
}

.no-dynamic-context {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.no-dynamic-context .hint {
  font-size: var(--font-size-body);
}

.content-input {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: var(--font-size-heading);
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