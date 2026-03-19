<template>
  <div
    ref="voiceNoteRef"
    class="voice-note"
    :data-node-id="node.id"
    :class="{ active: isActive, selected: node.selectedAsContext, 'show-header': showHeader }"
    :style="{ left: node.position.x + 'px', top: node.position.y + 'px', zIndex: isActive ? 1000 : 'auto' }"
    @mousedown="handleVoiceNoteMouseDown"
    @click="handleClick"
    @mousedown.right.stop
    @mouseenter="handleMouseEnter"
  >
    <div class="node-header" @mousedown="handleMouseDown" @mousedown.right.stop>
      <input
        type="checkbox"
        :checked="node.selectedAsContext"
        :disabled="node.transcriptStatus !== 'done'"
        @change="toggleContext"
        @click.stop
      />
      <!-- Only show mic icon for voice-note type -->
      <div v-if="node.type === 'voice-note'" class="mic-icon-wrapper" @click="playAudio">
        <div class="mic-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <div v-if="computedIsPlaying" class="playing-animation"></div>
        </div>
        <span v-if="node.duration" class="recording-duration">{{ formatDuration(node.duration) }}</span>
      </div>
      <!-- Text note type indicator -->
      <div v-else class="text-note-indicator">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
      <!-- 节点标题 -->
      <span v-if="node.title && false" class="node-title">{{ node.title }}</span>
      <!-- 功能按钮组 -->
      <div class="action-buttons">
        <!-- 收藏按钮 -->
        <button class="action-btn favorite-btn" :class="{ active: isFavorite }" @click.stop="toggleFavorite" :title="isFavorite ? '取消收藏' : '收藏'">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        </button>
        <!-- 隐藏 AI 回答按钮 -->
        <button class="action-btn hide-ai-btn" @click.stop="toggleHideAiResult" :title="isAiResultHidden ? '显示 AI 回答' : '隐藏 AI 回答'">
          <svg v-if="!isAiResultHidden" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
          </svg>
        </button>
        <!-- 重新生成按钮 -->
        <button class="action-btn regenerate-btn" @click.stop="handleRegenerate" :disabled="!canRegenerate" :title="canRegenerate ? '重新生成' : '无法重新生成'">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>
      <span class="created-time">{{ formatCreatedTime }}</span>
      <button class="delete-btn" @click.stop="deleteNode">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    <!-- 编辑模式 -->
    <div v-if="isEditing" class="editing-box" @click.stop @mousedown.stop>
      <textarea
        v-model="localEditingText"
        ref="editingTextarea"
        class="content-edit"
        placeholder="输入内容..."
        @keydown.ctrl.enter.exact.prevent="saveEdit"
        @keydown.meta.enter.exact.prevent="saveEdit"
        @keydown.escape="cancelEdit"
      ></textarea>
    </div>

    <div v-else-if="node.transcript" class="transcript-box" @dblclick.stop>
      <div v-if="node.transcriptStatus === 'processing'" class="status-text">
        转换中...
      </div>
      <div v-else-if="node.transcriptStatus === 'error'" class="error-text">
        {{ node.transcript }}
        <button @click.stop="retryTranscription">重试</button>
      </div>
      <div v-else class="transcript-content-wrapper">
        <textarea
          v-if="isEditingTranscript"
          v-model="editTranscript"
          ref="transcriptTextarea"
          class="transcript-edit"
          @blur="saveTranscriptEdit"
          @keydown.ctrl.enter.exact.prevent="saveTranscriptEdit"
          @keydown.meta.enter.exact.prevent="saveTranscriptEdit"
          @keydown.escape="cancelTranscriptEdit"
        ></textarea>
        <div
          v-else
          class="transcript-content"
          draggable="true"
          @dragstart="handleTextDragStart"
          @dblclick.stop="startTranscriptEdit"
          v-html="sanitizedTranscript"
        ></div>
      </div>
    </div>

    <div v-if="(node.agentResult || node.agentStatus === 'processing') && !isAiResultHidden" class="agent-result-box" @dblclick.stop>
      <div class="agent-header">
        <span class="agent-label">AI 回答</span>
        <span v-if="node.agentStatus === 'processing'" class="streaming-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </span>
      </div>
      <div v-if="node.agentStatus === 'error'" class="error-text">
        {{ node.agentResult }}
        <button @click.stop="retryAgent">重试</button>
      </div>
      <div v-else class="agent-content-wrapper">
        <textarea
          v-if="isEditingAgent"
          v-model="editAgent"
          ref="agentTextarea"
          class="agent-edit"
          @blur="saveAgentEdit"
          @keydown.ctrl.enter.exact.prevent="saveAgentEdit"
          @keydown.meta.enter.exact.prevent="saveAgentEdit"
          @keydown.escape="cancelAgentEdit"
        ></textarea>
        <div
          v-else
          class="agent-content"
          draggable="true"
          @dragstart="handleTextDragStart"
          @dblclick.stop="startAgentEdit"
          v-html="sanitizedAgentResult"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { formatDuration } from '@/utils/helpers'
import { renderMarkdown, renderMermaidCharts } from '@/utils/markdownRenderer'
import type { CanvasNode } from '@/types/project'

const props = defineProps<{
  node: CanvasNode
  isPlaying?: boolean
  isEditing?: boolean
  editingText?: string
  globalHideAiResult?: boolean
  isActive?: boolean
  activateOnHover?: boolean
  showHeader?: boolean
}>()

const emit = defineEmits<{
  (e: 'delete', nodeId: string): void
  (e: 'play', nodeId: string): void
  (e: 'toggle-context', nodeId: string): void
  (e: 'retry-transcription', nodeId: string): void
  (e: 'retry-agent', nodeId: string): void
  (e: 'regenerate-agent', nodeId: string): void
  (e: 'toggle-favorite', nodeId: string): void
  (e: 'drag-start', nodeId: string, offsetX: number, offsetY: number): void
  (e: 'update-node', nodeId: string, updates: Partial<CanvasNode>): void
  (e: 'save-edit', nodeId: string, text: string): void
  (e: 'cancel-edit', nodeId: string): void
  (e: 'update:editingText', text: string): void
  (e: 'activate', nodeId: string): void
}>()

// 使用外部传入的 isPlaying 或本地状态
const localIsPlaying = ref(false)
const computedIsPlaying = computed(() => props.isPlaying ?? localIsPlaying.value)

// 本地 AI 回答隐藏状态
const isAiResultHidden = ref(false)

// 监听全局隐藏状态变化
watch(() => props.globalHideAiResult, (newVal) => {
  if (newVal !== undefined) {
    isAiResultHidden.value = newVal
  }
}, { immediate: true })

// 暴露属性给父组件
defineExpose({
  nodeId: computed(() => props.node.id)
})

// 收藏状态计算属性
const isFavorite = computed(() => props.node.isFavorite ?? false)

// 格式化创建时间
const formatCreatedTime = computed(() => {
  const timestamp = props.node.createdAt
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
})

// 重新生成按钮是否可用
// 如果 agent-content 内容不为空且 agent-result-box 隐藏，则重新生成按钮失效，否则重新生成按钮有效
const canRegenerate = computed(() => {
  // 如果 agent-content 内容不为空且 agent-result-box 隐藏，则失效
  if (props.node.agentResult && isAiResultHidden.value) {
    return false
  }
  // 否则有效
  return true
})

// 编辑模式相关
const localEditingText = ref('')
const editingTextarea = ref<HTMLTextAreaElement | null>(null)

// Markdown 渲染结果
const sanitizedTranscript = ref('')
const sanitizedAgentResult = ref('')

// 同步外部传入的编辑文本
watch(() => props.editingText, (newVal) => {
  if (newVal !== undefined) {
    localEditingText.value = newVal
  }
}, { immediate: true })

// 同步本地编辑文本到父组件
watch(localEditingText, (newVal) => {
  emit('update:editingText', newVal)
})

// 监听 isEditing 变化，自动聚焦
watch(() => props.isEditing, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if (editingTextarea.value) {
        editingTextarea.value.focus()
        editingTextarea.value.select()
      }
    })
  }
}, { immediate: true })

function saveEdit() {
  emit('save-edit', props.node.id, localEditingText.value)
}

function cancelEdit() {
  emit('cancel-edit', props.node.id)
}

const isEditingTranscript = ref(false)
const isEditingAgent = ref(false)
const editTranscript = ref('')
const editAgent = ref('')
const transcriptTextarea = ref<HTMLTextAreaElement | null>(null)
const agentTextarea = ref<HTMLTextAreaElement | null>(null)

// 自动调整 textarea 高度的函数
function autoResizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = textarea.scrollHeight + 'px'
  }
}

// 监听编辑内容变化，自动调整高度
watch(editTranscript, () => {
  nextTick(() => {
    autoResizeTextarea(transcriptTextarea.value)
  })
})

watch(editAgent, () => {
  nextTick(() => {
    autoResizeTextarea(agentTextarea.value)
  })
})

// 在编辑开始时也调整一次高度
function startTranscriptEdit() {
  if (props.node.transcriptStatus !== 'done') return
  isEditingTranscript.value = true
  editTranscript.value = props.node.transcript || ''
  nextTick(() => {
    if (transcriptTextarea.value) {
      transcriptTextarea.value.focus()
      transcriptTextarea.value.select()
      autoResizeTextarea(transcriptTextarea.value)
    }
  })
}

function startAgentEdit() {
  if (props.node.agentStatus !== 'done') return
  isEditingAgent.value = true
  editAgent.value = props.node.agentResult || ''
  nextTick(() => {
    if (agentTextarea.value) {
      agentTextarea.value.focus()
      agentTextarea.value.select()
      autoResizeTextarea(agentTextarea.value)
    }
  })
}

// Prevent cross-node text selection
function handleVoiceNoteMouseDown(e: MouseEvent) {
  // If clicking on this node's content, clear any existing selection first
  // This prevents selecting text across multiple nodes
  const target = e.target as HTMLElement
  if (target.closest('.transcript-content') || target.closest('.agent-content')) {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // Check if the selection starts outside this node
      const voiceNote = target.closest('.voice-note')
      if (voiceNote && !voiceNote.contains(range.startContainer)) {
        // Selection started in another node - clear it and start fresh
        selection.removeAllRanges()
      }
    }
  }
}

// 处理点击事件，激活节点
function handleClick(e: MouseEvent) {
  // 阻止事件冒泡，防止触发画布点击
  e.stopPropagation()
  // 发送激活事件
  emit('activate', props.node.id)
}

function handleMouseEnter() {
  // 鼠标移入时激活节点，将其置于顶层（仅当 activateOnHover 为 true 时）
  if (props.activateOnHover !== false) {
    emit('activate', props.node.id)
  }
}

function handleMouseDown(e: MouseEvent) {
  // 右键不处理，让画布捕获用于拖拽
  if (e.button === 2) {
    return
  }

  e.stopPropagation()
  e.preventDefault()

  // Only allow drag if clicking directly on the header, not on text content
  const target = e.target as HTMLElement
  if (target.closest('.transcript-content') || target.closest('.agent-content') ||
      target.closest('.transcript-edit') || target.closest('.agent-edit')) {
    return // Don't drag when clicking on text content
  }

  // Get the voice-note element (parent of node-header)
  const voiceNoteEl = (e.currentTarget as HTMLElement).parentElement
  if (voiceNoteEl) {
    const rect = voiceNoteEl.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    emit('drag-start', props.node.id, offsetX, offsetY)
  }
}

function toggleContext() {
  emit('toggle-context', props.node.id)
}

function playAudio() {
  localIsPlaying.value = true
  emit('play', props.node.id)
  setTimeout(() => {
    localIsPlaying.value = false
  }, 3000)
}

function deleteNode() {
  emit('delete', props.node.id)
}

// 收藏功能
function toggleFavorite() {
  emit('toggle-favorite', props.node.id)
}

// 隐藏/显示 AI 回答
function toggleHideAiResult() {
  isAiResultHidden.value = !isAiResultHidden.value
}

// 重新生成 AI 回答
function handleRegenerate() {
  if (!canRegenerate.value) return
  emit('regenerate-agent', props.node.id)
}

function handleTextDragStart(e: DragEvent) {
  // Get currently selected text
  const selectedText = window.getSelection()?.toString()

  if (selectedText && selectedText.trim() !== '') {
    // User has selected some text - drag only the selection
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', selectedText)
      e.dataTransfer.effectAllowed = 'copy'

      // Set drag image/visual feedback
      const dragGhost = document.createElement('div')
      dragGhost.style.background = '#4299e1'
      dragGhost.style.color = 'white'
      dragGhost.style.padding = '8px 12px'
      dragGhost.style.borderRadius = '4px'
      dragGhost.style.fontSize = '12px'
      dragGhost.style.position = 'absolute'
      dragGhost.style.top = '-9999px'
      dragGhost.textContent = `拖拽提问 (${selectedText.length}字)`
      document.body.appendChild(dragGhost)
      e.dataTransfer.setDragImage(dragGhost, 0, 0)
      setTimeout(() => document.body.removeChild(dragGhost), 0)
    }
  } else {
    // No selection - prevent drag (don't drag entire content by default)
    e.preventDefault()
  }
}

function retryTranscription() {
  emit('retry-transcription', props.node.id)
}

function retryAgent() {
  emit('retry-agent', props.node.id)
}

async function saveTranscriptEdit() {
  console.log('[VoiceNote] saveTranscriptEdit called')
  if (!isEditingTranscript.value) {
    console.log('[VoiceNote] Not in edit mode, returning')
    return
  }
  const newTranscript = editTranscript.value.trim()
  isEditingTranscript.value = false
  
  console.log('[VoiceNote] New transcript:', newTranscript.substring(0, 50))
  
  // 重新渲染
  console.log('[VoiceNote] Rendering transcript...')
  sanitizedTranscript.value = await renderMarkdown(newTranscript)
  await nextTick()
  console.log('[VoiceNote] Rendering mermaid...')
  await renderMermaid()
  console.log('[VoiceNote] Transcript edit saved and rendered')
  
  // 通知父组件保存
  emit('update-node', props.node.id, { transcript: newTranscript })
}

function cancelTranscriptEdit() {
  console.log('[VoiceNote] cancelTranscriptEdit called')
  isEditingTranscript.value = false
}

async function saveAgentEdit() {
  console.log('[VoiceNote] saveAgentEdit called')
  if (!isEditingAgent.value) {
    console.log('[VoiceNote] Not in edit mode, returning')
    return
  }
  const newAgentResult = editAgent.value.trim()
  isEditingAgent.value = false
  
  console.log('[VoiceNote] New agent result:', newAgentResult.substring(0, 50))
  
  // 重新渲染
  console.log('[VoiceNote] Rendering agent result...')
  sanitizedAgentResult.value = await renderMarkdown(newAgentResult)
  await nextTick()
  console.log('[VoiceNote] Rendering mermaid...')
  await renderMermaid()
  console.log('[VoiceNote] Agent edit saved and rendered')
  
  // 通知父组件保存
  emit('update-node', props.node.id, { agentResult: newAgentResult })
}

function cancelAgentEdit() {
  console.log('[VoiceNote] cancelAgentEdit called')
  isEditingAgent.value = false
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (transcriptDebounceTimer) {
    clearTimeout(transcriptDebounceTimer)
  }
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }
})

// 组件引用
const voiceNoteRef = ref<HTMLElement | null>(null)

// 渲染 Mermaid 图表
async function renderMermaid() {
  if (voiceNoteRef.value) {
    // 等待 DOM 完全更新
    await nextTick()
    console.log('[VoiceNote] Calling renderMermaidCharts')
    const result = await renderMermaidCharts(voiceNoteRef.value)
    
    // 如果渲染了 Mermaid 图表，触发重新测量高度
    if (result && result > 0) {
      console.log('[VoiceNote] Mermaid rendered, emitting height update')
      // 通知父组件重新测量高度
      emit('update-node', props.node.id, {})
    }
  } else {
    console.warn('[VoiceNote] voiceNoteRef is null')
  }
}

// 当组件挂载时渲染 Markdown 和 Mermaid
onMounted(async () => {
  console.log('[VoiceNote] onMounted, rendering markdown...')

  if (props.node.transcript) {
    console.log('[VoiceNote] Rendering transcript...')
    sanitizedTranscript.value = await renderMarkdown(props.node.transcript)
  }

  if (props.node.agentResult) {
    console.log('[VoiceNote] Rendering agent result...')
    sanitizedAgentResult.value = await renderMarkdown(props.node.agentResult)
  }

  // 渲染 Mermaid 图表 - 等待 DOM 更新
  await nextTick()
  await nextTick()
  console.log('[VoiceNote] onMounted calling renderMermaid')
  await renderMermaid()
})

// 监听 transcript 变化，重新渲染 Markdown
// 使用防抖优化渲染性能
let transcriptDebounceTimer: number | null = null
watch(() => props.node.transcript, async (newTranscript) => {
  if (transcriptDebounceTimer) {
    clearTimeout(transcriptDebounceTimer)
  }

  if (!isEditingTranscript.value) {
    transcriptDebounceTimer = window.setTimeout(async () => {
      sanitizedTranscript.value = newTranscript ? await renderMarkdown(newTranscript) : ''
      transcriptDebounceTimer = null
      // 渲染 Mermaid
      await nextTick()
      await nextTick()
      await renderMermaid()
    }, 100)
  }
})

// 监听 agentResult 变化，重新渲染 Markdown（包括流式更新）
// 使用防抖优化流式渲染性能
let renderDebounceTimer: number | null = null
watch(() => props.node.agentResult, async (newAgentResult) => {
  // 清除之前的定时器
  if (renderDebounceTimer) {
    clearTimeout(renderDebounceTimer)
  }

  if (newAgentResult) {
    // 如果用户正在编辑，同步更新编辑框内容
    if (isEditingAgent.value) {
      editAgent.value = newAgentResult
    }

    // 流式模式下，使用短延迟渲染 Markdown 以避免频繁重渲染
    // 在 processing 状态下使用更短的延迟（50ms）以实现流畅的流式效果
    const delay = props.node.agentStatus === 'processing' ? 50 : 100
    renderDebounceTimer = window.setTimeout(async () => {
      sanitizedAgentResult.value = await renderMarkdown(newAgentResult)
      renderDebounceTimer = null
      // 渲染 Mermaid
      await nextTick()
      await nextTick()
      await renderMermaid()
    }, delay)
  } else {
    sanitizedAgentResult.value = ''
  }
}, { immediate: true })
</script>

<style scoped>
.voice-note {
  position: absolute;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-color);
  padding: 4px;
  width: var(--node-width);
  box-sizing: border-box;
  contain: layout style paint;
  transition: box-shadow 0.2s;
}

.voice-note.active {
  box-shadow: 0 4px 20px rgba(66, 153, 225, 0.4), 0 0 0 3px #4299e1;
  border: 1px solid #4299e1;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: move;
  user-select: none;
  opacity: 0;
  height: 0;
  margin-bottom: 0;
  overflow: hidden;
  transition: opacity 0.2s, height 0.2s, margin-bottom 0.2s;
}

.voice-note.selected .node-header,
.voice-note.show-header .node-header,
.voice-note.active .node-header {
  opacity: 1;
  height: 32px;
  margin-bottom: 8px;
}

.mic-icon-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-note-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4299e1;
  flex-shrink: 0;
}

.mic-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}

.mic-icon:hover {
  background: var(--border-color);
}

.playing-animation {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #4299e1;
  animation: ripple 1s infinite;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.recording-duration {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
  min-width: 40px;
}

.node-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  margin-left: 4px;
  visibility: hidden;
}

.created-time {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  margin-left: auto;
  margin-right: 8px;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.delete-btn:hover {
  background: rgba(255, 68, 68, 0.1);
  color: #f44;
}

/* 功能按钮组 */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.action-btn {
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

.action-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn:disabled:hover {
  background: transparent;
  color: var(--text-secondary);
}

/* 收藏按钮 */
.favorite-btn {
  color: var(--text-secondary);
}

.favorite-btn.active,
.favorite-btn:active {
  color: #ffc107 !important;
}

/* 隐藏 AI 按钮 */
.hide-ai-btn {
  color: var(--text-secondary);
}

/* 重新生成按钮 */
.regenerate-btn {
  color: var(--text-secondary);
}

.regenerate-btn:not(:disabled):hover {
  color: #4299e1;
}

.transcript-box {
  background: rgba(66, 153, 225, 0.15);
  border-left: 3px solid #4299e1;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 3px;
  position: relative;
}

.transcript-content-wrapper {
  position: relative;
  padding: 8px;
  margin: -8px;
}

.transcript-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  width: 100%;
  box-sizing: border-box;
  user-select: text;
  cursor: text;
  min-height: 24px;
}

/* 确保段落有正确的间距 */
.transcript-content :deep(p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

/* 确保换行符正常工作 */
.transcript-content :deep(br) {
  line-height: 1.6;
}

/* LaTeX 占位符隐藏 */
.transcript-content :deep(.latex-placeholder) {
  display: inline;
  padding: 0;
  margin: 0;
}

.transcript-content::selection {
  background: rgba(66, 153, 225, 0.3);
}

/* 深度选择器，确保样式应用到 v-html 渲染的内容 */
.transcript-content :deep(h1),
.transcript-content :deep(h2),
.transcript-content :deep(h3),
.transcript-content :deep(h4),
.transcript-content :deep(h5),
.transcript-content :deep(h6),
.transcript-content :deep(p),
.transcript-content :deep(ul),
.transcript-content :deep(ol),
.transcript-content :deep(li),
.transcript-content :deep(code),
.transcript-content :deep(pre),
.transcript-content :deep(blockquote),
.transcript-content :deep(a),
.transcript-content :deep(img),
.transcript-content :deep(.katex),
.transcript-content :deep(.mermaid),
.transcript-content :deep(.mermaid-wrapper) {
  all: revert; /* 重置继承的样式 */
}

/* .hljs 不应用 all: revert，保留 highlight.js 语法高亮颜色 */

.transcript-edit {
  width: 100%;
  min-height: 60px;
  padding: 0;
  border: 2px solid #4299e1;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.98);
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  box-sizing: border-box;
  overflow: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  position: relative;
  z-index: 10;
}

.agent-result-box {
  background: rgba(102, 187, 106, 0.15);
  border-left: 3px solid #66bb6a;
  padding: 10px;
  border-radius: 4px;
  position: relative;
}

.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.agent-label {
  font-size: 12px;
  color: #66bb6a;
  font-weight: 500;
}

.streaming-indicator {
  display: flex;
  gap: 2px;
  align-items: center;
}

.streaming-indicator .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #66bb6a;
  animation: bounce 1.4s infinite ease-in-out both;
}

.streaming-indicator .dot:nth-child(1) {
  animation-delay: -0.32s;
}

.streaming-indicator .dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.agent-content-wrapper {
  position: relative;
  padding: 8px;
  margin: -8px;
}

.agent-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  width: 100%;
  box-sizing: border-box;
  user-select: text;
  cursor: text;
  min-height: 24px;
}

/* 确保段落有正确的间距 */
.agent-content :deep(p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

/* 确保换行符正常工作 */
.agent-content :deep(br) {
  line-height: 1.6;
}

/* LaTeX 占位符隐藏 */
.agent-content :deep(.latex-placeholder) {
  display: inline;
  padding: 0;
  margin: 0;
}

.agent-content::selection {
  background: rgba(66, 153, 225, 0.3);
}

/* 深度选择器，确保样式应用到 v-html 渲染的内容 */
.agent-content :deep(h1),
.agent-content :deep(h2),
.agent-content :deep(h3),
.agent-content :deep(h4),
.agent-content :deep(h5),
.agent-content :deep(h6),
.agent-content :deep(p),
.agent-content :deep(ul),
.agent-content :deep(ol),
.agent-content :deep(li),
.agent-content :deep(code),
.agent-content :deep(pre),
.agent-content :deep(blockquote),
.agent-content :deep(a),
.agent-content :deep(img),
.agent-content :deep(.katex),
.agent-content :deep(.mermaid),
.agent-content :deep(.mermaid-wrapper) {
  all: revert; /* 重置继承的样式 */
}

/* .hljs 不应用 all: revert，保留 highlight.js 语法高亮颜色 */

.agent-edit {
  width: 100%;
  min-height: 60px;
  padding: 0;
  border: 2px solid #66bb6a;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.98);
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
  box-sizing: border-box;
  overflow: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  position: relative;
  z-index: 10;
}

.status-text {
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
}

.error-text {
  font-size: 14px;
  color: #f44;
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-text button {
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid #f44;
  color: #f44;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.error-text button:hover {
  background: rgba(255, 68, 68, 0.2);
}

.editing-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.content-edit {
  width: 100%;
  min-height: 80px;
  padding: 12px;
  border: 2px solid #4299e1;
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}

.content-edit::placeholder {
  color: var(--text-secondary);
}

/* ========================================
   Markdown 渲染样式
   ======================================== */
/* 标题 */
.transcript-content :deep(h1),
.agent-content :deep(h1) {
  font-size: 1.5em;
  margin: 0.5em 0;
  font-weight: bold;
}

.transcript-content :deep(h2),
.agent-content :deep(h2) {
  font-size: 1.4em;
  margin: 0.5em 0;
  font-weight: bold;
}

.transcript-content :deep(h3),
.agent-content :deep(h3) {
  font-size: 1.3em;
  margin: 0.4em 0;
  font-weight: bold;
}

.transcript-content :deep(h4),
.agent-content :deep(h4) {
  font-size: 1.2em;
  margin: 0.4em 0;
  font-weight: bold;
}

.transcript-content :deep(h5),
.agent-content :deep(h5) {
  font-size: 1.1em;
  margin: 0.3em 0;
  font-weight: bold;
}

.transcript-content :deep(h6),
.agent-content :deep(h6) {
  font-size: 1em;
  margin: 0.3em 0;
  font-weight: bold;
}

/* 段落 */
.transcript-content :deep(p),
.agent-content :deep(p) {
  margin: 0.5em 0;
  line-height: 1.4;
}

/* 列表 */
.transcript-content :deep(ul),
.agent-content :deep(ul) {
  list-style-type: disc;
  padding-left: 1.5em;
  margin: 0.3em 0;
}

.transcript-content :deep(ol),
.agent-content :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin: 0.3em 0;
}

.transcript-content :deep(li),
.agent-content :deep(li) {
  margin: 0.15em 0;
  padding: 0;
}

/* 强调 */
.transcript-content :deep(strong),
.agent-content :deep(strong) {
  font-weight: bold;
}

.transcript-content :deep(em),
.agent-content :deep(em) {
  font-style: italic;
}

/* 行内代码 */
.transcript-content :deep(.inline-code),
.agent-content :deep(.inline-code) {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  font-size: 0.85em;
  white-space: nowrap;
}

:root.dark .transcript-content :deep(.inline-code),
:root.dark .agent-content :deep(.inline-code) {
  background-color: rgba(255, 255, 255, 0.1);
}

/* 代码块 */
.transcript-content :deep(pre),
.agent-content :deep(pre) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.5em;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.5em 0;
}

.transcript-content :deep(pre code),
.agent-content :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 1em;
}

/* 引用 */
.transcript-content :deep(blockquote),
.agent-content :deep(blockquote) {
  border-left: 3px solid #ccc;
  padding-left: 0.8em;
  margin: 0.5em 0;
  padding: 0.3em 0 0.3em 0.5em;
  font-style: italic;
  color: #666;
}

/* 链接 */
.transcript-content :deep(a),
.agent-content :deep(a) {
  color: #4299e1;
  text-decoration: underline;
}

/* 图片 */
.transcript-content :deep(img),
.agent-content :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}

/* ========================================
   代码高亮样式 (Highlight.js)
   ======================================== */
/* 代码块容器 */
.transcript-content :deep(pre),
.agent-content :deep(pre) {
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.5;
  margin: 0.5em 0;
  padding: 16px;
  display: block;
  /* 背景色和颜色由 highlight.js 主题控制 */
}

/* 浅色主题下代码块背景色 */
.transcript-content :deep(pre.hljs),
.agent-content :deep(pre.hljs) {
  background-color: #f6f8fa !important;
}

/* 深色主题下代码块颜色和背景由 highlight.js 主题控制 */
:root.dark .transcript-content :deep(pre.hljs),
:root.dark .agent-content :deep(pre.hljs) {
  color: unset;
  background-color: #0d1117 !important;
}

:root.dark .transcript-content :deep(pre.hljs code),
:root.dark .agent-content :deep(pre.hljs code) {
  color: unset;
  background-color: transparent !important;
}

/* 不要为 pre.hljs span 设置颜色，让 highlight.js 主题控制 */
/* :root.dark .transcript-content :deep(pre.hljs span),
:root.dark .agent-content :deep(pre.hljs span) {
  color: inherit;
} */

/* 确保 hljs 类的样式由主题控制 - 只针对 code.hljs，不覆盖 pre.hljs 的 padding */
.transcript-content :deep(code.hljs),
.agent-content :deep(code.hljs) {
  background: transparent !important;
  padding: 0;
  margin: 0;
}

/* 代码块内的 code 元素 */
.transcript-content :deep(pre code),
.agent-content :deep(pre code) {
  background: transparent !important;
  padding: 0;
  border-radius: 0;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
}

/* Mermaid 的 pre 元素不应用代码高亮背景 */
.transcript-content :deep(pre.mermaid),
.agent-content :deep(pre.mermaid) {
  background: transparent !important;
  padding: 0;
  margin: 0;
}

/* 行内代码 */
.transcript-content :deep(.inline-code),
.agent-content :deep(.inline-code) {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1em 0.4em;
  border-radius: 3px;
  font-size: 0.85em;
  white-space: nowrap;
}

:root.dark .transcript-content :deep(.inline-code),
:root.dark .agent-content :deep(.inline-code) {
  background-color: rgba(255, 255, 255, 0.1);
}

/* ========================================
   LaTeX 公式样式 (KaTeX)
   ======================================== */
/* KaTeX 公式容器 - 确保 KaTeX CSS 能正确应用 */
.transcript-content :deep(.katex),
.agent-content :deep(.katex) {
  font-size: 1.1em;
  margin: 0 0.2em;
}

.transcript-content :deep(.katex-display),
.agent-content :deep(.katex-display) {
  display: block;
  margin: 0.8em 0;
  overflow-x: auto;
  overflow-y: hidden;
  text-align: center;
}

.transcript-content :deep(.katex-display .katex),
.agent-content :deep(.katex-display .katex) {
  display: inline-block;
}

/* 公式错误提示 */
.transcript-content :deep(.latex-error),
.agent-content :deep(.latex-error) {
  display: inline-block;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  color: #f44;
  padding: 0.5em 0.8em;
  border-radius: 3px;
  font-size: 0.85em;
  font-style: italic;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ========================================
   Mermaid 图表样式
   ======================================== */
/* Mermaid 容器 */
.transcript-content :deep(.mermaid-wrapper),
.agent-content :deep(.mermaid-wrapper) {
  margin: 1em 0;
  padding: 0;
  background: transparent;
  border: none;
  overflow-x: auto;
  text-align: center;
  display: block;
}

/* Mermaid 渲染后的 SVG */
.transcript-content :deep(.mermaid-svg),
.agent-content :deep(.mermaid-svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

/* 确保 SVG 内的元素可见 */
.transcript-content :deep(.mermaid-svg svg),
.agent-content :deep(.mermaid-svg svg) {
  display: block;
  width: 100%;
  height: auto;
}

/* Mermaid 元素 */
.transcript-content :deep(.mermaid),
.agent-content :deep(.mermaid) {
  display: inline-block;
  width: 100%;
}

.transcript-content :deep(.mermaid svg),
.agent-content :deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
}

/* Mermaid 渲染后移除背景 */
.transcript-content :deep(.mermaid-wrapper.mermaid-rendered),
.agent-content :deep(.mermaid-wrapper.mermaid-rendered) {
  background: transparent;
  border: none;
  padding: 0.5em 0;
}

/* Mermaid 错误提示 */
.transcript-content :deep(.mermaid-error),
.agent-content :deep(.mermaid-error) {
  display: inline-block;
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  color: #f44;
  padding: 0.5em 1em;
  border-radius: 4px;
  font-size: 0.85em;
  font-style: italic;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 100%;
}
</style>