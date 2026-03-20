<template>
  <div class="canvas-header">
    <button @click="$emit('back')" class="back-btn">
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
          v-for="file in allStaticContextFiles"
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

    <h2>{{ projectName }}</h2>

    <!-- 回到原点按钮 -->
    <button
      @click="$emit('reset-viewport')"
      class="reset-viewport-btn"
      title="回到原点"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-9h10v2H7l3.5 3.5-1.42 1.42L4.16 13l4.92-4.92L10.5 9.5 7 13z"/>
      </svg>
    </button>

    <!-- 自动排版按钮 -->
    <button
      @click="$emit('auto-layout')"
      class="auto-layout-btn"
      title="自动排版"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
      </svg>
    </button>

    <!-- 总隐藏 AI 回答开关 -->
    <button
      @click="$emit('update:globalHideAiResult', !globalHideAiResult)"
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
      @click="$emit('update:aiAnswerEnabled', !aiAnswerEnabled)"
      class="ai-answer-toggle-btn"
      :class="{ active: aiAnswerEnabled }"
      :title="aiAnswerEnabled ? '关闭 AI 回答' : '开启 AI 回答'"
    >
      <span class="ai-icon-text">AI</span>
    </button>

    <!-- 动态上下文显示（右侧） -->
    <div class="context-toolbar-group">
      <button @click="$emit('toggle-all-context')" class="context-action-btn" :title="isAllContextSelected ? '清空选择' : '全选所有已完成节点'">
        <svg v-if="!isAllContextSelected" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      <button @click="$emit('invert-selection')" class="context-action-btn" title="反选所有已完成节点">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
        </svg>
      </button>
    </div>

    <div
      class="dynamic-context-display"
      :class="{ 'has-content': dynamicContextFile && dynamicContextFile.content }"
      @dblclick="$emit('open-dynamic-context-editor')"
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ContextFile } from '@/types/context'

const props = defineProps<{
  projectName: string
  staticContextFiles: ContextFile[]
  allStaticContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile
  globalHideAiResult: boolean
  aiAnswerEnabled: boolean
  isAllContextSelected: boolean
}>()

const emit = defineEmits<{
  'back': []
  'reset-viewport': []
  'auto-layout': []
  'update:globalHideAiResult': [value: boolean]
  'update:aiAnswerEnabled': [value: boolean]
  'toggle-all-context': []
  'invert-selection': []
  'open-dynamic-context-editor': []
  'toggle-static-context': [contextId: string]
  'dynamic-context-drop': [text: string]
}>()

// 静态上下文选择器状态
const showStaticContextSelector = ref(false)
const staticContextDisplayRef = ref<HTMLElement | null>(null)

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

function toggleStaticContext(contextId: string) {
  emit('toggle-static-context', contextId)
}

// 动态上下文拖拽处理
const isOverDynamicContext = ref(false)

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

function handleDynamicContextDrop(e: DragEvent) {
  e.preventDefault()
  isOverDynamicContext.value = false

  const text = e.dataTransfer?.getData('text/plain')
  if (!text || !text.trim()) return

  emit('dynamic-context-drop', text.trim())
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
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
</style>