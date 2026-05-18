<template>
  <div ref="headerRef" class="canvas-header">
    <!-- 左侧组件容器 -->
    <div class="left-controls-group">
      <!-- 返回按钮（仅在非隐藏导航模式下显示） -->
      <button v-if="!hideNavigation" @click="$emit('back')" class="back-btn">
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
      :title="staticContextFiles.length > 0 ? t('canvas.clickToManageStaticContext') : t('canvas.clickToSelectStaticContext')"
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
            color: staticContextFiles.some(f => f.id === file.id) ? 'var(--text-primary)' : 'var(--text-secondary)'
          }"
          @click.stop="toggleStaticContext(file.id)"
        >
          {{ file.name }}
        </span>
      </div>
      <div v-else-if="staticContextFiles.length > 0" class="static-context-names">
        <template v-for="(file, index) in staticContextFiles" :key="file.id">
          <span v-if="index < 4" class="context-name-tag" :title="file.name" :style="{ backgroundColor: file.color + '20', borderColor: file.color, color: 'var(--text-primary)' }">
            {{ file.name }}
          </span>
        </template>
        <span v-if="staticContextFiles.length > 4" class="context-count">+{{ staticContextFiles.length - 4 }}</span>
      </div>
      <span v-else class="context-placeholder">{{ t('context.selectStaticContext') }}</span>
    </div>
    </div>

    <!-- 以下元素在宽度不足时隐藏 -->
    <template v-if="!isCompactMode">
      <!-- 右侧组件容器 -->
      <div class="right-controls-group">

      <!-- 回到原点按钮 -->
      <button
        v-if="showViewportControls"
        @click="$emit('reset-viewport')"
        class="reset-viewport-btn"
        :title="t('canvas.backToOrigin')"
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <rect x="3" y="3" width="18" height="18" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1" opacity="0.5"/>
          <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1" opacity="0.5"/>
          <circle cx="12" cy="12" r="2" fill="currentColor"/>
        </svg>
      </button>

      <!-- 自动排版按钮 -->
      <button
        v-if="showViewportControls"
        @click="$emit('auto-layout')"
        class="auto-layout-btn"
        :title="t('canvas.autoLayout')"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <rect x="2" y="2" width="9" height="9" rx="1.5"/>
          <rect x="13" y="2" width="9" height="9" rx="1.5"/>
          <rect x="2" y="13" width="9" height="9" rx="1.5"/>
          <rect x="13" y="13" width="9" height="9" rx="1.5"/>
        </svg>
      </button>

      <!-- 总隐藏 AI 回答开关 -->
      <button
        v-if="showViewportControls"
        @click="$emit('update:globalHideAiResult', !globalHideAiResult)"
        class="global-hide-ai-btn"
        :class="{ active: globalHideAiResult }"
        :title="globalHideAiResult ? t('canvas.showAllAiAnswers') : t('canvas.hideAllAiAnswers')"
      >
        <svg v-if="!globalHideAiResult" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
        </svg>
      </button>

      <!-- 动态上下文显示（右侧） -->
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
          :title="showDynamicContextSelector ? t('canvas.clickToToggleSelector') : t('canvas.clickToSelectDynamicContext')"
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
              color: dynamicContextFile?.id === file.id ? 'var(--text-primary)' : 'var(--text-secondary)'
            }"
            @click.stop="selectDynamicContext(file.id)"
          >
            {{ file.name }}
          </span>
          <span v-if="allDynamicContextFiles.length === 0" class="no-contexts-hint">{{ t('context.noDynamicContexts') }}</span>
        </div>
        <div
          v-else-if="dynamicContextFile"
          class="dynamic-context-info"
          @dblclick.stop="$emit('open-dynamic-context-editor')"
          :title="t('canvas.doubleClickToEdit')"
        >
          <span class="context-name" :style="{ color: 'var(--text-primary)' }">
            {{ dynamicContextFile.name }}
          </span>
          <span class="word-count" v-if="dynamicContextFile.content">{{ t('context.wordCount', { count: dynamicContextFile.content.length }) }}</span>
        </div>
        <span
          v-else
          class="context-placeholder"
          @click.stop="toggleDynamicContextSelector"
          :title="t('canvas.clickToSelectDynamicContext')"
        >
          {{ t('context.selectDynamicContext') }}
        </span>
      </div>
      </div>
    </template>

    <!-- 创建笔记本对话框 -->
    <CreateNotebookDialog
      :visible="showCreateNotebookDialog"
      :static-context-files="allStaticContextFiles"
      :dynamic-context-files="allDynamicContextFiles"
      @close="showCreateNotebookDialog = false"
      @create="handleCreateNotebook"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import CreateNotebookDialog from '@/components/CreateNotebookDialog.vue'
import type { ContextFile } from '@/types/context'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  staticContextFiles: ContextFile[]
  allStaticContextFiles: ContextFile[]
  allDynamicContextFiles: ContextFile[]
  dynamicContextFile?: ContextFile
  globalHideAiResult: boolean
  showViewportControls?: boolean
  hideNavigation?: boolean
}>(), {
  showViewportControls: true,
  hideNavigation: false
})

const emit = defineEmits<{
  'back': []
  'reset-viewport': []
  'auto-layout': []
  'update:globalHideAiResult': [value: boolean]
  'open-dynamic-context-editor': []
  'toggle-static-context': [contextId: string]
  'select-dynamic-context': [contextId: string]
  'dynamic-context-drop': [text: string]
  'create-notebook': [data: {
    name: string
    pdfPath?: string
    staticContextIds: string[]
    dynamicContextId?: string
  }]
}>()

// 创建笔记本对话框状态
const showCreateNotebookDialog = ref(false)

// 静态上下文选择器状态
const showStaticContextSelector = ref(false)
const staticContextDisplayRef = ref<HTMLElement | null>(null)

// 动态上下文选择器状态
const showDynamicContextSelector = ref(false)
const dynamicContextDisplayRef = ref<HTMLElement | null>(null)

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
  // 关闭其他选择器
  if (showDynamicContextSelector.value) {
    showStaticContextSelector.value = false
  }
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

// 处理创建笔记本
function handleCreateNotebook(data: {
  name: string
  pdfPath?: string
  staticContextIds: string[]
  dynamicContextId?: string
}) {
  emit('create-notebook', data)
  showCreateNotebookDialog.value = false
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

/* 左侧组件容器 */
.left-controls-group {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-right: auto;
}

/* 右侧组件容器 */
.right-controls-group {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
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
</style>