<template>
  <div class="canvas-view">
    <div class="canvas-header">
      <button @click="goBack" class="back-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>
      <h2>{{ projectStore.currentProject?.name }}</h2>
      <button @click="openSettings" class="settings-btn">设置</button>
    </div>

    <InfiniteCanvas
      :viewport="viewport"
      :is-recording="isRecording"
      :recording-position="recordingPosition"
      :recording-duration="recordingDuration"
      @viewport-change="handleViewportChange"
      @long-press="handleLongPress"
      @long-press-end="handleLongPressEnd"
      @click="handleCanvasClick"
    >
      <template #nodes>
        <VoiceNote
          v-for="node in projectStore.currentProject?.canvas.nodes"
          :key="node.id"
          :node="node"
          @delete="handleDeleteNode"
          @play="handlePlayNode"
          @toggle-context="handleToggleContext"
          @retry-transcription="handleRetryTranscription"
          @retry-agent="handleRetryAgent"
          @drag-start="handleDragStart"
        />
      </template>
    </InfiniteCanvas>

    <ContextToolbar
      :selected-count="selectedCount"
      @clear="handleClearContext"
      @ask="handleAskWithContext"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import InfiniteCanvas from '@/components/InfiniteCanvas.vue'
import VoiceNote from '@/components/VoiceNote.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { transcribeWithFunASR } from '@/composables/useFunASR'
import { transcribeWithWhisper } from '@/composables/useWhisper'
import { chatWithLLM, buildContextMessages } from '@/composables/useQwenAgent'
import { generateId } from '@/utils/helpers'
import type { CanvasNode, Viewport } from '@/types/project'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const viewport = ref<Viewport>({ x: 0, y: 0, zoom: 1 })
const isRecording = ref(false)
const recordingPosition = ref({ x: 0, y: 0 })
const recordingDuration = ref(0)
const draggingNodeId = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })
const draggedText = ref<string | null>(null) // Store dragged text for drop
const dragStartPos = ref({ x: 0, y: 0 }) // Store drag start position

const { startRecording, stopRecording } = useVoiceRecorder()

const selectedCount = computed(() => {
  return projectStore.currentProject?.canvas.nodes.filter(
    n => n.selectedAsContext
  ).length || 0
})

onMounted(async () => {
  await settingsStore.loadSettings()
  const projectId = route.params.projectId as string
  const project = projectStore.projects.find(p => p.id === projectId)
  if (project) {
    projectStore.setCurrentProject(project)
    viewport.value = project.canvas.viewport
  }
  
  // Add global drag and drop listeners for text selection
  window.addEventListener('dragover', handleDragOver)
  window.addEventListener('drop', handleDrop)
})

onUnmounted(() => {
  window.removeEventListener('dragover', handleDragOver)
  window.removeEventListener('drop', handleDrop)
})

function handleViewportChange(newViewport: Viewport) {
  viewport.value = newViewport
  if (projectStore.currentProject) {
    projectStore.currentProject.canvas.viewport = newViewport
    projectStore.saveProject(projectStore.currentProject)
  }
}

async function handleLongPress(clientX: number, clientY: number) {
  const canvas = document.querySelector('.infinite-canvas') as HTMLElement
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = (clientX - rect.left - viewport.value.x) / viewport.value.zoom
  const y = (clientY - rect.top - viewport.value.y) / viewport.value.zoom

  recordingPosition.value = { x: clientX, y: clientY }
  
  const success = await startRecording()
  if (success) {
    isRecording.value = true
    recordingStartPos = { x, y }
    recordingStartTime = Date.now() // Record start time
    recordingDuration.value = 0 // Reset duration to 0
    
    // Update duration
    recordingInterval = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)
    
    // Auto stop after 30 seconds max
    recordingTimeout = window.setTimeout(() => {
      if (isRecording.value) {
        handleLongPressEnd()
      }
    }, 30000)
  }
}

function handleLongPressEnd() {
  if (isRecording.value) {
    // Clear interval and timeout
    if (recordingInterval) {
      clearInterval(recordingInterval)
      recordingInterval = null
    }
    if (recordingTimeout) {
      clearTimeout(recordingTimeout)
      recordingTimeout = null
    }
    
    // Determine which position to use
    const pos = isAskingWithContext ? askWithContextPos : recordingStartPos
    finishRecording(pos.x, pos.y)
    
    isAskingWithContext = false
  }
}

let recordingInterval: number | null = null
let recordingTimeout: number | null = null
let recordingStartPos = { x: 0, y: 0 }
let recordingStartTime: number = 0 // Record start time for duration calculation

async function finishRecording(x: number, y: number) {
  if (isRecording.value) {
    // Clear interval and timeout
    if (recordingInterval) {
      clearInterval(recordingInterval)
      recordingInterval = null
    }
    if (recordingTimeout) {
      clearTimeout(recordingTimeout)
      recordingTimeout = null
    }
    
    // Calculate duration
    const duration = Date.now() - recordingStartTime
    
    // Determine which position to use
    const pos = isAskingWithContext ? askWithContextPos : recordingStartPos
    finishRecordingWithDuration(pos.x, pos.y, duration)
    
    isAskingWithContext = false
  }
}

async function finishRecordingWithDuration(x: number, y: number, duration: number) {
  try {
    const audioBlob = await stopRecording()
    isRecording.value = false
    
    // Create node
    const nodeId = generateId()
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const audioPath = `${appDataPath}/projects/${projectStore.currentProject?.id}/audio/${nodeId}.webm`
    
    // Convert blob to base64
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result as string
      const commaIndex = base64.indexOf(',')
      const audioData = commaIndex > -1 ? base64.slice(commaIndex + 1) : base64
      
      await window.electronAPI.saveFile(audioPath, audioData)
      
      const node: CanvasNode = {
        id: nodeId,
        type: 'voice-note',
        position: { x, y },
        audioPath,
        transcript: null,
        transcriptStatus: 'pending',
        agentResult: null,
        agentStatus: 'pending',
        createdAt: Date.now(),
        duration // Store recording duration
      }
      
      projectStore.addNode(node)
      
      // Auto transcribe
      await transcribeNode(node, audioBlob)
    }
    reader.readAsDataURL(audioBlob)
  } catch (error) {
    console.error('Failed to finish recording:', error)
    isRecording.value = false
  }
}

async function transcribeNode(node: CanvasNode, audioBlob: Blob) {
  console.log('开始转写:', node.id, '音频大小:', audioBlob.size)
  projectStore.updateNode(node.id, { transcriptStatus: 'processing' })
  
  const sttConfig = settingsStore.settings.stt
  console.log('STT 配置:', sttConfig)
  
  let result
  if (sttConfig.provider === 'funasr') {
    console.log('使用 FunASR 转写，服务地址:', sttConfig.funasr.serverUrl)
    result = await transcribeWithFunASR(audioBlob, sttConfig.funasr)
  } else {
    console.log('使用 Whisper 转写')
    result = await transcribeWithWhisper(audioBlob, sttConfig.whisper)
  }
  
  console.log('转写结果:', result)
  
  if (result.success && result.text && result.text.trim() !== '') {
    projectStore.updateNode(node.id, { 
      transcript: result.text,
      transcriptStatus: 'done'
    })
    
    // Auto trigger AI response if no context selected
    const hasContext = projectStore.currentProject?.canvas.nodes.some(n => n.selectedAsContext)
    if (!hasContext) {
      await triggerAgent(node)
    }
  } else {
    console.error('转写失败或结果为空:', result.error)
    const errorMsg = result.error?.includes('fetch') || result.error?.includes('network') 
      ? '无法连接到语音转写服务，请检查设置（FunASR 服务地址或 Whisper API Key）'
      : (result.error || '转写失败，未识别到有效内容')
    projectStore.updateNode(node.id, { 
      transcript: errorMsg,
      transcriptStatus: 'error'
    })
  }
}

async function triggerAgent(node: CanvasNode) {
  // Double check transcript is not empty
  if (!node.transcript || node.transcript.trim() === '') {
    console.log('转写内容为空，跳过 AI 回答')
    return
  }
  
  projectStore.updateNode(node.id, { agentStatus: 'processing' })
  
  const llmConfig = settingsStore.settings.llm
  const messages = [
    { role: 'system', content: 'You are an intelligent notebook assistant. Based on the user\'s voice note content and context, provide useful responses, summaries, or expanded information. Reply in the same language as the user\'s input.' },
    { role: 'user', content: node.transcript }
  ]
  
  try {
    let fullContent = ''
    const content = await chatWithLLM(messages, llmConfig, (chunk) => {
      fullContent += chunk
      projectStore.updateNode(node.id, { agentResult: fullContent })
    })
    
    projectStore.updateNode(node.id, { 
      agentResult: content,
      agentStatus: 'done'
    })
  } catch (error) {
    projectStore.updateNode(node.id, { 
      agentResult: error instanceof Error ? error.message : 'AI 回答失败',
      agentStatus: 'error'
    })
  }
}

async function handleAskWithContext() {
  // Get selected context nodes
  const contextNodes = projectStore.currentProject?.canvas.nodes
    .filter(n => n.selectedAsContext && n.transcript && n.agentResult)
    .map(n => ({ transcript: n.transcript!, agentResult: n.agentResult! })) || []
  
  if (contextNodes.length === 0) return
  
  // Clear context selection
  handleClearContext()
  
  // Start new recording - will be stopped when user releases mouse
  const canvas = document.querySelector('.infinite-canvas') as HTMLElement
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  
  const x = (centerX - viewport.value.x) / viewport.value.zoom
  const y = (centerY - viewport.value.y) / viewport.value.zoom
  
  recordingPosition.value = { x: centerX, y: centerY }
  askWithContextPos = { x, y }
  isAskingWithContext = true
  
  const success = await startRecording()
  if (success) {
    isRecording.value = true
    recordingStartTime = Date.now() // Record start time
    recordingDuration.value = 0 // Reset duration to 0
    
    recordingInterval = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)
    
    // Auto stop after 30 seconds max
    recordingTimeout = window.setTimeout(() => {
      if (isRecording.value) {
        handleLongPressEnd()
      }
    }, 30000)
  }
}

let askWithContextPos = { x: 0, y: 0 }
let isAskingWithContext = false

function handleCanvasClick(x: number, y: number) {
  console.log('Canvas clicked at:', x, y)
}

function handleDeleteNode(nodeId: string) {
  projectStore.removeNode(nodeId)
}

function handlePlayNode(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node) {
    const audio = new Audio(node.audioPath)
    audio.play()
  }
}

function handleToggleContext(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node && node.transcriptStatus === 'done') {
    node.selectedAsContext = !node.selectedAsContext
    projectStore.saveProject(projectStore.currentProject!)
  }
}

function handleRetryTranscription(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node) {
    // Re-load audio file and transcribe again
    console.log('Retry transcription for:', nodeId)
  }
}

function handleRetryAgent(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    triggerAgent(node)
  }
}

function handleDragStart(nodeId: string, offsetX: number, offsetY: number) {
  draggingNodeId.value = nodeId
  dragOffset.value = { x: offsetX, y: offsetY }
}

// Handle text selection drag
function handleDragOver(e: DragEvent) {
  e.preventDefault() // Allow drop
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  
  const selectedText = window.getSelection()?.toString()
  if (!selectedText || selectedText.trim() === '') return
  
  // Get drop position
  const canvas = document.querySelector('.infinite-canvas') as HTMLElement
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const x = (e.clientX - rect.left - viewport.value.x) / viewport.value.zoom
  const y = (e.clientY - rect.top - viewport.value.y) / viewport.value.zoom
  
  // Create new text note node with the selected text as transcript
  await createTextNoteNode(selectedText.trim(), { x, y })
}

async function createTextNoteNode(text: string, position: { x: number; y: number }) {
  const nodeId = generateId()
  
  const node: CanvasNode = {
    id: nodeId,
    type: 'text-note',
    position,
    transcript: text,
    transcriptStatus: 'done', // Already have the text
    agentResult: null,
    agentStatus: 'pending',
    createdAt: Date.now()
  }
  
  projectStore.addNode(node)
  
  // Auto trigger AI with this text as question
  await triggerAgent(node)
}

function handleClearContext() {
  projectStore.currentProject?.canvas.nodes.forEach(n => {
    n.selectedAsContext = false
  })
  projectStore.saveProject(projectStore.currentProject!)
}

function goBack() {
  router.push('/')
}

function openSettings() {
  router.push('/settings')
}

// Global mouse handlers for dragging
function handleMouseMove(e: MouseEvent) {
  // Don't drag nodes if user is selecting text
  const selection = window.getSelection()
  if (selection && selection.toString().length > 0) {
    return // User is selecting text, don't move nodes
  }
  
  if (draggingNodeId.value && projectStore.currentProject) {
    const canvas = document.querySelector('.infinite-canvas') as HTMLElement
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left - viewport.value.x) / viewport.value.zoom - dragOffset.value.x
      const y = (e.clientY - rect.top - viewport.value.y) / viewport.value.zoom - dragOffset.value.y
      
      const node = projectStore.currentProject.canvas.nodes.find(
        n => n.id === draggingNodeId.value
      )
      if (node) {
        node.position = { x, y }
      }
    }
  }
}

function handleMouseUp() {
  if (draggingNodeId.value && projectStore.currentProject) {
    projectStore.saveProject(projectStore.currentProject)
  }
  draggingNodeId.value = null
}

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})

window.addEventListener('mousemove', handleMouseMove)
window.addEventListener('mouseup', handleMouseUp)
</script>

<style scoped>
.canvas-view {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.canvas-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 12px;
  background: var(--bg-primary);
  box-shadow: 0 2px 4px var(--shadow-color);
  z-index: 100;
}

.back-btn {
  padding: 8px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--border-color);
}

.canvas-header h2 {
  font-size: 18px;
  color: var(--text-primary);
  flex: 1;
}

.settings-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.settings-btn:hover {
  background: var(--border-color);
}
</style>
