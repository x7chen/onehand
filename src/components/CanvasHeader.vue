<template>
  <div ref="headerRef" class="canvas-header">
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

    <!-- 模型选择器 -->
    <div
      ref="modelSelectorRef"
      class="model-selector"
      @click="toggleModelSelector"
      :class="{ 'active': showModelSelector }"
      :title="currentModel ? `当前模型: ${currentModel.name}` : '选择模型'"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="model-icon">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.1c-.26.81-1.05 1.38-1.9 1.38h-1v-1c0-1.1-.9-2-2-2h-2v-2c0-.55-.45-1-1-1H7v-2h2c1.1 0 2-.9 2-2h2v2c0 .55.45 1 1 1h3v1h-1v2h2l.3 1.62zM21 12c0 .34-.03.67-.07 1H18v-2h2.93c.04.33.07.66.07 1z"/>
      </svg>
      <div v-if="showModelSelector" class="model-dropdown">
        <span
          v-for="profile in allProfiles"
          :key="profile.id"
          class="model-option"
          :class="{ selected: currentModel?.id === profile.id }"
          @click.stop="selectModel(profile.id)"
        >
          {{ profile.name }}
        </span>
        <span v-if="allProfiles.length === 0" class="no-models-hint">暂无模型配置</span>
      </div>
      <span v-else class="model-name">{{ currentModel?.name || '选择模型' }}</span>
    </div>

    <!-- 以下元素在宽度不足时隐藏 -->
    <template v-if="!isCompactMode">
      <h2>{{ notebookName }}</h2>

      <!-- 回到原点按钮 -->
      <button
        v-if="showViewportControls"
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
        v-if="showViewportControls"
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
        <button
          @click="$emit('copy-selected-context')"
          class="context-action-btn copy-btn"
          :class="{ disabled: selectedContextCount === 0 }"
          :title="selectedContextCount > 0 ? `复制已选 ${selectedContextCount} 个笔记内容` : '未选中笔记'"
          :disabled="selectedContextCount === 0"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
        <button @click="$emit('toggle-all-context')" class="context-action-btn" :title="isAllContextSelected ? '清空选择' : '全选所有已完成笔记'">
          <svg v-if="!isAllContextSelected" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <button @click="$emit('invert-selection')" class="context-action-btn" title="反选所有已完成笔记">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
          </svg>
        </button>
      </div>

      <div
        ref="dynamicContextDisplayRef"
        class="dynamic-context-display"
        :class="{ 'active': showDynamicContextSelector, 'has-content': dynamicContextFile && dynamicContextFile.content }"
        @dragover="handleDynamicContextDragOver"
        @dragleave="handleDynamicContextDragLeave"
        @drop="handleDynamicContextDrop"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="currentColor"
          class="context-icon"
          @click.stop="toggleDynamicContextSelector"
          :title="showDynamicContextSelector ? '关闭选择器' : '点击选择动态上下文'"
        >
          <path d="M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z"/>
        </svg>
        <div v-if="showDynamicContextSelector" class="dynamic-context-tags">
          <span
            v-for="file in allDynamicContextFiles"
            :key="file.id"
            class="context-tag-mini"
            :class="{ selected: dynamicContextFile?.id === file.id }"
            :style="{
              backgroundColor: dynamicContextFile?.id === file.id ? file.color + '40' : 'var(--bg-secondary)',
              borderColor: dynamicContextFile?.id === file.id ? file.color : 'var(--border-color)',
              color: dynamicContextFile?.id === file.id ? file.color : 'var(--text-secondary)'
            }"
            @click.stop="selectDynamicContext(file.id)"
          >
            {{ file.name }}
          </span>
          <span v-if="allDynamicContextFiles.length === 0" class="no-contexts-hint">暂无动态上下文</span>
        </div>
        <div
          v-else-if="dynamicContextFile"
          class="dynamic-context-info"
          @dblclick.stop="$emit('open-dynamic-context-editor')"
          :title="'双击编辑动态上下文'"
        >
          <span class="context-name" :style="{ color: dynamicContextFile.color }">
            {{ dynamicContextFile.name }}
          </span>
          <span class="word-count" v-if="dynamicContextFile.content">{{ dynamicContextFile.content.length }}字</span>
        </div>
        <span
          v-else
          class="context-placeholder"
          @click.stop="toggleDynamicContextSelector"
          :title="'点击选择动态上下文'"
        >
          选择动态上下文
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ContextFile } from '@/types/context'
import type { LLMProfile } from '@/types/settings'

const props = withDefaults(defineProps<{
  notebookName: string
  staticContextFiles: ContextFile[]
  allStaticContextFiles: ContextFile[]
  allDynamicContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile
  globalHideAiResult: boolean
  aiAnswerEnabled: boolean
  isAllContextSelected: boolean
  showViewportControls?: boolean
  selectedContextCount?: number
  notebookModelId?: string
  allProfiles: LLMProfile[]
  activeProfileId: string
}>(), {
  showViewportControls: true,
  selectedContextCount: 0,
  notebookModelId: undefined,
  allProfiles: () => [],
  activeProfileId: ''
})

const emit = defineEmits<{
  'back': []
  'reset-viewport': []
  'auto-layout': []
  'update:globalHideAiResult': [value: boolean]
  'update:aiAnswerEnabled': [value: boolean]
  'toggle-all-context': []
  'invert-selection': []
  'copy-selected-context': []
  'open-dynamic-context-editor': []
  'toggle-static-context': [contextId: string]
  'select-dynamic-context': [contextId: string]
  'dynamic-context-drop': [text: string]
  'select-model': [modelId: string]
}>()

// 静态上下文选择器状态
const showStaticContextSelector = ref(false)
const staticContextDisplayRef = ref<HTMLElement | null>(null)

// 动态上下文选择器状态
const showDynamicContextSelector = ref(false)
const dynamicContextDisplayRef = ref<HTMLElement | null>(null)

// 模型选择器状态
const showModelSelector = ref(false)
const modelSelectorRef = ref<HTMLElement | null>(null)

// 获取当前笔记本使用的模型（如果没有指定则使用全局默认）
const currentModel = computed(() => {
  const modelId = props.notebookModelId || props.activeProfileId
  return props.allProfiles.find(p => p.id === modelId)
})

// Header 宽度检测
const headerRef = ref<HTMLElement | null>(null)
const isCompactMode = ref(false)
const COMPACT_MODE_THRESHOLD = 600 // 宽度小于 600px 时进入紧凑模式

let resizeObserver: ResizeObserver | null = null

function checkCompactMode() {
  if (headerRef.value) {
    isCompactMode.value = headerRef.value.offsetWidth < COMPACT_MODE_THRESHOLD
  }
}

function toggleStaticContextSelector() {
  showStaticContextSelector.value = !showStaticContextSelector.value
  // 关闭另一个选择器
  if (showStaticContextSelector.value) {
    showDynamicContextSelector.value = false
  }
}

function toggleDynamicContextSelector() {
  showDynamicContextSelector.value = !showDynamicContextSelector.value
  // 关闭另一个选择器
  if (showDynamicContextSelector.value) {
    showStaticContextSelector.value = false
    showModelSelector.value = false
  }
}

function toggleModelSelector() {
  showModelSelector.value = !showModelSelector.value
  // 关闭其他选择器
  if (showModelSelector.value) {
    showStaticContextSelector.value = false
    showDynamicContextSelector.value = false
  }
}

function selectModel(profileId: string) {
  emit('select-model', profileId)
  showModelSelector.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (showStaticContextSelector.value &&
      staticContextDisplayRef.value &&
      !staticContextDisplayRef.value.contains(e.target as Node)) {
    showStaticContextSelector.value = false
  }
  if (showDynamicContextSelector.value &&
      dynamicContextDisplayRef.value &&
      !dynamicContextDisplayRef.value.contains(e.target as Node)) {
    showDynamicContextSelector.value = false
  }
  if (showModelSelector.value &&
      modelSelectorRef.value &&
      !modelSelectorRef.value.contains(e.target as Node)) {
    showModelSelector.value = false
  }
}

function toggleStaticContext(contextId: string) {
  emit('toggle-static-context', contextId)
}

function selectDynamicContext(contextId: string) {
  emit('select-dynamic-context', contextId)
  showDynamicContextSelector.value = false
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

  // 监听宽度变化
  if (headerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      checkCompactMode()
    })
    resizeObserver.observe(headerRef.value)
    checkCompactMode()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
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
  background: var(--color-info-light);
  color: var(--color-info);
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

.ai-answer-toggle-btn.active {
  background: var(--color-primary);
}

.ai-answer-toggle-btn.active .ai-icon-text {
  color: white !important;
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

.context-action-btn.disabled,
.context-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.context-action-btn.disabled:hover,
.context-action-btn:disabled:hover {
  background: transparent;
  color: var(--text-secondary);
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

.dynamic-context-display.active {
  background: var(--border-color);
}

.dynamic-context-display.has-content {
  border-color: var(--color-primary);
}

.dynamic-context-display .context-icon {
  flex-shrink: 0;
  color: var(--color-primary);
  cursor: pointer;
  transition: color 0.2s, transform 0.2s;
}

.dynamic-context-display .context-icon:hover {
  color: var(--color-primary-hover);
  transform: scale(1.1);
}

.dynamic-context-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.dynamic-context-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.dynamic-context-info:hover {
  background: rgba(66, 153, 225, 0.1);
}

.no-contexts-hint {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.word-count {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 4px;
}

/* 模型选择器 */
.model-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 80px;
  max-width: 150px;
}

.model-selector:hover {
  background: var(--border-color);
}

.model-selector.active {
  background: var(--border-color);
}

.model-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.model-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.model-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px;
  min-width: 120px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-option {
  display: block;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.model-option:hover {
  background: var(--bg-secondary);
}

.model-option.selected {
  background: var(--color-primary)20;
  color: var(--color-primary);
  font-weight: 500;
}

.no-models-hint {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  padding: 6px 12px;
}
</style>