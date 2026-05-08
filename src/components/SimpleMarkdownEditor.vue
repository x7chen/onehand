<template>
  <div class="editor-wrapper">
    <!-- 自定义工具栏 -->
    <div class="editor-toolbar">
      <!-- 撤销 -->
      <button
        class="toolbar-btn"
        :class="{ disabled: !canUndo }"
        :disabled="!canUndo"
        @mousedown.prevent
        @click="undo"
        title="撤销 (Ctrl+Z)"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
        </svg>
      </button>
      <!-- 前进 -->
      <button
        class="toolbar-btn"
        :class="{ disabled: !canRedo }"
        :disabled="!canRedo"
        @mousedown.prevent
        @click="redo"
        title="前进 (Ctrl+Y)"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.06-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 字体颜色 -->
      <div class="color-btn-wrapper">
        <button class="toolbar-btn color-btn" @mousedown.prevent="handleColorBtnMouseDown" title="字体颜色">
          <span class="color-letter">A</span>
          <span class="color-indicator" :style="{ backgroundColor: selectedColor }"></span>
        </button>
        <div v-if="showColorPicker" class="color-picker-popup">
          <div
            v-for="color in TEXT_COLORS"
            :key="color.value"
            class="color-option-popup"
            :style="{ backgroundColor: color.value }"
            :title="color.name"
            @mousedown.prevent
            @click="applyColor(color.value)"
          ></div>
        </div>
      </div>

      <!-- 高亮 -->
      <div class="color-btn-wrapper">
        <button class="toolbar-btn highlight-btn" @mousedown.prevent="handleHighlightBtnMouseDown" title="高亮">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15.24 3.76l-9.8 9.8c-.39.39-.39 1.02 0 1.41l4.95 4.96c.39.39 1.02.39 1.41 0l9.8-9.8c.39-.39.39-1.02 0-1.41l-4.96-4.96c-.39-.39-1.02-.39-1.4 0zM16.66 5.17l3.54 3.54-8.49 8.49-3.54-3.54 8.49-8.49zM3.76 15.24l2.12-2.12 4.95 4.96-2.12 2.12-4.95-4.96z"/>
          </svg>
          <span class="highlight-indicator" :style="{ backgroundColor: selectedHighlightColor }"></span>
        </button>
        <div v-if="showHighlightPicker" class="color-picker-popup">
          <div
            v-for="color in HIGHLIGHT_COLORS"
            :key="color.value"
            class="color-option-popup"
            :style="{ backgroundColor: color.value }"
            :title="color.name"
            @mousedown.prevent
            @click="applyHighlight(color.value)"
          ></div>
        </div>
      </div>

      <!-- 加粗 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleStrong" title="加粗 (Ctrl+B)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.83-4.04-4.1-4.04H6v16h8.43c2.39 0 4.31-1.94 4.31-4.33 0-2.04-1.35-3.76-3.14-4.84zM8.5 6h4.1c1.16 0 2.1.95 2.1 2.1s-.95 2.1-2.1 2.1H8.5V6zm5.17 12H8.5v-5h5.17c1.39 0 2.52 1.13 2.52 2.52S14.56 18 13.67 18z"/>
        </svg>
      </button>
      <!-- 斜体 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleEmphasis" title="斜体 (Ctrl+I)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
        </svg>
      </button>
      <!-- 代码 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleInlineCode" title="代码">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      </button>
      <!-- 链接 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleLink" title="链接">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 标题 -->
      <button class="toolbar-btn" @mousedown.prevent @click="turnIntoHeading(1)" title="标题1">H1</button>
      <button class="toolbar-btn" @mousedown.prevent @click="turnIntoHeading(2)" title="标题2">H2</button>
      <button class="toolbar-btn" @mousedown.prevent @click="turnIntoHeading(3)" title="标题3">H3</button>

      <div class="toolbar-divider"></div>

      <!-- 无序列表 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleBulletList" title="无序列表">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
        </svg>
      </button>
      <!-- 有序列表 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleOrderedList" title="有序列表">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
        </svg>
      </button>
      <!-- 复选框列表 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleTaskList" title="复选框">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-9.5-4.5l-2-2L6 14l3.5 3.5L17 10l-1.41-1.41-4.09 4.09z"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 引用 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleBlockquote" title="引用">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 代码块 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleCodeBlock" title="代码块">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <!-- 显示/隐藏源码 -->
      <button class="toolbar-btn" @mousedown.prevent @click="toggleSourceView" :title="showSource ? '显示渲染' : '显示源码'">
        <svg v-if="showSource" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      </button>
    </div>

    <!-- 双 buffer 容器 -->
    <div class="content-container">
      <!-- 源码视图（使用 v-show 保持 DOM 存在） -->
      <div v-show="showSource" ref="sourceContainer" class="source-container">
        <textarea
          ref="sourceTextarea"
          class="source-textarea"
          :value="currentMarkdown"
          @input="handleSourceInput"
          @keydown="handleKeydown"
          @select="handleTextareaSelect"
        ></textarea>
      </div>

      <!-- 渲染视图（使用 v-show 保持 DOM 存在） -->
      <div
        v-show="!showSource"
        ref="renderContainer"
        class="render-container markdown"
        v-html="renderedHtml"
        @mouseup="handleRenderMouseUp"
        @click="handleRenderClick"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { renderMarkdown, renderMermaidCharts } from '@/utils/markdownRenderer'
import '@/assets/styles/markdown.css'

// 预设文字颜色
const TEXT_COLORS = [
  { name: '红色', value: '#ff4d4f' },
  { name: '橙色', value: '#fa8c16' },
  { name: '黄色', value: '#fadb14' },
  { name: '绿色', value: '#52c41a' },
  { name: '蓝色', value: '#1890ff' },
  { name: '紫色', value: '#722ed1' },
  { name: '粉色', value: '#eb2f96' },
  { name: '灰色', value: '#8c8c8c' },
  { name: '白色', value: '#ffffff' },
  { name: '黑色', value: '#000000' },
]

// 预设高亮颜色
const HIGHLIGHT_COLORS = [
  { name: '黄色', value: '#ffff00' },
  { name: '绿色', value: '#00ff00' },
  { name: '蓝色', value: '#00bfff' },
  { name: '粉色', value: '#ff69b4' },
  { name: '橙色', value: '#ffa500' },
  { name: '红色', value: '#ff6b6b' },
  { name: '紫色', value: '#dda0dd' },
  { name: '青色', value: '#00ffff' },
]

const props = defineProps<{
  initialValue?: string
}>()

const emit = defineEmits<{
  change: [value: string]
}>()

const sourceTextarea = ref<HTMLTextAreaElement | null>(null)
const renderContainer = ref<HTMLDivElement | null>(null)
const sourceContainer = ref<HTMLDivElement | null>(null) // 源码容器（滚动容器）
const currentMarkdown = ref(props.initialValue || '')
const renderedHtml = ref('')
const showSource = ref(true) // 默认源码模式（可编辑）

// 历史记录（撤销/前进）
const historyStack: string[] = []
let historyIndex = -1
const MAX_HISTORY_SIZE = 100
let isUndoRedo = false // 标记是否正在执行撤销/前进操作

const canUndo = ref(false)
const canRedo = ref(false)

// 保存当前状态到历史记录
function saveToHistory() {
  if (isUndoRedo) return // 撤销/前进操作不保存历史

  // 如果当前不在栈顶，清除后面的历史
  if (historyIndex < historyStack.length - 1) {
    historyStack.splice(historyIndex + 1)
  }

  // 保存当前状态
  historyStack.push(currentMarkdown.value)

  // 限制历史记录大小
  if (historyStack.length > MAX_HISTORY_SIZE) {
    historyStack.shift()
    historyIndex--
  }

  historyIndex = historyStack.length - 1
  updateHistoryButtons()
}

// 更新撤销/前进按钮状态
function updateHistoryButtons() {
  canUndo.value = historyIndex > 0
  canRedo.value = historyIndex < historyStack.length - 1
}

// 撤销
function undo() {
  if (historyIndex <= 0) return

  saveScrollPosition()
  historyIndex--
  isUndoRedo = true
  currentMarkdown.value = historyStack[historyIndex]
  emit('change', currentMarkdown.value)
  isUndoRedo = false
  updateHistoryButtons()

  nextTick(() => {
    adjustTextareaHeight()
    restoreScrollPosition()
    if (!showSource.value) renderContent()
  })
}

// 前进
function redo() {
  if (historyIndex >= historyStack.length - 1) return

  saveScrollPosition()
  historyIndex++
  isUndoRedo = true
  currentMarkdown.value = historyStack[historyIndex]
  emit('change', currentMarkdown.value)
  isUndoRedo = false
  updateHistoryButtons()

  nextTick(() => {
    adjustTextareaHeight()
    restoreScrollPosition()
    if (!showSource.value) renderContent()
  })
}

// 颜色选择器状态
const showColorPicker = ref(false)
const selectedColor = ref('#1890ff') // 默认蓝色

// 高亮选择器状态
const showHighlightPicker = ref(false)
const selectedHighlightColor = ref('#ffff00') // 默认黄色

// 内部选区状态（用于渲染模式下的编辑）
const internalSelection = ref<{ start: number; end: number } | null>(null)

// 保存滚动位置（用于格式操作后恢复）
let savedScrollTop = 0

function saveScrollPosition() {
  if (sourceContainer.value) {
    savedScrollTop = sourceContainer.value.scrollTop
  }
}

function restoreScrollPosition() {
  if (sourceContainer.value) {
    sourceContainer.value.scrollTop = savedScrollTop
  }
}

// 格式操作完成后的通用处理
function afterFormatAction(newStart?: number, newEnd?: number) {
  nextTick(() => {
    if (sourceTextarea.value && newStart !== undefined && newEnd !== undefined) {
      sourceTextarea.value.setSelectionRange(newStart, newEnd)
      if (showSource.value) sourceTextarea.value.focus()
    }
    adjustTextareaHeight()
    restoreScrollPosition()
    if (!showSource.value) renderContent()
    // 保存历史（格式操作后立即保存）
    saveToHistory()
  })
}

// 颜色按钮点击处理
function handleColorBtnMouseDown() {
  showColorPicker.value = !showColorPicker.value
  showHighlightPicker.value = false // 关闭另一个选择器
}

// 高亮按钮点击处理
function handleHighlightBtnMouseDown() {
  showHighlightPicker.value = !showHighlightPicker.value
  showColorPicker.value = false // 关闭另一个选择器
}

// 清理选区边缘可能包含的标签字符
function cleanSelectionFromTags(start: number, end: number, md: string): { start: number; end: number } {
  let newStart = start
  let newEnd = end

  // 检查选区开始位置是否在开始标签 <span style="color: ..."> 内
  // 向前查找最近的 < 字符
  for (let i = start - 1; i >= Math.max(0, start - 100); i--) {
    const char = md[i]
    if (char === '<') {
      // 检查是否是开始标签
      const tagMatch = md.substring(i).match(/^<span style="color:\s*[^"]+">/)
      if (tagMatch) {
        // 找到标签结束位置
        const tagEndPos = i + tagMatch[0].length
        if (start < tagEndPos) {
          // 选区开始位置在标签内，需要调整到标签之后
          newStart = tagEndPos
        }
      }
      break
    }
    if (char === '>') {
      // 找到上一个标签的结束，停止查找
      break
    }
  }

  // 检查选区开始位置是否刚好是 < 字符（开始标签的开始）
  if (md[newStart] === '<') {
    const tagMatch = md.substring(newStart).match(/^<span style="color:\s*[^"]+">/)
    if (tagMatch) {
      newStart = newStart + tagMatch[0].length
    }
  }

  // 检查选区结束位置是否包含结束标签 </span>
  // 检查选区结束位置之前的字符
  for (let i = end - 1; i >= Math.max(newStart, end - 20); i--) {
    if (md.substring(i, i + 7) === '</span>') {
      // 选区包含了结束标签的开始，需要调整到标签之前
      newEnd = i
      break
    }
    if (md[i] === '>') {
      // 找到上一个标签的结束，停止查找
      break
    }
    if (md[i] === '<' && i < end) {
      // 找到标签开始
      break
    }
  }

  // 确保选区有效
  if (newStart >= newEnd) {
    return { start, end }
  }

  return { start: newStart, end: newEnd }
}

// 查找选区所在的颜色标签范围
function findColorTagRange(start: number, end: number, md: string): { tagStart: number; tagEnd: number; color: string } | null {
  // 向前查找开始标签 <span style="color: ...">
  let tagStart = -1
  let existingColor = ''
  let searchPos = start

  // 从选区开始位置向前查找未闭合的 span 开始标签
  let unclosedSpans: Array<{ pos: number; color: string }> = []

  for (let i = start - 1; i >= 0; i--) {
    // 查找 </span> 结束标签
    if (md.substring(i, i + 7) === '</span>') {
      // 找到一个闭合的 span，需要跳过对应的开始标签
      let depth = 1
      for (let j = i - 1; j >= 0 && depth > 0; j--) {
        if (md.substring(j, j + 7) === '</span>') {
          depth++
        } else if (md.substring(j, j + 5) === '<span') {
          // 找到开始标签，解析颜色
          const spanMatch = md.substring(j).match(/^<span style="color:\s*([^"]+)">/)
          if (spanMatch) {
            depth--
            if (depth === 0) {
              // 找到匹配的开始标签，继续向前查找
              break
            }
          }
        }
      }
      continue
    }

    // 查找开始标签 <span style="color: ...">
    const spanMatch = md.substring(i).match(/^<span style="color:\s*([^"]+)">/)
    if (spanMatch) {
      unclosedSpans.push({ pos: i, color: spanMatch[1].trim() })
    }
  }

  // 检查选区结束位置之后的闭合标签
  let closedCount = 0
  for (let i = end; i < md.length; i++) {
    if (md.substring(i, i + 7) === '</span>') {
      closedCount++
    } else if (md.substring(i, i + 5) === '<span') {
      // 遇到新的开始标签，停止
      break
    }
  }

  // 找到包含选区的最内层 span（闭合标签数量匹配）
  for (let i = unclosedSpans.length - 1; i >= 0; i--) {
    if (closedCount > 0) {
      closedCount--
    } else {
      // 这个 span 包含选区
      const span = unclosedSpans[i]
      tagStart = span.pos
      existingColor = span.color
      break
    }
  }

  if (tagStart === -1) {
    return null
  }

  // 从选区结束位置向后查找对应的闭合标签
  let depth = 1
  let tagEnd = -1
  for (let i = end; i < md.length; i++) {
    if (md.substring(i, i + 7) === '</span>') {
      depth--
      if (depth === 0) {
        tagEnd = i + 7
        break
      }
    } else if (md.substring(i, i + 5) === '<span') {
      const spanMatch = md.substring(i).match(/^<span style="color:\s*([^"]+)">/)
      if (spanMatch) {
        depth++
      }
    }
  }

  if (tagEnd === -1) {
    return null
  }

  return { tagStart, tagEnd, color: existingColor }
}

// 应用颜色
function applyColor(color: string) {
  saveScrollPosition()
  selectedColor.value = color
  showColorPicker.value = false

  const selection = getCurrentSelection()
  if (!selection) {
    return
  }

  const md = currentMarkdown.value

  // 清理选区边缘可能包含的标签字符
  const cleaned = cleanSelectionFromTags(selection.start, selection.end, md)
  const start = cleaned.start
  const end = cleaned.end
  const selected = md.substring(start, end)

  if (!selected) {
    return
  }

  // 查找选区所在的颜色标签范围
  const colorTag = findColorTagRange(start, end, md)

  if (colorTag) {
    const { tagStart, tagEnd, color: existingColor } = colorTag

    // 检查选区是否完全匹配标签内容（选区从头到尾选中整个标签内容）
    const startTagLength = md.substring(tagStart).match(/^<span style="color:\s*[^"]+">/)?.[0]?.length || 0
    const tagContentStart = tagStart + startTagLength
    const tagContentEnd = tagEnd - 7 // 减去 </span> 的长度

    if (start === tagContentStart && end === tagContentEnd && existingColor === color) {
      // 选区完全匹配标签内容且颜色相同，移除整个标签
      const pureText = md.substring(tagContentStart, tagContentEnd)
      currentMarkdown.value =
        md.substring(0, tagStart) +
        pureText +
        md.substring(tagEnd)

      emit('change', currentMarkdown.value)
      internalSelection.value = { start: tagStart, end: tagStart + pureText.length }

      afterFormatAction(tagStart, tagStart + pureText.length)
      return
    }

    // 选区在标签内但不是完全匹配，嵌套新颜色
    // 在选区前后添加新的 span 标签（嵌套在原有标签内）
    const colorHtml = `<span style="color: ${color}">${selected}</span>`
    currentMarkdown.value =
      md.substring(0, start) +
      colorHtml +
      md.substring(end)

    emit('change', currentMarkdown.value)
    internalSelection.value = { start: start, end: start + colorHtml.length }

    afterFormatAction(start, start + colorHtml.length)
    return
  }

  // 选区不在任何颜色标签内，直接应用新颜色
  const colorHtml = `<span style="color: ${color}">${selected}</span>`
  currentMarkdown.value =
    md.substring(0, start) +
    colorHtml +
    md.substring(end)

  emit('change', currentMarkdown.value)
  internalSelection.value = { start: start, end: start + colorHtml.length }

  afterFormatAction(start, start + colorHtml.length)
}

// 应用高亮
function applyHighlight(color: string) {
  saveScrollPosition()
  selectedHighlightColor.value = color
  showHighlightPicker.value = false

  const selection = getCurrentSelection()
  if (!selection) {
    return
  }

  const md = currentMarkdown.value
  const start = selection.start
  const end = selection.end
  const selected = md.substring(start, end)

  if (!selected) {
    return
  }

  // 使用 mark 标签应用高亮
  const highlightHtml = `<mark style="background-color: ${color}">${selected}</mark>`
  currentMarkdown.value =
    md.substring(0, start) +
    highlightHtml +
    md.substring(end)

  emit('change', currentMarkdown.value)
  internalSelection.value = { start: start, end: start + highlightHtml.length }

  afterFormatAction(start, start + highlightHtml.length)
}

// 点击外部关闭颜色选择器
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.color-btn-wrapper')) {
    showColorPicker.value = false
    showHighlightPicker.value = false
  }
}

// 渲染 markdown 内容
async function renderContent() {
  if (!currentMarkdown.value) {
    renderedHtml.value = ''
    return
  }

  renderedHtml.value = await renderMarkdown(currentMarkdown.value)

  // 渲染 mermaid 图表
  if (renderContainer.value) {
    await nextTick()
    await renderMermaidCharts(renderContainer.value)
  }
}

// 切换视图
function toggleSourceView() {
  showSource.value = !showSource.value
  if (!showSource.value) {
    renderContent()
  } else {
    // 切换到源码模式时，恢复选区并调整高度
    nextTick(() => {
      adjustTextareaHeight()
      if (internalSelection.value && sourceTextarea.value) {
        const startPos = internalSelection.value.start
        const endPos = internalSelection.value.end
        sourceTextarea.value.setSelectionRange(startPos, endPos)
        sourceTextarea.value.focus()

        // 滚动到选区位置
        scrollToSelection(startPos)
      }
    })
  }
}

// 滚动到选区位置
function scrollToSelection(position: number) {
  if (!sourceTextarea.value || !sourceContainer.value) return

  const text = currentMarkdown.value
  // 计算选区位置之前的换行符数量（估算行数）
  const textBeforePosition = text.substring(0, position)
  const lineCount = textBeforePosition.split('\n').length

  // 获取行高（从 textarea 样式）
  const lineHeight = parseFloat(getComputedStyle(sourceTextarea.value).lineHeight) || 24

  // 计算目标滚动位置（使选区行位于视口中间偏上）
  const targetScrollTop = Math.max(0, (lineCount - 3) * lineHeight)

  sourceContainer.value.scrollTop = targetScrollTop
}

// 源码输入处理
let inputDebounceTimer: ReturnType<typeof setTimeout> | null = null

function handleSourceInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  currentMarkdown.value = target.value
  emit('change', target.value)
  adjustTextareaHeight()
  // 清除内部选区（因为内容已改变）
  internalSelection.value = null

  // 防抖保存历史（输入停止后保存）
  if (inputDebounceTimer) {
    clearTimeout(inputDebounceTimer)
  }
  inputDebounceTimer = setTimeout(() => {
    saveToHistory()
  }, 500)
}

// textarea 选区变化处理
function handleTextareaSelect() {
  if (!sourceTextarea.value) return
  const start = sourceTextarea.value.selectionStart
  const end = sourceTextarea.value.selectionEnd
  internalSelection.value = { start, end }
}

// 键盘快捷键处理
function handleKeydown(e: KeyboardEvent) {
  // Ctrl+Z: 撤销
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
    return
  }
  // Ctrl+Y 或 Ctrl+Shift+Z: 前进
  if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
    e.preventDefault()
    redo()
    return
  }
  // Ctrl+B: 加粗
  if (e.ctrlKey && e.key === 'b') {
    e.preventDefault()
    toggleStrong()
  }
  // Ctrl+I: 斜体
  if (e.ctrlKey && e.key === 'i') {
    e.preventDefault()
    toggleEmphasis()
  }
}

// 渲染视图点击处理
function handleRenderClick(e: MouseEvent) {
  // 清除选区状态
  internalSelection.value = null
}

// 渲染视图 mouseup 处理 - 同步选区到 markdown 源码
function handleRenderMouseUp(e: MouseEvent) {
  if (showSource.value) return

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    internalSelection.value = null
    return
  }

  const selectedText = selection.toString()
  if (!selectedText.trim()) {
    internalSelection.value = null
    return
  }

  // 获取选区在渲染视图中的匹配索引
  const matchIndex = getMatchIndexInRenderedView(selection)

  // 在 markdown 源码中查找选中的文本位置
  const positions = findTextInMarkdown(selectedText)
  if (positions.length > matchIndex) {
    // 取对应索引的匹配位置
    internalSelection.value = { start: positions[matchIndex].start, end: positions[matchIndex].end }

    // 同步设置隐藏 textarea 的选区
    if (sourceTextarea.value) {
      sourceTextarea.value.setSelectionRange(positions[matchIndex].start, positions[matchIndex].end)
    }
  } else if (positions.length > 0) {
    // 如果找不到精确匹配，取第一个
    internalSelection.value = { start: positions[0].start, end: positions[0].end }
  }
}

// 获取选区在渲染视图中的匹配索引（计算选区前方文本中该字符串出现的次数）
function getMatchIndexInRenderedView(selection: Selection): number {
  if (!renderContainer.value || !selection.rangeCount) return 0

  const range = selection.getRangeAt(0)
  const selectedText = selection.toString()

  // 从选区开始位置向前遍历 DOM，收集文本
  const textBeforeSelection = getTextBeforeRange(range, renderContainer.value)

  // 计算前面的文本中，目标字符串出现了多少次
  let count = 0
  let searchPos = 0
  while (true) {
    const pos = textBeforeSelection.indexOf(selectedText, searchPos)
    if (pos === -1) break
    count++
    searchPos = pos + 1
  }

  return count
}

// 获取 range 开始位置之前的所有文本
function getTextBeforeRange(range: Range, container: HTMLElement): string {
  // 创建一个从容器开始到 range 开始位置的 range
  const preRange = document.createRange()
  preRange.setStart(container, 0)
  preRange.setEnd(range.startContainer, range.startOffset)

  // 获取这个范围内的文本内容
  return preRange.toString()
}

// 在 markdown 源码中查找文本位置
function findTextInMarkdown(text: string): Array<{ start: number; end: number }> {
  const results: Array<{ start: number; end: number }> = []
  const md = currentMarkdown.value

  // 直接搜索
  let index = 0
  while (index < md.length) {
    const pos = md.indexOf(text, index)
    if (pos === -1) break
    results.push({ start: pos, end: pos + text.length })
    index = pos + 1
  }

  return results
}

// 获取当前选区（用于格式操作）
function getCurrentSelection(): { start: number; end: number } | null {
  if (showSource.value && sourceTextarea.value) {
    return {
      start: sourceTextarea.value.selectionStart,
      end: sourceTextarea.value.selectionEnd
    }
  }
  return internalSelection.value
}

// 调整 textarea 高度以适应内容
function adjustTextareaHeight() {
  if (!sourceTextarea.value) return
  const textarea = sourceTextarea.value
  textarea.style.height = 'auto'
  textarea.style.height = textarea.scrollHeight + 'px'
}

// 插入格式标记的通用函数
function insertFormat(before: string, after: string = '', placeholder: string = '') {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) {
    // 没有选区，在末尾插入
    const md = currentMarkdown.value
    const insertText = before + placeholder + after
    currentMarkdown.value = md + insertText
    internalSelection.value = { start: md.length + before.length, end: md.length + before.length + placeholder.length }
    emit('change', currentMarkdown.value)
    afterFormatAction(md.length + before.length, md.length + before.length + placeholder.length)
    return
  }

  const start = selection.start
  const end = selection.end
  const selected = currentMarkdown.value.substring(start, end)

  let insertText = placeholder
  if (selected) {
    insertText = before + selected + after
  } else {
    insertText = before + placeholder + after
  }

  currentMarkdown.value =
    currentMarkdown.value.substring(0, start) +
    insertText +
    currentMarkdown.value.substring(end)

  // 更新选区位置
  const newStart = start + before.length
  const newEnd = selected ? newStart + selected.length : newStart + placeholder.length
  internalSelection.value = { start: newStart, end: newEnd }

  emit('change', currentMarkdown.value)
  afterFormatAction(newStart, newEnd)
}

// 加粗
function toggleStrong() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) {
    insertFormat('**', '**', '粗体文字')
    return
  }

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value

  // 检查选区边界外是否已有加粗标记
  const hasBoldBefore = start >= 2 && md.substring(start - 2, start) === '**'
  const hasBoldAfter = end + 2 <= md.length && md.substring(end, end + 2) === '**'

  if (hasBoldBefore && hasBoldAfter) {
    // 移除加粗标记
    currentMarkdown.value =
      md.substring(0, start - 2) +
      md.substring(start, end) +
      md.substring(end + 2)
    const newStart = start - 2
    const newEnd = end - 2
    internalSelection.value = { start: newStart, end: newEnd }
    emit('change', currentMarkdown.value)
    afterFormatAction(newStart, newEnd)
  } else {
    // 添加加粗
    insertFormat('**', '**', '粗体文字')
  }
}

// 斜体
function toggleEmphasis() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) {
    insertFormat('*', '*', '斜体文字')
    return
  }

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value

  // 检查选区边界外是否已有斜体标记（注意避免与加粗混淆）
  // 斜体标记是单个 *，但要确保不是 ** 的一部分
  const beforeChar = start >= 1 ? md[start - 1] : ''
  const beforeBeforeChar = start >= 2 ? md[start - 2] : ''
  const hasItalicBefore = beforeChar === '*' && beforeBeforeChar !== '*'

  const afterChar = end < md.length ? md[end] : ''
  const afterAfterChar = end + 1 < md.length ? md[end + 1] : ''
  const hasItalicAfter = afterChar === '*' && afterAfterChar !== '*'

  if (hasItalicBefore && hasItalicAfter) {
    // 移除斜体标记
    currentMarkdown.value =
      md.substring(0, start - 1) +
      md.substring(start, end) +
      md.substring(end + 1)
    const newStart = start - 1
    const newEnd = end - 1
    internalSelection.value = { start: newStart, end: newEnd }
    emit('change', currentMarkdown.value)
    afterFormatAction(newStart, newEnd)
  } else {
    // 添加斜体
    insertFormat('*', '*', '斜体文字')
  }
}

// 行内代码
function toggleInlineCode() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) {
    insertFormat('`', '`', '代码')
    return
  }

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value

  // 检查选区边界外是否已有代码标记
  const hasCodeBefore = start >= 1 && md[start - 1] === '`'
  const hasCodeAfter = end < md.length && md[end] === '`'

  if (hasCodeBefore && hasCodeAfter) {
    // 移除代码标记
    currentMarkdown.value =
      md.substring(0, start - 1) +
      md.substring(start, end) +
      md.substring(end + 1)
    const newStart = start - 1
    const newEnd = end - 1
    internalSelection.value = { start: newStart, end: newEnd }
    emit('change', currentMarkdown.value)
    afterFormatAction(newStart, newEnd)
  } else {
    // 添加代码标记
    insertFormat('`', '`', '代码')
  }
}

// 链接
function toggleLink() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) {
    insertFormat('[', '](https://example.com)', '链接文字')
    return
  }

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value
  const selected = md.substring(start, end)

  // 检查选区是否是链接的一部分
  // 向前查找 [
  let bracketStart = -1
  for (let i = start - 1; i >= 0 && i >= start - 100; i--) {
    if (md[i] === '[') {
      bracketStart = i
      break
    }
    if (md[i] === '\n') break
  }

  // 向后查找 ]( 和 )
  let urlEnd = -1
  let bracketEnd = -1
  if (bracketStart !== -1) {
    // 找 ](
    for (let i = end; i < md.length && i < end + 100; i++) {
      if (md[i] === ']' && md[i + 1] === '(') {
        bracketEnd = i
        // 找对应的 )
        let parenStart = i + 1
        for (let j = parenStart + 1; j < md.length && j < parenStart + 500; j++) {
          if (md[j] === ')') {
            urlEnd = j
            break
          }
          if (md[j] === '\n') break
        }
        break
      }
      if (md[i] === '\n') break
    }
  }

  // 如果找到了完整的链接结构，移除链接格式
  if (bracketStart !== -1 && bracketEnd !== -1 && urlEnd !== -1) {
    // 提取链接文字
    const linkText = md.substring(bracketStart + 1, bracketEnd)
    currentMarkdown.value =
      md.substring(0, bracketStart) +
      linkText +
      md.substring(urlEnd + 1)
    const newStart = bracketStart
    const newEnd = bracketStart + linkText.length
    internalSelection.value = { start: newStart, end: newEnd }
    emit('change', currentMarkdown.value)
    afterFormatAction(newStart, newEnd)
  } else {
    // 添加链接格式
    const linkMarkdown = selected
      ? `[${selected}](https://example.com)`
      : `[链接文字](https://example.com)`

    currentMarkdown.value =
      md.substring(0, start) +
      linkMarkdown +
      md.substring(end)

    // 更新选区 -选中链接文字部分
    const newStart = start + 1
    const newEnd = selected ? start + 1 + selected.length : start + 5
    internalSelection.value = { start: newStart, end: newEnd }

    emit('change', currentMarkdown.value)
    afterFormatAction(newStart, newEnd)
  }
}

// 标题
function turnIntoHeading(level: number) {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) return

  const start = selection.start
  const end = selection.end

  // 找到当前行的开头
  let lineStart = start
  while (lineStart > 0 && currentMarkdown.value[lineStart - 1] !== '\n') {
    lineStart--
  }

  const md = currentMarkdown.value
  const prefix = '#'.repeat(level) + ' '

  let offset = 0

  // 检查当前行是否已经是标题
  const existingHeadingMatch = md.substring(lineStart).match(/^(#{1,6})\s*/)
  if (existingHeadingMatch) {
    const existingLevel = existingHeadingMatch[1].length
    const existingPrefix = existingHeadingMatch[0]
    if (existingLevel === level) {
      // 已是同级别标题，移除标题标记
      currentMarkdown.value =
        md.substring(0, lineStart) +
        md.substring(lineStart + existingPrefix.length)
      offset = -existingPrefix.length
    } else {
      // 不同级别，替换为新级别
      currentMarkdown.value =
        md.substring(0, lineStart) +
        prefix +
        md.substring(lineStart + existingPrefix.length)
      offset = prefix.length - existingPrefix.length
    }
  } else {
    // 添加新标题
    currentMarkdown.value =
      md.substring(0, lineStart) +
      prefix +
      md.substring(lineStart)
    offset = prefix.length
  }

  emit('change', currentMarkdown.value)

  const newStart = start + offset
  const newEnd = end + offset
  internalSelection.value = { start: newStart, end: newEnd }

  afterFormatAction(newStart, newEnd)
}

// 无序列表
function toggleBulletList() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) return

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value

  // 找到当前行的开头
  let lineStart = start
  while (lineStart > 0 && md[lineStart - 1] !== '\n') {
    lineStart--
  }

  let offset = 0 // 选区偏移量

  // 检查当前行是否已经是列表项
  if (md.substring(lineStart, lineStart + 2) === '- ') {
    // 移除列表标记
    currentMarkdown.value =
      md.substring(0, lineStart) +
      md.substring(lineStart + 2)
    offset = -2
  } else {
    // 添加列表标记
    currentMarkdown.value =
      md.substring(0, lineStart) +
      '- ' +
      md.substring(lineStart)
    offset = 2
  }

  emit('change', currentMarkdown.value)

  // 计算新选区位置
  const newStart = start + offset
  const newEnd = end + offset
  internalSelection.value = { start: newStart, end: newEnd }

  afterFormatAction(newStart, newEnd)
}

// 有序列表
function toggleOrderedList() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) return

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value

  // 找到当前行的开头
  let lineStart = start
  while (lineStart > 0 && md[lineStart - 1] !== '\n') {
    lineStart--
  }

  let offset = 0 // 选区偏移量

  // 检查当前行是否已经是有序列表
  const linePrefix = md.substring(lineStart, lineStart + 3)
  const orderedMatch = linePrefix.match(/^\d+\.\s/)
  if (orderedMatch) {
    // 移除列表标记
    currentMarkdown.value =
      md.substring(0, lineStart) +
      md.substring(lineStart + orderedMatch[0].length)
    offset = -orderedMatch[0].length
  } else if (linePrefix === '- ') {
    // 如果是无序列表，转为有序列表
    currentMarkdown.value =
      md.substring(0, lineStart) +
      '1. ' +
      md.substring(lineStart + 2)
    offset = 1 // '- ' (2) -> '1. ' (3), 差值 +1
  } else {
    // 添加有序列表标记
    currentMarkdown.value =
      md.substring(0, lineStart) +
      '1. ' +
      md.substring(lineStart)
    offset = 3
  }

  emit('change', currentMarkdown.value)

  // 计算新选区位置
  const newStart = start + offset
  const newEnd = end + offset
  internalSelection.value = { start: newStart, end: newEnd }

  afterFormatAction(newStart, newEnd)
}

// 任务列表
function toggleTaskList() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) return

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value

  // 找到当前行的开头
  let lineStart = start
  while (lineStart > 0 && md[lineStart - 1] !== '\n') {
    lineStart--
  }

  let offset = 0 // 选区偏移量

  const linePrefix = md.substring(lineStart, lineStart + 6)

  if (linePrefix === '- [x] ') {
    // 已完成 -> 移除
    currentMarkdown.value =
      md.substring(0, lineStart) +
      md.substring(lineStart + 6)
    offset = -6
  } else if (linePrefix === '- [ ] ') {
    // 未完成 -> 已完成（长度不变）
    currentMarkdown.value =
      md.substring(0, lineStart) +
      '- [x] ' +
      md.substring(lineStart + 6)
    offset = 0
  } else if (md.substring(lineStart, lineStart + 2) === '- ') {
    // 普通列表 -> 任务列表（未完成）
    // '- ' (2) -> '- [ ] ' (6), 差值 +4
    currentMarkdown.value =
      md.substring(0, lineStart) +
      '- [ ] ' +
      md.substring(lineStart + 2)
    offset = 4
  } else {
    // 添加任务列表
    currentMarkdown.value =
      md.substring(0, lineStart) +
      '- [ ] ' +
      md.substring(lineStart)
    offset = 6
  }

  emit('change', currentMarkdown.value)

  // 计算新选区位置
  const newStart = start + offset
  const newEnd = end + offset
  internalSelection.value = { start: newStart, end: newEnd }

  afterFormatAction(newStart, newEnd)
}

// 引用
function toggleBlockquote() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection) return

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value

  // 找到当前行的开头
  let lineStart = start
  while (lineStart > 0 && md[lineStart - 1] !== '\n') {
    lineStart--
  }

  let offset = 0

  if (md.substring(lineStart, lineStart + 2) === '> ') {
    // 移除引用标记
    currentMarkdown.value =
      md.substring(0, lineStart) +
      md.substring(lineStart + 2)
    offset = -2
  } else {
    // 添加引用标记
    currentMarkdown.value =
      md.substring(0, lineStart) +
      '> ' +
      md.substring(lineStart)
    offset = 2
  }

  emit('change', currentMarkdown.value)

  const newStart = start + offset
  const newEnd = end + offset
  internalSelection.value = { start: newStart, end: newEnd }

  afterFormatAction(newStart, newEnd)
}

// 代码块
function toggleCodeBlock() {
  saveScrollPosition()
  const selection = getCurrentSelection()
  if (!selection || selection.start === selection.end) {
    // 没有选区或选区为空，不执行操作
    return
  }

  const start = selection.start
  const end = selection.end
  const md = currentMarkdown.value
  const selected = md.substring(start, end)

  if (!selected.trim()) {
    // 选区内容为空，不执行操作
    return
  }

  // 遍历整个文本，找到所有代码块的位置
  const codeBlocks: Array<{ start: number; end: number; contentStart: number; contentEnd: number }> = []
  let i = 0
  while (i < md.length) {
    // 查找代码块开始标记 ```
    if (md[i] === '`' && md[i + 1] === '`' && md[i + 2] === '`') {
      const blockStart = i
      // 跳过语言标识符，找到内容开始的换行
      let contentStart = i + 3
      while (contentStart < md.length && md[contentStart] !== '\n') {
        contentStart++
      }
      contentStart++ // 跳过换行，指向内容第一字符

      // 查找代码块结束标记 ```
      let contentEnd = contentStart
      while (contentEnd < md.length) {
        if (md[contentEnd] === '\n' && md[contentEnd + 1] === '`' && md[contentEnd + 2] === '`' && md[contentEnd + 3] === '`') {
          // 找到结束标记
          const blockEnd = contentEnd + 4 // \n``` 后的位置
          codeBlocks.push({
            start: blockStart,
            end: blockEnd,
            contentStart,
            contentEnd
          })
          i = blockEnd
          break
        }
        contentEnd++
      }
      if (contentEnd >= md.length) {
        // 没找到结束标记，跳过
        i = contentStart
      }
    } else {
      i++
    }
  }

  // 检查选区是否在某个代码块的内容区域内
  for (const block of codeBlocks) {
    if (start >= block.contentStart && end <= block.contentEnd) {
      // 选区在代码块内，移除代码块格式
      const content = md.substring(block.contentStart, block.contentEnd)
      currentMarkdown.value =
        md.substring(0, block.start) +
        content +
        md.substring(block.end)

      // 更新选区
      const newStart = block.start
      const newEnd = block.start + content.length
      internalSelection.value = { start: newStart, end: newEnd }
      emit('change', currentMarkdown.value)

      afterFormatAction(newStart, newEnd)
      return
    }
  }

  // 选区不在任何代码块内，添加代码块格式
  const codeBlock = `\n\`\`\`\n${selected}\n\`\`\`\n`

  currentMarkdown.value =
    md.substring(0, start) +
    codeBlock +
    md.substring(end)

  emit('change', currentMarkdown.value)
  internalSelection.value = null

  afterFormatAction()
}

// 获取当前 markdown 内容
function getMarkdown(): string {
  return currentMarkdown.value
}

// 设置 markdown 内容
function setMarkdown(markdown: string) {
  currentMarkdown.value = markdown
  internalSelection.value = null
  if (showSource.value) {
    nextTick(() => adjustTextareaHeight())
  } else {
    renderContent()
  }
}

// 监听初始值变化
watch(() => props.initialValue, (newVal) => {
  if (newVal && newVal !== currentMarkdown.value) {
    currentMarkdown.value = newVal
    internalSelection.value = null
    if (!showSource.value) {
      renderContent()
    }
  }
})

// 初始化
onMounted(() => {
  if (props.initialValue) {
    currentMarkdown.value = props.initialValue
  }
  // 保存初始状态到历史记录
  saveToHistory()
  adjustTextareaHeight()
  // 监听点击外部关闭颜色选择器
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  // 清理防抖定时器
  if (inputDebounceTimer) {
    clearTimeout(inputDebounceTimer)
  }
})

// 暴露方法
defineExpose({
  getMarkdown,
  setMarkdown
})
</script>

<style scoped>
.editor-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  background: transparent;
}

/* 自定义工具栏样式 */
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color);
  background: transparent;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 4px 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 12px;
  font-weight: 600;
}

.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-btn:active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.toolbar-btn.disabled,
.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn.disabled:hover,
.toolbar-btn:disabled:hover {
  background: transparent;
  color: var(--text-secondary);
}

/* 颜色按钮样式 */
.color-btn-wrapper {
  position: relative;
}

.color-btn {
  position: relative;
  flex-direction: column;
  padding: 2px 6px;
}

.color-letter {
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}

.color-indicator {
  width: 14px;
  height: 3px;
  border-radius: 1px;
  margin-top: 2px;
}

.color-picker-popup {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  padding: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  z-index: 100;
}

.color-option-popup {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s ease;
}

.color-option-popup:hover {
  transform: scale(1.1);
  border-color: var(--text-primary);
}

/* 高亮按钮样式 */
.highlight-btn {
  position: relative;
  flex-direction: column;
  padding: 2px 6px;
}

.highlight-btn svg {
  line-height: 1;
}

.highlight-indicator {
  width: 14px;
  height: 3px;
  border-radius: 1px;
  margin-top: 2px;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  margin: 0 4px;
}

/* 双 buffer 内容容器 */
.content-container {
  flex: 1;
  min-height: 150px;
  overflow: hidden;
  position: relative;
}

/* 源码视图容器 */
.source-container {
  position: absolute;
  inset: 0;
  overflow: auto;
  background: transparent;
}

/* 源码视图 */
.source-textarea {
  display: block;
  width: 100%;
  height: auto;
  min-height: 100%;
  padding: 12px;
  border: none;
  outline: none;
  resize: none;
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1.6;
  background: transparent !important;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 渲染视图容器 */
.render-container {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 12px;
  background: transparent;
  user-select: text;
}
</style>