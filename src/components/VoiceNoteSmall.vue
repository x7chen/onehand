<template>
  <div
    class="voice-note-small"
    :class="{ selected: node.selectedAsContext, active: isActive }"
    :style="{ left: node.position.x + 'px', top: node.position.y + 'px' }"
    @click="handleClick"
  >
    <!-- 头部 -->
    <div class="small-header">
      <input
        type="checkbox"
        class="small-checkbox"
        :checked="node.selectedAsContext"
        :disabled="node.transcriptStatus !== 'done'"
        @change="toggleContext"
        @click.stop
      />
      <span class="small-title">{{ node.title || '' }}</span>
      <button class="small-favorite-btn" :class="{ active: isFavorite }" @click.stop="toggleFavorite">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      </button>
      <div class="small-indicator" :class="{ 'has-ai': hasAiResult }"></div>
    </div>

    <!-- 转录内容 -->
    <div v-if="node.transcript" class="small-transcript-box">
      <div v-if="node.transcriptStatus === 'processing'" class="status-text">
        转换中...
      </div>
      <div v-else-if="node.transcriptStatus === 'error'" class="error-text">
        转录失败
      </div>
      <div v-else class="small-transcript-content" v-html="sanitizedTranscript"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { renderMarkdown } from '@/utils/markdownRenderer'
import type { CanvasNode } from '@/types/project'

const props = defineProps<{
  node: CanvasNode
  isActive?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-context', nodeId: string): void
  (e: 'toggle-favorite', nodeId: string): void
  (e: 'activate', nodeId: string): void
}>()

// 收藏状态
const isFavorite = computed(() => props.node.isFavorite ?? false)

// 是否有 AI 回答
const hasAiResult = computed(() => {
  return !!(props.node.agentResult || props.node.agentStatus === 'processing')
})

// 渲染后的转录内容
const sanitizedTranscript = ref('')

// 渲染 Markdown
async function renderTranscript() {
  if (props.node.transcript) {
    sanitizedTranscript.value = await renderMarkdown(props.node.transcript)
  }
}

onMounted(renderTranscript)

watch(() => props.node.transcript, renderTranscript)

function toggleContext() {
  emit('toggle-context', props.node.id)
}

function toggleFavorite() {
  emit('toggle-favorite', props.node.id)
}

function handleClick() {
  emit('activate', props.node.id)
}
</script>

<style scoped>
.voice-note-small {
  position: absolute;
  width: var(--node-width);
  box-sizing: border-box;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(66, 153, 225, 0.15);
  border-left: 3px solid #4299e1;
  box-shadow: 0 1px 4px var(--shadow-color);
  transition: box-shadow 0.2s;
  cursor: pointer;
}

.voice-note-small.active {
  box-shadow: 0 2px 12px rgba(66, 153, 225, 0.4), 0 0 0 2px #4299e1;
}

.small-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 20px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
}

.small-checkbox {
  width: 10px;
  height: 10px;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
}

.small-checkbox:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.small-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  max-width: 60%;
  text-align: center;
}

.small-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.2s;
}

.small-indicator.has-ai {
  background: #66bb6a;
}

.small-favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 2px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.2s;
}

.small-favorite-btn:hover {
  color: var(--text-primary);
}

.small-favorite-btn.active {
  color: #ffc107;
}

.small-transcript-box {
  padding: 6px 8px;
}

.small-transcript-content {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.status-text {
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

.error-text {
  font-size: 11px;
  color: #f44;
}
</style>