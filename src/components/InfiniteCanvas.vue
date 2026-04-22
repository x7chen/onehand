<template>
  <div
    ref="canvasRef"
    class="infinite-canvas"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @wheel="handleWheel"
    @contextmenu.prevent
    @dblclick="handleDblClick"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @mousedown.right.capture="handleRightMouseDownCapture"
  >

    <div
      class="canvas-content"
      :style="transformStyle"
    >
      <div class="grid-background"></div>

      <slot name="nodes"></slot>
    </div>

    <!-- Recording indicator outside canvas-content to avoid transform -->
    <RecordingIndicator
      v-if="isRecording"
      :x="screenRecordingPosition.x"
      :y="screenRecordingPosition.y"
      :duration="recordingDuration"
    />

    <!-- 拖拽提示 -->
    <div
      v-if="isDraggingText"
      class="drag-hint"
      :style="dragHintStyle"
    >
      {{ t('canvas.dragToAsk', { count: draggedTextLength }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import RecordingIndicator from './RecordingIndicator.vue'

const { t } = useI18n()

const props = defineProps<{
  viewport: { x: number; y: number; zoom: number }
  isRecording?: boolean
  recordingPosition?: { x: number; y: number }
  recordingDuration?: number
}>()

const emit = defineEmits<{
  'viewport-change': [viewport: { x: number; y: number; zoom: number }]
  'long-press': [x: number, y: number]
  'long-press-end': [isCancel?: boolean]
  'click': [x: number, y: number]
  'dbl-click': [x: number, y: number]
  'drop-text': [x: number, y: number, text: string]
  'drop-image': [x: number, y: number, files: File[]]
}>()

const isDraggingText = ref(false)
const dragHintStyle = ref({ left: '0px', top: '0px' })
const draggedTextLength = ref(0)
// 添加一个变量跟踪是否在节点上
const isOverNode = ref(false)

const canvasRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const lastPosition = ref({ x: 0, y: 0 })
const longPressTimer = ref<number | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const isLongPressing = ref(false)
const panThreshold = 30 // 移动超过这个距离才算是拖动，避免误触发录音
const hasMovedBeyondThreshold = ref(false) // 是否已经超过阈值
const isMouseDown = ref(false) // 鼠标是否按下
const isRightMouseDown = ref(false) // 鼠标右键是否按下
const isSpacePressed = ref(false) // 空格键是否按下
const isCtrlPressed = ref(false) // Ctrl 键是否按下
// 屏幕坐标位置的录音指示器（用于显示）
const screenRecordingPosition = ref({ x: 0, y: 0 })

// 监听 recordingPosition 变化，转换为屏幕坐标
watch(() => props.recordingPosition, (newVal) => {
  if (newVal && canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    screenRecordingPosition.value = {
      x: newVal.x * props.viewport.zoom + props.viewport.x + rect.left,
      y: newVal.y * props.viewport.zoom + props.viewport.y + rect.top
    }
  }
}, { immediate: true })

const transformStyle = computed(() => ({
  transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.viewport.zoom})`
}))

// 在捕获阶段处理右键，确保即使在元素上也能拖动画布
function handleRightMouseDownCapture(e: MouseEvent) {
  if (e.button === 2) {
    // 阻止事件继续传播，防止被节点捕获
    e.stopPropagation()
    
    isRightMouseDown.value = true
    isDragging.value = true
    lastPosition.value = { x: e.clientX, y: e.clientY }
    dragStart.value = { x: e.clientX, y: e.clientY }
  }
}

function handleMouseDown(e: MouseEvent) {
  // Don't handle mousedown if clicking on draggable text content
  // This allows text selection without triggering canvas pan
  const target = e.target as HTMLElement
  if (target.closest('.transcript-content') || target.closest('.agent-content')) {
    return // Let the text selection happen normally
  }

  // Check if we're clicking on an editable textarea (editing mode)
  if (target.tagName === 'TEXTAREA' || target.closest('textarea')) {
    return // We're in text editing mode, don't trigger recording
  }

  // Check if clicking on edge buttons or their containers
  if (target.closest('.page-nav-btn') || target.closest('.page-nav-buttons')) {
    return // Don't trigger canvas events when clicking edge buttons
  }

  if (e.button === 0) {
    // 如果正在录音且处于长按状态，再次点击鼠标左键可以取消录音
    if (props.isRecording && isLongPressing.value) {
      isLongPressing.value = false
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value)
        longPressTimer.value = null
      }
      emit('long-press-end', true)
      return
    }

    // Left click - check for long press (recording)
    isMouseDown.value = true
    isDragging.value = false
    isLongPressing.value = false
    hasMovedBeyondThreshold.value = false
    lastPosition.value = { x: e.clientX, y: e.clientY }
    dragStart.value = { x: e.clientX, y: e.clientY }
    longPressTimer.value = window.setTimeout(() => {
      // Only trigger recording if haven't moved beyond threshold
      if (!hasMovedBeyondThreshold.value && isMouseDown.value) {
        // 如果已经在录音或已经在长按状态，不要重复触发
        if (props.isRecording || isLongPressing.value) {
          return
        }

        isLongPressing.value = true
        // 计算画布坐标（考虑 viewport 和 zoom）
        const rect = canvasRef.value?.getBoundingClientRect()
        if (rect) {
          const canvasX = (e.clientX - rect.left - props.viewport.x) / props.viewport.zoom
          const canvasY = (e.clientY - rect.top - props.viewport.y) / props.viewport.zoom
          emit('long-press', canvasX, canvasY)
        } else {
          emit('long-press', dragStart.value.x, dragStart.value.y)
        }
      }
    }, 500)
  }
  // Right click is handled in capture phase
}

function handleMouseMove(e: MouseEvent) {
  // Handle right mouse button drag (panning)
  if (isRightMouseDown.value && isDragging.value) {
    const dx = e.clientX - lastPosition.value.x
    const dy = e.clientY - lastPosition.value.y
    lastPosition.value = { x: e.clientX, y: e.clientY }

    emit('viewport-change', {
      x: props.viewport.x + dx,
      y: props.viewport.y + dy,
      zoom: props.viewport.zoom
    })
    return
  }

  // Must have mouse button pressed to drag
  if (!isMouseDown.value) return

  // If already recording, don't handle pan/drag
  if (isLongPressing.value) return

  // Don't drag canvas if user is selecting text in a note
  const selection = window.getSelection()
  if (selection && selection.toString().length > 0) {
    return // User is selecting text, don't interfere
  }

  const dx = e.clientX - lastPosition.value.x
  const dy = e.clientY - lastPosition.value.y

  // Check total distance from start position
  const totalDx = e.clientX - dragStart.value.x
  const totalDy = e.clientY - dragStart.value.y
  const totalDistance = Math.sqrt(totalDx * totalDx + totalDy * totalDy)

  if (!hasMovedBeyondThreshold.value) {
    // Haven't crossed threshold yet
    if (totalDistance > panThreshold) {
      // Just crossed threshold - cancel recording
      hasMovedBeyondThreshold.value = true
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value)
        longPressTimer.value = null
      }
      isDragging.value = true
      // Update last position to current to avoid jump
      lastPosition.value = { x: e.clientX, y: e.clientY }
    }
    // Don't pan until we've crossed the threshold
    return
  }

  // Has moved beyond threshold - this is a drag operation
  if (isDragging.value) {
    lastPosition.value = { x: e.clientX, y: e.clientY }

    emit('viewport-change', {
      x: props.viewport.x + dx,
      y: props.viewport.y + dy,
      zoom: props.viewport.zoom
    })
  }
}

function handleMouseUp(e: MouseEvent) {
  // Handle right mouse button release
  if (e.button === 2) {
    isRightMouseDown.value = false
    isDragging.value = false
    return
  }

  isMouseDown.value = false

  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  // If releasing from a long press, stop recording (normal stop, not cancel)
  if (isLongPressing.value && props.isRecording) {
    isLongPressing.value = false
    emit('long-press-end', false)
  }

  // Reset drag state
  isDragging.value = false
  hasMovedBeyondThreshold.value = false
}

function handleMouseLeave() {
  // Mouse left canvas - reset everything
  isMouseDown.value = false
  isRightMouseDown.value = false

  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }

  isDragging.value = false
  hasMovedBeyondThreshold.value = false
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()

  // Shift + 滚轮：左右滚动画布
  if (e.shiftKey) {
    // 在某些系统上，Shift+ 滚轮会产生 deltaX，有些则产生 deltaY
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY
    emit('viewport-change', {
      x: props.viewport.x - delta,
      y: props.viewport.y,
      zoom: props.viewport.zoom
    })
  }
  // 空格 + 滚轮：缩放画布
  else if (isSpacePressed.value|| isCtrlPressed.value) {
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.min(Math.max(props.viewport.zoom * delta, 0.1), 5)

    const rect = canvasRef.value?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const newX = mouseX - (mouseX - props.viewport.x) * (newZoom / props.viewport.zoom)
      const newY = mouseY - (mouseY - props.viewport.y) * (newZoom / props.viewport.zoom)

      emit('viewport-change', { x: newX, y: newY, zoom: newZoom })
    }
  }
  // 滚轮：上下滚动画布
  else {
    emit('viewport-change', {
      x: props.viewport.x,
      y: props.viewport.y - e.deltaY,
      zoom: props.viewport.zoom
    })
  }
}

// 拖拽处理
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  let isOverNodeLocal = false
  if (e.dataTransfer) {
    // 检测是否在画布节点区域上方
    const target = e.target as HTMLElement
    isOverNodeLocal = !!target.closest('.voice-note')

    // 检测是否有图片文件
    const items = e.dataTransfer.items
    let hasImageFile = false
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          hasImageFile = true
          break
        }
      }
    }

    // 根据是否在节点上来设置不同的 dropEffect
    if (isOverNodeLocal) {
      e.dataTransfer.dropEffect = 'none'
    } else if (hasImageFile) {
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const text = e.dataTransfer?.getData('text/plain')
  if (text && text.trim()) {
    // 只有在从节点移出到空白区域，或者在空白区域移动时才显示拖拽提示
    if (!isOverNodeLocal) {
      isDraggingText.value = true
    } else {
      isDraggingText.value = false
    }

    // 更新状态
    isOverNode.value = isOverNodeLocal

    draggedTextLength.value = text.trim().length
    dragHintStyle.value = {
      left: (e.clientX + 15) + 'px',
      top: (e.clientY + 15) + 'px'
    }
  }
}

function handleDragLeave() {
  // 不立即重置，而是检测是否真正离开了画布容器
  // 使用 setTimeout 来延迟检查 relatedTarget 是否仍在画布元素内
  setTimeout(() => {
    if (!document.querySelector('.infinite-canvas:hover')) {
      isDraggingText.value = false
      isOverNode.value = false
    }
  }, 10)
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDraggingText.value = false

  // 检查是否在画布空白区域释放，而不是在节点上
  const target = e.target as HTMLElement
  // 如果释放目标或其祖先元素包含 voice-note 类，则不在空白区域，直接返回
  if (target.closest('.voice-note')) {
    return
  }

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  // 计算画布坐标（考虑 viewport 和 zoom）
  const canvasX = (e.clientX - rect.left - props.viewport.x) / props.viewport.zoom
  const canvasY = (e.clientY - rect.top - props.viewport.y) / props.viewport.zoom

  // 检测是否有图片文件
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const imageFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    )
    if (imageFiles.length > 0) {
      emit('drop-image', canvasX, canvasY, imageFiles)
      return
    }
  }

  // 处理文本拖拽
  const text = e.dataTransfer?.getData('text/plain')
  if (!text || !text.trim()) return

  emit('drop-text', canvasX, canvasY, text.trim())
}

function handleDblClick(e: MouseEvent) {
  // 双击节点区域不触发
  const target = e.target as HTMLElement
  if (target.closest('.voice-note')) {
    return
  }

  // 双击边缘按钮区域不触发
  if (target.closest('.page-nav-btn') || target.closest('.page-nav-buttons')) {
    return
  }

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  // 计算画布坐标（考虑 viewport 和 zoom）
  const canvasX = (e.clientX - rect.left - props.viewport.x) / props.viewport.zoom
  const canvasY = (e.clientY - rect.top - props.viewport.y) / props.viewport.zoom

  emit('dbl-click', canvasX, canvasY)
}

// 键盘事件处理
function handleKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !e.repeat) {
    isSpacePressed.value = true
  }
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    isCtrlPressed.value = true
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    isSpacePressed.value = false
  }
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
    isCtrlPressed.value = false
  }
}

// 添加和移除键盘事件监听
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
})

watch(() => props.viewport, (newViewport) => {
  emit('viewport-change', newViewport)
}, { deep: true })

// 暴露给父组件
defineExpose({
  canvasRef
})
</script>

<style scoped>
.infinite-canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  cursor: grab;
  background: var(--bg-secondary);
}

.infinite-canvas:active {
  cursor: grabbing;
}

.canvas-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

.grid-background {
  position: absolute;
  top: -5000px;
  left: -5000px;
  width: 10000px;
  height: 10000px;
  background-image:
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.drag-hint {
  position: fixed;
  background: var(--color-primary);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}
</style>
