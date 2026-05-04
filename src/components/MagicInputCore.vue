<template>
  <div ref="coreRootRef" class="magic-input-core">
    <!-- 快捷指令气泡 -->
    <div v-if="showQuickCommandSelector" class="quick-command-popover">
      <div
        v-for="cmd in quickCommandStore.quickCommands"
        :key="cmd.id"
        class="quick-command-item"
        :style="{ backgroundColor: cmd.color + '20', borderColor: cmd.color }"
        @click="insertQuickCommand(cmd)"
      >
        <span class="quick-command-name" :style="{ color: 'var(--text-primary)' }">{{ cmd.name }}</span>
      </div>
    </div>

    <!-- AI结果预览气泡 -->
    <div v-if="showPreviewPopover" class="preview-popover-overlay" @click="closePreviewPopover"></div>
    <div v-if="showPreviewPopover" class="preview-popover" :style="previewPopoverPosition" @mousedown.prevent>
      <div class="preview-content">{{ previewText }}</div>
      <div class="preview-footer">
        <span class="preview-menu-path">{{ selectedMenuPath }}</span>
        <div class="preview-actions">
        <button class="menu-btn cancel-btn" @click="closePreviewPopover" :title="t('common.cancel')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <button class="menu-btn regenerate-btn" @click="regeneratePreview" :title="t('common.regenerate')" :disabled="isRegenerating">
          <svg v-if="!isRegenerating" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
          <svg v-else class="loading-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
          </svg>
        </button>
        <button class="menu-btn append-btn" @click="appendPreviewText" :title="t('common.append')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </button>
        <button class="menu-btn use-btn" @click="applyPreviewText" :title="t('common.use')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </button>
        </div>
      </div>
    </div>

    <!-- 修辞改写多级菜单 -->
    <div v-if="showRewriteMenu" class="rewrite-menu-overlay" @click="closeRewriteMenu"></div>
    <div v-if="showRewriteMenu" class="rewrite-menu-wrapper" :style="rewriteMenuPosition" @mousedown.prevent>
      <div class="rewrite-menu-level">
        <button
          v-for="(item, key) in rewritePrompts"
          :key="key"
          class="rewrite-menu-item"
          :class="{ active: expandedKey === key }"
          @click="item.children ? (expandedKey = key, expandedChildren = item.children, expandedSubKey = null, expandedSubChildren = null) : selectRewritePrompt(item.prompt!, item.label)"
        >
          <span>{{ item.label }}</span>
          <svg v-if="item.children" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </button>
      </div>
      <!-- 第二级菜单 -->
      <div v-if="expandedChildren" class="rewrite-menu-level level-2">
        <button
          v-for="(item, key) in expandedChildren"
          :key="key"
          class="rewrite-menu-item"
          :class="{ active: expandedSubKey === key }"
          @click="item.children ? (expandedSubKey = key, expandedSubChildren = item.children) : selectRewritePrompt(item.prompt!, rewritePrompts[expandedKey!].label + ' > ' + item.label)"
        >
          <span>{{ item.label }}</span>
          <svg v-if="item.children" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </button>
      </div>
      <!-- 第三级菜单 -->
      <div v-if="expandedSubChildren" class="rewrite-menu-level level-3">
        <button
          v-for="(item, key) in expandedSubChildren"
          :key="key"
          class="rewrite-menu-item"
          @click="selectRewritePrompt(item.prompt!, rewritePrompts[expandedKey!].label + ' > ' + expandedChildren![expandedSubKey!].label + ' > ' + item.label)"
        >
          <span>{{ item.label }}</span>
        </button>
      </div>
    </div>

    <!-- 文本输入框 -->
    <div class="textarea-wrapper" :class="{ 'fixed-height': props.fixedHeight }">
      <!-- 高亮层 -->
      <div
        v-if="showFindBar && findMatches.length > 0"
        ref="highlightLayerRef"
        class="find-highlight-layer"
      ></div>
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="magic-input-textarea"
        :placeholder="t('common.inputContent')"
        @dragstart="handleTextareaDragStart"
        @dragend="handleDragEnd"
        @dragover.prevent="handleDragOver"
        @drop.prevent="handleDrop"
        @contextmenu.prevent="handleTextareaContextMenu"
        @input="handleInput"
        @keydown="handleKeydown"
        @scroll="handleTextareaScroll"
      ></textarea>
    </div>

    <!-- 查找栏 -->
    <div v-if="showFindBar" class="find-bar">
      <button class="find-close-btn" @click="closeFindBar" :title="t('common.close')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      <input
        ref="findInputRef"
        v-model="findKeyword"
        class="find-input"
        type="text"
        :placeholder="t('common.find')"
        @input="performFind"
        @keydown.enter="findNextMatch"
        @keydown.shift.enter="findPrevMatch"
        @keydown.escape="closeFindBar"
      />
      <button class="find-nav-btn" @click="findPrevMatch" :disabled="findMatches.length === 0" :title="t('common.findPrev')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
        </svg>
      </button>
      <button class="find-nav-btn" @click="findNextMatch" :disabled="findMatches.length === 0" :title="t('common.findNext')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
        </svg>
      </button>
      <span class="find-count">{{ findMatchesText }}</span>
    </div>

    <!-- 右键编辑菜单 -->
    <div v-if="showEditMenu" class="edit-menu-overlay" @click="showEditMenu = false"></div>
    <div
      v-if="showEditMenu"
      class="edit-menu"
      :style="editMenuStyle"
      @click.stop
    >
      <button class="edit-menu-item" @click="handleCopy" v-if="hasSelection">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
        <span>{{ t('common.copy') }}</span>
      </button>
      <button class="edit-menu-item" @click="handlePaste">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
        </svg>
        <span>{{ t('common.paste') }}</span>
      </button>
    </div>

    <!-- 菜单栏 -->
    <div class="magic-input-menu-bar">
      <button
        v-if="quickCommandStore.quickCommands.length > 0"
        class="menu-btn quick-btn"
        @click="toggleQuickCommandSelector"
        :class="{ active: showQuickCommandSelector }"
        :title="t('quickCommand.title')"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      </button>
      <button
        class="menu-btn record-btn"
        :class="{ active: isRecording }"
        @click="toggleRecording"
        :title="isRecording ? t('common.stopRecording') : t('common.startRecording')"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        <span v-if="isRecording" class="record-time">{{ recordingTimeDisplay }}</span>
      </button>
      <!-- 修辞改写按钮 -->
      <button
        v-if="showCorrect && quickModelConfig"
        class="menu-btn rewrite-btn"
        :class="{ active: showRewriteMenu, loading: isRewriting }"
        @mousedown.prevent
        @click="openRewriteMenu($event)"
        :disabled="!inputText.trim() || isRewriting"
        :title="t('common.rewriteText')"
      >
        <svg v-if="!isRewriting" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.71.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.7-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/>
        </svg>
        <svg v-else class="loading-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
        </svg>
      </button>
      <div class="menu-spacer"></div>
      <button v-if="showCancel" class="menu-btn cancel-btn" @click="handleCancel" :title="t('common.cancel')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      <button v-if="!sendMode" class="menu-btn confirm-btn" @click="handleSave" :disabled="!inputText.trim()" :title="t('common.confirm')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        <span class="btn-text">{{ t('common.save') }}</span>
      </button>
      <button v-else class="menu-btn send-btn" @click="handleSend" :disabled="!inputText.trim()" :title="t('common.send')">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuickCommandStore } from '@/stores/quickCommandStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import { transcribeWithSherpaOnnx } from '@/composables/useSherpaOnnx'
import { chatWithLLM } from '@/composables/useQwenAgent'
import { getNotebookImagesDir } from '@/utils/userFilesPath'
import type { QuickCommand } from '@/types/quickCommand'
import rewritePromptsRaw from '@/data/rewritePrompts.json'

// 查找匹配类型
interface FindMatch {
  start: number
  end: number
}

// 提示词菜单项类型定义
interface PromptMenuItem {
  label: string
  prompt?: string
  children?: Record<string, PromptMenuItem>
}

// 将JSON转换为正确类型
const rewritePrompts = rewritePromptsRaw as Record<string, PromptMenuItem>

const props = withDefaults(defineProps<{
  modelValue?: string
  initialText?: string
  showCorrect?: boolean
  showCancel?: boolean
  sendMode?: boolean
  nodeId?: string
  fixedHeight?: boolean
}>(), {
  modelValue: '',
  initialText: '',
  showCorrect: true,
  showCancel: false,
  sendMode: false,
  nodeId: undefined,
  fixedHeight: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': [text: string]
  'cancel': []
  'input': []
  'send': [text: string]
}>()

const { t } = useI18n()
const quickCommandStore = useQuickCommandStore()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()

// 输入文本
const inputText = ref(props.modelValue || props.initialText || '')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const coreRootRef = ref<HTMLElement | null>(null) // 根元素引用，用于定位预览框

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== inputText.value) {
    inputText.value = newVal
    nextTick(() => {
      autoResize()
    })
  }
})

// 监听 initialText 变化
watch(() => props.initialText, (newVal) => {
  if (newVal && newVal !== inputText.value) {
    inputText.value = newVal
  }
})

// 监听文本变化，更新查找
watch(inputText, () => {
  if (showFindBar.value && findKeyword.value) {
    performFind()
    nextTick(() => {
      updateHighlightLayer()
    })
  }
})

// 拖拽相关
const dragCaretPosition = ref<number | null>(null)
const internalDragSelection = ref<{ start: number; end: number; text: string } | null>(null)

// 右键编辑菜单
const showEditMenu = ref(false)
const editMenuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const hasSelection = ref(false)

// 自适应高度
function autoResize() {
  // 固定高度模式下不自动调整
  if (props.fixedHeight) return

  const textarea = textareaRef.value
  const wrapper = textarea?.parentElement
  if (!textarea || !wrapper) return
  textarea.style.height = 'auto'
  const newHeight = Math.min(textarea.scrollHeight, 600)
  textarea.style.height = newHeight + 'px'
  wrapper.style.minHeight = newHeight + 'px'
}

// 处理输入变化
function handleInput() {
  nextTick(() => {
    autoResize()
  })
  emit('update:modelValue', inputText.value)
  emit('input')
}

// 滚动条自动隐藏逻辑
let scrollTimer: number | null = null
function handleTextareaScroll() {
  const textarea = textareaRef.value
  if (!textarea) return

  textarea.classList.add('is-scrolling')

  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }

  scrollTimer = window.setTimeout(() => {
    textarea.classList.remove('is-scrolling')
    scrollTimer = null
  }, 1000)
}

// 处理键盘事件
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (props.sendMode) {
      // 如果正在输入法组合输入，不触发发送
      if (e.isComposing) return

      // 发送模式：Enter 发送消息
      if (!e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      // Shift+Enter 换行（默认行为）
    }
    // 非发送模式（MagicInputDialog）：Enter 换行（默认行为）
  }
}

// 快捷指令
const showQuickCommandSelector = ref(false)

// 录音相关
const recorder = createAudioWorkletRecorder()
const isRecording = ref(false)
const recordingDuration = ref(0)
let recordingTimer: number | null = null
const RECORDING_TIMEOUT = 30000

const recordingTimeDisplay = computed(() => {
  const seconds = Math.floor(recordingDuration.value / 1000)
  return `${seconds}s`
})

// 修辞改写相关
const isRewriting = ref(false)
const showRewriteMenu = ref(false)
const expandedKey = ref<string | null>(null)
const expandedChildren = ref<Record<string, PromptMenuItem> | null>(null)
const expandedSubKey = ref<string | null>(null)
const expandedSubChildren = ref<Record<string, PromptMenuItem> | null>(null)
const savedSelectionRange = ref<{ start: number; end: number } | null>(null)
const rewriteMenuPosition = ref<{ bottom: string; left: string }>({ bottom: '0px', left: '0px' })
const selectedMenuPath = ref<string>('') // 保存选择的菜单路径

// 查找功能相关
const showFindBar = ref(false)
const findKeyword = ref('')
const findMatches = ref<FindMatch[]>([])
const currentMatchIndex = ref(0)
const findInputRef = ref<HTMLInputElement | null>(null)
const highlightLayerRef = ref<HTMLDivElement | null>(null)

// 打开修辞菜单
function openRewriteMenu(event: MouseEvent) {
  // 保存当前选中状态
  const textarea = textareaRef.value
  if (textarea) {
    savedSelectionRange.value = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    }
  }
  expandedKey.value = null
  expandedChildren.value = null
  expandedSubKey.value = null
  expandedSubChildren.value = null

  // 计算菜单位置（相对于视窗）
  const btnRect = (event.currentTarget as HTMLElement).getBoundingClientRect()

  rewriteMenuPosition.value = {
    bottom: `${window.innerHeight - btnRect.top + 8}px`,
    left: `${btnRect.left}px`
  }

  showRewriteMenu.value = true
}

// 选择提示词并执行改写
function selectRewritePrompt(prompt: string, path?: string) {
  // 保存菜单路径
  if (path) {
    selectedMenuPath.value = path
  } else if (expandedKey.value) {
    // 从第一级菜单直接选择
    const level1Label = rewritePrompts[expandedKey.value]?.label || ''
    selectedMenuPath.value = level1Label
  }

  showRewriteMenu.value = false
  expandedKey.value = null
  expandedChildren.value = null
  expandedSubKey.value = null
  expandedSubChildren.value = null
  executeRewriteWithPrompt(prompt)
}

// 关闭修辞菜单并恢复选中状态
function closeRewriteMenu() {
  showRewriteMenu.value = false
  expandedKey.value = null
  expandedChildren.value = null
  expandedSubKey.value = null
  expandedSubChildren.value = null
  // 恢复选中状态
  if (savedSelectionRange.value) {
    const textarea = textareaRef.value
    if (textarea) {
      nextTick(() => {
        textarea.selectionStart = savedSelectionRange.value!.start
        textarea.selectionEnd = savedSelectionRange.value!.end
        textarea.focus()
      })
    }
  }
}

// AI结果预览气泡相关
const showPreviewPopover = ref(false)
const previewText = ref('')
const previewSelectionRange = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const previewPopoverPosition = ref<{ bottom: string; left: string; width: string }>({ bottom: '0px', left: '0px', width: '0px' })
const isRegenerating = ref(false)
const lastPromptTemplate = ref<string | null>(null)
const lastTextToProcess = ref<string | null>(null)
const lastSelectionRange = ref<{ start: number; end: number } | null>(null)

// 快速模型配置
const quickModelConfig = computed(() => {
  const quickModelId = settingsStore.settings.llm.quickModelProfileId
  if (!quickModelId) return null
  return settingsStore.settings.llm.profiles.find(p => p.id === quickModelId)
})

// 加载快捷指令
onMounted(() => {
  quickCommandStore.loadQuickCommands()
  nextTick(() => {
    autoResize()
  })
  // 添加查找快捷键监听
  document.addEventListener('keydown', handleFindShortcut)
})

// 处理查找快捷键 Ctrl/Cmd+F
function handleFindShortcut(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    toggleFindBar()
  }
}

// 点击外部关闭快捷指令气泡和修辞菜单
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.quick-command-popover') && !target.closest('.quick-btn')) {
    showQuickCommandSelector.value = false
  }
  // 关闭编辑菜单
  if (!target.closest('.edit-menu') && !target.closest('.magic-input-textarea')) {
    showEditMenu.value = false
  }
  // 关闭修辞菜单
  if (!target.closest('.rewrite-menu-wrapper') && !target.closest('.rewrite-btn')) {
    closeRewriteMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleFindShortcut)
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }
})

// 切换快捷指令选择器
function toggleQuickCommandSelector() {
  showQuickCommandSelector.value = !showQuickCommandSelector.value
}

// 右键菜单处理
function handleTextareaContextMenu(e: MouseEvent) {
  const textarea = textareaRef.value
  const selection = textarea ? textarea.value.substring(textarea.selectionStart, textarea.selectionEnd) : ''

  hasSelection.value = selection.length > 0
  editMenuStyle.value = {
    top: `${e.clientY}px`,
    left: `${e.clientX}px`
  }
  showEditMenu.value = true
}

// 处理 textarea 内部拖拽开始
function handleTextareaDragStart(e: DragEvent) {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = textarea.value.substring(start, end)

  if (selectedText && e.dataTransfer) {
    e.dataTransfer.setData('text/plain', selectedText)
    e.dataTransfer.setData('application/x-magic-input-core', 'true')
    e.dataTransfer.effectAllowed = 'move'

    internalDragSelection.value = {
      start: Math.min(start, end),
      end: Math.max(start, end),
      text: selectedText
    }
  }
}

// 处理拖拽结束
function handleDragEnd() {
  dragCaretPosition.value = null
  internalDragSelection.value = null
}

// 处理拖拽悬停,实时更新光标位置
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  const textarea = textareaRef.value
  if (!textarea) return

  const position = getCaretPositionFromPoint(e.clientX, e.clientY, textarea)
  if (position !== null) {
    dragCaretPosition.value = position
    textarea.selectionStart = textarea.selectionEnd = position
    textarea.focus()
  }
}

// 根据鼠标坐标计算 textarea 中的字符位置
function getCaretPositionFromPoint(x: number, y: number, textarea: HTMLTextAreaElement): number | null {
  const mirror = document.createElement('div')
  const style = window.getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()

  mirror.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    font-family: ${style.fontFamily};
    font-size: ${style.fontSize};
    line-height: ${style.lineHeight};
    letter-spacing: ${style.letterSpacing};
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: ${style.padding};
    border: ${style.border};
    box-sizing: border-box;
    z-index: 9999;
    opacity: 0;
  `

  const styleSheet = document.createElement('style')
  styleSheet.textContent = 'textarea-caret-mirror::-webkit-scrollbar { display: none; }'
  document.head.appendChild(styleSheet)

  mirror.textContent = textarea.value
  document.body.appendChild(mirror)
  mirror.scrollTop = textarea.scrollTop

  try {
    let position: number | null = null

    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y)
      if (range && range.startContainer === mirror) {
        position = range.startOffset
      } else if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        position = findTextOffset(mirror, range.startContainer, range.startOffset)
      }
    }

    if (position === null && document.caretPositionFromPoint) {
      const caretPos = document.caretPositionFromPoint(x, y)
      if (caretPos && caretPos.offsetNode === mirror) {
        position = caretPos.offset
      } else if (caretPos && caretPos.offsetNode.nodeType === Node.TEXT_NODE) {
        position = findTextOffset(mirror, caretPos.offsetNode, caretPos.offset)
      }
    }

    return position
  } finally {
    mirror.remove()
    styleSheet.remove()
  }
}

function findTextOffset(mirror: HTMLElement, textNode: Node, localOffset: number): number {
  let offset = 0
  for (const child of mirror.childNodes) {
    if (child === textNode) {
      return offset + localOffset
    }
    if (child.nodeType === Node.TEXT_NODE) {
      offset += (child as Text).length
    }
  }
  return offset + localOffset
}

// 复制选中文本
async function handleCopy() {
  const textarea = textareaRef.value
  if (textarea) {
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    if (selectedText) {
      try {
        await navigator.clipboard.writeText(selectedText)
      } catch (error) {
        console.error('Copy failed:', error)
      }
    }
  }
  showEditMenu.value = false
}

// 粘贴文本
async function handlePaste() {
  try {
    const clipboardText = await navigator.clipboard.readText()
    if (clipboardText) {
      const textarea = textareaRef.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = inputText.value
        inputText.value = text.substring(0, start) + clipboardText + text.substring(end)
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = start + clipboardText.length
          textarea.focus()
        })
      } else {
        inputText.value += clipboardText
      }
    }
  } catch (error) {
    console.error('Paste failed:', error)
  }
  showEditMenu.value = false
}

// 插入快捷指令
function insertQuickCommand(cmd: QuickCommand) {
  const textarea = textareaRef.value
  if (textarea) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = inputText.value
    inputText.value = text.substring(0, start) + cmd.content + text.substring(end)
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + cmd.content.length
      textarea.focus()
    })
  } else {
    inputText.value += cmd.content
  }
  showQuickCommandSelector.value = false
}

// 切换录音
async function toggleRecording() {
  if (isRecording.value) {
    await stopRecording()
  } else {
    await startRecording()
  }
}

// 开始录音
async function startRecording() {
  try {
    await recorder.start()
    isRecording.value = true
    recordingDuration.value = 0

    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
      if (recordingDuration.value >= RECORDING_TIMEOUT) {
        stopRecording()
      }
    }, 100)
  } catch (error) {
    console.error('Failed to start recording:', error)
    isRecording.value = false
  }
}

// 停止录音并转写
async function stopRecording() {
  if (!isRecording.value) return

  try {
    const audioBlob = await recorder.stop()
    isRecording.value = false

    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }

    const settings = settingsStore.settings
    if (!settings.stt.sherpaOnnx) {
      console.error('Sherpa-ONNX not configured')
      return
    }

    const transcriptResult = await transcribeWithSherpaOnnx(audioBlob, settings.stt.sherpaOnnx)

    if (transcriptResult.success && transcriptResult.text) {
      const textarea = textareaRef.value
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = inputText.value
        const insertText = transcriptResult.text

        inputText.value = text.substring(0, start) + insertText + text.substring(end)

        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = start + insertText.length
          textarea.focus()
        })
      } else {
        inputText.value += transcriptResult.text
      }
    }
  } catch (error) {
    console.error('Failed to stop recording:', error)
    isRecording.value = false
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
  }

  recordingDuration.value = 0
}

// 执行改写
async function executeRewriteWithPrompt(promptTemplate: string, isRegenerate: boolean = false) {
  if (!quickModelConfig.value) return

  // 使用保存的选中范围或当前选中范围
  let textToRewrite: string
  let selectionStart = 0
  let selectionEnd = 0

  if (savedSelectionRange.value) {
    selectionStart = savedSelectionRange.value.start
    selectionEnd = savedSelectionRange.value.end
    const selectedText = inputText.value.substring(selectionStart, selectionEnd)
    if (selectedText.trim()) {
      textToRewrite = selectedText
    } else {
      textToRewrite = inputText.value
      selectionStart = 0
      selectionEnd = inputText.value.length
    }
  } else {
    const textarea = textareaRef.value
    if (textarea) {
      selectionStart = textarea.selectionStart
      selectionEnd = textarea.selectionEnd
      const selectedText = textarea.value.substring(selectionStart, selectionEnd)
      if (selectedText.trim()) {
        textToRewrite = selectedText
      } else {
        textToRewrite = inputText.value
        selectionStart = 0
        selectionEnd = inputText.value.length
      }
    } else {
      textToRewrite = inputText.value
      selectionEnd = inputText.value.length
    }
  }

  if (!textToRewrite.trim()) return

  // 保存选中范围用于重新生成
  lastSelectionRange.value = { start: selectionStart, end: selectionEnd }

  // 只在首次执行时清空保存的选中范围
  if (!isRegenerate) {
    savedSelectionRange.value = null
  }

  if (isRegenerate) {
    isRegenerating.value = true
    // 重新生成时清空预览文本
    previewText.value = ''
  } else {
    isRewriting.value = true
    // 保存提示词和文本以便重新生成
    lastPromptTemplate.value = promptTemplate
    lastTextToProcess.value = textToRewrite
    // 先显示预览弹出框（空内容）
    showPreviewResult('', selectionStart, selectionEnd)
  }

  // 替换提示词中的 {text} 占位符
  const prompt = promptTemplate.replace('{text}', textToRewrite)

  const messages = [
    { role: 'user' as const, content: prompt }
  ]

  // 用于过滤 think 标签
  let buffer = ''

  try {
    await chatWithLLM(messages, {
      baseUrl: quickModelConfig.value.baseUrl,
      apiKey: quickModelConfig.value.apiKey,
      model: quickModelConfig.value.model,
      temperature: 0.7
    }, (chunk: string) => {
      // 流式更新预览文本
      buffer += chunk
      // 过滤 think 标签后再显示
      const displayText = buffer
        .replace(/<\/?think>/gi, '')
        .replace(/<\|begin_of_box\|>/gi, '')
        .replace(/<\|end_of_box\|>/gi, '')
      previewText.value = displayText
    })

    // 最终结果过滤
    const rewrittenText = buffer.trim()
      .replace(/<\/?think>/gi, '')
      .replace(/<\|begin_of_box\|>/gi, '')
      .replace(/<\|end_of_box\|>/gi, '')

    previewText.value = rewrittenText
  } catch (error) {
    console.error('Text rewrite failed:', error)
    // 失败时关闭预览弹出框
    if (!isRegenerate) {
      closePreviewPopover()
    }
  } finally {
    if (isRegenerate) {
      isRegenerating.value = false
    } else {
      isRewriting.value = false
    }
  }
}

// 显示预览结果
function showPreviewResult(text: string, start: number, end: number) {
  previewText.value = text
  previewSelectionRange.value = { start, end }

  // 计算气泡位置（使用组件自身的根元素）
  const container = coreRootRef.value
  if (container) {
    const containerRect = container.getBoundingClientRect()
    const menuBar = container.querySelector('.magic-input-menu-bar')
    if (menuBar) {
      const menuBarRect = menuBar.getBoundingClientRect()
      previewPopoverPosition.value = {
        bottom: `${window.innerHeight - menuBarRect.top + 8}px`,
        left: `${containerRect.left}px`,
        width: `${containerRect.width}px`
      }
    }
  }

  showPreviewPopover.value = true
}

// 应用预览文本
function applyPreviewText() {
  const textarea = textareaRef.value
  const { start, end } = previewSelectionRange.value

  // 替换文本
  const beforeText = inputText.value.substring(0, start)
  const afterText = inputText.value.substring(end)
  inputText.value = beforeText + previewText.value + afterText

  // 触发 v-model 更新
  emit('update:modelValue', inputText.value)

  // 恢复选取状态：选中替换后的文本
  if (textarea) {
    nextTick(() => {
      const newEnd = start + previewText.value.length
      textarea.selectionStart = start
      textarea.selectionEnd = newEnd
      textarea.focus()
    })
  }

  closePreviewPopover()
}

// 追加预览文本
function appendPreviewText() {
  const textarea = textareaRef.value
  const { start, end } = previewSelectionRange.value

  // 判断是否有选取内容
  const hasSelection = start !== end
  const appendPosition = hasSelection ? end : inputText.value.length

  // 追加文本（如果有选取内容则追加到选取内容之后，否则追加到整个文本最后）
  const beforeText = inputText.value.substring(0, appendPosition)
  const afterText = inputText.value.substring(appendPosition)
  inputText.value = beforeText + previewText.value + afterText

  // 触发 v-model 更新
  emit('update:modelValue', inputText.value)

  // 恢复选取状态：选中追加的文本
  if (textarea) {
    nextTick(() => {
      const newStart = appendPosition
      const newEnd = appendPosition + previewText.value.length
      textarea.selectionStart = newStart
      textarea.selectionEnd = newEnd
      textarea.focus()
    })
  }

  closePreviewPopover()
}

// 重新生成预览文本
async function regeneratePreview() {
  if (!lastPromptTemplate.value || !lastTextToProcess.value || !quickModelConfig.value) return

  isRegenerating.value = true
  // 清空当前预览文本
  previewText.value = ''

  const prompt = lastPromptTemplate.value.replace('{text}', lastTextToProcess.value)

  const messages = [
    { role: 'user' as const, content: prompt }
  ]

  // 用于过滤 think 标签
  let buffer = ''

  try {
    await chatWithLLM(messages, {
      baseUrl: quickModelConfig.value.baseUrl,
      apiKey: quickModelConfig.value.apiKey,
      model: quickModelConfig.value.model,
      temperature: 0.7
    }, (chunk: string) => {
      // 流式更新预览文本
      buffer += chunk
      // 过滤 think 标签后再显示
      const displayText = buffer
        .replace(/<\/?think>/gi, '')
        .replace(/<\|begin_of_box\|>/gi, '')
        .replace(/<\|end_of_box\|>/gi, '')
      previewText.value = displayText
    })

    // 最终结果过滤
    const rewrittenText = buffer.trim()
      .replace(/<\/?think>/gi, '')
      .replace(/<\|begin_of_box\|>/gi, '')
      .replace(/<\|end_of_box\|>/gi, '')

    previewText.value = rewrittenText

    // 恢复原文的选中状态
    if (lastSelectionRange.value) {
      const textarea = textareaRef.value
      if (textarea) {
        nextTick(() => {
          textarea.selectionStart = lastSelectionRange.value!.start
          textarea.selectionEnd = lastSelectionRange.value!.end
        })
      }
    }
  } catch (error) {
    console.error('Regenerate failed:', error)
  } finally {
    isRegenerating.value = false
  }
}

// 关闭预览气泡
function closePreviewPopover() {
  showPreviewPopover.value = false
  previewText.value = ''
}

// 查找功能：切换查找栏
function toggleFindBar() {
  showFindBar.value = !showFindBar.value
  if (showFindBar.value) {
    nextTick(() => {
      findInputRef.value?.focus()
      // 如果 textarea 有选中内容，将其作为默认搜索词
      const textarea = textareaRef.value
      if (textarea) {
        const selection = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
        if (selection) {
          findKeyword.value = selection
          performFind()
        }
      }
    })
  } else {
    closeFindBar()
  }
}

// 关闭查找栏
function closeFindBar() {
  showFindBar.value = false
  findKeyword.value = ''
  findMatches.value = []
  currentMatchIndex.value = 0
  textareaRef.value?.focus()
}

// 执行查找
function performFind() {
  const keyword = findKeyword.value
  const text = inputText.value

  if (!keyword) {
    findMatches.value = []
    currentMatchIndex.value = 0
    return
  }

  // 查找所有匹配
  const matches: FindMatch[] = []
  let searchPos = 0
  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()

  while (searchPos <= lowerText.length) {
    const pos = lowerText.indexOf(lowerKeyword, searchPos)
    if (pos === -1) break
    matches.push({ start: pos, end: pos + keyword.length })
    searchPos = pos + 1
  }

  findMatches.value = matches

  // 如果有匹配，选中第一个
  if (matches.length > 0) {
    currentMatchIndex.value = 0
    scrollToMatch(0)
  } else {
    currentMatchIndex.value = 0
  }
}

// 查找下一个
function findNextMatch() {
  if (findMatches.value.length === 0) return

  currentMatchIndex.value = (currentMatchIndex.value + 1) % findMatches.value.length
  scrollToMatch(currentMatchIndex.value)
}

// 查找上一个
function findPrevMatch() {
  if (findMatches.value.length === 0) return

  currentMatchIndex.value = (currentMatchIndex.value - 1 + findMatches.value.length) % findMatches.value.length
  scrollToMatch(currentMatchIndex.value)
}

// 滚动到指定匹配并选中
function scrollToMatch(index: number) {
  const match = findMatches.value[index]
  if (!match) return

  const textarea = textareaRef.value
  if (textarea) {
    textarea.focus()
    textarea.selectionStart = match.start
    textarea.selectionEnd = match.end

    // 滚动使匹配可见
    const textBefore = inputText.value.substring(0, match.start)
    const linesBefore = textBefore.split('\n').length
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20
    const scrollTop = (linesBefore - 1) * lineHeight - textarea.clientHeight / 2
    textarea.scrollTop = Math.max(0, scrollTop)

    // 更新高亮层
    updateHighlightLayer()
  }
}

// 更新高亮层
function updateHighlightLayer() {
  const textarea = textareaRef.value
  const highlightLayer = highlightLayerRef.value
  if (!textarea || !highlightLayer || findMatches.value.length === 0) return

  const text = inputText.value
  const keyword = findKeyword.value

  // 构建高亮HTML
  let html = ''
  let lastEnd = 0

  findMatches.value.forEach((match, idx) => {
    // 添加匹配前的文本
    html += escapeHtml(text.substring(lastEnd, match.start))

    // 添加高亮匹配
    const matchText = text.substring(match.start, match.end)
    const isCurrent = idx === currentMatchIndex.value
    const className = isCurrent ? 'find-highlight-current' : 'find-highlight'
    html += `<span class="${className}">${escapeHtml(matchText)}</span>`

    lastEnd = match.end
  })

  // 添加最后剩余文本
  html += escapeHtml(text.substring(lastEnd))

  highlightLayer.innerHTML = html
}

// HTML转义
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/<span class="find-highlight-current">/g, '%%CURRENT%%')
    .replace(/<span class="find-highlight">/g, '%%MATCH%%')
    .replace(/<\/span>/g, '%%END%%')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/%%CURRENT%%/g, '<span class="find-highlight-current">')
    .replace(/%%MATCH%%/g, '<span class="find-highlight">')
    .replace(/%%END%%/g, '</span>')
}

// 查找匹配数量显示
const findMatchesText = computed(() => {
  if (findMatches.value.length === 0) {
    return t('common.findNoMatch')
  }
  return t('common.findMatches', {
    current: currentMatchIndex.value + 1,
    total: findMatches.value.length
  })
})

// 同步高亮层滚动
function syncHighlightScroll() {
  const textarea = textareaRef.value
  const highlightLayer = highlightLayerRef.value
  if (textarea && highlightLayer) {
    highlightLayer.scrollTop = textarea.scrollTop
    highlightLayer.scrollLeft = textarea.scrollLeft
  }

  // 同时处理滚动条显示
  handleTextareaScroll()
}

// 处理拖放
async function handleDrop(e: DragEvent) {
  const textarea = textareaRef.value

  const text = e.dataTransfer?.getData('text/plain')
  if (text && text.trim()) {
    if (textarea) {
      const insertPosition = dragCaretPosition.value ?? textarea.selectionStart
      const currentText = inputText.value
      const isInternalDrag = internalDragSelection.value !== null

      if (isInternalDrag && internalDragSelection.value) {
        const { start: deleteStart, end: deleteEnd } = internalDragSelection.value

        let adjustedInsertPos = insertPosition
        if (insertPosition > deleteEnd) {
          adjustedInsertPos = insertPosition - (deleteEnd - deleteStart)
        } else if (insertPosition >= deleteStart && insertPosition <= deleteEnd) {
          adjustedInsertPos = deleteStart
        }

        const beforeDelete = currentText.substring(0, deleteStart)
        const afterDelete = currentText.substring(deleteEnd)
        const textAfterDelete = beforeDelete + afterDelete

        inputText.value = textAfterDelete.substring(0, adjustedInsertPos) + text + textAfterDelete.substring(adjustedInsertPos)

        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = adjustedInsertPos + text.length
          textarea.focus()
        })

        internalDragSelection.value = null
      } else {
        inputText.value = currentText.substring(0, insertPosition) + text + currentText.substring(insertPosition)
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = insertPosition + text.length
          textarea.focus()
        })
      }

      dragCaretPosition.value = null
    } else {
      inputText.value += text
    }
    return
  }

  if (!e.dataTransfer?.files.length) return

  const files = Array.from(e.dataTransfer.files)
  const imageFiles = files.filter(f => f.type.startsWith('image/'))

  if (imageFiles.length === 0) return

  const notebook = notebookStore.currentNotebook
  if (!notebook) return

  const imagesDir = await getNotebookImagesDir(notebook.id)
  await window.electronAPI.mkdir(imagesDir)

  for (const file of imageFiles) {
    const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const ext = file.name.split('.').pop() || 'png'
    const filename = `${imageId}.${ext}`
    const imagePath = `${imagesDir}/${filename}`
    const relativePath = `images/${filename}`

    const arrayBuffer = await file.arrayBuffer()
    await window.electronAPI.saveFileBuffer(imagePath, arrayBuffer)

    const markdownLink = `\n![${file.name}](${relativePath})\n`
    const textarea = textareaRef.value
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = inputText.value
      inputText.value = text.substring(0, start) + markdownLink + text.substring(end)
      nextTick(() => {
        textarea.selectionStart = textarea.selectionEnd = start + markdownLink.length
        textarea.focus()
      })
    }
  }
}

// 保存
function handleSave() {
  const text = inputText.value.trim()
  if (text) {
    emit('save', text)
  }
}

// 发送
function handleSend() {
  const text = inputText.value.trim()
  if (text) {
    emit('send', text)
  }
}

// 取消
function handleCancel() {
  if (isRecording.value) {
    recorder.stop().catch(console.error)
    isRecording.value = false
    if (recordingTimer) {
      clearInterval(recordingTimer)
      recordingTimer = null
    }
    recordingDuration.value = 0
  }
  emit('cancel')
}

// 暴露方法供外部调用
defineExpose({
  textareaRef,
  inputText,
  autoResize
})
</script>

<style scoped>
.magic-input-core {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.magic-input-textarea {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px;
  border: none;
  background: var(--bg-primary) !important;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;
  overflow-y: auto;
  z-index: 2;
  scrollbar-color: transparent transparent;
}

.magic-input-textarea.is-scrolling {
  scrollbar-color: rgba(128, 128, 128, 0.4) transparent;
}

.magic-input-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.magic-input-textarea::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.magic-input-textarea.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
}

:root.dark .magic-input-textarea.is-scrolling {
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

:root.dark .magic-input-textarea.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.magic-input-textarea::placeholder {
  color: var(--text-secondary);
}

.magic-input-menu-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  height: 32px;
  flex-shrink: 0;
}

.magic-input-menu-bar .menu-spacer {
  flex: 1;
}

.magic-input-menu-bar .menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.2s;
  gap: 4px;
}

.magic-input-menu-bar .menu-btn .btn-text {
  display: none;
  font-size: 13px;
  font-weight: 500;
}

/* 弹出框模式下显示按钮文本 */
.magic-input-dialog-mode .magic-input-menu-bar .menu-btn .btn-text {
  display: inline;
}

.magic-input-menu-bar .menu-btn:hover {
  background: var(--color-primary);
  color: white;
}

.magic-input-menu-bar .menu-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.magic-input-menu-bar .menu-btn:disabled:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.magic-input-menu-bar .confirm-btn:disabled {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
  opacity: 0.6;
}

.magic-input-menu-bar .confirm-btn:disabled:hover {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
}

.magic-input-menu-bar .send-btn:hover {
  background: var(--color-primary);
  color: white;
}

.magic-input-menu-bar .send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.magic-input-menu-bar .send-btn:disabled:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.magic-input-menu-bar .record-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 32px;
}

.magic-input-menu-bar .record-btn.active {
  background: var(--color-danger);
  color: white;
}

.magic-input-menu-bar .record-btn .record-time {
  font-size: 12px;
  font-weight: 500;
}

/* 快捷指令气泡 */
.quick-command-popover {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 40px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
}

.quick-command-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.quick-command-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px var(--shadow-color);
}

.quick-command-name {
  font-size: 13px;
  font-weight: 500;
}

/* 右键编辑菜单 */
.edit-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
}

.edit-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px;
  z-index: 20;
  min-width: 100px;
}

.edit-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  width: 100%;
  transition: background 0.2s;
}

.edit-menu-item:hover {
  background: var(--bg-secondary);
}

/* 修辞改写按钮加载动画 */
.rewrite-btn .loading-spinner {
  animation: spin 1s linear infinite;
}

/* AI结果预览气泡 */
.preview-popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.preview-popover {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  padding: 12px;
  box-sizing: border-box;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 -2px 12px var(--shadow-color);
  z-index: 1000;
  max-height: 300px;
  overflow: hidden;
}


.preview-content {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-menu-path {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary) !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

.preview-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}

.preview-actions .menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.preview-actions .menu-btn:hover {
  background: var(--color-primary);
  color: white;
}

.preview-actions .menu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-actions .menu-btn:disabled:hover {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.preview-actions .regenerate-btn .loading-spinner {
  animation: spin 1s linear infinite;
}

/* 修辞改写多级菜单 */
.rewrite-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.rewrite-menu-wrapper {
  position: fixed;
  display: flex;
  align-items: flex-end;
  gap: 0;
  z-index: 1000;
}

.rewrite-menu-level {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 2px 12px var(--shadow-color);
  padding: 4px;
  min-width: 80px;
  max-height: 200px;
  overflow-y: auto;
}

.rewrite-menu-level.level-2 {
  margin-left: -1px;
}

.rewrite-menu-level.level-3 {
  margin-left: -1px;
}

.rewrite-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  width: 100%;
  transition: background 0.2s;
  white-space: nowrap;
}

.rewrite-menu-item:hover,
.rewrite-menu-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 文本区域包装器 */
.textarea-wrapper {
  position: relative;
  flex: 1;
  min-height: 100px;
  overflow: hidden;
}

/* 固定高度模式：移除最小高度限制，让 textarea 填充可用空间 */
.textarea-wrapper.fixed-height {
  min-height: 0;
}

/* 高亮层 */
.find-highlight-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: hidden;
  pointer-events: none;
  color: transparent;
  z-index: 1;
}

.find-highlight-layer .find-highlight {
  background-color: rgba(255, 200, 0, 0.4);
  border-radius: 2px;
}

.find-highlight-layer .find-highlight-current {
  background-color: rgba(255, 180, 0, 0.7);
  border-radius: 2px;
  box-shadow: 0 0 0 2px rgba(255, 180, 0, 0.5);
}

/* 查找栏 */
.find-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 -2px 12px var(--shadow-color);
  z-index: 10;
}

.find-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.find-close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.find-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.find-input:focus {
  border-color: var(--color-primary);
}

.find-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.find-nav-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
}

.find-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.find-count {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  min-width: 60px;
}
</style>
