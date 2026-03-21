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
          :nodes="projectStore.currentCanvas?.nodes || []"
          :selected-node-id="selectedNode?.id"
          @page-change="handlePageChange"
          @create-node="handleCreateNode"
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useContextStore } from '@/stores/contextStore'
import CanvasHeader from '@/components/CanvasHeader.vue'
import PdfViewer from '@/components/PdfViewer.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
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
  return projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.transcriptStatus === 'done').length || 0
})

const completedNodesCount = computed(() => {
  return projectStore.currentCanvas?.nodes.filter(n => n.transcriptStatus === 'done').length || 0
})

const isAllContextSelected = computed(() => {
  return completedNodesCount.value > 0 && selectedContextCount.value === completedNodesCount.value
})

const currentPageNumber = ref(1)

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
  projectStore.updateNode(data.nodeId, { pdfPosition: data.position })
}

function handleCreateNode(data: { type: 'text-note' | 'voice-note'; page: number; x: number; y: number }) {
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
  
  if (data.type === 'voice-note') {
    startRecordingForNode(nodeId, data.x, data.y, data.page)
  } else {
    editingNodeId.value = nodeId
    editingText.value = ''
    projectStore.addNode(node)
    selectedNode.value = node
  }
}

async function startRecordingForNode(nodeId: string, x: number, y: number, page: number) {
  const title = `第 ${page} 页录音`
  
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
    pdfPage: page,
    pdfPosition: { x, y }
  }
  
  projectStore.addNode(node)
  selectedNode.value = node
  
  const pdfRecorder = createAudioWorkletRecorder()
  
  try {
    await pdfRecorder.start()
    
    setTimeout(async () => {
      try {
        const audioBlob = await pdfRecorder.stop()
        const extension = audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
        const audioPath = `audio/${nodeId}.${extension}`
        
        const appDataPath = await window.electronAPI.getAppPath('userData')
        const project = projectStore.currentProject
        if (!project) return
        
        const projectDir = `${appDataPath}/projects/${project.id}`
        await window.electronAPI.mkdir(`${projectDir}/audio`)
        
        const arrayBuffer = await audioBlob.arrayBuffer()
        await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)
        
        projectStore.updateNode(nodeId, { audioPath })
        
        try {
          projectStore.updateNode(nodeId, { transcriptStatus: 'processing' })
          const transcriptResult = await transcribeWithSherpaOnnx(audioBlob, settingsStore.settings.stt.sherpaOnnx)
          projectStore.updateNode(nodeId, {
            transcript: transcriptResult.success ? transcriptResult.text || '' : '',
            transcriptStatus: transcriptResult.success ? 'done' : 'error'
          })
        } catch (error) {
          console.error('Transcription failed:', error)
          projectStore.updateNode(nodeId, { transcriptStatus: 'error' })
        }
      } catch (error) {
        console.error('Failed to save audio:', error)
        projectStore.removeNode(nodeId)
      }
    }, 1000)
    
  } catch (error) {
    console.error('Failed to start recording:', error)
    projectStore.removeNode(nodeId)
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

function handleNodeUpdated(node: CanvasNode) {
  if (selectedNode.value?.id === node.id) {
    selectedNode.value = node
  }
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    projectStore.updateNode(nodeId, { transcript: text.trim() })
    if (selectedNode.value?.id === nodeId) {
      selectedNode.value = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId) || null
    }
    if (aiAnswerEnabled.value) {
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
  if (selectedNode.value?.id === nodeId) {
    const updatedNode = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
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

  const node = projectStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      projectStore.updateNode(editingNodeId.value, { transcript: editingText.value.trim() })
      if (selectedNode.value?.id === editingNodeId.value) {
        selectedNode.value = projectStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value) || null
      }
      if (aiAnswerEnabled.value) {
        handleAgentResponse(editingNodeId.value, editingText.value.trim())
      }
    } else {
      projectStore.removeNode(editingNodeId.value)
    }
  }
  editingNodeId.value = null
  editingText.value = ''
}

function handleAgentResponse(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
    if (!node) return

    const selectedNodes = projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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
      projectStore.updateNode(nodeId, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })
    }).then(result => {
      projectStore.updateNode(nodeId, {
        agentResult: result,
        agentStatus: 'done'
      })
    }).catch(error => {
      projectStore.updateNode(nodeId, {
        agentResult: String(error),
        agentStatus: 'error'
      })
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

async function handleRetryTranscription(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (!node || !node.audioPath) return

  projectStore.updateNode(nodeId, { transcriptStatus: 'processing' })
  
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
        projectStore.updateNode(nodeId, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done'
        })
      } else {
        throw new Error(transcriptResult.error || '转写失败')
      }
    }
  } catch (error) {
    console.error('Transcription failed:', error)
    projectStore.updateNode(nodeId, { transcriptStatus: 'error' })
  }
}

function handleRetryAgent(nodeId: string) {
  console.log('Retry agent:', nodeId)
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
  const nodes = projectStore.currentCanvas?.nodes || []
  if (isAllContextSelected.value) {
    nodes.forEach(node => {
      if (node.selectedAsContext) {
        projectStore.updateNode(node.id, { selectedAsContext: false })
      }
    })
  } else {
    nodes.forEach(node => {
      if (node.transcriptStatus === 'done') {
        projectStore.updateNode(node.id, { selectedAsContext: true })
      }
    })
  }
}

function handleInvertSelection() {
  const nodes = projectStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.transcriptStatus === 'done') {
      projectStore.updateNode(node.id, { selectedAsContext: !node.selectedAsContext })
    }
  })
}

function clearContextSelection() {
  const nodes = projectStore.currentCanvas?.nodes || []
  nodes.forEach(node => {
    if (node.selectedAsContext) {
      projectStore.updateNode(node.id, { selectedAsContext: false })
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
