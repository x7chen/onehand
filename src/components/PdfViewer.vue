<template>
  <div class="pdf-viewer" ref="containerRef">
    <div class="pdf-toolbar">
      <button @click="prevPage" :disabled="currentPage <= 1" class="nav-btn">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button @click="nextPage" :disabled="currentPage >= totalPages" class="nav-btn">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </button>
      <div class="toolbar-divider"></div>
      <button @click="zoomOut" class="tool-btn" title="缩小">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 13H5v-2h14v2z"/>
        </svg>
      </button>
      <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
      <button @click="zoomIn" class="tool-btn" title="放大">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
    </div>
    
    <div 
      class="pdf-content" 
      ref="contentRef"
      @dblclick="handleDoubleClick"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
    >
      <div v-if="isLoading" class="pdf-loading">
        <span>加载中...</span>
      </div>
      <div v-else-if="loadError" class="pdf-error">
        <span>{{ loadError }}</span>
      </div>
      <div v-else-if="isDocReady" class="pdf-page-outer">
        <div class="pdf-page-container" ref="pageContainerRef" :style="pageContainerStyle">
          <canvas ref="canvasRef" class="pdf-canvas" :style="canvasStyle"></canvas>
          <div ref="textLayerRef" class="textLayer-container"></div>
          <div class="node-markers" :style="nodeMarkersStyle">
            <div
              v-for="node in pageNodes"
              :key="node.id"
              class="node-marker"
              :class="{ selected: selectedNodeId === node.id, dragging: draggingNodeId === node.id }"
              :style="getNodeMarkerStyle(node)"
              @click.stop="$emit('node-click', node)"
              @mousedown.stop="startDragNode($event, node)"
              :title="node.title || '节点'"
            >
              {{ getNodeMarkerText(node) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <RecordingIndicator
      v-if="isRecording"
      :x="recordingPosition.x"
      :y="recordingPosition.y"
      :duration="recordingDuration"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
import type { CanvasNode } from '@/types/project'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import RecordingIndicator from '@/components/RecordingIndicator.vue'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs`

interface Props {
  pdfPath: string
  nodes: CanvasNode[]
  selectedNodeId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  selectedNodeId: null
})

const emit = defineEmits<{
  'page-change': [page: number]
  'create-node': [data: { type: 'text-note' | 'voice-note'; page: number; x: number; y: number }]
  'recording-complete': [data: { audioBlob: Blob; duration: number; page: number; x: number; y: number }]
  'node-click': [node: CanvasNode]
  'node-position-change': [data: { nodeId: string; position: { x: number; y: number } }]
}>()

const containerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const pageContainerRef = ref<HTMLElement | null>(null)
const textLayerRef = ref<HTMLElement | null>(null)

let pdfDocInstance: PDFDocumentProxy | null = null
const currentPage = ref(1)
const totalPages = ref(0)
const scale = ref(1.2)
const canvasWidth = ref(0)
const canvasHeight = ref(0)
const devicePixelRatio = ref(window.devicePixelRatio || 1)
const isRendering = ref(false)
const loadError = ref<string | null>(null)
const isLoading = ref(false)
const isDocReady = ref(false)

const LONG_PRESS_DURATION = 300
const MOVE_THRESHOLD = 5
let longPressTimer: number | null = null
let mouseDownPos = { x: 0, y: 0 }
let mouseDownOnTextLayer = false

const isRecording = ref(false)
const recordingDuration = ref(0)
const recordingPosition = ref({ x: 0, y: 0 })
const recordingPagePos = ref({ x: 0, y: 0 })
let recordingTimer: number | null = null
let currentRecorder: ReturnType<typeof createAudioWorkletRecorder> | null = null

const draggingNodeId = ref<string | null>(null)
const draggingNodeStartPos = ref({ x: 0, y: 0 })

const pageNodes = computed(() => {
  return props.nodes.filter(node => node.pdfPage === currentPage.value)
})

const scaledWidth = computed(() => canvasWidth.value)
const scaledHeight = computed(() => canvasHeight.value)

const pageContainerStyle = computed(() => ({
  width: `${scaledWidth.value}px`,
  height: `${scaledHeight.value}px`
}))

const nodeMarkersStyle = computed(() => ({
  width: `${scaledWidth.value}px`,
  height: `${scaledHeight.value}px`
}))

const canvasStyle = computed(() => ({
  width: `${scaledWidth.value}px`,
  height: `${scaledHeight.value}px`
}))

function getNodeMarkerStyle(node: CanvasNode) {
  if (!node.pdfPosition) return {}
  
  return {
    left: `${node.pdfPosition.x * scale.value}px`,
    top: `${node.pdfPosition.y * scale.value}px`
  }
}

function getNodeMarkerText(node: CanvasNode): string {
  const title = node.title || '节点'
  return title.length > 8 ? title.substring(0, 8) + '...' : title
}

function startDragNode(e: MouseEvent, node: CanvasNode) {
  if (e.button !== 0) return
  
  draggingNodeId.value = node.id
  draggingNodeStartPos.value = { x: e.clientX, y: e.clientY }
  
  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
  
  e.preventDefault()
}

function handleDragMove(e: MouseEvent) {
  if (!draggingNodeId.value) return
  
  const node = props.nodes.find(n => n.id === draggingNodeId.value)
  if (!node || !node.pdfPosition) return
  
  const dx = (e.clientX - draggingNodeStartPos.value.x) / scale.value
  const dy = (e.clientY - draggingNodeStartPos.value.y) / scale.value
  
  const newX = Math.max(0, node.pdfPosition.x + dx)
  const newY = Math.max(0, node.pdfPosition.y + dy)
  
  node.pdfPosition.x = newX
  node.pdfPosition.y = newY
  
  draggingNodeStartPos.value = { x: e.clientX, y: e.clientY }
}

function handleDragEnd(e: MouseEvent) {
  if (draggingNodeId.value) {
    const node = props.nodes.find(n => n.id === draggingNodeId.value)
    if (node) {
      emit('node-position-change', {
        nodeId: draggingNodeId.value,
        position: { ...node.pdfPosition! }
      })
    }
  }
  
  draggingNodeId.value = null
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
}

async function loadPdf() {
  if (!props.pdfPath) return
  
  isLoading.value = true
  loadError.value = null
  isDocReady.value = false
  
  try {
    let pdfUrl = props.pdfPath
    if (!pdfUrl.startsWith('file://') && !pdfUrl.startsWith('http')) {
      pdfUrl = `file:///${props.pdfPath.replace(/\\/g, '/')}`
    }
    
    console.log('Loading PDF from:', pdfUrl)
    
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
    })
    
    pdfDocInstance = await loadingTask.promise
    totalPages.value = pdfDocInstance.numPages
    isDocReady.value = true
    await renderPage()
  } catch (error) {
    console.error('Failed to load PDF:', error)
    loadError.value = error instanceof Error ? error.message : '加载 PDF 失败'
  } finally {
    isLoading.value = false
  }
}

async function renderPage() {
  if (!pdfDocInstance || !canvasRef.value || isRendering.value || !isDocReady.value) return
  if (pdfDocInstance.numPages === 0 || currentPage.value < 1 || currentPage.value > pdfDocInstance.numPages) return
  
  isRendering.value = true
  
  try {
    console.log('Rendering page:', currentPage.value)
    
    await nextTick()
    
    const page = await pdfDocInstance.getPage(currentPage.value)
    
    const canvas = canvasRef.value
    if (!canvas) return
    
    const context = canvas.getContext('2d')
    if (!context) return
    
    const dpr = devicePixelRatio.value
    const outputScale = scale.value
    const renderScale = outputScale * dpr
    
    const renderViewport = page.getViewport({ scale: renderScale })
    const cssViewport = page.getViewport({ scale: outputScale })
    
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height
    canvasWidth.value = cssViewport.width
    canvasHeight.value = cssViewport.height
    
    await nextTick()
    
    const renderContext = {
      canvasContext: context,
      viewport: renderViewport
    }
    
    await page.render(renderContext).promise
    console.log('Page rendered successfully')
    
    const textLayerDiv = textLayerRef.value
    if (textLayerDiv) {
      textLayerDiv.innerHTML = ''
      
      const textLayerBuilder = new TextLayerBuilder({
        pdfPage: page
      })
      
      textLayerDiv.appendChild(textLayerBuilder.div)
      
      await textLayerBuilder.render(cssViewport)
      console.log('TextLayer rendered successfully')
    }
  } catch (error) {
    console.error('Failed to render page:', error)
  } finally {
    isRendering.value = false
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    emit('page-change', currentPage.value)
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    emit('page-change', currentPage.value)
  }
}

function zoomIn() {
  scale.value = Math.min(scale.value + 0.2, 3)
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.2, 0.5)
}

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey) {
    e.preventDefault()
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }
}

function handleDoubleClick(e: MouseEvent) {
  if (e.button !== 0) return
  const container = pageContainerRef.value
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const x = (e.clientX - rect.left) / scale.value
  const y = (e.clientY - rect.top) / scale.value
  
  emit('create-node', {
    type: 'text-note',
    page: currentPage.value,
    x,
    y
  })
}

async function startRecording(e: MouseEvent) {
  const container = pageContainerRef.value
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const x = (e.clientX - rect.left) / scale.value
  const y = (e.clientY - rect.top) / scale.value
  
  recordingPosition.value = { x: e.clientX, y: e.clientY }
  recordingPagePos.value = { x, y }
  recordingDuration.value = 0
  
  try {
    currentRecorder = createAudioWorkletRecorder()
    await currentRecorder.start()
    isRecording.value = true
    
    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)
  } catch (error) {
    console.error('Failed to start recording:', error)
    currentRecorder = null
  }
}

async function stopRecording() {
  if (!currentRecorder) return
  
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  
  try {
    const audioBlob = await currentRecorder.stop()
    isRecording.value = false
    currentRecorder = null
    
    emit('recording-complete', {
      audioBlob,
      duration: recordingDuration.value,
      page: currentPage.value,
      x: recordingPagePos.value.x,
      y: recordingPagePos.value.y
    })
  } catch (error) {
    console.error('Failed to stop recording:', error)
    isRecording.value = false
    currentRecorder = null
  }
}

function cancelRecording() {
  if (!currentRecorder) return
  
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  
  currentRecorder.stop().catch(() => {})
  isRecording.value = false
  currentRecorder = null
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  if (isRecording.value) return
  
  const target = e.target as HTMLElement
  mouseDownOnTextLayer = !!target.closest('.textLayer')
  mouseDownPos = { x: e.clientX, y: e.clientY }
  
  longPressTimer = window.setTimeout(() => {
    longPressTimer = null
    startRecording(e)
  }, LONG_PRESS_DURATION)
}

function handleMouseMove(e: MouseEvent) {
  if (!longPressTimer && !isRecording.value) return
  
  const dx = e.clientX - mouseDownPos.x
  const dy = e.clientY - mouseDownPos.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (isRecording.value) {
    recordingPosition.value = { x: e.clientX, y: e.clientY }
  }
  
  if (longPressTimer && mouseDownOnTextLayer && distance > MOVE_THRESHOLD) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleMouseUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  
  if (isRecording.value) {
    stopRecording()
  }
  
  mouseDownOnTextLayer = false
}

function handleMouseLeave() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  
  if (isRecording.value) {
    cancelRecording()
  }
  
  mouseDownOnTextLayer = false
}

watch(() => props.pdfPath, () => {
  loadPdf()
})

watch(currentPage, async () => {
  await nextTick()
  renderPage()
})

watch(scale, async () => {
  await nextTick()
  renderPage()
})

onMounted(() => {
  loadPdf()
  if (contentRef.value) {
    contentRef.value.addEventListener('wheel', handleWheel, { passive: false })
  }
  window.addEventListener('resize', handleResize)
})

function handleResize() {
  const newDpr = window.devicePixelRatio || 1
  if (newDpr !== devicePixelRatio.value) {
    devicePixelRatio.value = newDpr
  }
}

onUnmounted(() => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
  }
  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  if (currentRecorder) {
    currentRecorder.stop().catch(() => {})
  }
  if (pdfDocInstance) {
    pdfDocInstance.destroy()
    pdfDocInstance = null
  }
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
  if (contentRef.value) {
    contentRef.value.removeEventListener('wheel', handleWheel)
  }
  window.removeEventListener('resize', handleResize)
})

defineExpose({
  goToPage: (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }
})
</script>

<style scoped>
.pdf-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  position: relative;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.nav-btn,
.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled),
.tool-btn:hover {
  background: var(--border-color);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: var(--text-primary);
  min-width: 60px;
  text-align: center;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 8px;
}

.zoom-level {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 45px;
  text-align: center;
}

.pdf-content {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  padding: 20px;
}

.pdf-loading,
.pdf-error {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 16px;
  padding: 40px;
}

.pdf-error {
  color: #e53e3e;
}

.pdf-page-outer {
  display: inline-block;
}

.pdf-page-container {
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  background: white;
}

.pdf-canvas {
  display: block;
}

.textLayer-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.textLayer ::selection {
  background: rgba(0, 0, 255, 0.3);
}

.node-markers {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.node-marker {
  position: absolute;
  padding: 4px 8px;
  border-radius: 12px;
  background: #4299e1;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
  z-index: 10;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-marker:hover {
  transform: scale(1.1);
  z-index: 20;
}

.node-marker.selected {
  background: #2b6cb0;
  box-shadow: 0 0 0 0.2em rgba(66, 153, 225, 0.4);
}

.node-marker.dragging {
  opacity: 0.8;
  cursor: grabbing;
  z-index: 100;
  transform: scale(1.15);
}

.node-marker.voice-note {
  background: #e53e3e;
}

.node-marker.voice-note.selected {
  background: #c53030;
}
</style>
