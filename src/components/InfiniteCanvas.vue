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
      :x="recordingPosition!.x"
      :y="recordingPosition!.y"
      :duration="recordingDuration"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import RecordingIndicator from './RecordingIndicator.vue'

const props = defineProps<{
  viewport: { x: number; y: number; zoom: number }
  isRecording?: boolean
  recordingPosition?: { x: number; y: number }
  recordingDuration?: number
}>()

const emit = defineEmits<{
  'viewport-change': [viewport: { x: number; y: number; zoom: number }]
  'long-press': [x: number, y: number]
  'long-press-end': []
  'click': [x: number, y: number]
}>()

const canvasRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const lastPosition = ref({ x: 0, y: 0 })
const longPressTimer = ref<number | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const isLongPressing = ref(false)
const panThreshold = 30 // 移动超过这个距离才算是拖动，避免误触发录音
const hasMovedBeyondThreshold = ref(false) // 是否已经超过阈值
const isMouseDown = ref(false) // 鼠标左键是否按下

const transformStyle = computed(() => ({
  transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.viewport.zoom})`
}))

function handleMouseDown(e: MouseEvent) {
  // Don't handle mousedown if clicking on draggable text content
  // This allows text selection without triggering canvas pan
  const target = e.target as HTMLElement
  if (target.closest('.transcript-content') || target.closest('.agent-content')) {
    return // Let the text selection happen normally
  }
  
  if (e.button === 0) {
    // Left click - start panning and check for long press
    isMouseDown.value = true
    isDragging.value = false
    isLongPressing.value = false
    hasMovedBeyondThreshold.value = false
    lastPosition.value = { x: e.clientX, y: e.clientY }
    dragStart.value = { x: e.clientX, y: e.clientY }
    longPressTimer.value = window.setTimeout(() => {
      // Only trigger recording if haven't moved beyond threshold
      if (!hasMovedBeyondThreshold.value && isMouseDown.value) {
        isLongPressing.value = true
        emit('long-press', dragStart.value.x, dragStart.value.y)
      }
    }, 500)
  }
}

function handleMouseMove(e: MouseEvent) {
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
  isMouseDown.value = false
  
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  // If releasing from a long press, stop recording
  if (isLongPressing.value && props.isRecording) {
    isLongPressing.value = false
    emit('long-press-end')
  }
  
  // Reset drag state
  isDragging.value = false
  hasMovedBeyondThreshold.value = false
}

function handleMouseLeave() {
  // Mouse left canvas - reset everything
  isMouseDown.value = false
  
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  isDragging.value = false
  hasMovedBeyondThreshold.value = false
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.min(Math.max(props.viewport.zoom * delta, 0.5), 2)
  
  const rect = canvasRef.value?.getBoundingClientRect()
  if (rect) {
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const newX = mouseX - (mouseX - props.viewport.x) * (newZoom / props.viewport.zoom)
    const newY = mouseY - (mouseY - props.viewport.y) * (newZoom / props.viewport.zoom)
    
    emit('viewport-change', { x: newX, y: newY, zoom: newZoom })
  }
}

watch(() => props.viewport, (newViewport) => {
  emit('viewport-change', newViewport)
}, { deep: true })
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
</style>
