<template>
  <div class="chat-panel">
    <!-- 节点详情区域 -->
    <div ref="nodeDetailContainerRef" class="node-detail-container" @scroll="handleNodeDetailScroll">
      <div v-if="activeNode" class="node-detail">
        <VoiceNote
          :node="activeNode"
          :is-active="true"
          :is-editing="isCurrentNodeEditing"
          :editing-text="currentEditingText"
          :global-hide-ai-result="false"
          :show-header="true"
          @delete="$emit('delete', $event)"
          @play="$emit('play', $event)"
          @toggle-context="$emit('toggle-context', $event)"
          @retry-transcription="$emit('retry-transcription', $event)"
          @retry-agent="$emit('retry-agent', $event)"
          @regenerate-agent="handleRegenerateAgent"
          @toggle-favorite="$emit('toggle-favorite', $event)"
          @update-node="(nodeId, updates) => $emit('update-node', nodeId, updates)"
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
          @update:editing-text="(text) => $emit('update-editing-text', text)"
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

    <!-- MagicPad 区域 -->
    <div
      class="magic-pad"
      @dblclick="handleMagicPadDblClick"
      @mousedown="handleMagicPadMouseDown"
      @mouseup="handleMagicPadMouseUp"
      @mouseleave="handleMagicPadMouseLeave"
      @dragover.prevent
      @drop="handleMagicPadDrop"
    >
      <div class="magic-pad-hint"></div>
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
  activeNode: CanvasNode | null
  staticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile | null
  aiAnswerEnabled: boolean
  editingNodeId?: string | null
  editingText?: string
  currentPage?: number
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
  'update-editing-text': [text: string]
  'save-edit': [nodeId: string, text: string]
  'cancel-edit': [nodeId: string]
  'start-editing': [nodeId: string]
}>()

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// MagicPad 相关
const magicPadRef = ref<HTMLElement | null>(null)
let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

// 节点详情区域滚动相关
const nodeDetailContainerRef = ref<HTMLElement | null>(null)
const shouldAutoScroll = ref(true)

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

// MagicPad - 双击创建文本节点
function handleMagicPadDblClick(e: MouseEvent) {
  const newNodeId = `node-${Date.now()}`
  const newNode: CanvasNode = {
    id: newNodeId,
    type: 'text-note',
    position: { x: 100, y: 100 },
    transcript: '',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: props.aiAnswerEnabled ? 'pending' : 'pending',
    selectedAsContext: false,
    createdAt: Date.now(),
    pdfPage: props.currentPage,
    pdfPosition: { x: 100, y: 100 }
  }

  if (props.currentPage) {
    projectStore.addNodeToPdfPage(newNode, props.currentPage)
  } else {
    projectStore.addNode(newNode)
  }
  emit('node-created', newNode)
  emit('update-editing-text', '')
  emit('start-editing', newNodeId)
}

// MagicPad - 长按开始录音
function handleMagicPadMouseDown(e: MouseEvent) {
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
    projectStore.addNodeToPdfPage(newNode, props.currentPage)
  } else {
    projectStore.addNode(newNode)
  }
  emit('node-created', newNode)

  if (props.aiAnswerEnabled) {
    await handleAgentResponseForText(newNodeId, text)
  }
}

async function handleAgentResponseForText(nodeId: string, transcript: string) {
  const settings = settingsStore.settings
  const pdfPage = props.currentPage

  try {
    if (pdfPage) {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, { agentStatus: 'processing' })
    } else {
      projectStore.updateNode(nodeId, { agentStatus: 'processing' })
    }

    const canvas = pdfPage ? projectStore.getCanvasByPdfPage(pdfPage) : projectStore.currentCanvas
    const selectedNodes = canvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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
      if (pdfPage) {
        projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      } else {
        projectStore.updateNode(nodeId, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      }
    })

    if (pdfPage) {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: result,
        agentStatus: 'done'
      })
    } else {
      projectStore.updateNode(nodeId, {
        agentResult: result,
        agentStatus: 'done'
      })
    }
  } catch (error) {
    if (pdfPage) {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    } else {
      projectStore.updateNode(nodeId, {
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
  const project = projectStore.currentProject
  if (!project) return

  const projectDir = `${appDataPath}/projects/${project.id}`
  await window.electronAPI.mkdir(`${projectDir}/audio`)

  const arrayBuffer = await audioBlob.arrayBuffer()
  await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)

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
    projectStore.addNodeToPdfPage(node, pdfPage)
  } else {
    projectStore.addNode(node)
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
        const title = transcriptResult.text.slice(0, 10)
        updateNodeWithPage(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done',
          title
        })

        if (props.aiAnswerEnabled) {
          await handleAgentResponseForVoice(node.id, transcriptResult.text, node.pdfPage)
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
    projectStore.updateNodeInPdfPage(nodeId, node.pdfPage, updates)
  } else {
    projectStore.updateNode(nodeId, updates)
  }
}

function findNodeById(nodeId: string): CanvasNode | undefined {
  if (!projectStore.currentProject?.canvases) return undefined
  for (const canvas of projectStore.currentProject.canvases) {
    const node = canvas.nodes.find(n => n.id === nodeId)
    if (node) return node
  }
  return undefined
}

// 重新生成 AI 回答
function handleRegenerateAgent(nodeId: string) {
  const node = findNodeById(nodeId)
  if (node && node.transcript) {
    handleAgentResponseForVoice(nodeId, node.transcript, node.pdfPage)
  }
}

// 语音节点的 AI 回答
async function handleAgentResponseForVoice(nodeId: string, transcript: string, pdfPage?: number) {
  const settings = settingsStore.settings

  try {
    if (pdfPage !== undefined && pdfPage !== null) {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, { agentStatus: 'processing' })
    } else {
      projectStore.updateNode(nodeId, { agentStatus: 'processing' })
    }

    const canvas = pdfPage !== undefined && pdfPage !== null
      ? projectStore.getCanvasByPdfPage(pdfPage)
      : projectStore.currentCanvas
    const selectedNodes = canvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

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
      if (pdfPage !== undefined && pdfPage !== null) {
        projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      } else {
        projectStore.updateNode(nodeId, {
          agentResult: accumulatedContent,
          agentStatus: 'processing'
        })
      }

      if (shouldAutoScroll.value) {
        nextTick(() => scrollToBottom())
      }
    })

    if (pdfPage !== undefined && pdfPage !== null) {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: result,
        agentStatus: 'done'
      })
    } else {
      projectStore.updateNode(nodeId, {
        agentResult: result,
        agentStatus: 'done'
      })
    }
  } catch (error) {
    if (pdfPage !== undefined && pdfPage !== null) {
      projectStore.updateNodeInPdfPage(nodeId, pdfPage, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    } else {
      projectStore.updateNode(nodeId, {
        agentResult: String(error),
        agentStatus: 'error'
      })
    }
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
.magic-pad {
  min-height: 120px;
  padding: 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.magic-pad-hint {
  width: 100%;
  height: 80px;
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
</style>