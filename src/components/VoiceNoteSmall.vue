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

    <!-- 图片预览 -->
    <div v-if="node.type === 'image-note' && node.imagePath" class="small-image-box">
      <img v-if="imageBlobUrl" :src="imageBlobUrl" class="small-image-preview" />
      <div v-else class="small-image-loading">加载中...</div>
    </div>

    <!-- 转录内容 -->
    <div v-else-if="node.transcript" class="small-transcript-box">
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useNotebookStore } from '@/stores/notebookStore'
import { renderMarkdown, processImagePaths } from '@/utils/markdownRenderer'
import type { CanvasNode } from '@/types/notebook'

const notebookStore = useNotebookStore()

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

// 图片blob URL
const imageBlobUrl = ref<string | null>(null)

// 加载图片
async function loadImage() {
  if (props.node.type !== 'image-note' || !props.node.imagePath) return

  const appDataPath = await window.electronAPI.getAppPath('userData')
  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const fullPath = `${appDataPath}/notebooks/${notebook.id}/${props.node.imagePath}`
  const result = await window.electronAPI.readFile(fullPath, 'arraybuffer')

  if (result.success && result.data) {
    const blob = new Blob([result.data])
    imageBlobUrl.value = URL.createObjectURL(blob)
  }
}

// 渲染 Markdown
async function renderTranscript() {
  if (props.node.transcript) {
    let html = await renderMarkdown(props.node.transcript)
    // 处理相对路径图片
    const notebookId = notebookStore.currentNotebook?.id
    if (notebookId) {
      html = await processImagePaths(html, notebookId)
    }
    sanitizedTranscript.value = html
  }
}

onMounted(() => {
  renderTranscript()
  loadImage()
})

onUnmounted(() => {
  if (imageBlobUrl.value) {
    URL.revokeObjectURL(imageBlobUrl.value)
  }
})

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
  background: white;
  border-left: 3px solid var(--color-primary);
  box-shadow: 0 1px 4px var(--shadow-color);
  transition: box-shadow 0.2s;
  cursor: pointer;
}

:root.dark .voice-note-small {
  background: var(--bg-node-transcript);
}

.voice-note-small.active {
  box-shadow: 0 2px 12px rgba(66, 153, 225, 0.4), 0 0 0 2px var(--color-primary);
}

.small-header {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 20px;
  padding: 0 6px;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
}

:root.dark .small-header {
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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
  background: var(--color-success);
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
  color: var(--color-favorite);
}

:root.dark .small-favorite-btn.active {
  color: var(--color-favorite) !important;
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

.small-transcript-content :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 8px 0;
  border-radius: 4px;
}

.small-transcript-content :deep(video) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 8px 0;
  border-radius: 4px;
}

.status-text {
  font-size: 11px;
  color: var(--text-secondary);
  font-style: italic;
}

.error-text {
  font-size: 11px;
  color: var(--color-error);
}

/* 图片预览样式 */
.small-image-box {
  padding: 6px 8px;
}

.small-image-preview {
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
  display: block;
  margin: 0 auto;
}

.small-image-loading {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  padding: 20px 0;
}
</style>