<template>
  <div class="pdf-reader-view">
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

    <div class="panel-container">
      <div class="pdf-panel" :style="{ width: leftPanelWidth + 'px' }">
        <PdfViewer
          v-if="projectStore.currentProject?.pdfPath"
          ref="pdfViewerRef"
          :pdf-path="getFullPdfPath()"
          :nodes="currentPdfPageNodes"
          :selected-node-id="selectedNode?.id"
          @page-change="handlePageChange"
          @create-node="handleCreateNode"
          @recording-complete="handleRecordingComplete"
          @node-click="handleNodeClick"
          @node-position-change="handleNodePositionChange"
        />
        <div v-else class="no-pdf">
          <p>未找到 PDF 文件</p>
        </div>
      </div>

      <div class="panel-resizer" @mousedown="startResize">
        <div class="resizer-line"></div>
      </div>

      <ChatPanel
        :selected-node="selectedNode"
        :static-context-files="staticContextFiles"
        :dynamic-context-file="dynamicContextFile"
        :ai-answer-enabled="aiAnswerEnabled"
        :editing-node-id="editingNodeId"
        :editing-text="editingText"
        :current-page="currentPageNumber"
        @delete="handleDeleteNode"
        @play="handlePlayNode"
        @toggle-context="handleToggleContext"
        @retry-transcription="handleRetryTranscription"
        @retry-agent="handleRetryAgent"
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
import PdfViewer from '@/components/PdfViewer.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import type { CanvasNode } from '@/types/project'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const contextStore = useContextStore()

const leftPanelWidth = ref(800)
const pdfViewerRef = ref<InstanceType<typeof PdfViewer> | null>(null)

const isResizing = ref(false)
let savePanelRatioTimer: number | null = null

const selectedNode = ref<CanvasNode | null>(null)
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

const globalHideAiResult = ref(false)
const aiAnswerEnabled = ref(true)

const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')

const staticContextFiles = computed(() => {
  const ids = projectStore.currentProject?.context?.staticContextIds || []
  return contextStore.staticContextFiles.filter(f => ids.includes(f.id))
})

const dynamicContextFile = computed(() => {
  const id = projectStore.currentProject?.context?.dynamicContextId
  return id ? contextStore.dynamicContextFiles.find(f => f.id === id) : null
})

const selectedContextCount = computed(() => {
  // 使用当前 PDF 页面的节点
  const nodes = projectStore.getNodesByPdfPage(currentPageNumber.value)
  return nodes.filter(n => n.selectedAsContext && n.transcriptStatus === 'done').length
})

const completedNodesCount = computed(() => {
  // 使用当前 PDF 页面的节点
  const nodes = projectStore.getNodesByPdfPage(currentPageNumber.value)
  return nodes.filter(n => n.transcriptStatus === 'done').length
})

const isAllContextSelected = computed(() => {
  return completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
})

const currentPageNumber = ref(1)

// 当前 PDF 页面的节点（用于 PdfViewer 组件）
const currentPdfPageNodes = computed(() => {
  return projectStore.getNodesByPdfPage(currentPageNumber.value)
    .sort((a, b) => a.createdAt - b.createdAt)
})

// 当前选中画布的节点（用于 ChatPanel 组件，保持兼容）
const currentPageNodes = computed(() => {
  return projectStore.currentCanvas?.nodes
    .filter(n => n.pdfPage === currentPageNumber.value)
    .sort((a, b) => a.createdAt - b.createdAt) || []
})

function getFullPdfPath(): string {
  if (!projectStore.currentProject?.pdfPath) return ''
  if (projectStore.currentProject.pdfPath.startsWith('file://') || projectStore.currentProject.pdfPath.startsWith('http')) {
    return projectStore.currentProject.pdfPath
  }
  return `file://${projectStore.currentProject.pdfPath}`
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
  const projectId = route.params.projectId as string
  if (projectId) {
    await projectStore.loadProjects()
    const project = projectStore.projects.find(p => p.id === projectId)
    if (project) {
      projectStore.setCurrentProject(project)
    }
  }
  await contextStore.loadContextFiles()
  initPanelWidth()
  document.addEventListener('click', handleClickOutsideEditing)
  window.addEventListener('keydown', handleKeyDown)

  // 初始化时选中第一个节点
  nextTick(() => {
    selectFirstNode()
  })
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

function handlePageChange(page: number) {
  currentPageNumber.value = page
  // 切换到对应 PDF 页面的画布（如果存在）
  projectStore.switchToPdfPage(page)
  // 切换页面后选中第一个节点
  selectFirstNode()
}

// 选中当前 PDF 页面的第一个节点
function selectFirstNode() {
  nextTick(() => {
    const nodes = projectStore.getNodesByPdfPage(currentPageNumber.value)
    if (nodes.length > 0) {
      const sortedNodes = [...nodes].sort((a, b) => a.createdAt - b.createdAt)
      selectedNode.value = sortedNodes[0]
    } else {
      selectedNode.value = null
    }
  })
}

function handleKeyDown(e: KeyboardEvent) {
  if (editingNodeId.value) return
  
  const nodes = currentPageNodes.value
  if (nodes.length === 0) return
  
  const currentIndex = selectedNode.value 
    ? nodes.findIndex(n => n.id === selectedNode.value!.id)
    : -1
  
  let newIndex = currentIndex
  
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault()
    if (currentIndex <= 0) {
      newIndex = nodes.length - 1
    } else {
      newIndex = currentIndex - 1
    }
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault()
    if (currentIndex >= nodes.length - 1) {
      newIndex = 0
    } else {
      newIndex = currentIndex + 1
    }
  } else {
    return
  }
  
  selectedNode.value = nodes[newIndex]
}

function handleNodePositionChange(data: { nodeId: string; position: { x: number; y: number } }) {
  projectStore.updateNodeAuto(data.nodeId, { pdfPosition: data.position })
}

function handleCreateNode(data: { type: 'text-note' | 'voice-note'; page: number; x: number; y: number }) {
  if (data.type === 'voice-note') return

  const nodeId = `node-${Date.now()}`
  const title = `第 ${data.page} 页节点`

  const node: CanvasNode = {
    id: nodeId,
    type: data.type,
    title,
    position: { x: 0, y: 0 },
    transcript: null,
    transcriptStatus: 'pending',
    agentResult: null,
    agentStatus: 'pending',
    createdAt: Date.now(),
    pdfPage: data.page,
    pdfPosition: { x: data.x, y: data.y }
  }

  editingNodeId.value = nodeId
  editingText.value = ''
  // 使用新的 PDF 页面画布管理方法
  projectStore.addNodeToPdfPage(node, data.page)
  selectedNode.value = node
}

async function handleRecordingComplete(data: { audioBlob: Blob; duration: number; page: number; x: number; y: number }) {
  const nodeId = `node-${Date.now()}`
  const title = `第 ${data.page} 页录音`

  const node: CanvasNode = {
    id: nodeId,
    type: 'voice-note',
    title,
    position: { x: 0, y: 0 },
    transcript: null,
    transcriptStatus: 'pending',
    agentResult: null,
    agentStatus: 'pending',
    createdAt: Date.now(),
    pdfPage: data.page,
    pdfPosition: { x: data.x, y: data.y },
    duration: data.duration
  }

  // 使用新的 PDF 页面画布管理方法
  projectStore.addNodeToPdfPage(node, data.page)
  selectedNode.value = node

  try {
    const extension = data.audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
    const audioPath = `audio/${nodeId}.${extension}`

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const projectDir = `${appDataPath}/projects/${project.id}`
    await window.electronAPI.mkdir(`${projectDir}/audio`)

    const arrayBuffer = await data.audioBlob.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)

    projectStore.updateNodeInPdfPage(nodeId, data.page, { audioPath })

    projectStore.updateNodeInPdfPage(nodeId, data.page, { transcriptStatus: 'processing' })
    const transcriptResult = await transcribeWithSherpaOnnx(data.audioBlob, settingsStore.settings.stt.sherpaOnnx)

    if (transcriptResult.success && transcriptResult.text) {
      projectStore.updateNodeInPdfPage(nodeId, data.page, {
        transcript: transcriptResult.text,
        transcriptStatus: 'done',
        title: transcriptResult.text.slice(0, 10)
      })

      if (aiAnswerEnabled.value) {
        handleAgentResponse(nodeId, transcriptResult.text, data.page)
      }
    } else {
      projectStore.updateNodeInPdfPage(nodeId, data.page, {
        transcript: '',
        transcriptStatus: 'error'
      })
    }
  } catch (error) {
    console.error('Failed to process recording:', error)
    projectStore.updateNodeInPdfPage(nodeId, data.page, { transcriptStatus: 'error' })
  }
}

function handleNodeClick(node: CanvasNode) {
  selectedNode.value = node
}

function handleNodeActivate(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    selectedNode.value = node
  }
}

function handleNodeCreated(node: CanvasNode) {
  selectedNode.value = node
}

function handleStartEditing(nodeId: string) {
  editingNodeId.value = nodeId
  editingText.value = ''
}

function handleNodeUpdated(node: CanvasNode) {
  if (selectedNode.value?.id === node.id) {
    selectedNode.value = node
  }
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    const pdfPage = projectStore.findNodePdfPage(nodeId)
    const title = text.trim().slice(0, 10)
    projectStore.updateNodeAuto(nodeId, { transcript: text.trim(), title })
    if (selectedNode.value?.id === nodeId) {
      const canvas = pdfPage !== null ? projectStore.getCanvasByPdfPage(pdfPage) : null
      selectedNode.value = canvas?.nodes.find(n => n.id === nodeId) || null
    }
    if (aiAnswerEnabled.value && pdfPage !== null) {
      handleAgentResponse(nodeId, text.trim(), pdfPage)
    }
  } else {
    projectStore.removeNodeAuto(nodeId)
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleCancelEdit(nodeId: string) {
  const pdfPage = projectStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? projectStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (node && !node.transcript) {
    projectStore.removeNodeAuto(nodeId)
  }
  editingNodeId.value = null
  editingText.value = ''
  if (selectedNode.value?.id === nodeId) {
    const updatedNode = canvas?.nodes.find(n => n.id === nodeId)
    if (updatedNode) {
      selectedNode.value = updatedNode
    }
  }
}

function handleClickOutsideEditing(e: MouseEvent) {
  if (!editingNodeId.value) return

  const target = e.target as HTMLElement

  if (target.closest('.content-edit') || target.closest('.voice-note') || target.closest('.chat-panel')) {
    return
  }

  const pdfPage = projectStore.findNodePdfPage(editingNodeId.value)
  const canvas = pdfPage !== null ? projectStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      projectStore.updateNodeAuto(editingNodeId.value, { transcript: editingText.value.trim() })
      if (selectedNode.value?.id === editingNodeId.value) {
        selectedNode.value = canvas?.nodes.find(n => n.id === editingNodeId.value) || null
      }
      if (aiAnswerEnabled.value && pdfPage !== null) {
        handleAgentResponse(editingNodeId.value, editingText.value.trim(), pdfPage)
      }
    } else {
      projectStore.removeNodeAuto(editingNodeId.value)
    }
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleAgentResponse(nodeId: string, transcript: string, pdfPage: number) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNodeInPdfPage(nodeId, pdfPage, { agentStatus: 'processing' })

    const node = projectStore.getCanvasByPdfPage(pdfPage)?.nodes.find(n => n.id === nodeId)
    if (!node) return

    const selectedNodes = projectStore.getCanvasByPdfPage(pdfPage)?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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

    chatWithLLM(messages, {
      baseUrl: settings.llm.baseUrl,
      apiKey: settings.llm.apiKey,
      model: settings.llm.model
    }, (chunk) => {
      accumulatedContent += chunk
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })
    }).then(result => {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: result,
        agentStatus: 'done'
      })
    }).catch(error => {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    })
  } catch (error) {
    projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

function handleDeleteNode(nodeId: string) {
  projectStore.removeNodeAuto(nodeId)
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = null
  }
}

async function handlePlayNode(nodeId: string) {
  const pdfPage = projectStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? projectStore.getCanvasByPdfPage(pdfPage) : null
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
  const pdfPage = projectStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? projectStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.updateNodeAuto(nodeId, { selectedAsContext: !node.selectedAsContext })
  }
}

async function handleRetryTranscription(nodeId: string) {
  const pdfPage = projectStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? projectStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (!node || !node.audioPath || pdfPage === null) return

  projectStore.updateNodeInPdfPage(nodeId, pdfPage, { transcriptStatus: 'processing' })

  try {
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const extension = node.audioPath.split('.').pop()?.toLowerCase()
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/webm'
      const blob = new Blob([result.data], { type: mimeType })

      const transcriptResult = await transcribeWithSherpaOnnx(blob, settingsStore.settings.stt.sherpaOnnx)

      if (transcriptResult.success && transcriptResult.text) {
        projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
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
    projectStore.updateNodeInPdfPage(nodeId, pdfPage, { transcriptStatus: 'error' })
  }
}

function handleRetryAgent(nodeId: string) {
  console.log('Retry agent:', nodeId)
}

function handleToggleFavorite(nodeId: string) {
  const pdfPage = projectStore.findNodePdfPage(nodeId)
  const canvas = pdfPage !== null ? projectStore.getCanvasByPdfPage(pdfPage) : null
  const node = canvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.updateNodeAuto(nodeId, { isFavorite: !node.isFavorite })
  }
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  projectStore.updateNodeAuto(nodeId, updates)
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = { ...selectedNode.value, ...updates }
  }
}

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

function handleToggleAllContext() {
  // 获取当前 PDF 页面的节点
  const nodes = projectStore.getNodesByPdfPage(currentPageNumber.value)
  if (isAllContextSelected.value) {
    nodes.forEach(node => {
      if (node.selectedAsContext) {
        projectStore.updateNodeAuto(node.id, { selectedAsContext: false })
      }
    })
  } else {
    nodes.forEach(node => {
      if (node.transcriptStatus === 'done') {
        projectStore.updateNodeAuto(node.id, { selectedAsContext: true })
      }
    })
  }
}

function handleInvertSelection() {
  // 获取当前 PDF 页面的节点
  const nodes = projectStore.getNodesByPdfPage(currentPageNumber.value)
  nodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      projectStore.updateNodeAuto(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function clearContextSelection() {
  // 获取当前 PDF 页面的节点
  const nodes = projectStore.getNodesByPdfPage(currentPageNumber.value)
  nodes.forEach(node => {
    if (node.selectedAsContext) {
      projectStore.updateNodeAuto(node.id, { selectedAsContext: false })
    }
  })
}
</script>

<style scoped>
.pdf-reader-view {
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
  background: #4299e1;
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
