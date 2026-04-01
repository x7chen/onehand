<template>
  <div class="pdf-viewer" ref="containerRef" @mousemove="handleContainerMouseMove" @mouseleave="hideEdgeButtons" @contextmenu.prevent="handleContextMenu">
    <div class="pdf-toolbar">
      <button @click="toggleSidebar" class="tool-btn" title="侧边栏">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
        </svg>
      </button>
      <div class="toolbar-divider"></div>
      <button @click="prevPage" class="tool-btn" :disabled="currentPage <= 1" title="上一页">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button @click="nextPage" class="tool-btn" :disabled="currentPage >= totalPages" title="下一页">
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
      <div class="toolbar-divider"></div>
      <button @click="rotateCounterClockwise" class="tool-btn" title="逆时针旋转90°">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/>
        </svg>
      </button>
      <button @click="rotateClockwise" class="tool-btn" title="顺时针旋转90°">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/>
        </svg>
      </button>
      <div class="toolbar-divider"></div>
      <label class="include-page-checkbox" title="勾选后，上下文将附带当前页面图片，需要支持视觉的AI模型">
        <input type="checkbox" v-model="includePageAsContext" @change="handleIncludePageChange" />
      </label>
    </div>

    <div class="pdf-main">
      <div class="pdf-sidebar" :class="{ collapsed: !sidebarVisible }">
        <div class="sidebar-tabs">
          <button 
            class="sidebar-tab" 
            :class="{ active: sidebarTab === 'outline' }" 
            @click="sidebarTab = 'outline'; sidebarVisible = true"
            title="目录"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
            </svg>
          </button>
          <button 
            class="sidebar-tab" 
            :class="{ active: sidebarTab === 'thumbnails' }" 
            @click="sidebarTab = 'thumbnails'; sidebarVisible = true"
            title="缩略图"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </button>
        </div>
        
        <div class="sidebar-content" v-show="sidebarVisible">
          <div v-if="sidebarTab === 'outline'" class="outline-container">
            <div v-if="outlineLoading" class="sidebar-loading">加载目录...</div>
            <div v-else-if="outline.length === 0" class="sidebar-empty">无目录</div>
            <OutlineTree 
              v-else 
              :items="outline" 
              @navigate="handleOutlineNavigate"
            />
          </div>
          
          <div v-else-if="sidebarTab === 'thumbnails'" class="thumbnails-container">
            <div class="thumbnails-grid">
              <div
                v-for="thumb in thumbnails"
                :key="thumb.pageNumber"
                class="thumbnail-item"
                :class="{ current: thumb.pageNumber === currentPage }"
                @click="goToPage(thumb.pageNumber)"
              >
                <canvas
                  ref="thumbnailCanvasesRef"
                  :data-page-number="thumb.pageNumber"
                  class="thumbnail-canvas"
                ></canvas>
                <span class="thumbnail-label">{{ thumb.pageNumber }}</span>
              </div>
            </div>
            <div v-if="thumbnailsLoading" class="sidebar-loading-overlay">加载缩略图...</div>
          </div>
        </div>
      </div>

      <div 
        class="pdf-content" 
        ref="contentRef"
        @dblclick="handleDoubleClick"
        @mousedown="handleMouseDown"
      >
        <div v-if="isLoading" class="pdf-loading">
          <span>加载中...</span>
        </div>
        <div v-else-if="loadError" class="pdf-error">
          <span>{{ loadError }}</span>
        </div>
        <div v-else-if="isDocReady" class="pdf-page-outer" :style="pageOuterStyle">
          <div class="pdf-page-container" ref="pageContainerRef" :style="pageContainerStyle">
            <canvas ref="canvasRef" class="pdf-canvas" :style="canvasStyle"></canvas>
            <div ref="textLayerRef" class="textLayer-container"></div>
            <div class="node-markers" :style="nodeMarkersStyle">
              <div
                v-for="node in pageNodes"
                :key="node.id"
                class="node-marker"
                :class="{
                  selected: activeNodeId === node.id,
                  dragging: draggingNodeId === node.id,
                  'context-selected': node.selectedAsContext
                }"
                :style="getNodeMarkerStyle(node)"
                @click.stop="$emit('node-click', node)"
                @mousedown.stop="startDragNode($event, node)"
                :title="node.title || '笔记'"
              >
                {{ getNodeMarkerText(node) }}
              </div>
            </div>
          </div>
        </div>
        
        <button 
          v-show="showLeftNav && currentPage > 1"
          class="edge-nav-btn left"
          @click.stop="handleEdgeNavClick(prevPage)"
          @mousedown.stop="handleEdgeNavMouseDown"
          @mouseup.stop="handleEdgeNavMouseUp"
          @mouseleave="handleEdgeNavMouseLeave"
          @dblclick.stop
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        
        <button 
          v-show="showRightNav && currentPage < totalPages"
          class="edge-nav-btn right"
          @click.stop="handleEdgeNavClick(nextPage)"
          @mousedown.stop="handleEdgeNavMouseDown"
          @mouseup.stop="handleEdgeNavMouseUp"
          @mouseleave="handleEdgeNavMouseLeave"
          @dblclick.stop
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      </div>
    </div>

    <RecordingIndicator
      v-if="isRecording"
      :x="recordingPosition.x"
      :y="recordingPosition.y"
      :duration="recordingDuration"
    />

    <!-- 右键菜单 -->
    <div
      v-if="contextMenuVisible"
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <div v-if="selectedText" class="context-menu-item" @click="handleExplainSelection">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/>
        </svg>
        <span>解释选中内容</span>
      </div>
      <div class="context-menu-item" @click="handleAnalyzePage">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
        <span>分析当前页面</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import {
  TextLayerBuilder,
  PDFLinkService,
  EventBus
} from 'pdfjs-dist/web/pdf_viewer.mjs'
import 'pdfjs-dist/web/pdf_viewer.css'
import type { CanvasNode } from '@/types/notebook'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import RecordingIndicator from '@/components/RecordingIndicator.vue'
import { createAudioWorkletRecorder } from '@/utils/audioWorkletRecorder'
import OutlineTree from './OutlineTree.vue'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

interface OutlineItem {
  title: string
  dest: string | null
  items: OutlineItem[]
  url?: string
}

interface ThumbnailItem {
  pageNumber: number
}

interface Props {
  pdfPath: string
  nodes: CanvasNode[]
  activeNodeId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  activeNodeId: null
})

const emit = defineEmits<{
  'page-change': [page: number]
  'create-node': [data: { type: 'text-note' | 'voice-note'; page: number; x: number; y: number }]
  'recording-complete': [data: { audioBlob: Blob; duration: number; page: number; x: number; y: number }]
  'node-click': [node: CanvasNode]
  'node-position-change': [data: { nodeId: string; position: { x: number; y: number } }]
  'save': [data: Uint8Array]
  'analyze-page': [data: { imageBase64: string; pageNumber: number; position: { x: number; y: number } }]
  'explain-selection': [data: { imageBase64: string; selectedText: string; pageNumber: number; position: { x: number; y: number } }]
  'include-page-change': [data: { include: boolean; imageBase64?: string; pageNumber: number }]
}>()

const containerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const pageContainerRef = ref<HTMLElement | null>(null)
const textLayerRef = ref<HTMLElement | null>(null)

let pdfDocInstance: PDFDocumentProxy | null = null
let eventBus: EventBus | null = null
let linkService: PDFLinkService | null = null

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
const pendingPage = ref<number | null>(null) // Page to navigate to after PDF loads

const sidebarVisible = ref(false)
const sidebarTab = ref<'outline' | 'thumbnails'>('outline')
const outline = ref<OutlineItem[]>([])
const outlineLoading = ref(false)
const thumbnails = ref<ThumbnailItem[]>([])
const thumbnailsLoading = ref(false)

// 右键菜单相关状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedText = ref('')
const contextMenuPagePosition = ref({ x: 0, y: 0 }) // 右键点击在 PDF 页面上的位置

// 附图功能状态
const includePageAsContext = ref(false)

const mainRotation = ref(0)


const LONG_PRESS_DURATION = 300
const MOVE_THRESHOLD = 5
const EDGE_ZONE_WIDTH = 60
let longPressTimer: number | null = null
let mouseDownPos = { x: 0, y: 0 }
let currentMousePos = { x: 0, y: 0 }
let mouseDownOnTextLayer = false
let isClickingEdgeButton = false
let isStartingRecording = false

const isRecording = ref(false)
const recordingDuration = ref(0)
const recordingPosition = ref({ x: 0, y: 0 })
const recordingPagePos = ref({ x: 0, y: 0 })
let recordingTimer: number | null = null
let currentRecorder: ReturnType<typeof createAudioWorkletRecorder> | null = null

const draggingNodeId = ref<string | null>(null)
const draggingNodeStartPos = ref({ x: 0, y: 0 })

const showLeftNav = ref(false)
const showRightNav = ref(false)

const thumbnailCanvasesRef = ref<HTMLCanvasElement[]>([])

const pageNodes = computed(() => {
  return props.nodes.filter(node => node.pdfPage === currentPage.value)
})

const scaledWidth = computed(() => canvasWidth.value)
const scaledHeight = computed(() => canvasHeight.value)

const pageContainerStyle = computed(() => ({
  width: `${scaledWidth.value}px`,
  height: `${scaledHeight.value}px`
}))

const pageOuterStyle = computed(() => ({}))

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
  const title = node.title || '笔记'
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

function handleDragEnd() {
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

async function loadOutline() {
  if (!pdfDocInstance) return
  
  outlineLoading.value = true
  try {
    const outlineItems = await pdfDocInstance.getOutline()
    outline.value = transformOutline(outlineItems || [])
  } catch (error) {
    console.error('Failed to load outline:', error)
    outline.value = []
  } finally {
    outlineLoading.value = false
  }
}

function transformOutline(items: any[]): OutlineItem[] {
  return items.map(item => ({
    title: item.title,
    dest: item.dest,
    items: item.items ? transformOutline(item.items) : [],
    url: item.url
  }))
}

async function handleOutlineNavigate(dest: string | null, url?: string) {
  if (url) {
    window.open(url, '_blank')
    return
  }
  
  if (!pdfDocInstance || !dest) return
  
  try {
    const destObj = await pdfDocInstance.getDestination(dest)
    if (destObj) {
      const [pageIndex] = destObj
      const pageNumber = typeof pageIndex === 'number' ? pageIndex + 1 : await pdfDocInstance.getPageIndex(pageIndex) + 1
      goToPage(pageNumber)
    }
  } catch (error) {
    console.error('Failed to navigate to destination:', error)
  }
}

async function loadThumbnails() {
  if (!pdfDocInstance) return

  // 如果已经有缩略图数据，只需要重新渲染
  const needsInit = thumbnails.value.length === 0

  if (needsInit) {
    thumbnailsLoading.value = true
    thumbnails.value = []
    for (let i = 1; i <= pdfDocInstance.numPages; i++) {
      thumbnails.value.push({ pageNumber: i })
    }
  }

  try {
    // 等待 DOM 更新
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 50))

    const canvasElements = thumbnailCanvasesRef.value
    console.log('Found thumbnail canvas refs:', canvasElements?.length || 0)

    if (!canvasElements || canvasElements.length === 0) {
      console.warn('No thumbnail canvas elements found, sidebar may be hidden')
      return
    }

    // 渲染所有缩略图
    for (const canvas of canvasElements) {
      if (!canvas) continue
      const pageNumber = parseInt(canvas.dataset.pageNumber || '0')
      if (pageNumber > 0 && pageNumber <= pdfDocInstance.numPages) {
        console.log('Rendering thumbnail for page:', pageNumber)
        await renderThumbnail(pageNumber, canvas)
      }
    }
  } catch (error) {
    console.error('Failed to load thumbnails:', error)
  } finally {
    thumbnailsLoading.value = false
  }
}

async function renderThumbnail(pageNumber: number, canvas: HTMLCanvasElement) {
  if (!pdfDocInstance) return

  try {
    const page = await pdfDocInstance.getPage(pageNumber)

    const maxWidth = 120
    const viewport = page.getViewport({ scale: 1 })
    const scale = maxWidth / viewport.width
    const scaledViewport = page.getViewport({ scale })

    const context = canvas.getContext('2d')
    if (!context) {
      console.error('Failed to get 2d context for thumbnail', pageNumber)
      return
    }

    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    console.log('Rendering thumbnail', pageNumber, 'with size:', canvas.width, 'x', canvas.height)

    await page.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise

    console.log('Thumbnail', pageNumber, 'rendered successfully')
  } catch (error) {
    console.error(`Failed to render thumbnail ${pageNumber}:`, error)
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  } else if (isLoading.value || totalPages.value === 0) {
    // PDF is still loading, save the page for later
    pendingPage.value = page
  }
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
    
    eventBus = new EventBus()
    linkService = new PDFLinkService({
      eventBus,
      externalLinkTarget: 2
    })
    
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
    })
    
    pdfDocInstance = await loadingTask.promise
    totalPages.value = pdfDocInstance.numPages
    linkService.setDocument(pdfDocInstance, null)
    
    // 先关闭加载状态，再设置文档就绪，确保 canvas 能正确渲染
    isLoading.value = false
    isDocReady.value = true
    await nextTick()  // 等待 canvas 元素渲染到 DOM

    // Check if there's a pending page to navigate to
    if (pendingPage.value !== null && pendingPage.value >= 1 && pendingPage.value <= totalPages.value) {
      currentPage.value = pendingPage.value
      pendingPage.value = null
    }

    await renderPage()
    
    await Promise.all([
      loadOutline(),
      loadThumbnails()
    ])
  } catch (error) {
    console.error('Failed to load PDF:', error)
    loadError.value = error instanceof Error ? error.message : '加载 PDF 失败'
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
    
    const baseViewport = page.getViewport({ scale: 1 })
    const rotation = (baseViewport.rotation + mainRotation.value) % 360
    const renderViewport = page.getViewport({ scale: renderScale, rotation })
    const cssViewport = page.getViewport({ scale: outputScale, rotation })
    
    // Set canvas dimensions first (these get truncated to integers)
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height

    // Derive CSS dimensions from actual canvas dimensions to ensure exact dpr ratio
    // This prevents blur caused by fractional pixel mismatch
    canvasWidth.value = canvas.width / devicePixelRatio.value
    canvasHeight.value = canvas.height / devicePixelRatio.value
    
    await nextTick()
    
    const renderContext = {
      canvasContext: context,
      viewport: renderViewport
    }
    
    await page.render(renderContext).promise
    console.log('Page rendered successfully')
    
    await renderTextLayer(page, cssViewport)
    
  } catch (error) {
    console.error('Failed to render page:', error)
  } finally {
    isRendering.value = false
  }
}

async function renderTextLayer(page: PDFPageProxy, viewport: any) {
  const textLayerDiv = textLayerRef.value
  if (!textLayerDiv) return
  
  textLayerDiv.innerHTML = ''
  
  try {
    const textLayerBuilder = new TextLayerBuilder({
      pdfPage: page
    })
    
    textLayerDiv.appendChild(textLayerBuilder.div)
    
    await textLayerBuilder.render(viewport)
    console.log('TextLayer rendered successfully')
  } catch (error) {
    console.error('Failed to render text layer:', error)
  }
}

function rotateClockwise() {
  mainRotation.value = (mainRotation.value + 90) % 360
}

function rotateCounterClockwise() {
  mainRotation.value = (mainRotation.value - 90 + 360) % 360
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
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

function handleEdgeNavClick(action: () => void) {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  isClickingEdgeButton = false
  action()
}

function handleEdgeNavMouseDown() {
  isClickingEdgeButton = true
}

function handleEdgeNavMouseUp() {
  isClickingEdgeButton = false
}

function handleEdgeNavMouseLeave() {
  isClickingEdgeButton = false
}

// 滚轮翻页相关状态
const wheelPageTurnCooldown = ref(false)
const WHEEL_PAGE_TURN_COOLDOWN_MS = 300

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey) {
    e.preventDefault()
    if (e.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
    return
  }

  // 滚轮翻页逻辑：当滚动到顶部或底部后继续滚动触发翻页
  if (!contentRef.value || wheelPageTurnCooldown.value) return

  const element = contentRef.value
  const { scrollTop, scrollHeight, clientHeight } = element
  const isAtTop = scrollTop <= 0
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1

  // 向上滚动（deltaY < 0）且在顶部 -> 翻到上一页，滚动到底部
  if (e.deltaY < 0 && isAtTop && currentPage.value > 1) {
    e.preventDefault()
    wheelPageTurnCooldown.value = true
    prevPage()
    // 翻页后滚动到底部
    nextTick(() => {
      if (contentRef.value) {
        contentRef.value.scrollTop = contentRef.value.scrollHeight
      }
    })
    setTimeout(() => {
      wheelPageTurnCooldown.value = false
    }, WHEEL_PAGE_TURN_COOLDOWN_MS)
  }
  // 向下滚动（deltaY > 0）且在底部 -> 翻到下一页，滚动到顶部
  else if (e.deltaY > 0 && isAtBottom && currentPage.value < totalPages.value) {
    e.preventDefault()
    wheelPageTurnCooldown.value = true
    nextPage()
    // 翻页后滚动到顶部
    nextTick(() => {
      if (contentRef.value) {
        contentRef.value.scrollTop = 0
      }
    })
    setTimeout(() => {
      wheelPageTurnCooldown.value = false
    }, WHEEL_PAGE_TURN_COOLDOWN_MS)
  }
}

function handleContainerMouseMove(e: MouseEvent) {
  if (!containerRef.value) return
  
  const rect = containerRef.value.getBoundingClientRect()
  const edgeZone = 60
  const x = e.clientX - rect.left
  
  if (x < edgeZone) {
    showLeftNav.value = true
    showRightNav.value = false
  } else if (x > rect.width - edgeZone) {
    showLeftNav.value = false
    showRightNav.value = true
  } else {
    showLeftNav.value = false
    showRightNav.value = false
  }
}

function hideEdgeButtons() {
  showLeftNav.value = false
  showRightNav.value = false
}

function handleDoubleClick(e: MouseEvent) {
  if (e.button !== 0) return

  const target = e.target as HTMLElement
  if (target.closest('.edge-nav-btn')) return
  
  if (!containerRef.value) return
  const containerRect = containerRef.value.getBoundingClientRect()
  const clientX = e.clientX - containerRect.left
  if (clientX < EDGE_ZONE_WIDTH || clientX > containerRect.width - EDGE_ZONE_WIDTH) return
  
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
  if (isClickingEdgeButton) return
  if (showLeftNav.value || showRightNav.value) return
  
  const dx = currentMousePos.x - mouseDownPos.x
  const dy = currentMousePos.y - mouseDownPos.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance > MOVE_THRESHOLD) return
  
  const container = pageContainerRef.value
  if (!container) return
  
  const rect = container.getBoundingClientRect()
  const x = (currentMousePos.x - rect.left) / scale.value
  const y = (currentMousePos.y - rect.top) / scale.value
  
  recordingPosition.value = { x: currentMousePos.x, y: currentMousePos.y }
  recordingPagePos.value = { x, y }
  recordingDuration.value = 0
  
  isStartingRecording = true
  
  try {
    currentRecorder = createAudioWorkletRecorder()
    await currentRecorder.start()
    
    if (!isStartingRecording) {
      currentRecorder.stop().catch(() => {})
      currentRecorder = null
      return
    }
    
    const dx2 = currentMousePos.x - mouseDownPos.x
    const dy2 = currentMousePos.y - mouseDownPos.y
    if (Math.sqrt(dx2 * dx2 + dy2 * dy2) > MOVE_THRESHOLD) {
      currentRecorder.stop().catch(() => {})
      currentRecorder = null
      isStartingRecording = false
      return
    }
    
    isRecording.value = true
    isStartingRecording = false
    
    recordingTimer = window.setInterval(() => {
      recordingDuration.value += 100
    }, 100)
  } catch (error) {
    console.error('Failed to start recording:', error)
    currentRecorder = null
    isStartingRecording = false
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
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  
  if (currentRecorder) {
    currentRecorder.stop().catch(() => {})
    currentRecorder = null
  }
  
  isRecording.value = false
  isStartingRecording = false
}

function handleMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  if (isRecording.value) return
  
  const target = e.target as HTMLElement
  if (target.closest('.edge-nav-btn')) return
  
  if (!containerRef.value) return
  const containerRect = containerRef.value.getBoundingClientRect()
  const x = e.clientX - containerRect.left
  if (x < EDGE_ZONE_WIDTH || x > containerRect.width - EDGE_ZONE_WIDTH) return
  
  mouseDownOnTextLayer = !!target.closest('.textLayer')
  mouseDownPos = { x: e.clientX, y: e.clientY }
  currentMousePos = { x: e.clientX, y: e.clientY }
  
  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('mouseup', handleDocumentMouseUp)
  
  longPressTimer = window.setTimeout(() => {
    longPressTimer = null
    startRecording(e)
  }, LONG_PRESS_DURATION)
}

function handleDocumentMouseMove(e: MouseEvent) {
  currentMousePos = { x: e.clientX, y: e.clientY }
  
  if (!longPressTimer && !isRecording.value && !isStartingRecording) return
  
  const dx = e.clientX - mouseDownPos.x
  const dy = e.clientY - mouseDownPos.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  if (distance > MOVE_THRESHOLD) {
    if (isRecording.value) {
      cancelRecording()
      cleanupDocumentListeners()
      return
    }
    if (isStartingRecording) {
      isStartingRecording = false
      cleanupDocumentListeners()
      return
    }
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
      cleanupDocumentListeners()
    }
    return
  }
  
  if (isRecording.value) {
    recordingPosition.value = { x: e.clientX, y: e.clientY }
  }
}

function handleDocumentMouseUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  
  if (isStartingRecording) {
    isStartingRecording = false
  }
  
  if (isRecording.value) {
    stopRecording()
  }
  
  mouseDownOnTextLayer = false
  cleanupDocumentListeners()
}

function cleanupDocumentListeners() {
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mouseup', handleDocumentMouseUp)
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

watch(mainRotation, async () => {
  await nextTick()
  renderPage()
})

watch(sidebarVisible, async (visible) => {
  if (visible && pdfDocInstance && sidebarTab.value === 'thumbnails') {
    await nextTick()
    await loadThumbnails()
  }
})

watch(sidebarTab, async (tab) => {
  if (tab === 'thumbnails' && sidebarVisible.value && pdfDocInstance) {
    await nextTick()
    await loadThumbnails()
  }
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
  cleanupDocumentListeners()
  if (contentRef.value) {
    contentRef.value.removeEventListener('wheel', handleWheel)
  }
  window.removeEventListener('resize', handleResize)
})

defineExpose({
  goToPage,
  prevPage,
  nextPage,
  rotateClockwise,
  rotateCounterClockwise,
  exportPageAsImage
})

// ==================== 右键菜单和图片导出功能 ====================

/**
 * 获取当前选中的文字
 */
function getSelectedText(): string {
  const selection = window.getSelection()
  return selection ? selection.toString().trim() : ''
}

/**
 * 导出当前页面为 base64 图片
 */
async function exportPageAsImage(maxWidth: number = 1200): Promise<string> {
  if (!pdfDocInstance || !currentPage.value) {
    throw new Error('PDF not loaded')
  }

  try {
    const page = await pdfDocInstance.getPage(currentPage.value)
    const viewport = page.getViewport({ scale: 1 })
    const outputScale = maxWidth / viewport.width
    const scaledViewport = page.getViewport({ scale: outputScale })

    // 创建临时 canvas
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = scaledViewport.width
    tempCanvas.height = scaledViewport.height
    const context = tempCanvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get canvas context')
    }

    // 渲染页面到 canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise

    // 转换为 base64
    const base64 = tempCanvas.toDataURL('image/png')
    return base64
  } catch (error) {
    console.error('Failed to export page as image:', error)
    throw error
  }
}

/**
 * 处理右键菜单
 */
function handleContextMenu(e: MouseEvent) {
  // 检查是否点击在 PDF 页面区域内
  if (!pageContainerRef.value?.contains(e.target as Node)) {
    return
  }

  // 获取选中的文字
  selectedText.value = getSelectedText()

  // 设置菜单位置
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) {
    contextMenuPosition.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // 计算点击位置相对于 PDF 页面的坐标
  const pageRect = pageContainerRef.value.getBoundingClientRect()
  contextMenuPagePosition.value = {
    x: (e.clientX - pageRect.left) / scale.value,
    y: (e.clientY - pageRect.top) / scale.value
  }

  contextMenuVisible.value = true

  // 点击其他地方关闭菜单
  document.addEventListener('click', closeContextMenu, { once: true })
}

/**
 * 关闭右键菜单
 */
function closeContextMenu() {
  contextMenuVisible.value = false
}

/**
 * 处理"解释选中内容"
 */
async function handleExplainSelection() {
  contextMenuVisible.value = false

  if (!selectedText.value) return

  try {
    const imageBase64 = await exportPageAsImage()
    emit('explain-selection', {
      imageBase64,
      selectedText: selectedText.value,
      pageNumber: currentPage.value,
      position: { ...contextMenuPagePosition.value }
    })
    selectedText.value = ''
  } catch (error) {
    console.error('Failed to explain selection:', error)
  }
}

/**
 * 处理"分析当前页面"
 */
async function handleAnalyzePage() {
  contextMenuVisible.value = false

  try {
    const imageBase64 = await exportPageAsImage()
    emit('analyze-page', {
      imageBase64,
      pageNumber: currentPage.value,
      position: { ...contextMenuPagePosition.value }
    })
  } catch (error) {
    console.error('Failed to analyze page:', error)
  }
}

/**
 * 处理"附图"勾选框变化
 */
async function handleIncludePageChange() {
  if (includePageAsContext.value) {
    try {
      const imageBase64 = await exportPageAsImage()
      emit('include-page-change', {
        include: true,
        imageBase64,
        pageNumber: currentPage.value
      })
    } catch (error) {
      console.error('Failed to export page as image:', error)
      includePageAsContext.value = false
    }
  } else {
    emit('include-page-change', {
      include: false,
      pageNumber: currentPage.value
    })
  }
}
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

.pdf-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.pdf-sidebar {
  display: flex;
  width: 280px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  transition: width 0.2s;
}

.pdf-sidebar.collapsed {
  width: 40px;
}

.sidebar-tabs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 4px;
  background: var(--bg-secondary);
}

.sidebar-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-tab:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.sidebar-tab.active {
  background: var(--primary-color);
  color: white;
}

.sidebar-content {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.sidebar-loading,
.sidebar-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--text-secondary);
  font-size: 14px;
}

.sidebar-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 14px;
  z-index: 10;
}

.outline-container {
  font-size: 13px;
}

.thumbnails-container {
  position: relative;
  min-height: 100px;
}

.thumbnails-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.thumbnail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.thumbnail-item:hover {
  background: var(--bg-secondary);
}

.thumbnail-item.current {
  background: var(--primary-color);
}

.thumbnail-item.current .thumbnail-label {
  color: white;
}

.thumbnail-canvas {
  max-width: 100%;
  max-height: 160px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: block;
  background: white;
}

.thumbnail-label {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
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

.tool-btn.active {
  background: var(--primary-color);
  color: white;
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
  color: var(--color-error);
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
  z-index: 3;
}

.node-marker {
  position: absolute;
  padding: 4px 8px;
  border-radius: 12px;
  background: var(--color-primary);
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
  background: var(--color-primary-dark);
  box-shadow: 0 0 0 0.2em rgba(66, 153, 225, 0.4);
}

.node-marker.dragging {
  opacity: 0.8;
  cursor: grabbing;
  z-index: 100;
  transform: scale(1.15);
}

.node-marker.context-selected {
  box-shadow: 0 0 0 2px var(--color-success), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.node-marker.voice-note {
  background: var(--color-error);
}

.node-marker.voice-note.selected {
  background: var(--color-error-hover);
}

.edge-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 100;
}

.edge-nav-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: translateY(-50%) scale(1.1);
}

.edge-nav-btn.left {
  left: 20px;
}

.edge-nav-btn.right {
  right: 20px;
}

/* 右键菜单样式 */
.context-menu {
  position: absolute;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 4px 0;
  min-width: 160px;
  z-index: 1000;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s;
  font-size: 14px;
}

.context-menu-item:hover {
  background: var(--bg-secondary);
}

.context-menu-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

/* 附图勾选框样式 */
.include-page-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  user-select: none;
}

.include-page-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--primary-color);
}

.include-page-checkbox:hover {
  color: var(--text-primary);
}
</style>
