<template>
  <div
    class="voice-note"
    :style="{ left: node.position.x + 'px', top: node.position.y + 'px' }"
    @mousedown="handleVoiceNoteMouseDown"
  >
    <div class="node-header" @mousedown="handleMouseDown">
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
        @keydown.enter.exact.prevent="saveEdit"
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
          @keydown.enter.exact.prevent="saveTranscriptEdit"
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
          @keydown.enter.exact.prevent="saveAgentEdit"
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
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue'
import { formatDuration, renderMarkdown } from '@/utils/helpers'
import type { CanvasNode } from '@/types/project'

const props = defineProps<{
  node: CanvasNode
  isPlaying?: boolean
  isEditing?: boolean
  editingText?: string
  globalHideAiResult?: boolean
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

// 收藏状态计算属性
const isFavorite = computed(() => props.node.isFavorite ?? false)

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

function handleMouseDown(e: MouseEvent) {
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

function saveTranscriptEdit() {
  if (!isEditingTranscript.value) return
  const newTranscript = editTranscript.value.trim()
  if (newTranscript !== (props.node.transcript || '')) {
    emit('update-node', props.node.id, { transcript: newTranscript })
  }
  isEditingTranscript.value = false
}

function cancelTranscriptEdit() {
  isEditingTranscript.value = false
}

function saveAgentEdit() {
  if (!isEditingAgent.value) return
  const newAgentResult = editAgent.value.trim()
  if (newAgentResult !== (props.node.agentResult || '')) {
    emit('update-node', props.node.id, { agentResult: newAgentResult })
  }
  isEditingAgent.value = false
}

function cancelAgentEdit() {
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

// 当组件挂载时渲染 Markdown
onMounted(async () => {
  if (props.node.transcript) {
    sanitizedTranscript.value = await renderMarkdown(props.node.transcript)
  }
  
  if (props.node.agentResult) {
    sanitizedAgentResult.value = await renderMarkdown(props.node.agentResult)
  }
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
  padding: 12px;
  width: 500px;
  contain: layout style paint;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: move;
  user-select: none;
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

.delete-btn {
  margin-left: auto;
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
  margin-bottom: 8px;
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
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: calc(500px - 25px); /* 容器宽度减去 padding */
  user-select: text;
  cursor: text;
  min-height: 24px;
}

.transcript-content::selection {
  background: rgba(66, 153, 225, 0.3);
}

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
  width: 500px;
}

.agent-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: calc(500px - 25px); /* 容器宽度减去 padding */
  user-select: text;
  cursor: text;
  min-height: 24px;
}

.agent-content::selection {
  background: rgba(66, 153, 225, 0.3);
}

.agent-edit {
  width: calc(500px - 25px);
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
  width: calc(500px - 25px);
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

/* 添加 Markdown 样式 */
.transcript-content h1,
.agent-content h1 {
  font-size: 1.5em;
  margin: 0.5em 0; /* 进一步减小标题间距 */
  font-weight: bold;
}

.transcript-content h2,
.agent-content h2 {
  font-size: 1.4em;
  margin: 0.5em 0; /* 进一步减小标题间距 */
  font-weight: bold;
}

.transcript-content h3,
.agent-content h3 {
  font-size: 1.3em;
  margin: 0.4em 0; /* 进一步减小标题间距 */
  font-weight: bold;
}

.transcript-content h4,
.agent-content h4 {
  font-size: 1.2em;
  margin: 0.4em 0; /* 进一步减小标题间距 */
  font-weight: bold;
}

.transcript-content h5,
.agent-content h5 {
  font-size: 1.1em;
  margin: 0.3em 0; /* 进一步减小标题间距 */
  font-weight: bold;
}

.transcript-content h6,
.agent-content h6 {
  font-size: 1em;
  margin: 0.3em 0; /* 进一步减小标题间距 */
  font-weight: bold;
}

.transcript-content p,
.agent-content p {
  margin: 0.5em 0; /* 进一步减小段落间距 */
  line-height: 1.4; /* 进一步调整行高 */
}

.transcript-content ul,
.agent-content ul {
  list-style-type: disc;
  padding-left: 1.5em; /* 减小左边距 */
  margin: 0.3em 0; /* 进一步减小列表间距 */
}

.transcript-content ol,
.agent-content ol {
  list-style-type: decimal;
  padding-left: 1.5em; /* 减小左边距 */
  margin: 0.3em 0; /* 进一步减小列表间距 */
}

.transcript-content li,
.agent-content li {
  margin: 0.15em 0; /* 进一步减小列表项间距 */
  padding: 0; /* 移除额外内边距 */
}

.transcript-content strong,
.agent-content strong {
  font-weight: bold;
}

.transcript-content em,
.agent-content em {
  font-style: italic;
}

.transcript-content code,
.agent-content code {
  font-family: monospace;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 0.85em;
}

.transcript-content pre,
.agent-content pre {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.5em; /* 减小内边距 */
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.5em 0; /* 进一步减小代码块间距 */
}

.transcript-content pre code,
.agent-content pre code {
  background: none;
  padding: 0;
  font-size: 1em;
}

.transcript-content blockquote,
.agent-content blockquote {
  border-left: 3px solid #ccc;
  padding-left: 0.8em; /* 减小左边距 */
  margin: 0.5em 0; /* 进一步减小区块引用间距 */
  padding: 0.3em 0 0.3em 0.5em; /* 减小内边距 */
  font-style: italic;
  color: #666;
}

.transcript-content a,
.agent-content a {
  color: #4299e1;
  text-decoration: underline;
}

.transcript-content img,
.agent-content img {
  max-width: 100%;
  border-radius: 4px;
}
</style>