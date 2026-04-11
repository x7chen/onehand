<template>
  <Teleport to="body">
    <Transition name="magic-input-fade">
      <div v-if="isOpen" class="magic-input-overlay" @click="handleOverlayClick">
        <div class="magic-input-container" :class="{ shake: isShaking }" @click.stop>
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

          <!-- 文本输入框 -->
          <textarea
            ref="textareaRef"
            v-model="inputText"
            class="magic-input-textarea"
            :placeholder="t('common.inputContent')"
            @keydown.enter.exact="handleEnterKey"
            @keydown.shift.enter.exact.stop
            @keydown.escape="handleCancel"
            @dragstart="handleTextareaDragStart"
            @dragend="handleDragEnd"
            @dragover.prevent="handleDragOver"
            @drop.prevent="handleDrop"
            @contextmenu.prevent="handleTextareaContextMenu"
          ></textarea>

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

          <!-- Toast 消息提示 -->
          <Transition name="toast-fade">
            <div v-if="showToast" class="toast-message">
              {{ toastMessage }}
            </div>
          </Transition>

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
            <!-- 纠正按钮 -->
            <button
              v-if="showCorrect && quickModelConfig"
              class="menu-btn correct-btn"
              :class="{ loading: isCorrecting }"
              @click="handleCorrectText"
              :disabled="!inputText.trim() || isCorrecting"
              :title="t('common.correctText')"
            >
              <svg v-if="!isCorrecting" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.71.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.7-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/>
              </svg>
              <svg v-else class="loading-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
              </svg>
            </button>
            <div class="menu-spacer"></div>
            <button class="menu-btn cancel-btn" @click="handleCancel" :title="t('common.cancel')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            <button class="menu-btn send-btn" @click="handleSave" :disabled="!inputText.trim()" :title="t('common.send')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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

const props = defineProps<{
  isOpen: boolean
  initialText?: string
  showCorrect?: boolean
  nodeId?: string
}>()

const emit = defineEmits<{
  save: [text: string]
  cancel: []
}>()

const { t } = useI18n()
const quickCommandStore = useQuickCommandStore()
const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()

// 输入文本
const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 初始文本（用于检测变化）
const initialText = ref('')

// Toast 消息
const showToast = ref(false)
const toastMessage = ref('')
let toastTimer: number | null = null

// 抖动动画
const isShaking = ref(false)

// 拖拽时的光标位置
const dragCaretPosition = ref<number | null>(null)
// 内部拖拽时原始选区
const internalDragSelection = ref<{ start: number; end: number; text: string } | null>(null)

// 右键编辑菜单
const showEditMenu = ref(false)
const editMenuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })
const hasSelection = ref(false)

// 自适应高度
function autoResize() {
  const textarea = textareaRef.value
  if (!textarea) return
  textarea.style.height = 'auto'
  textarea.style.height = Math.min(textarea.scrollHeight, 600) + 'px'
}

// 监听输入文本变化，自动调整高度
watch(inputText, () => {
  nextTick(() => {
    autoResize()
  })
})

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

// 纠正相关
const isCorrecting = ref(false)

// 快速模型配置
const quickModelConfig = computed(() => {
  const quickModelId = settingsStore.settings.llm.quickModelProfileId
  if (!quickModelId) return null
  return settingsStore.settings.llm.profiles.find(p => p.id === quickModelId)
})

// 监听 isOpen 变化
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    inputText.value = props.initialText || ''
    initialText.value = inputText.value  // 记录初始文本
    showQuickCommandSelector.value = false
    showToast.value = false
    nextTick(() => {
      autoResize()
      textareaRef.value?.focus()
      textareaRef.value?.select()
    })
  }
})

// 检查文本是否有变化
function hasTextChanges(): boolean {
  return inputText.value !== initialText.value
}

// 显示 toast 消息
function showToastMessage(message: string) {
  toastMessage.value = message
  showToast.value = true
  if (toastTimer) {
    clearTimeout(toastTimer)
  }
  toastTimer = window.setTimeout(() => {
    showToast.value = false
  }, 2000)
}

// 触发抖动动画
function triggerShake() {
  isShaking.value = true
  setTimeout(() => {
    isShaking.value = false
  }, 500)
}

// 处理点击 overlay（非内容区域）
function handleOverlayClick() {
  if (hasTextChanges()) {
    triggerShake()
    showToastMessage(t('common.unsavedChanges'))
  } else {
    handleCancel()
  }
}

// 加载快捷指令
onMounted(() => {
  quickCommandStore.loadQuickCommands()
})

// 点击外部关闭快捷指令气泡
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.quick-command-popover') && !target.closest('.quick-btn')) {
    showQuickCommandSelector.value = false
  }
  // 关闭编辑菜单
  if (!target.closest('.edit-menu') && !target.closest('.magic-input-textarea')) {
    showEditMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  if (toastTimer) {
    clearTimeout(toastTimer)
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
    e.dataTransfer.setData('application/x-magic-input', 'true')
    e.dataTransfer.effectAllowed = 'move'

    // 记录原始选区位置
    internalDragSelection.value = {
      start: Math.min(start, end),
      end: Math.max(start, end),
      text: selectedText
    }
  }
}

// 处理拖拽结束
function handleDragEnd() {
  // 清理拖拽状态
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
    // 设置光标位置提供视觉反馈
    textarea.selectionStart = textarea.selectionEnd = position
    textarea.focus()
  }
}

// 根据鼠标坐标计算 textarea 中的字符位置
function getCaretPositionFromPoint(x: number, y: number, textarea: HTMLTextAreaElement): number | null {
  // 创建临时镜像元素，定位在与 textarea 完全相同的位置
  const mirror = document.createElement('div')
  const style = window.getComputedStyle(textarea)
  const rect = textarea.getBoundingClientRect()

  // 复制 textarea 的所有关键样式
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

  // 隐藏滚动条
  const styleSheet = document.createElement('style')
  styleSheet.textContent = 'textarea-caret-mirror::-webkit-scrollbar { display: none; }'
  document.head.appendChild(styleSheet)

  // 复制文本内容
  mirror.textContent = textarea.value

  document.body.appendChild(mirror)

  // 同步滚动位置
  mirror.scrollTop = textarea.scrollTop

  try {
    let position: number | null = null

    // 使用 caretRangeFromPoint (Chrome/Safari/Edge)
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y)
      if (range && range.startContainer === mirror) {
        position = range.startOffset
      } else if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        position = findTextOffset(mirror, range.startContainer, range.startOffset)
      }
    }

    // Firefox 使用 caretPositionFromPoint
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

// 在镜像元素中找到文本节点的偏移
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

    // 转写音频
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

// 纠正文本
async function handleCorrectText() {
  if (!quickModelConfig.value || !inputText.value.trim()) return

  isCorrecting.value = true

  const messages = [
    { role: 'user' as const, content: `Correct spelling errors and add missing or incorrect punctuation to the text: ${inputText.value}\n\nProvide only the corrected text without any additional explanation.` }
  ]

  try {
    const result = await chatWithLLM(messages, {
      baseUrl: quickModelConfig.value.baseUrl,
      apiKey: quickModelConfig.value.apiKey,
      model: quickModelConfig.value.model,
      temperature: 0.3
    })

    inputText.value = result.content.trim()
      .replace(/<\/?think>/gi, '')
      .replace(/<\|begin_of_box\|>/gi, '')
      .replace(/<\|end_of_box\|>/gi, '')
  } catch (error) {
    console.error('Text correction failed:', error)
  } finally {
    isCorrecting.value = false
  }
}

// 处理拖放
async function handleDrop(e: DragEvent) {
  const textarea = textareaRef.value

  // 处理文字拖拽
  const text = e.dataTransfer?.getData('text/plain')
  if (text && text.trim()) {
    if (textarea) {
      // 使用 dragover 记录的位置,或当前 selectionStart 作为 fallback
      const insertPosition = dragCaretPosition.value ?? textarea.selectionStart
      const currentText = inputText.value

      // 判断是否是内部拖拽
      const isInternalDrag = internalDragSelection.value !== null

      if (isInternalDrag && internalDragSelection.value) {
        // 内部拖拽: 先删除选中内容,再插入到目标位置
        const { start: deleteStart, end: deleteEnd } = internalDragSelection.value

        // 如果插入位置在删除范围后面,需要调整插入位置
        let adjustedInsertPos = insertPosition
        if (insertPosition > deleteEnd) {
          adjustedInsertPos = insertPosition - (deleteEnd - deleteStart)
        } else if (insertPosition >= deleteStart && insertPosition <= deleteEnd) {
          // 如果插入位置在删除范围内,插入到删除起始位置
          adjustedInsertPos = deleteStart
        }

        // 构建新文本: 删除原选中内容,插入新文本
        const beforeDelete = currentText.substring(0, deleteStart)
        const afterDelete = currentText.substring(deleteEnd)
        const textAfterDelete = beforeDelete + afterDelete

        // 在调整后的位置插入
        inputText.value = textAfterDelete.substring(0, adjustedInsertPos) + text + textAfterDelete.substring(adjustedInsertPos)

        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = adjustedInsertPos + text.length
          textarea.focus()
        })

        // 清除内部拖拽记录
        internalDragSelection.value = null
      } else {
        // 外部拖拽: 直接插入到目标位置
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

  // 处理图片文件拖拽
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

// 处理 Enter 键（检查输入法组合状态）
function handleEnterKey(event: KeyboardEvent) {
  // 如果正在输入法组合中（如中文拼音输入），忽略 Enter 键
  if (event.isComposing) return
  event.preventDefault()
  handleSave()
}

// 保存
function handleSave() {
  const text = inputText.value.trim()
  if (text) {
    emit('save', text)
  }
}

// 取消
function handleCancel() {
  // 停止录音
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
</script>

<style scoped>
.magic-input-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.magic-input-container {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 800px;

  background: var(--bg-primary);
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
}

.magic-input-textarea {
  min-height: 100px;
  max-height: 600px;
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

.magic-input-menu-bar .send-btn:disabled {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
  opacity: 0.6;
}

.magic-input-menu-bar .send-btn:disabled:hover {
  background: var(--bg-primary-bg);
  color: var(--text-secondary);
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
  bottom: 48px;
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
  z-index: 3005;
}

.edit-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--shadow-color);
  padding: 4px;
  z-index: 3010;
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

/* 纠正按钮加载动画 */
.correct-btn .loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 过渡动画 */
.magic-input-fade-enter-active,
.magic-input-fade-leave-active {
  transition: opacity 0.2s ease;
}

.magic-input-fade-enter-from,
.magic-input-fade-leave-to {
  opacity: 0;
}

/* 抖动动画 */
.magic-input-container.shake {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

/* Toast 消息 */
.toast-message {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-warning-bg, rgba(234, 179, 8, 0.15));
  border: 1px solid var(--color-warning, #eab308);
  color: var(--color-warning, #eab308);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  white-space: nowrap;
  z-index: 20;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>