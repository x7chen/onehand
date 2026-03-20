<template>
  <div class="chat-panel">
    <div class="chat-header">
      <span v-if="selectedNode" class="selected-node-title">{{ selectedNode.title || '无标题' }}</span>
    </div>

    <!-- 节点详情区域 -->
    <div ref="nodeDetailContainerRef" class="node-detail-container" @scroll="handleNodeDetailScroll">
      <div v-if="selectedNode" class="node-detail">
        <VoiceNote
          :node="selectedNode"
          :is-active="true"
          :global-hide-ai-result="false"
          :show-header="true"
          @delete="$emit('delete', $event)"
          @play="$emit('play', $event)"
          @toggle-context="$emit('toggle-context', $event)"
          @retry-transcription="$emit('retry-transcription', $event)"
          @retry-agent="$emit('retry-agent', $event)"
          @regenerate-agent="$emit('regenerate-agent', $event)"
          @toggle-favorite="$emit('toggle-favorite', $event)"
          @update-node="(nodeId, updates) => $emit('update-node', nodeId, updates)"
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
          @activate="() => {}"
        />
      </div>
      <div v-else class="empty-node">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" class="empty-icon">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <p>点击左侧节点查看详情</p>
      </div>
    </div>

    <!-- 对话输入区域 -->
    <div class="chat-input-container">
      <div class="chat-input-wrapper">
        <textarea
          v-model="chatInput"
          :placeholder="selectedNode ? '输入问题，将当前节点作为上下文...' : '输入内容创建新节点...'"
          @keydown.enter.exact.prevent="sendChat"
          @keydown.shift.enter.exact="() => {}"
          :disabled="isChatting || isRecording"
        ></textarea>
        <button
          @mousedown="handleVoiceButtonDown"
          @mouseup="handleVoiceButtonUp"
          @mouseleave="handleVoiceButtonLeave"
          class="voice-btn"
          :class="{ recording: isRecording }"
          :disabled="isChatting"
          :title="isRecording ? '松开停止录音' : '长按语音输入'"
        >
          <svg v-if="!isRecording" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <span v-else class="recording-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </button>
        <button
          @click="sendChat"
          class="send-btn"
          :disabled="!chatInput.trim() || isChatting || isRecording"
        >
          <svg v-if="!isChatting" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
          <span v-else class="loading-spinner"></span>
        </button>
      </div>
      <p class="input-hint">按 Enter 发送，Shift+Enter 换行，长按麦克风语音输入</p>
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
import { ref, computed, watch, nextTick } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import VoiceNote from '@/components/VoiceNote.vue'
import RecordingIndicator from '@/components/RecordingIndicator.vue'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import type { CanvasNode } from '@/types/project'
import type { ContextFile } from '@/types/context'

const props = defineProps<{
  selectedNode: CanvasNode | null
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile | null
  aiAnswerEnabled: boolean
}>()

const emit = defineEmits<{
  'delete': [nodeId: string]
  'play': [nodeId: string]
  'toggle-context': [nodeId: string]
  'retry-transcription': [nodeId: string]
  'retry-agent': [nodeId: string]
  'regenerate-agent': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'update-node': [nodeId: string, updates: Partial<CanvasNode>]
  'node-created': [node: CanvasNode]
  'node-updated': [node: CanvasNode]
}>()

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// 对话相关
const chatInput = ref('')
const isChatting = ref(false)

// 节点详情区域滚动相关
const nodeDetailContainerRef = ref<HTMLElement | null>(null)
const shouldAutoScroll = ref(true)

// 录音相关
const simpleRecorder = createAudioWorkletRecorder()
const isRecording = ref(false)
const recordingDuration = ref(0)
const recordingPosition = ref({ x: 0, y: 0 })
let recordingTimer: number | null = null

// 节点详情区域滚动处理
function handleNodeDetailScroll() {
  if (!nodeDetailContainerRef.value) return

  const container = nodeDetailContainerRef.value
  const { scrollTop, scrollHeight, clientHeight } = container
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 50

  shouldAutoScroll.value = isNearBottom
}

function scrollToBottom() {
  if (!nodeDetailContainerRef.value) return
  nodeDetailContainerRef.value.scrollTop = nodeDetailContainerRef.value.scrollHeight
}

// 当选中节点变化时，重置自动滚动状态
watch(() => props.selectedNode, () => {
  shouldAutoScroll.value = true
  nextTick(() => {
    scrollToBottom()
  })
})

function handleSaveEdit(nodeId: string, text: string) {
  emit('update-node', nodeId, { transcript: text })
}

function handleCancelEdit(nodeId: string) {
  // 取消编辑不需要特殊处理
}

// 发送对话
async function sendChat() {
  if (!chatInput.value.trim() || isChatting.value) return

  const prompt = chatInput.value.trim()
  chatInput.value = ''
  isChatting.value = true

  try {
    const settings = settingsStore.settings

    // 如果没有选中节点，创建新节点
    if (!props.selectedNode) {
      const newNodeId = `node-${Date.now()}`
      const newNode: CanvasNode = {
        id: newNodeId,
        type: 'text-note',
        title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
        position: { x: 100, y: 100 },
        transcript: prompt,
        transcriptStatus: 'done',
        agentResult: '',
        agentStatus: 'processing',
        selectedAsContext: false,
        createdAt: Date.now()
      }

      projectStore.addNode(newNode)
      emit('node-created', newNode)

      await processChatRequest(newNodeId, prompt)

    } else {
      // 有选中节点，创建新节点显示回答
      const node = props.selectedNode
      const newNodeId = `node-${Date.now()}`
      const newNode: CanvasNode = {
        id: newNodeId,
        type: 'text-note',
        title: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
        position: {
          x: node.position.x + 50,
          y: node.position.y + 300
        },
        transcript: prompt,
        transcriptStatus: 'done',
        agentResult: '',
        agentStatus: 'processing',
        selectedAsContext: false,
        createdAt: Date.now()
      }

      projectStore.addNode(newNode)
      emit('node-created', newNode)

      await processChatRequest(newNodeId, prompt)
    }

  } catch (error) {
    console.error('Chat failed:', error)
  } finally {
    isChatting.value = false
  }
}

async function processChatRequest(nodeId: string, prompt: string) {
  const settings = settingsStore.settings

  const selectedNodes = projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

  const staticContextContent = props.staticContextFiles
    .map(f => f.content)
    .filter(c => c && c.trim())
    .join('\n\n')

  const messages = buildFullContextMessages(
    selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '' })),
    prompt,
    staticContextContent,
    props.dynamicContextFile?.content
  )

  let accumulatedContent = ''

  const result = await chatWithLLM(messages, {
    baseUrl: settings.llm.baseUrl,
    apiKey: settings.llm.apiKey,
    model: settings.llm.model
  }, (chunk) => {
    accumulatedContent += chunk
    projectStore.updateNode(nodeId, {
      agentResult: accumulatedContent,
      agentStatus: 'processing'
    })

    const updatedNode = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
    if (updatedNode) {
      emit('node-updated', updatedNode)
    }

    if (shouldAutoScroll.value) {
      nextTick(() => scrollToBottom())
    }
  })

  projectStore.updateNode(nodeId, {
    agentResult: result,
    agentStatus: 'done'
  })

  const updatedNode = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (updatedNode) {
    emit('node-updated', updatedNode)
  }
}

// 录音按钮按下
async function handleVoiceButtonDown(e: MouseEvent) {
  if (isChatting.value || isRecording.value) return

  try {
    await simpleRecorder.start()
    isRecording.value = true
    recordingDuration.value = 0

    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    recordingPosition.value = {
      x: rect.left + rect.width / 2,
      y: rect.top
    }

    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)
  } catch (error) {
    console.error('Failed to start recording:', error)
    isRecording.value = false
  }
}

// 录音按钮松开
async function handleVoiceButtonUp() {
  if (!isRecording.value) return
  await stopVoiceRecording()
}

// 录音按钮离开（取消录音）
async function handleVoiceButtonLeave() {
  if (!isRecording.value) return

  try {
    await simpleRecorder.stop()
  } catch (error) {
    console.error('Failed to cancel recording:', error)
  }

  isRecording.value = false
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  recordingDuration.value = 0
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
}

// 创建语音节点
async function createVoiceNode(audioBlob: Blob, duration: number) {
  const extension = audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
  const nodeId = `node-${Date.now()}`
  const audioPath = `audio/${nodeId}.${extension}`

  const appDataPath = await window.electronAPI.getAppPath('userData')
  const project = projectStore.currentProject
  if (!project) return

  const projectDir = `${appDataPath}/projects/${project.id}`
  await window.electronAPI.mkdir(`${projectDir}/audio`)

  const arrayBuffer = await audioBlob.arrayBuffer()
  await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)

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
    duration
  }

  projectStore.addNode(node)
  emit('node-created', node)

  await handleTranscription(node)
}

// 处理语音转写
async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }

  if (!settings.stt.sherpaOnnx) {
    projectStore.updateNode(node.id, {
      transcript: '语音识别配置错误，请检查设置',
      transcriptStatus: 'error'
    })
    return
  }

  try {
    projectStore.updateNode(node.id, { transcriptStatus: 'processing' })

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project || !node.audioPath) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const extension = node.audioPath.split('.').pop()?.toLowerCase()
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/webm'

      const blob = new Blob([result.data], { type: mimeType })
      const transcriptResult = await transcribeWithSherpaOnnx(blob, settings.stt.sherpaOnnx)

      if (transcriptResult.success && transcriptResult.text) {
        projectStore.updateNode(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done'
        })

        const updatedNode = projectStore.currentCanvas?.nodes.find(n => n.id === node.id)
        if (updatedNode) {
          emit('node-updated', updatedNode)
        }

        if (props.aiAnswerEnabled) {
          await handleAgentResponseForVoice(node.id, transcriptResult.text)
        }
      } else {
        throw new Error(transcriptResult.error || '转写失败')
      }
    }
  } catch (error) {
    projectStore.updateNode(node.id, {
      transcript: String(error),
      transcriptStatus: 'error'
    })
  }
}

// 语音节点的 AI 回答
async function handleAgentResponseForVoice(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(nodeId, { agentStatus: 'processing' })

    const selectedNodes = projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

    const staticContextContent = props.staticContextFiles
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '' })),
      transcript,
      staticContextContent,
      props.dynamicContextFile?.content
    )

    let accumulatedContent = ''

    const result = await chatWithLLM(messages, {
      baseUrl: settings.llm.baseUrl,
      apiKey: settings.llm.apiKey,
      model: settings.llm.model
    }, (chunk) => {
      accumulatedContent += chunk
      projectStore.updateNode(nodeId, {
        agentResult: accumulatedContent,
        agentStatus: 'processing'
      })

      if (shouldAutoScroll.value) {
        nextTick(() => scrollToBottom())
      }
    })

    projectStore.updateNode(nodeId, {
      agentResult: result,
      agentStatus: 'done'
    })
  } catch (error) {
    projectStore.updateNode(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}
</script>

<style scoped>
.chat-panel {
  flex: 1;
  min-width: 400px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
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

.selected-node-title {
  font-size: 13px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 4px;
}

/* 节点详情区域 */
.node-detail-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
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

/* 对话输入区域 */
.chat-input-container {
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.chat-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input-wrapper textarea {
  flex: 1;
  min-height: 44px;
  max-height: 150px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  resize: none;
  outline: none;
  font-family: inherit;
}

.chat-input-wrapper textarea:focus {
  border-color: #4299e1;
}

.chat-input-wrapper textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 语音按钮 */
.voice-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.voice-btn:hover:not(:disabled) {
  background: var(--border-color);
  color: var(--text-primary);
}

.voice-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.voice-btn.recording {
  background: #f44;
  color: white;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.recording-indicator {
  display: flex;
  gap: 3px;
  align-items: center;
}

.recording-indicator .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: white;
  animation: bounce 1.4s infinite ease-in-out both;
}

.recording-indicator .dot:nth-child(1) {
  animation-delay: -0.32s;
}

.recording-indicator .dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.send-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: #4299e1;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: #3182ce;
}

.send-btn:disabled {
  background: var(--border-color);
  cursor: not-allowed;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.input-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 8px 0 0 0;
}
</style>