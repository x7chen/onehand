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
        <div v-if="showStaticContextSelector" class="static-context-tags">
          <span
            v-for="file in contextStore.staticContextFiles"
            :key="file.id"
            class="context-tag-mini"
            :class="{ selected: staticContextFiles.some(f => f.id === file.id) }"
            :style="{
              backgroundColor: staticContextFiles.some(f => f.id === file.id) ? file.color + '40' : 'var(--bg-secondary)',
              borderColor: staticContextFiles.some(f => f.id === file.id) ? file.color : 'var(--border-color)',
              color: staticContextFiles.some(f => f.id === file.id) ? file.color : 'var(--text-secondary)'
            }"
            @click.stop="toggleStaticContext(file.id)"
          >
            {{ file.name }}
          </span>
        </div>
        <div v-else-if="staticContextFiles.length > 0" class="static-context-names">
          <template v-for="(file, index) in staticContextFiles" :key="file.id">
            <span v-if="index < 4" class="context-name-tag" :title="file.name" :style="{ backgroundColor: file.color + '20', borderColor: file.color, color: file.color }">
              {{ file.name }}
            </span>
          </template>
          <span v-if="staticContextFiles.length > 4" class="context-count">+{{ staticContextFiles.length - 4 }}</span>
        </div>
        <span v-else class="context-placeholder">选择静态上下文</span>
      </div>
      
      <h2>{{ projectStore.currentProject?.name }}</h2>

      <!-- 回到原点按钮 -->
      <button
        @click="handleResetViewport"
        class="reset-viewport-btn"
        title="回到原点"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-9h10v2H7l3.5 3.5-1.42 1.42L4.16 13l4.92-4.92L10.5 9.5 7 13z"/>
        </svg>
      </button>

      <!-- 自动排版按钮 -->
      <button
        @click="handleAutoLayout"
        class="auto-layout-btn"
        title="自动排版"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
        </svg>
      </button>

      <!-- 总隐藏 AI 回答开关 -->
      <button
        @click="toggleGlobalHideAiResult"
        class="global-hide-ai-btn"
        :class="{ active: globalHideAiResult }"
        :title="globalHideAiResult ? '显示所有 AI 回答' : '隐藏所有 AI 回答'"
      >
        <svg v-if="!globalHideAiResult" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
        </svg>
      </button>

      <!-- AI 回答开关 -->
      <button 
        @click="toggleAiAnswer" 
        class="ai-answer-toggle-btn" 
        :class="{ active: aiAnswerEnabled }"
        :title="aiAnswerEnabled ? '关闭 AI 回答' : '开启 AI 回答'"
      >
        <span class="ai-icon-text">AI</span>
      </button>
      
      <!-- 动态上下文显示（右侧） -->
      <div class="context-toolbar-group">
        <button @click="handleSelectAllContext" class="context-action-btn" title="全选所有已完成节点">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </button>
        <button @click="handleInvertSelection" class="context-action-btn" title="反选所有已完成节点">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M7 19V5h2v14H7zm4 0V5h2v14h-2zm4 0V5h2v14h-2z"/>
            <path d="M5 19V5H3v14h2zm16 0V5h-2v14h2z"/>
          </svg>
        </button>
        <button @click="handleClearContextSelection" class="context-action-btn" title="清空选择">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

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
      :has-prev-page="projectStore.hasPrevPage"
      :has-next-page="projectStore.hasNextPage"
      :is-current-canvas-empty="projectStore.isCurrentCanvasEmpty"
      :current-page-number="projectStore.currentPageNumber"
      :total-pages="projectStore.totalPages"
      @viewport-change="handleViewportChange"
      @long-press="handleLongPress"
      @long-press-end="handleLongPressEnd($event)"
      @click="handleCanvasClick"
      @dbl-click="handleDblClick"
      @drop-text="handleDropText"
      @prev-page="handlePrevPage"
      @next-page="handleNextPage"
    >
      <template #nodes>
        <VoiceNote
          v-for="node in projectStore.currentCanvas?.nodes"
          :key="node.id"
          :ref="(el) => { if (el) voiceNoteRefs[node.id] = el }"
          :node="node"
          :is-playing="playingNodeId === node.id"
          :is-editing="editingNodeId === node.id"
          :editing-text="editingText"
          :global-hide-ai-result="globalHideAiResult"
          :is-active="activeNodeId === node.id"
          :show-header="activeNodeId === node.id"
          @delete="handleDeleteNode"
          @play="handlePlayNode"
          @toggle-context="handleToggleContext"
          @retry-transcription="handleRetryTranscription"
          @retry-agent="handleRetryAgent"
          @regenerate-agent="handleRegenerateAgent"
          @toggle-favorite="handleToggleFavorite"
          @drag-start="handleDragStart"
          @update-node="handleUpdateNode"
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
          @update:editing-text="editingText = $event"
          @activate="handleActivateNode"
        />
      </template>
    </InfiniteCanvas>

    <ContextToolbar
      v-if="selectedContextCount > 0"
      :selected-count="selectedContextCount"
      @clear="clearContextSelection"
      @ask="handleAskWithNewRecording"
    />

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
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM, buildFullContextMessages } from '@/composables/useQwenAgent'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const contextStore = useContextStore()
const settingsStore = useSettingsStore()

// 录音实例 - 在组件级别保持同一个实例
const voiceRecorder = useVoiceRecorder()
const simpleRecorder = createAudioWorkletRecorder() // 使用 AudioWorklet 录音器

const viewport = ref<Viewport>({ x: 0, y: 0, zoom: 1 })
const isRecording = ref(false)
const recordingPosition = ref<{ x: number; y: number } | undefined>(undefined)
const recordingDuration = ref(0)
const recordingStartPosition = ref<{ x: number; y: number } | null>(null) // 存储长按开始位置
let recordingTimer: number | null = null

// 节点拖动相关
const isDraggingNode = ref(false)
const draggingNodeId = ref<string | null>(null)
const dragOffset = ref({ offsetX: 0, offsetY: 0 })

// VoiceNote组件引用
const voiceNoteRefs = ref<Record<string, any>>({})

// 当前激活的节点ID
const activeNodeId = ref<string | null>(null)

// 全局 AI 回答隐藏状态
const globalHideAiResult = ref(false)

// AI 回答开关状态（默认开启）
const aiAnswerEnabled = ref(true)

const selectedContextCount = computed(() =>
  projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext).length || 0
)

// 静态上下文（支持多选）
const showStaticContextSelector = ref(false)
const staticContextDisplayRef = ref<HTMLElement | null>(null)

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
    // 使用当前画布的 viewport
    viewport.value = projectStore.getCurrentViewport()
  }

  // 添加全局鼠标事件监听用于节点拖动
  window.addEventListener('mousemove', handleNodeDragMove)
  window.addEventListener('mouseup', handleNodeDragEnd)

  // 添加点击外部关闭选择器的监听
  document.addEventListener('click', handleClickOutside)

  // 添加点击外部取消编辑的监听
  document.addEventListener('click', handleClickOutsideEditing)
})

onUnmounted(() => {
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  // 移除事件监听
  window.removeEventListener('mousemove', handleNodeDragMove)
  window.removeEventListener('mouseup', handleNodeDragEnd)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleClickOutsideEditing)
})

function goBack() {
  // 返回前清理所有空页
  projectStore.cleanupEmptyPages()
  cancelTextEdit() 
  router.push('/')
}

function toggleStaticContextSelector() {
  showStaticContextSelector.value = !showStaticContextSelector.value
}

function handleClickOutside(e: MouseEvent) {
  if (showStaticContextSelector.value &&
      staticContextDisplayRef.value &&
      !staticContextDisplayRef.value.contains(e.target as Node)) {
    showStaticContextSelector.value = false
  }
}

function handleViewportChange(newViewport: Viewport) {
  viewport.value = newViewport
  projectStore.updateCurrentViewport(newViewport)
}

// 回到原点
function handleResetViewport() {
  const resetViewport: Viewport = { x: 0, y: 0, zoom: 1 }
  viewport.value = resetViewport
  projectStore.updateCurrentViewport(resetViewport)
}

// 切换到上一页
function handlePrevPage() {
  cancelTextEdit()
  projectStore.goToPrevPage()
  // 切换后更新 viewport
  viewport.value = projectStore.getCurrentViewport()
}

// 切换到下一页或新增一页
function handleNextPage() {
  cancelTextEdit() 
  if (projectStore.hasNextPage) {
    // 有下一页，直接切换
    projectStore.goToNextPage()
    viewport.value = projectStore.getCurrentViewport()
  } else {
    // 没有下一页，尝试新增一页
    const success = projectStore.addNewPage()
    if (success) {
      viewport.value = projectStore.getCurrentViewport()
    }
  }
}

async function handleLongPress(x: number, y: number) {
  try {
    await simpleRecorder.start()
    isRecording.value = true
    recordingPosition.value = { x, y }
    recordingStartPosition.value = { x, y }
    recordingDuration.value = 0

    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)
  } catch (error) {
    console.error('Failed to start recording:', error)
    isRecording.value = false
    recordingPosition.value = undefined
  }
}

async function handleLongPressEnd(isCancel = false) {
  if (!recordingTimer) return

  clearInterval(recordingTimer)
  recordingTimer = null

  // 如果是取消录音（用户再次点击），则不保存录音数据
  if (isCancel) {
    try {
      await simpleRecorder.stop() // 停止录音但不保存
    } catch (error) {
      console.error('Failed to stop recorder:', error)
    }
    isRecording.value = false
    recordingPosition.value = undefined
    recordingStartPosition.value = null
    recordingDuration.value = 0
    return
  }

  try {
    const audioBlob = await simpleRecorder.stop()
    
    // 根据实际 Blob 类型决定扩展名
    const extension = audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
    
    console.log('🎤 Recording stopped:', {
      blobType: audioBlob.type,
      blobSize: audioBlob.size,
      extension
    })

    // 创建语音节点
    const nodeId = `node-${Date.now()}`
    const audioPath = `audio/${nodeId}.${extension}`

    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const projectDir = `${appDataPath}/projects/${project.id}`
    await window.electronAPI.mkdir(`${projectDir}/audio`)

    const arrayBuffer = await audioBlob.arrayBuffer()
    console.log('🎤 Saving audio file:', {
      path: `${projectDir}/${audioPath}`,
      extension,
      blobType: audioBlob.type,
      bufferSize: arrayBuffer.byteLength
    })
    await window.electronAPI.saveFileBuffer(`${projectDir}/${audioPath}`, arrayBuffer)

    // 使用保存的开始位置计算节点位置（已经是画布坐标）
    const startX = recordingStartPosition.value?.x || 100
    const startY = recordingStartPosition.value?.y || 100

    const node: CanvasNode = {
      id: nodeId,
      type: 'voice-note',
      position: {
        x: startX,
        y: startY
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
    recordingPosition.value = undefined
    recordingStartPosition.value = null

    // 自动转写
    handleTranscription(node)
  } catch (error) {
    console.error('Recording failed:', error)
    isRecording.value = false
    recordingPosition.value = undefined
    recordingStartPosition.value = null
  }
}

function handleCanvasClick(x: number, y: number) {
  // 点击画布空白处，取消激活节点
  deactivateNode()
}

function handleDblClick(x: number, y: number) {
  // 双击空白区域，创建可编辑的文本框
  const node: CanvasNode = {
    id: `node-${Date.now()}`,
    type: 'text-note',
    position: { x: x, y }, 
    transcript: '',
    transcriptStatus: 'done',
    agentResult: null,
    agentStatus: 'pending',
    selectedAsContext: false,
    createdAt: Date.now()
  }

  projectStore.addNode(node)

  // 开始编辑
  editingNodeId.value = node.id
  editingText.value = ''
}

function saveTextEdit() {
  if (editingNodeId.value) {
    const node = projectStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
    if (node && editingText.value.trim()) {
      // 更新节点内容
      projectStore.updateNode(editingNodeId.value, {
        transcript: editingText.value.trim()
      })
      
      // 提交给大模型回答
      handleAgentResponse(editingNodeId.value, editingText.value.trim())
    }
    editingNodeId.value = null
    editingText.value = ''
  }
}

function cancelTextEdit() {
  if (editingNodeId.value) {
    const node = projectStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
    if (node && !node.transcript) {
      // 如果内容为空，删除节点
      projectStore.removeNode(editingNodeId.value)
    }
    editingNodeId.value = null
    editingText.value = ''
  }
}

function handleSaveEdit(nodeId: string, text: string) {
  if (text.trim()) {
    projectStore.updateNode(nodeId, {
      transcript: text.trim()
    })
    // 提交给大模型回答
    if (aiAnswerEnabled.value) {
      handleAgentResponse(nodeId, text.trim())
    }
  } else {
    // 空内容删除节点
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
}

function handleClickOutsideEditing(e: MouseEvent) {
  // 如果正在编辑且点击的不是正在编辑的节点，则处理编辑
  if (!editingNodeId.value) return
  
  const target = e.target as HTMLElement
  
  // 如果点击的是编辑框内部，不处理
  if (target.closest('.content-edit')) {
    return
  }
  
  // 如果点击的是节点内部，不处理
  if (target.closest('.voice-note')) {
    return
  }
  
  // 点击了外部区域，处理保存或删除
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === editingNodeId.value)
  if (node) {
    if (editingText.value.trim()) {
      // 有内容则自动保存
      console.log('自动保存内容:', editingText.value.trim())
      projectStore.updateNode(editingNodeId.value, {
        transcript: editingText.value.trim()
      })
      // 提交给大模型回答
      if (aiAnswerEnabled.value) {
        handleAgentResponse(editingNodeId.value, editingText.value.trim())
      }
    } else {
      // 内容为空则删除节点
      console.log('删除空节点')
      projectStore.removeNode(editingNodeId.value)
    }
  }
  editingNodeId.value = null
  editingText.value = ''
}

async function handleTranscription(node: CanvasNode) {
  const settings = settingsStore.settings

  // 确保配置已加载
  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }

  // 检查 sherpaOnnx 配置
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
    if (!project) return

    if (!node.audioPath) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')

    if (result.success && result.data) {
      // 根据文件扩展名判断 MIME 类型
      const extension = node.audioPath.split('.').pop()?.toLowerCase()
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/webm'

      console.log('Transcribing audio:', {
        path: audioPath,
        extension,
        mimeType,
        size: (result.data as ArrayBuffer).byteLength
      })
      
      const blob = new Blob([result.data], { type: mimeType })
      const transcriptResult = await transcribeWithSherpaOnnx(blob, settings.stt.sherpaOnnx)

      if (transcriptResult.success && transcriptResult.text) {
        projectStore.updateNode(node.id, {
          transcript: transcriptResult.text,
          transcriptStatus: 'done'
        })

        // 转写完成后自动触发 AI 回答
        if (aiAnswerEnabled.value) {
          handleAgentResponse(node.id, transcriptResult.text)
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

async function handleAgentResponse(nodeId: string, transcript: string) {
  const settings = settingsStore.settings

  try {
    projectStore.updateNode(nodeId, { agentStatus: 'processing' })

    const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
    if (!node) return

    // 获取已选择的上下文节点（不包括当前节点）
    const selectedNodes = projectStore.currentCanvas?.nodes.filter(n => n.selectedAsContext && n.id !== nodeId) || []

    // 合并多个静态上下文内容
    const staticContextFilesList = staticContextFiles.value
    console.log('staticContextFilesList:', staticContextFilesList.map(f => ({ name: f.name, contentLength: f.content?.length })))

    const staticContextContent = staticContextFilesList
      .map(f => f.content)
      .filter(c => c && c.trim())
      .join('\n\n')

    console.log('handleAgentResponse:', {
      nodeId,
      staticContextIds: projectStore.currentProject?.context?.staticContextIds,
      staticContextFiles: staticContextFiles.value.map(f => f.name),
      staticContextContent: staticContextContent?.substring(0, 100) + '...',
      dynamicContextId: projectStore.currentProject?.context?.dynamicContextId,
      dynamicContextContent: dynamicContextFile.value?.content?.substring(0, 50) + '...',
      selectedNodesCount: selectedNodes.length,
      selectedNodes: selectedNodes.map(n => ({ id: n.id, transcript: n.transcript?.substring(0, 30) + '...', agentResult: n.agentResult?.substring(0, 30) + '...' })),
      transcript: transcript.substring(0, 50) + '...'
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

    // 注意：不清空上下文选择状态，方便用户继续提问
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

// 音频播放相关
const currentAudio = ref<HTMLAudioElement | null>(null)
const playingNodeId = ref<string | null>(null)

// 文本框编辑相关
const editingNodeId = ref<string | null>(null)
const editingText = ref('')

async function handlePlayNode(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (!node?.audioPath) return

  // 如果正在播放同一个音频，则停止播放
  if (playingNodeId.value === nodeId && currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
    playingNodeId.value = null
    return
  }

  // 停止当前正在播放的音频
  if (currentAudio.value) {
    currentAudio.value.pause()
    currentAudio.value = null
  }

  // 创建并播放新音频
  try {
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const project = projectStore.currentProject
    if (!project) return

    const audioPath = `${appDataPath}/projects/${project.id}/${node.audioPath}`
    
    // 读取音频文件
    const result = await window.electronAPI.readFile(audioPath, 'arraybuffer')
    if (!result.success || !result.data) return

    // 创建 Blob 并生成 URL
    const blob = new Blob([result.data], { type: 'audio/webm' })
    const audioUrl = URL.createObjectURL(blob)
    
    // 创建音频对象
    const audio = new Audio(audioUrl)
    
    // 播放结束时清理
    audio.onended = () => {
      playingNodeId.value = null
      currentAudio.value = null
      URL.revokeObjectURL(audioUrl)
    }
    
    // 播放出错时清理
    audio.onerror = () => {
      console.error('音频播放失败')
      playingNodeId.value = null
      currentAudio.value = null
      URL.revokeObjectURL(audioUrl)
    }

    currentAudio.value = audio
    playingNodeId.value = nodeId
    
    // 开始播放
    audio.play().catch(err => {
      console.error('播放失败:', err)
      playingNodeId.value = null
      currentAudio.value = null
      URL.revokeObjectURL(audioUrl)
    })
  } catch (error) {
    console.error('加载音频失败:', error)
    playingNodeId.value = null
  }
}

function handleToggleContext(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcriptStatus === 'done') {
    projectStore.updateNode(nodeId, {
      selectedAsContext: !node.selectedAsContext
    })
  }
}

// 节点上下文选择工具栏功能
function handleSelectAllContext() {
  if (!projectStore.currentProject || !projectStore.currentCanvas) return

  // 选中所有已完成转写的节点
  for (const node of projectStore.currentCanvas.nodes) {
    if (node.transcriptStatus === 'done') {
      node.selectedAsContext = true
    }
  }
  projectStore.saveProject(projectStore.currentProject)
}

function handleInvertSelection() {
  if (!projectStore.currentProject || !projectStore.currentCanvas) return

  // 反选所有已完成转写的节点
  for (const node of projectStore.currentCanvas.nodes) {
    if (node.transcriptStatus === 'done') {
      node.selectedAsContext = !node.selectedAsContext
    }
  }
  projectStore.saveProject(projectStore.currentProject)
}

function handleClearContextSelection() {
  if (!projectStore.currentProject || !projectStore.currentCanvas) return

  // 清空所有节点的选中状态
  for (const node of projectStore.currentCanvas.nodes) {
    node.selectedAsContext = false
  }
  projectStore.saveProject(projectStore.currentProject)
}

function handleRetryTranscription(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    handleTranscription(node)
  }
}

function handleRetryAgent(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

// 重新生成 AI 回答
function handleRegenerateAgent(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node && node.transcript) {
    handleAgentResponse(nodeId, node.transcript)
  }
}

// 收藏/取消收藏
function handleToggleFavorite(nodeId: string) {
  const node = projectStore.currentCanvas?.nodes.find(n => n.id === nodeId)
  if (node) {
    projectStore.updateNode(nodeId, {
      isFavorite: !node.isFavorite
    })
  }
}

// 自动排版功能 - 3 栏瀑布式布局
async function handleAutoLayout() {
  const nodes = projectStore.currentCanvas?.nodes
  if (!nodes || nodes.length === 0) return

  // 过滤出 voice-note 和 text-note 类型的节点
  const layoutNodes = nodes.filter(n => n.type === 'voice-note' || n.type === 'text-note')
  if (layoutNodes.length === 0) return

  // 按创建时间排序
  const sortedNodes = [...layoutNodes].sort((a, b) => a.createdAt - b.createdAt)

  // 瀑布式布局参数
  const COLUMN_COUNT = 3 // 3 栏
  const NODE_WIDTH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--node-width'))
  const COLUMN_GAP = 5 // 栏间距
  const ROW_GAP = 5 // 行间距
  const START_X = 100 // 起始 X 坐标
  const START_Y = 100 // 起始 Y 坐标

  // 测量每个节点的实际高度
  const nodeHeights: Record<string, number> = {}
  for (const node of sortedNodes) {
    const el = document.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement
    if (el) {
      nodeHeights[node.id] = el.offsetHeight
    } else {
      nodeHeights[node.id] = 200 // 默认高度
    }
  }

  // 初始化每列的高度追踪
  const columnHeights: number[] = Array(COLUMN_COUNT).fill(START_Y)

  // 为每个节点计算位置
  for (const node of sortedNodes) {
    // 选择当前高度最小的列（贪心算法）
    let minColumn = 0
    let minHeight = columnHeights[0]
    for (let col = 1; col < COLUMN_COUNT; col++) {
      if (columnHeights[col] < minHeight) {
        minHeight = columnHeights[col]
        minColumn = col
      }
    }

    // 计算当前节点位置
    const x = START_X + minColumn * (NODE_WIDTH + COLUMN_GAP)
    const y = columnHeights[minColumn]

    // 更新节点位置
    projectStore.updateNode(node.id, { position: { x, y } })

    // 获取节点实际高度
    const nodeHeight = nodeHeights[node.id] || 200

    // 更新该列的高度
    columnHeights[minColumn] = y + nodeHeight + ROW_GAP
  }

  // 保存项目
  if (projectStore.currentProject) {
    projectStore.saveProject(projectStore.currentProject)
  }
}

// 切换全局 AI 回答隐藏状态
function toggleGlobalHideAiResult() {
  globalHideAiResult.value = !globalHideAiResult.value
}

// 切换 AI 回答开关
function toggleAiAnswer() {
  aiAnswerEnabled.value = !aiAnswerEnabled.value
}

// 激活节点（置顶显示）
function handleActivateNode(nodeId: string) {
  activeNodeId.value = nodeId
}

// 取消激活节点
function deactivateNode() {
  activeNodeId.value = null
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

  // 使用完整上下文触发 AI 回答（包含静态上下文、动态上下文、已勾选的文本框、当前拖拽的文字）
  if (aiAnswerEnabled.value) {
    await handleAgentResponse(node.id, text)
  }
}

function clearContextSelection() {
  if (!projectStore.currentProject || !projectStore.currentCanvas) return
  
  for (const node of projectStore.currentCanvas.nodes) {
    node.selectedAsContext = false
  }
  projectStore.saveProject(projectStore.currentProject)
}

async function handleAskWithNewRecording() {
  console.log('🎤 handleAskWithNewRecording called')
  try {
    console.log('🎤 Starting simpleRecorder...')
    await simpleRecorder.start()
    console.log('🎤 simpleRecorder.start() completed')
    
    isRecording.value = true
    recordingPosition.value = { x: 100, y: 100 }
    recordingDuration.value = 0

    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)

    // 3 秒后自动停止录音
    setTimeout(async () => {
      console.log('🎤 Auto-stopping recording after timeout, duration:', recordingDuration.value, 'ms')
      const audioBlob = await simpleRecorder.stop()
      
      const extension = audioBlob.type === 'audio/wav' ? 'wav' : 'webm'
      
      console.log('🎤 Recording stopped:', {
        blobType: audioBlob.type,
        blobSize: audioBlob.size,
        extension
      })
      
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
      recordingPosition.value = undefined
      
      // 转写完成后会用完整上下文处理
      handleTranscription(node)
    }, 3000) // 3 秒
  } catch (error) {
    console.error('Recording failed:', error)
    isRecording.value = false
    recordingPosition.value = undefined
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

/* 回到原点按钮 */
.reset-viewport-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.reset-viewport-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

/* 自动排版按钮 */
.auto-layout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.auto-layout-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

/* 全局隐藏 AI 回答按钮 */
.global-hide-ai-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.global-hide-ai-btn:hover {
  background: var(--border-color);
}

.global-hide-ai-btn.active {
  background: rgba(255, 152, 0, 0.15);
  color: #ff9800;
}

/* AI 回答开关按钮 */
.ai-answer-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.ai-answer-toggle-btn .ai-icon-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  transition: color 0.2s;
}

.ai-answer-toggle-btn:hover {
  background: var(--border-color);
}

.ai-answer-toggle-btn.active .ai-icon-text {
  color: #4299e1 !important;
}

.context-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.context-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.context-action-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
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
  max-width: 400px;
}

.static-context-display:hover {
  background: var(--border-color);
}

.static-context-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.context-tag-mini {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.context-tag-mini:hover {
  transform: scale(1.05);
}

.context-tag-mini.selected {
  font-weight: 600;
}

.static-context-names {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.context-name-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 10px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  font-weight: 500;
}

.context-count {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
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
