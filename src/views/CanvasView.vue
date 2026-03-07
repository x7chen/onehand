<template>
  <div class="canvas-view">
    <div class="canvas-header">
      <button @click="goBack" class="back-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>
      
      <!-- 静态上下文显示（左侧） -->
      <div
        ref="staticContextDisplayRef"
        class="static-context-display"
        @click="toggleStaticContextSelector"
        :class="{ 'active': showStaticContextSelector }"
        :title="staticContextFiles.length > 0 ? '点击管理静态上下文' : '点击选择静态上下文'"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="context-icon">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
        <div v-if="staticContextFiles.length > 0" class="static-context-names">
          <span class="context-name" :title="file.name" v-for="file in staticContextFiles" :key="file.id">
            {{ file.name }}
          </span>
          <span class="context-count" v-if="staticContextFiles.length > 1">+{{ staticContextFiles.length - 1 }}</span>
        </div>
        <span v-else class="context-placeholder">选择静态上下文</span>
      </div>
      
      <h2>{{ projectStore.currentProject?.name }}</h2>
      
      <!-- 动态上下文显示（右侧） -->
      <div 
        class="dynamic-context-display"
        :class="{ 'has-content': dynamicContextFile && dynamicContextFile.content }"
        @dblclick="openDynamicContextEditor"
        @dragover="handleDynamicContextDragOver"
        @dragleave="handleDynamicContextDragLeave"
        @drop="handleDynamicContextDrop"
        :title="dynamicContextFile ? '双击编辑动态上下文' : '拖拽文字到此处加入动态上下文'"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="context-icon">
          <path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z"/>
        </svg>
        <span v-if="dynamicContextFile" class="context-name">
          {{ dynamicContextFile.name }}
          <span class="word-count" v-if="dynamicContextFile.content">{{ dynamicContextFile.content.length }}字</span>
        </span>
        <span v-else class="context-placeholder">拖拽文字到此处</span>
      </div>
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
      @drop-text="handleDropText"
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
          @update-node="handleUpdateNode"
        />
      </template>
    </InfiniteCanvas>

    <ContextToolbar
      v-if="selectedContextCount > 0"
      :count="selectedContextCount"
      @clear="clearContextSelection"
      @ask="handleAskWithNewRecording"
    />

    <!-- 静态上下文选择器（支持多选） -->
    <div v-if="showStaticContextSelector" ref="staticContextSelectorRef" class="static-context-selector" :style="selectorStyle">
      <div class="context-list">
        <div
          v-for="file in contextStore.staticContextFiles"
          :key="file.id"
          class="context-item"
          :class="{ selected: staticContextFiles.some(f => f.id === file.id) }"
          @click="toggleStaticContext(file.id)"
        >
          <input
            type="checkbox"
            :checked="staticContextFiles.some(f => f.id === file.id)"
            @change="toggleStaticContext(file.id)"
            @click.stop
          />
          <span class="context-item-name">{{ file.name }}</span>
          <span v-if="staticContextFiles.some(f => f.id === file.id)" class="selected-indicator">✓</span>
        </div>
      </div>
    </div>

    <!-- 动态上下文编辑器 -->
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
        <div class="dialog-actions" v-else>
          <button @click="showDynamicContextEditor = false" class="confirm-btn">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useContextStore } from '@/stores/contextStore'
import { useSettingsStore } from '@/stores/settingsStore'
import InfiniteCanvas from '@/components/InfiniteCanvas.vue'
import VoiceNote from '@/components/VoiceNote.vue'
import ContextToolbar from '@/components/ContextToolbar.vue'
import type { CanvasNode, Viewport } from '@/types/project'
import type { ContextFile } from '@/types/context'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { transcribeWithFunASR } from '@/composables/useFunASR'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const contextStore = useContextStore()
const settingsStore = useSettingsStore()

// 录音实例 - 在组件级别保持同一个实例
const voiceRecorder = useVoiceRecorder()

const viewport = ref<Viewport>({ x: 0, y: 0, zoom: 1 })
const isRecording = ref(false)
const recordingPosition = ref<{ x: number; y: number } | null>(null)
const recordingDuration = ref(0)
const recordingStartPosition = ref<{ x: number; y: number } | null>(null) // 存储长按开始位置
let recordingTimer: number | null = null

// 节点拖动相关
const isDraggingNode = ref(false)
const draggingNodeId = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })

const selectedContextCount = computed(() =>
  projectStore.currentProject?.canvas.nodes.filter(n => n.selectedAsContext).length || 0
)

// 静态上下文（支持多选）
const showStaticContextSelector = ref(false)
const staticContextDisplayRef = ref<HTMLElement | null>(null)
const staticContextSelectorRef = ref<HTMLElement | null>(null)

const selectorStyle = ref<Record<string, string>>({})

const staticContextFiles = computed(() => {
  const staticContextIds = projectStore.currentProject?.context?.staticContextIds || []
  return staticContextIds.map(id => contextStore.getContextFileById(id)).filter(Boolean) as ContextFile[]
})

// 动态上下文
const showDynamicContextEditor = ref(false)
const dynamicContextEditContent = ref('')
const dynamicContextFile = computed(() => {
  const dynamicContextId = projectStore.currentProject?.context?.dynamicContextId
  if (dynamicContextId) {
    return contextStore.getContextFileById(dynamicContextId)
  }
  return undefined
})

// 拖拽相关
const draggedNodeId = ref<string | null>(null)
const draggedText = ref<string | null>(null)
const isOverDynamicContext = ref(false)

onMounted(async () => {
  await contextStore.loadContextFiles()

  const projectId = route.params.projectId as string
  const project = projectStore.projects.find(p => p.id === projectId)
  if (project) {
    projectStore.setCurrentProject(project)
    viewport.value = project.canvas.viewport
  }

  // 添加全局鼠标事件监听用于节点拖动
  window.addEventListener('mousemove', handleNodeDragMove)
  window.addEventListener('mouseup', handleNodeDragEnd)
  
  // 添加点击外部关闭选择器的监听
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  // 移除事件监听
  window.removeEventListener('mousemove', handleNodeDragMove)
  window.removeEventListener('mouseup', handleNodeDragEnd)
  document.removeEventListener('click', handleClickOutside)
})

function goBack() {
  router.push('/')
}

function toggleStaticContextSelector() {
  showStaticContextSelector.value = !showStaticContextSelector.value
  if (showStaticContextSelector.value) {
    // 计算选择器位置
    setTimeout(() => {
      if (staticContextDisplayRef.value && staticContextSelectorRef.value) {
        const displayRect = staticContextDisplayRef.value.getBoundingClientRect()
        const selectorRect = staticContextSelectorRef.value.getBoundingClientRect()
        
        // 选择器显示在静态上下文按钮下方，左对齐
        selectorStyle.value = {
          top: `${displayRect.bottom + 8}px`,
          left: `${displayRect.left}px`,
          position: 'fixed'
        }
      }
    }, 0)
  }
}

function handleClickOutside(e: MouseEvent) {
  if (showStaticContextSelector.value && 
      staticContextDisplayRef.value && 
      staticContextSelectorRef.value &&
      !staticContextDisplayRef.value.contains(e.target as Node) &&
      !staticContextSelectorRef.value.contains(e.target as Node)) {
    showStaticContextSelector.value = false
  }
}

function handleViewportChange(newViewport: Viewport) {
  viewport.value = newViewport
  if (projectStore.currentProject) {
    projectStore.currentProject.canvas.viewport = newViewport
    projectStore.saveProject(projectStore.currentProject)
  }
}

async function handleLongPress(x: number, y: number) {
  const started = await voiceRecorder.startRecording()
  if (!started) {
    isRecording.value = false
    recordingPosition.value = null
    return
  }
  
  isRecording.value = true
  recordingPosition.value = { x, y }
  recordingStartPosition.value = { x, y } // 保存开始位置
  recordingDuration.value = 0

  recordingTimer = window.setInterval(() => {
    recordingDuration.value += 100
  }, 100)
}

async function handleLongPressEnd() {
  if (!recordingTimer) return

  clearInterval(recordingTimer)
  recordingTimer = null

  try {
    const audioBlob = await voiceRecorder.stopRecording()
    const audioFormat = settingsStore.settings.audioFormat
    const extension = audioFormat === 'webm' ? 'webm' : 'wav'

    // 创建语音节点
    const nodeId = `node-${Date.now()}`
    const audioPath = `audio/${nodeId}.${extension}`

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const projectDir = `${appDataPath}/projects/${project.id}`
    await window.electronAPI.mkdir(`${projectDir}/audio`)

    const arrayBuffer = await audioBlob.arrayBuffer()
    await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)

    // 使用保存的开始位置计算节点位置
    const startX = recordingStartPosition.value?.x || 100
    const startY = recordingStartPosition.value?.y || 100
    
    const node: CanvasNode = {
      id: nodeId,
      type: 'voice-note',
      position: {
        x: startX - viewport.value.x / viewport.value.zoom,
        y: startY - viewport.value.y / viewport.value.zoom
      },
      audioPath,
      transcript: null,
      transcriptStatus: 'pending',
      agentResult: null,
      agentStatus: 'pending',
      selectedAsContext: false,
      createdAt: Date.now(),
      duration: recordingDuration.value
    }

    projectStore.addNode(node)
    isRecording.value = false
    recordingPosition.value = null
    recordingStartPosition.value = null

    // 自动转写
    handleTranscription(node)
  } catch (error) {
    console.error('Recording failed:', error)
    isRecording.value = false
    recordingPosition.value = null
    recordingStartPosition.value = null
  }
}

function handleCanvasClick(x: number, y: number) {
  // 处理画布点击
}

async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(node.id, { transcriptStatus: 'processing' })

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      const blob = new Blob([result.data], { type: 'audio/webm' })
      const transcriptResult = await transcribeWithFunASR(blob, settings.stt.funasr)

      if (transcriptResult.success && transcriptResult.text) {
        projectStore.updateNode(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done'
        })

        // 转写完成后自动触发 AI 回答
        handleAgentResponse(node.id, transcriptResult.text)
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

async function handleAgentResponse(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
    if (!node) return

    // 获取已选择的上下文节点
    const selectedNodes = projectStore.currentProject?.canvas.nodes.filter(n => n.selectedAsContext) || []

    // 合并多个静态上下文内容
    const staticContextFilesList = staticContextFiles.value
    console.log('staticContextFilesList:', staticContextFilesList.map(f => ({ name: f.name, contentLength: f.content?.length })))
    
    const staticContextContent = staticContextFilesList
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    console.log('handleAgentResponse:', {
      staticContextIds: projectStore.currentProject?.context?.staticContextIds,
      staticContextFiles: staticContextFiles.value.map(f => f.name),
      staticContextContent: staticContextContent?.substring(0, 100) + '...',
      dynamicContextId: projectStore.currentProject?.context?.dynamicContextId,
      selectedNodesCount: selectedNodes.length
    })

    // 构建完整的提示词（包含静态上下文、动态上下文、已选择上下文）
    const messages = buildFullContextMessages(
      selectedNodes.map(n => ({ transcript: n.transcript || '', agentResult: n.agentResult || '' })),
      transcript,
      staticContextContent,
      dynamicContextFile.value?.content
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
    })

    projectStore.updateNode(nodeId, {
      agentResult: result,
      agentStatus: 'done'
    })

    // 清空上下文选择
    clearContextSelection()
  } catch (error) {
    projectStore.updateNode(nodeId, {
      agentResult: String(error),
      agentStatus: 'error'
    })
  }
}

function handleDeleteNode(nodeId: string) {
  projectStore.removeNode(nodeId)
}

function handlePlayNode(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node?.audioPath) {
    // 播放音频逻辑
  }
}

function handleToggleContext(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node && node.transcriptStatus === 'done') {
    projectStore.updateNode(nodeId, {
      selectedAsContext: !node.selectedAsContext
    })
  }
}

function handleRetryTranscription(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node) {
    handleTranscription(node)
  }
}

function handleRetryAgent(nodeId: string) {
  const node = projectStore.currentProject?.canvas.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

function handleDragStart(nodeId: string, offsetX: number, offsetY: number) {
  draggingNodeId.value = nodeId
  dragOffset.value = { offsetX, offsetY }
  isDraggingNode.value = true
}

// 节点拖动处理
function handleNodeDragMove(e: MouseEvent) {
  if (!isDraggingNode.value || !draggingNodeId.value) return
  
  const canvas = document.querySelector('.infinite-canvas') as HTMLElement
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const canvasX = (e.clientX - rect.left - dragOffset.value.offsetX - viewport.value.x) / viewport.value.zoom
  const canvasY = (e.clientY - rect.top - dragOffset.value.offsetY - viewport.value.y) / viewport.value.zoom
  
  projectStore.updateNode(draggingNodeId.value, {
    position: { x: canvasX, y: canvasY }
  })
}

function handleNodeDragEnd() {
  isDraggingNode.value = false
  draggingNodeId.value = null
}

function handleUpdateNode(nodeId: string, updates: Partial<CanvasNode>) {
  projectStore.updateNode(nodeId, updates)
}

// 处理拖拽文本到画布空白区域
async function handleDropText(x: number, y: number, text: string) {
  const node: CanvasNode = {
    id: `node-${Date.now()}`,
    type: 'text-note',
    position: { x, y },
    transcript: text,
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: false,
    createdAt: Date.now()
  }

  projectStore.addNode(node)
  
  // 使用完整上下文触发 AI 回答
  await handleAgentResponse(node.id, text)
}

function clearContextSelection() {
  if (projectStore.currentProject) {
    for (const node of projectStore.currentProject.canvas.nodes) {
      node.selectedAsContext = false
    }
    projectStore.saveProject(projectStore.currentProject)
  }
}

async function handleAskWithNewRecording() {
  // 结合已选择上下文和新录音提问
  // 触发新的录音流程
  try {
    const started = await voiceRecorder.startRecording()
    if (!started) {
      isRecording.value = false
      recordingPosition.value = null
      return
    }
    
    isRecording.value = true
    recordingPosition.value = { x: 100, y: 100 }
    recordingDuration.value = 0

    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)

    // 等待用户停止录音（通过再次点击或释放）
    // 这里简化处理，实际应该有一个 UI 来控制录音停止
    setTimeout(async () => {
      const audioBlob = await voiceRecorder.stopRecording()
      const audioFormat = settingsStore.settings.audioFormat
      const extension = audioFormat === 'webm' ? 'webm' : 'wav'
      
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
        duration: recordingDuration.value
      }

      projectStore.addNode(node)
      isRecording.value = false
      recordingPosition.value = null

      // 转写完成后会用完整上下文处理
      handleTranscription(node)
    }, 3000) // 简化：3 秒后自动停止
  } catch (error) {
    console.error('Recording failed:', error)
    isRecording.value = false
    recordingPosition.value = null
  }
}

// 静态上下文选择（支持多选）
async function toggleStaticContext(contextId: string) {
  if (!projectStore.currentProject) return

  const currentIds = projectStore.currentProject.context?.staticContextIds || []
  const newIds = currentIds.includes(contextId)
    ? currentIds.filter(id => id !== contextId)
    : [...currentIds, contextId]

  // 确保 context 对象存在
  if (!projectStore.currentProject.context) {
    projectStore.currentProject.context = {}
  }
  
  // 直接修改数组以触发响应式更新
  if (newIds.length > 0) {
    if (!projectStore.currentProject.context.staticContextIds) {
      projectStore.currentProject.context.staticContextIds = []
    }
    // 清空并重新赋值以触发响应式
    projectStore.currentProject.context.staticContextIds.splice(0, projectStore.currentProject.context.staticContextIds.length, ...newIds)
  } else {
    projectStore.currentProject.context.staticContextIds = undefined
  }

  await projectStore.saveProject(projectStore.currentProject)
}

// 动态上下文编辑
function openDynamicContextEditor() {
  if (dynamicContextFile.value) {
    dynamicContextEditContent.value = dynamicContextFile.value.content
  }
  showDynamicContextEditor.value = true
}

function saveDynamicContextEdit() {
  if (dynamicContextFile.value) {
    contextStore.updateContextFile(dynamicContextFile.value.id, {
      content: dynamicContextEditContent.value
    })
  }
  showDynamicContextEditor.value = false
}

// 动态上下文拖拽处理
function handleDynamicContextDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'copy'
  }
  isOverDynamicContext.value = true
}

function handleDynamicContextDragLeave() {
  isOverDynamicContext.value = false
}

async function handleDynamicContextDrop(e: DragEvent) {
  e.preventDefault()
  isOverDynamicContext.value = false
  
  const text = e.dataTransfer?.getData('text/plain')
  if (!text || !text.trim()) return
  
  const project = projectStore.currentProject
  if (!project) return
  
  // 如果项目未关联动态上下文，自动创建
  if (!project.context?.dynamicContextId) {
    const newContext = await contextStore.createContextFile(
      `${project.name}`,
      'dynamic',
      text.trim(),
      project.id
    )
    
    project.context = {
      ...project.context,
      dynamicContextId: newContext.id
    }
    await projectStore.saveProject(project)
  } else {
    // 已关联动态上下文，追加内容
    await contextStore.appendToDynamicContext(
      project.context.dynamicContextId,
      text.trim()
    )
  }
}
</script>

<style scoped>
.canvas-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.canvas-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-primary);
  box-shadow: 0 2px 4px var(--shadow-color);
  position: relative;
  z-index: 100;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--border-color);
}

.canvas-header h2 {
  font-size: 18px;
  color: var(--text-primary);
  flex: 1;
  text-align: center;
}

/* 静态上下文显示 */
.static-context-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 150px;
  max-width: 300px;
}

.static-context-display:hover {
  background: var(--border-color);
}

.static-context-names {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.context-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.context-count {
  font-size: 11px;
  color: #66bb6a;
  background: rgba(102, 187, 106, 0.2);
  padding: 1px 4px;
  border-radius: 4px;
  flex-shrink: 0;
}

.context-placeholder {
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
}

.static-context-display.active {
  background: var(--border-color);
}

/* 静态上下文选择器（下拉面板） */
.static-context-selector {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 280px;
  max-width: 350px;
}

.static-context-selector .context-list {
  max-height: 300px;
  overflow-y: auto;
}

/* 动态上下文显示 */
.dynamic-context-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 150px;
  max-width: 250px;
  border: 2px solid transparent;
}

.dynamic-context-display:hover {
  background: var(--border-color);
}

.dynamic-context-display.has-content {
  border-color: #4299e1;
}

.dynamic-context-display .context-icon {
  flex-shrink: 0;
  color: #4299e1;
}

.word-count {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 4px;
}

/* 对话框通用样式 */
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
  max-width: 500px;
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

.context-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.context-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--border-color);
}

.context-item:last-child {
  border-bottom: none;
}

.context-item:hover {
  background: var(--bg-secondary);
}

.context-item.selected {
  background: rgba(66, 153, 225, 0.1);
}

.context-item-name {
  font-size: 14px;
  color: var(--text-primary);
}

.selected-indicator {
  color: #4299e1;
  font-weight: bold;
  font-size: 16px;
}

.no-dynamic-context {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.no-dynamic-context .hint {
  font-size: 13px;
  margin-top: 8px;
  font-style: italic;
  color: var(--text-secondary);
}

.content-input {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  box-sizing: border-box;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.cancel-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
}

.confirm-btn {
  padding: 8px 16px;
  background: #4299e1;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: white;
}
</style>
