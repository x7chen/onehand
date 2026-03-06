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
          <div v-if="isPlaying" class="playing-animation"></div>
        </div>
        <span v-if="node.duration" class="recording-duration">{{ formatDuration(node.duration) }}</span>
      </div>
      <!-- Text note type indicator -->
      <div v-else class="text-note-indicator">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
      <button class="delete-btn" @click.stop="deleteNode">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    <div v-if="node.transcript" class="transcript-box">
      <div v-if="node.transcriptStatus === 'processing'" class="status-text">
        转换中...
      </div>
      <div v-else-if="node.transcriptStatus === 'error'" class="error-text">
        {{ node.transcript }}
        <button @click.stop="retryTranscription">重试</button>
      </div>
      <div 
        v-else 
        class="transcript-content"
        draggable="true"
        @dragstart="handleTextDragStart"
      >
        {{ node.transcript }}
      </div>
    </div>

    <div v-if="node.agentResult" class="agent-result-box">
      <div class="agent-header">
        <span class="agent-label">AI 回答</span>
        <span v-if="node.agentStatus === 'processing'" class="streaming-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </span>
      </div>
      <div v-if="node.agentStatus === 'processing'" class="status-text">
        处理中...
      </div>
      <div v-else-if="node.agentStatus === 'error'" class="error-text">
        {{ node.agentResult }}
        <button @click.stop="retryAgent">重试</button>
      </div>
      <div 
        v-else 
        class="agent-content"
        draggable="true"
        @dragstart="handleTextDragStart"
      >
        {{ node.agentResult }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatDuration } from '@/utils/helpers'
import type { CanvasNode } from '@/types/project'

const props = defineProps<{
  node: CanvasNode
}>()

const emit = defineEmits<{
  (e: 'delete', nodeId: string): void
  (e: 'play', nodeId: string): void
  (e: 'toggle-context', nodeId: string): void
  (e: 'retry-transcription', nodeId: string): void
  (e: 'retry-agent', nodeId: string): void
  (e: 'drag-start', nodeId: string, offsetX: number, offsetY: number): void
}>()

const isPlaying = ref(false)

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
  
  // Only allow drag if clicking directly on the header, not on text content
  const target = e.target as HTMLElement
  if (target.closest('.transcript-content') || target.closest('.agent-content')) {
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
  isPlaying.value = true
  emit('play', props.node.id)
  setTimeout(() => {
    isPlaying.value = false
  }, 3000)
}

function deleteNode() {
  emit('delete', props.node.id)
}

function handleTextDragStart(e: DragEvent) {
  // Get currently selected text
  const selectedText = window.getSelection()?.toString()
  
  if (selectedText && selectedText.trim() !== '') {
    // User has selected some text - drag only the selection
    e.dataTransfer?.setData('text/plain', selectedText)
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
</script>

<style scoped>
.voice-note {
  position: absolute;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-color);
  padding: 12px;
  min-width: 280px;
  max-width: 420px;
  /* Limit text selection to within this node */
  contain: layout style paint;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: move; /* Only header is draggable */
  user-select: none; /* Prevent text selection in header */
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

.transcript-box {
  background: rgba(66, 153, 225, 0.15);
  border-left: 3px solid #4299e1;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.transcript-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  user-select: text; /* Allow text selection */
  cursor: text;
}

.transcript-content::selection {
  background: rgba(66, 153, 225, 0.3);
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
  }
  40% {
    transform: scale(1);
  }
}

.agent-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  user-select: text; /* Allow text selection */
  cursor: text;
}

.agent-content::selection {
  background: rgba(66, 153, 225, 0.3);
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
</style>
