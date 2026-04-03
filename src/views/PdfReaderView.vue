<template>
  <div class="pdf-reader-view">
    <CanvasHeader
      :notebook-name="notebookStore.currentNotebook?.name || ''"
      :static-context-files="staticContextFiles"
      :all-static-context-files="contextStore.staticContextFiles"
      :all-dynamic-context-files="contextStore.dynamicContextFiles"
      :dynamic-context-file="dynamicContextFile || undefined"
      v-model:global-hide-ai-result="globalHideAiResult"
      v-model:ai-answer-enabled="aiAnswerEnabled"
      :is-all-context-selected="isAllContextSelected"
      :show-viewport-controls="false"
      :selected-context-count="selectedContextCount"
      :notebook-model-id="notebookStore.currentNotebook?.modelId"
      :all-profiles="settingsStore.settings.llm.profiles"
      :active-profile-id="settingsStore.settings.llm.activeProfileId"
      @back="goBack"
      @toggle-all-context="handleToggleAllContext"
      @invert-selection="handleInvertSelection"
      @open-dynamic-context-editor="openDynamicContextEditor"
      @toggle-static-context="toggleStaticContext"
      @select-dynamic-context="selectDynamicContext"
      @dynamic-context-drop="handleDynamicContextDrop"
      @copy-selected-context="handleCopySelectedContext"
      @select-model="handleSelectModel"
    />

    <div class="panel-container">
      <div class="pdf-panel" :style="{ width: leftPanelWidth + 'px' }">
        <PdfViewer
          v-if="notebookStore.currentNotebook?.pdfPath"
          ref="pdfViewerRef"
          :pdf-path="getFullPdfPath()"
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

      <div class="panel-resizer" @mousedown="startResize">
        <div class="resizer-line"></div>
      </div>

      <ChatPanel
        :active-node="activeNode"
        :static-context-files="staticContextFiles"
        :dynamic-context-file="dynamicContextFile"
        :ai-answer-enabled="aiAnswerEnabled"
        :editing-node-id="editingNodeId"
        :editing-text="editingText"
        :current-page="currentPageNumber"
        :included-page-image="includedPageImage"
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
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import PdfViewer from '@/components/PdfViewer.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages, buildImageAnalysisMessages } from '@/composables/useQwenAgent'
import type { CanvasNode } from '@/types/notebook'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const notebookStore = useNotebookStore()
const settingsStore = useSettingsStore()
const contextStore = useContextStore()

const leftPanelWidth = ref(800)
const pdfViewerRef = ref<InstanceType<typeof PdfViewer> | null>(null)

const isResizing = ref(false)
let savePanelRatioTimer: number | null = null

const activeNode = ref<CanvasNode | null>(null)
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

const globalHideAiResult = ref(false)
const aiAnswerEnabled = ref(true)

const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

// 附图功能状态
const includedPageImage = ref<{ imageBase64: string; pageNumber: number } | null>(null)

const staticContextFiles = computed(() => {
  const ids = notebookStore.currentNotebook?.context?.staticContextIds || []
  return contextStore.staticContextFiles.filter(f => ids.includes(f.id))
})

const dynamicContextFile = computed(() => {
  const id = notebookStore.currentNotebook?.context?.dynamicContextId
  return id ? contextStore.dynamicContextFiles.find(f => f.id === id) : null
})

const selectedContextCount = computed(() => {
  // 统计所有画布的已选中节点
  return notebookStore.countAllSelectedContext()
})

const completedNodesCount = computed(() => {
  // 统计所有画布的可选择节点
  return notebookStore.countAllSelectableNodes()
})

const isAllContextSelected = computed(() => {
  return completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
})

// 获取当前笔记本使用的模型配置
const currentModelConfig = computed(() => {
  const modelId = notebookStore.currentNotebook?.modelId || settingsStore.settings.llm.activeProfileId
  return settingsStore.settings.llm.profiles.find(p => p.id === modelId)
})

const currentPageNumber = ref(1)

// 当前 PDF 页面的节点（用于 PdfViewer 组件）
const currentPdfPageNodes = computed(() => {
  return notebookStore.getNodesByPdfPage(currentPageNumber.value)
    .sort((a, b) => a.createdAt - b.createdAt)
})

// 当前选中画布的节点（用于 ChatPanel 组件，保持兼容）
const currentPageNodes = computed(() => {
  return notebookStore.currentCanvas?.nodes
    .filter(n => n.pdfPage === currentPageNumber.value)
    .sort((a, b) => a.createdAt - b.createdAt) || []
})

function getFullPdfPath(): string {
  if (!notebookStore.currentNotebook?.pdfPath) return ''
  if (notebookStore.currentNotebook.pdfPath.startsWith('file://') || notebookStore.currentNotebook.pdfPath.startsWith('http')) {
    return notebookStore.currentNotebook.pdfPath
  }
  return `file://${notebookStore.currentNotebook.pdfPath}`
}

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

onMounted(async () => {
  const notebookId = route.params.notebookId as string
  if (notebookId) {
    await notebookStore.loadNotebooks()
    const notebook = notebookStore.notebooks.find(p => p.id === notebookId)
    if (notebook) {
      notebookStore.setCurrentNotebook(notebook)

      // 处理深度链接参数
      const nodeId = route.query.nodeId as string
      if (nodeId) {
        // 查找节点所在的 PDF 页面
        const pdfPage = notebookStore.findNodePdfPage(nodeId)
        if (pdfPage !== null) {
          // 切换到该页面
          notebookStore.switchToPdfPage(pdfPage)
          currentPageNumber.value = pdfPage
          // 激活该节点
          const canvas = notebookStore.getCanvasByPdfPage(pdfPage)
          if (canvas) {
            const node = canvas.nodes.find(n => n.id === nodeId)
            if (node) {
              activeNode.value = node
            }
          }
        }
        // 清除 URL 中的查询参数
        router.replace({ path: route.path, query: {} })
      } else {
        // 没有指定节点时，使用当前画布的页面
        const currentCanvas = notebook.canvases?.[notebook.currentCanvasIndex ?? 0]
        if (currentCanvas?.pdfPage) {
          currentPageNumber.value = currentCanvas.pdfPage
        }
      }
    }
  }
  await contextStore.loadContextFiles()
  initPanelWidth()
  document.addEventListener('click', handleClickOutsideEditing)
  window.addEventListener('keydown', handleKeyDown)

  // 如果没有通过深度链接激活节点，选中第一个节点
  if (!activeNode.value) {
    nextTick(() => {
      selectFirstNode()
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('click', handleClickOutsideEditing)
  window.removeEventListener('keydown', handleKeyDown)

  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
})

function goBack() {
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }
  playingNodeId.value = null
  router.push('/')
}

async function handlePageChange(page: number) {
  currentPageNumber.value = page
  // 切换到对应 PDF 页面的画布（如果存在）
  notebookStore.switchToPdfPage(page)
  // 切换页面后选中第一个节点
  selectFirstNode()

  // 如果附图勾选框是勾选状态，需要重新导出当前页面的图片
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

// 选中当前 PDF 页面的第一个节点
function selectFirstNode() {
  nextTick(() => {
    const nodes = notebookStore.getNodesByPdfPage(currentPageNumber.value)
    if (nodes.length > 0) {
      const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
      activeNode.value = sortedNodes[0]
    } else {
      activeNode.value = null
    }
  })
}

// Watch for canvas changes (e.g., from deep link navigation) and update page
watch(() => notebookStore.currentCanvas, (newCanvas) => {
  if (newCanvas?.pdfPage && newCanvas.pdfPage !== currentPageNumber.value) {
    currentPageNumber.value = newCanvas.pdfPage
    // Navigate PdfViewer to the new page
    nextTick(() => {
      pdfViewerRef.value?.goToPage(newCanvas.pdfPage!)
    })
  }
}, { immediate: false })

// Watch for currentPageNumber changes and sync with PdfViewer
watch(currentPageNumber, (newPage) => {
  nextTick(() => {
    pdfViewerRef.value?.goToPage(newPage)
  })
})

function handleKeyDown(e: KeyboardEvent) {
  if (editingNodeId.value) return

  // 左右键：PDF 页面翻页
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

  // 上下键：节点导航
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const nodes = currentPageNodes.value
    if (nodes.length === 0) return

    e.preventDefault()

    const currentIndex = activeNode.value
      ? nodes.findIndex(n => n.id === activeNode.value!.id)
      : -1

    let newIndex = currentIndex
    if (e.key === 'ArrowUp') {
      newIndex = currentIndex <= 0 ? nodes.length - 1 : currentIndex - 1
    } else {
      newIndex = currentIndex >= nodes.length - 1 ? 0 : currentIndex + 1
    }

    activeNode.value = nodes[newIndex]
  }
}

function handleNodePositionChange(data: { nodeId: string; position: { x: number; y: number } }) {
  notebookStore.updateNodeAuto(data.nodeId, { pdfPosition: data.position })
}

function handleCreateNode(data: { type: 'text-note' | 'voice-note'; page: number; x: number; y: number }) {
  if (data.type === 'voice-note') return

  const nodeId = `node-${Date.now()}`
  const title = `第 ${data.page} 页笔记`

  const node: CanvasNode = {
    id: nodeId,
    type: data.type,
    title,
    position: { x: 0, y: 0 },
    transcript: '',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    createdAt: Date.now(),
    pdfPage: data.page,
    pdfPosition: { x: data.x, y: data.y }
  }

  editingNodeId.value = nodeId
  editingText.value = ''
  notebookStore.addNodeToPdfPage(node, data.page)
  activeNode.value = node
}

async function handleRecordingComplete(data: { audioBlob: Blob; duration: number; page: number; x: number; y: number }) {
  const nodeId = `node-${Date.now()}`
  const title = `第 ${data.page} 页录音`

  const node: CanvasNode = {
    id: nodeId,
    type: 'voice-note',
    title,
    position: { x: 0, y: 0 },
    transcript: '',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    createdAt: Date.now(),
    pdfPage: data.page,
    pdfPosition: { x: data.x, y: data.y },
    duration: data.duration
  }

  // 使用新的 PDF 页面画布管理方法
  notebookStore.addNodeToPdfPage(node, data.page)
  activeNode.value = node

  try {
    const extension = data.audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
    const audioPath = `audio/${nodeId}.${extension}`

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const notebook = notebookStore.currentNotebook
    if (!notebook) return

    const notebookDir = `${appDataPath}/notebooks/${notebook.id}`
    await window.electronAPI.mkdir(`${notebookDir}/audio`)

    const arrayBuffer = await data.audioBlob.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${notebookDir}/${audioPath}`, arrayBuffer)

    notebookStore.updateNodeInPdfPage(nodeId, data.page, { audioPath })

    notebookStore.updateNodeInPdfPage(nodeId, data.page, { transcriptStatus: 'processing' })
    const transcriptResult = await transcribeWithSherpaOnnx(data.audioBlob, settingsStore.settings.stt.sherpaOnnx)

    if (transcriptResult.success && transcriptResult.text) {
      notebookStore.updateNodeInPdfPage(nodeId, data.page, {
        transcript: transcriptResult.text,
        transcriptStatus: 'done',
        title: transcriptResult.text.slice(0, 10)
      })

      if (aiAnswerEnabled.value) {
        callAIWithOptionalImage(nodeId, transcriptResult.text, data.page)
      }
    } else {
      notebookStore.updateNodeInPdfPage(nodeId, data.page, {
        transcript: '',
        transcriptStatus: 'error'
      })
    }
  } catch (error) {
    console.error('Failed to process recording:', error)
    notebookStore.updateNodeInPdfPage(nodeId, data.page, { transcriptStatus: 'error' })
  }
}

function handleNodeClick(node: CanvasNode) {
  activeNode.value = node
}

function handleNodeActivate(nodeId: string) {
  const node = notebookStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    activeNode.value = node
  }
}

function handleNodeCreated(node: CanvasNode) {
  activeNode.value = node
}

function handleStartEditing(nodeId: string) {
  editingNodeId.value = nodeId
  editingText.value = ''
}

function handleNodeUpdated(node: CanvasNode) {
  if (activeNode.value?.id === node.id) {
    activeNode.value = node
  }
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    const pdfPage = notebookStore.findNodePdfPage(nodeId)
    const title = text.trim().slice(0, 10)

    notebookStore.updateNodeAuto(nodeId, { transcript: text.trim(), title })

    if (activeNode.value?.id === nodeId) {
      const canvas = pdfPage !== null ? notebookStore.getCanvasByPdfPage(pdfPage) : null
      activeNode.value = canvas?.nodes.find(n => n.id === nodeId) || null
    }

    if (aiAnswerEnabled.value && pdfPage !== null) {
      callAIWithOptionalImage(nodeId, text.trim(), pdfPage)
    }
  } else {
    // 删除空节点后选中第一个节点
    notebookStore.removeNodeAuto(nodeId)
    selectFirstNode()
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleCancelEdit(nodeId: string) {
  const pdfPage = notebookStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? notebookStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    // 删除空节点后选中第一个节点
    notebookStore.removeNodeAuto(nodeId)
    selectFirstNode()
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleClickOutsideEditing(e: MouseEvent) {
  if (!editingNodeId.value) return

  const target = e.target as HTMLElement

  // 点击编辑框或节点本身不结束编辑
  if (target.closest('.content-edit') || target.closest('.voice-note')) {
    return
  }

  const pdfPage = notebookStore.findNodePdfPage(editingNodeId.value)
  const canvas = pdfPage !== null ? notebookStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      notebookStore.updateNodeAuto(editingNodeId.value, { transcript: editingText.value.trim() })
      if (activeNode.value?.id === editingNodeId.value) {
        activeNode.value = canvas?.nodes.find(n => n.id === editingNodeId.value) || null
      }
      if (aiAnswerEnabled.value && pdfPage !== null) {
        callAIWithOptionalImage(editingNodeId.value, editingText.value.trim(), pdfPage)
      }
    } else {
      // 删除空节点后选中第一个节点
      notebookStore.removeNodeAuto(editingNodeId.value)
      selectFirstNode()
    }
  }
  editingNodeId.value = null
  editingText.value = ''
}

/**
 * 调用 AI 处理节点内容，自动判断是否使用附图
 */
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
    notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { agentStatus: 'processing' })

    const node = notebookStore.getCanvasByPdfPage(pdfPage)?.nodes.find(n => n.id === nodeId)
    if (!node) return

    // 加载当前节点的内嵌图片（如果尚未加载）
    let currentEmbeddedImages = node.embeddedImages
    if (!currentEmbeddedImages && transcript) {
      currentEmbeddedImages = await loadEmbeddedImagesForTranscript(transcript)
      if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
        notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { embeddedImages: currentEmbeddedImages })
      }
    }

    // 使用跨画布的已选中节点作为上下文
    const selectedNodes = notebookStore.getAllSelectedContextNodes(nodeId)

    const staticContextContent = staticContextFiles.value
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '', imageBase64: n.imageBase64, embeddedImages: n.embeddedImages })),
      transcript,
      staticContextContent,
      dynamicContextFile.value?.content,
      currentEmbeddedImages
    )

    let accumulatedContent = ''

    const modelConfig = currentModelConfig.value
    if (!modelConfig) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: '模型配置错误，请检查设置',
        agentStatus: 'error'
      })
      return
    }

    chatWithLLM(messages, {
      baseUrl: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey,
      model: modelConfig.model
    }, (chunk) => {
      accumulatedContent += chunk
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })
    }).then(result => {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: result,
        agentStatus: 'done'
      })
    }).catch(error => {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    })
  } catch (error) {
    notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

function handleDeleteNode(nodeId: string) {
  notebookStore.removeNodeAuto(nodeId)
  if (activeNode.value?.id === nodeId) {
    activeNode.value = null
  }
}

async function handlePlayNode(nodeId: string) {
  const pdfPage = notebookStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? notebookStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
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
  const pdfPage = notebookStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? notebookStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    const newSelectedState = !node.selectedAsContext
    notebookStore.updateNodeAuto(nodeId, { selectedAsContext: newSelectedState })

    // 如果是图片节点且被勾选，加载base64
    if (newSelectedState && node.type === 'image-note' && node.imagePath && !node.imageBase64) {
      loadImageBase64(nodeId, node.imagePath, pdfPage)
    }

    // 如果是文本节点且被勾选，加载内嵌图片的base64
    if (newSelectedState && (node.type === 'voice-note' || node.type === 'text-note') && node.transcript) {
      loadEmbeddedImages(nodeId, node.transcript, pdfPage)
    }
  }
}

// 提取文本中的图片路径
function extractImagePaths(text: string): string[] {
  const imgRegex = /!\[.*?\]\((images\/[^)]+)\)/g
  const paths: string[] = []
  let match
  while ((match = imgRegex.exec(text)) !== null) {
    paths.push(match[1])
  }
  return paths
}

// 加载文本节点内嵌图片的base64编码
async function loadEmbeddedImages(nodeId: string, transcript: string, pdfPage: number | null) {
  const imagePaths = extractImagePaths(transcript)
  if (imagePaths.length === 0) return

  const appDataPath = await window.electronAPI.getAppPath('userData')
  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const base64Images: string[] = []

  for (const imagePath of imagePaths) {
    const fullPath = `${appDataPath}/notebooks/${notebook.id}/${imagePath}`
    const result = await window.electronAPI.readFile(fullPath, 'arraybuffer')

    if (result.success && result.data) {
      const buffer = result.data as ArrayBuffer
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      // 获取图片的MIME类型
      const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'
      const mimeTypes: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp'
      }
      const mimeType = mimeTypes[ext] || 'image/png'

      base64Images.push(`data:${mimeType};base64,${base64}`)
    }
  }

  if (base64Images.length > 0) {
    if (pdfPage !== null) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        embeddedImages: base64Images
      })
    } else {
      notebookStore.updateNode(nodeId, {
        embeddedImages: base64Images
      })
    }
  }
}

// 加载 transcript 中的内嵌图片并返回 base64 数组
async function loadEmbeddedImagesForTranscript(transcript: string): Promise<string[] | undefined> {
  const imagePaths = extractImagePaths(transcript)
  if (imagePaths.length === 0) return undefined

  const appDataPath = await window.electronAPI.getAppPath('userData')
  const notebook = notebookStore.currentNotebook
  if (!notebook) return undefined

  const base64Images: string[] = []

  for (const imagePath of imagePaths) {
    const fullPath = `${appDataPath}/notebooks/${notebook.id}/${imagePath}`
    const result = await window.electronAPI.readFile(fullPath, 'arraybuffer')

    if (result.success && result.data) {
      const buffer = result.data as ArrayBuffer
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      const base64 = btoa(binary)

      const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'
      const mimeTypes: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp'
      }
      const mimeType = mimeTypes[ext] || 'image/png'

      base64Images.push(`data:${mimeType};base64,${base64}`)
    }
  }

  return base64Images.length > 0 ? base64Images : undefined
}

// 加载图片的base64编码
async function loadImageBase64(nodeId: string, imagePath: string, pdfPage: number | null) {
  const appDataPath = await window.electronAPI.getAppPath('userData')
  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const fullPath = `${appDataPath}/notebooks/${notebook.id}/${imagePath}`
  const result = await window.electronAPI.readFile(fullPath, 'arraybuffer')

  if (result.success && result.data) {
    const buffer = result.data as ArrayBuffer
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    // 获取图片的MIME类型
    const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp'
    }
    const mimeType = mimeTypes[ext] || 'image/png'

    if (pdfPage !== null) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        imageBase64: `data:${mimeType};base64,${base64}`
      })
    } else {
      notebookStore.updateNode(nodeId, {
        imageBase64: `data:${mimeType};base64,${base64}`
      })
    }
  }
}

async function handleRetryTranscription(nodeId: string) {
  const pdfPage = notebookStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? notebookStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (!node || !node.audioPath || pdfPage === null) return

  notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { transcriptStatus: 'processing' })

  try {
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const notebook = notebookStore.currentNotebook
    if (!notebook) return

    const audioPath = `${appDataPath}/notebooks/${notebook.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const extension = node.audioPath.split('.').pop()?.toLowerCase()
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/webm'
      const blob = new Blob([result.data], { type: mimeType })

      const transcriptResult = await transcribeWithSherpaOnnx(blob, settingsStore.settings.stt.sherpaOnnx)

      if (transcriptResult.success && transcriptResult.text) {
        notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
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
    notebookStore.updateNodeInPdfPage(nodeId, pdfPage, { transcriptStatus: 'error' })
  }
}

function handleToggleFavorite(nodeId: string) {
  const pdfPage = notebookStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? notebookStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    notebookStore.updateNodeAuto(nodeId, { isFavorite: !node.isFavorite })
  }
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  notebookStore.updateNodeAuto(nodeId, updates)
  if (activeNode.value?.id === nodeId) {
    activeNode.value = { ...activeNode.value, ...updates }
  }
}

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

// 动态上下文选择（单选）
async function selectDynamicContext(contextId: string) {
  if (!notebookStore.currentNotebook) return

  if (!notebookStore.currentNotebook.context) {
    notebookStore.currentNotebook.context = {}
  }

  // 如果点击的是当前已选的，则取消选择；否则选择新的
  if (notebookStore.currentNotebook.context.dynamicContextId === contextId) {
    notebookStore.currentNotebook.context.dynamicContextId = undefined
  } else {
    notebookStore.currentNotebook.context.dynamicContextId = contextId
  }

  await notebookStore.saveNotebook(notebookStore.currentNotebook)
}

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

async function handleDynamicContextDrop(text: string) {
  let file = dynamicContextFile.value
  if (!file) {
    const notebookName = notebookStore.currentNotebook?.name || '动态上下文'
    file = await contextStore.createContextFile(notebookName, 'dynamic')
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

// 模型选择
async function handleSelectModel(modelId: string) {
  if (!notebookStore.currentNotebook) return

  notebookStore.currentNotebook.modelId = modelId
  await notebookStore.saveNotebook(notebookStore.currentNotebook)
}

function handleToggleAllContext() {
  // 获取所有画布的节点
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
  // 获取所有画布的节点
  const allNodes = notebookStore.getAllNodes()
  allNodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      notebookStore.updateNodeAuto(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function clearContextSelection() {
  // 获取所有画布的节点
  const allNodes = notebookStore.getAllNodes()
  allNodes.forEach(node => {
    if (node.selectedAsContext) {
      notebookStore.updateNodeAuto(node.id, { selectedAsContext: false })
    }
  })
}

// 复制已选中节点的内容到剪贴板
async function handleCopySelectedContext() {
  const selectedNodes = notebookStore.getAllSelectedContextNodes()
    .filter(n => n.transcript)
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
    console.log(`已复制 ${selectedNodes.length} 个笔记的内容到剪贴板`)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// ==================== 图片分析功能 ====================

/**
 * 处理"分析当前页面"事件
 */
async function handleAnalyzePage(data: { imageBase64: string; pageNumber: number; position: { x: number; y: number } }) {
  const nodeId = `node-${Date.now()}`
  const title = `第 ${data.pageNumber} 页分析`

  // 创建分析节点
  const node: CanvasNode = {
    id: nodeId,
    type: 'text-note',
    title,
    position: { x: 0, y: 0 },
    transcript: '分析当前页面',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'processing',
    createdAt: Date.now(),
    pdfPage: data.pageNumber,
    pdfPosition: data.position
  }

  notebookStore.addNodeToPdfPage(node, data.pageNumber)
  activeNode.value = node

  // 调用 AI 进行分析
  await callImageAnalysisAI(nodeId, data.imageBase64, '请分析这个 PDF 页面的内容，总结主要信息。', data.pageNumber)
}

/**
 * 处理"解释选中内容"事件
 */
async function handleExplainSelection(data: { imageBase64: string; selectedText: string; pageNumber: number; position: { x: number; y: number } }) {
  const nodeId = `node-${Date.now()}`
  const title = data.selectedText.length > 10 ? data.selectedText.slice(0, 10) + '...' : data.selectedText

  // 创建分析节点
  const node: CanvasNode = {
    id: nodeId,
    type: 'text-note',
    title,
    position: { x: 0, y: 0 },
    transcript: data.selectedText,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'processing',
    createdAt: Date.now(),
    pdfPage: data.pageNumber,
    pdfPosition: data.position
  }

  notebookStore.addNodeToPdfPage(node, data.pageNumber)
  activeNode.value = node

  // 调用 AI 进行解释
  await callImageAnalysisAI(nodeId, data.imageBase64, `请解释以下内容：\n\n${data.selectedText}`, data.pageNumber)
}

/**
 * 调用 AI 进行图片分析
 */
async function callImageAnalysisAI(
  nodeId: string,
  imageBase64: string,
  prompt: string,
  pdfPage: number
) {
  const settings = settingsStore.settings

  try {
    // 获取已选中的节点作为上下文（跨画布）
    const selectedNodes = notebookStore.getAllSelectedContextNodes(nodeId)

    const staticContextContent = staticContextFiles.value
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildImageAnalysisMessages(
      imageBase64,
      prompt,
      staticContextContent,
      dynamicContextFile.value?.content,
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '', imageBase64: n.imageBase64, embeddedImages: n.embeddedImages }))
    )

    let accumulatedContent = ''

    const modelConfig = currentModelConfig.value
    if (!modelConfig) {
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: '模型配置错误，请检查设置',
        agentStatus: 'error'
      })
      return
    }

    await chatWithLLM(messages, {
      baseUrl: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey,
      model: modelConfig.model
    }, (chunk) => {
      accumulatedContent += chunk
      notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })
    })

    notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
      agentResult: accumulatedContent,
      agentStatus: 'done'
    })

    // 更新 activeNode
    if (activeNode.value?.id === nodeId) {
      const canvas = notebookStore.getCanvasByPdfPage(pdfPage)
      if (canvas) {
        activeNode.value = canvas.nodes.find(n => n.id === nodeId) || null
      }
    }
  } catch (error) {
    console.error('Image analysis failed:', error)
    notebookStore.updateNodeInPdfPage(nodeId, pdfPage, {
      agentResult: `分析失败: ${error}`,
      agentStatus: 'error'
    })
  }
}

/**
 * 处理"附图"勾选框变化
 */
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
.pdf-reader-view {
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
  background: var(--color-primary);
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
