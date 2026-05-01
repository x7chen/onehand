<template>
  <div class="particle-view-panel" ref="containerRef">
    <canvas ref="canvasRef"></canvas>
    <!-- 返回按钮 -->
    <button class="back-btn" @click="handleBack" :title="t('common.back')">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </button>
    <!-- 速度调节滑块 -->
    <div class="speed-control" v-if="initialized">
      <label>{{ t('particle.speed') }}</label>
      <input
        type="range"
        min="0.01"
        max="0.3"
        step="0.01"
        v-model="speedValue"
        @input="updateSpeed"
      />
      <span>{{ speedLabel }}</span>
    </div>
    <!-- 提示信息 -->
    <div class="hint-overlay" v-if="initialized && nodes.length > 0">
      <span>{{ t('canvas.particleView') }} - {{ nodes.length }} {{ t('notebook.notes') }}</span>
      <span class="scroll-hint">{{ t('particle.scrollHint') }}</span>
    </div>
    <!-- 空状态提示 -->
    <div class="empty-hint" v-else-if="initialized && nodes.length === 0">
      <span>{{ t('common.noData') }}</span>
    </div>
    <!-- 加载状态 -->
    <div class="loading-hint" v-else>
      <span>{{ t('common.loading') }}</span>
    </div>
    <!-- NodePopup 弹窗 -->
    <NodePopup
      :visible="showNodePopup"
      :url="nodePopupUrl"
      @close="closeNodePopup"
      @navigate="handleNavigate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNotebookStore } from '@/stores/notebookStore'
import * as THREE from 'three'
import type { CanvasNode } from '@/types/notebook'
import NodePopup from '@/components/NodePopup.vue'
import { generateDeepLinkUrl } from '@/composables/useDeepLink'

const { t } = useI18n()
const notebookStore = useNotebookStore()

const props = defineProps<{
  notebookId: string
}>()

const emit = defineEmits<{
  'switch-to-chat': []
  'select-node': [nodeId: string]
  'navigate': [data: { notebookId: string; nodeId: string }]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const initialized = ref(false)

// NodePopup 状态
const showNodePopup = ref(false)
const nodePopupUrl = ref('')
const selectedNodeId = ref('')

// 获取笔记本节点
const notebook = computed(() => notebookStore.notebooks.find(n => n.id === props.notebookId))
const nodes = computed(() => notebook.value?.nodes || [])

// Three.js 相关
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let cardMeshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = []
let animationId: number | null = null
let lastInteractionTime: number = Date.now()
let isUserInteracting: boolean = false
let autoScrollSpeed: number = 0.1 // 默认速度降低
const AUTO_SCROLL_DELAY = 2000

// 创建卡片网格（只渲染30个，动态循环）
const MAX_VISIBLE_CARDS = 30
let allNodesList: CanvasNode[] = [] // 所有笔记列表
let currentNodeIndex = 0 // 当前渲染到的笔记索引
let cardPool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [] // 卡片池（复用）

// 速度控制（响应式）
const speedValue = ref('0.1')
const speedLabel = computed(() => {
  const val = parseFloat(speedValue.value)
  if (val < 0.1) return t('particle.slow')
  if (val < 0.2) return t('particle.medium')
  return t('particle.fast')
})

// 更新速度
const updateSpeed = () => {
  autoScrollSpeed = parseFloat(speedValue.value)
}

// 卡片文字颜色数组（绚丽多彩）
const CARD_COLORS = [
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#FFE66D', // 黄色
  '#95E1D3', // 绿色
  '#F38181', // 粉色
  '#AA96DA', // 紫色
  '#FCBAD3', // 淡粉
  '#A8D8EA', // 天蓝
  '#FF9F43', // 橙色
  '#6C5CE7', // 深紫
  '#00D2D3', // 青蓝
  '#FF6B81', // 玫红
]

// 根据笔记获取颜色
const getCardColor = (index: number): string => {
  return CARD_COLORS[index % CARD_COLORS.length]
}

// 主题颜色
const getThemeColors = () => {
  const style = getComputedStyle(document.documentElement)
  return {
    bgPrimary: style.getPropertyValue('--bg-primary').trim() || '#1a1a1a',
    bgCard: style.getPropertyValue('--bg-tertiary').trim() || '#2d2d2d',
    textPrimary: style.getPropertyValue('--text-primary').trim() || '#ffffff',
    textSecondary: style.getPropertyValue('--text-secondary').trim() || '#888888',
    colorPrimary: style.getPropertyValue('--color-primary').trim() || '#3b82f6',
    borderColor: style.getPropertyValue('--border-color').trim() || '#404040',
  }
}

// 绘制圆角矩形
const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// 简化 Markdown 文本（去除复杂格式，保留基本结构）
const simplifyMarkdown = (text: string): string => {
  let result = text
  // 移除代码块标记，保留内容
  result = result.replace(/```[\w]*\n([\s\S]*?)```/g, '\n$1\n')
  // 移除行内代码标记
  result = result.replace(/`([^`]+)`/g, '$1')
  // 移除链接，保留文本
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // 移除图片
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
  // 移除标题标记
  result = result.replace(/^#+\s+/gm, '')
  // 移除粗体/斜体标记
  result = result.replace(/[*_]+([^*_]+)[*_]+/g, '$1')
  // 移除列表标记，保留内容
  result = result.replace(/^[\s]*[-*+]\s+/gm, '  ')
  result = result.replace(/^[\s]*\d+\.\s+/gm, '  ')
  return result
}

// 创建卡片纹理（清晰版和模糊版）- Canvas 绘制
const createCardTextures = (node: CanvasNode, colorIndex: number): { clear: THREE.CanvasTexture, blurred: THREE.CanvasTexture, actualHeight: number } => {
  const content = node.transcript || ''

  // 简化 Markdown 内容，只使用转写内容
  const displayContent = simplifyMarkdown(content).trim() || '无内容'

  // 卡片显示尺寸
  const displayWidth = 500
  const lineHeight = 24
  const padding = 24
  const maxWidth = displayWidth - padding * 2

  // 高分辨率canvas（2倍）
  const scale = 2
  const cardColor = getCardColor(colorIndex)

  // 创建足够大的canvas来绘制内容
  const clearCanvas = document.createElement('canvas')
  const clearCtx = clearCanvas.getContext('2d')!
  clearCanvas.width = displayWidth * scale
  clearCanvas.height = 1000 * scale // 足够大的高度
  clearCtx.scale(scale, scale)

  clearCtx.fillStyle = cardColor
  clearCtx.font = '18px Arial, sans-serif'
  clearCtx.textBaseline = 'top'

  const chars = displayContent.split('')
  let line = ''
  let y = padding

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    if (char === '\n') {
      if (line.trim()) {
        clearCtx.fillText(line, padding, y)
      }
      line = ''
      y += lineHeight
    } else {
      line += char
      if (clearCtx.measureText(line).width > maxWidth) {
        clearCtx.fillText(line, padding, y)
        line = ''
        y += lineHeight
      }
    }
  }
  if (line.trim()) {
    clearCtx.fillText(line, padding, y)
    y += lineHeight
  }

  // 计算实际高度，确保最小高度
  const actualHeight = Math.max(y + padding, 50)

  // 创建模糊纹理
  const blurredCanvas = document.createElement('canvas')
  const blurredCtx = blurredCanvas.getContext('2d')!
  blurredCanvas.width = displayWidth * scale
  blurredCanvas.height = actualHeight * scale
  blurredCtx.filter = `blur(${scale * 2}px)`
  blurredCtx.drawImage(clearCanvas, 0, 0, displayWidth * scale, actualHeight * scale, 0, 0, displayWidth * scale, actualHeight * scale)
  blurredCtx.filter = 'none'

  // 调整清晰纹理canvas高度为实际高度
  const finalClearCanvas = document.createElement('canvas')
  const finalClearCtx = finalClearCanvas.getContext('2d')!
  finalClearCanvas.width = displayWidth * scale
  finalClearCanvas.height = actualHeight * scale
  finalClearCtx.drawImage(clearCanvas, 0, 0, displayWidth * scale, actualHeight * scale, 0, 0, displayWidth * scale, actualHeight * scale)

  const clearTexture = new THREE.CanvasTexture(finalClearCanvas)
  clearTexture.minFilter = THREE.LinearFilter
  clearTexture.magFilter = THREE.LinearFilter
  clearTexture.needsUpdate = true

  const blurredTexture = new THREE.CanvasTexture(blurredCanvas)
  blurredTexture.minFilter = THREE.LinearFilter
  blurredTexture.magFilter = THREE.LinearFilter
  blurredTexture.needsUpdate = true

  return { clear: clearTexture, blurred: blurredTexture, actualHeight }
}

// 初始化场景
const initScene = (): boolean => {
  const container = containerRef.value
  const canvas = canvasRef.value

  if (!container || !canvas) {
    console.log('ParticleView: container or canvas not found')
    return false
  }

  const width = container.clientWidth
  const height = container.clientHeight

  if (width <= 0 || height <= 0) {
    console.log('ParticleView: container size is zero', width, height)
    return false
  }

  console.log('ParticleView: initializing with size', width, height)

  try {
    // 创建场景
    scene = new THREE.Scene()
    const colors = getThemeColors()
    scene.background = new THREE.Color(colors.bgPrimary)

    // 创建相机
    camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000)
    camera.position.z = 30

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // 创建卡片
    createCards()

    // 启动动画
    startAnimation()

    initialized.value = true
    console.log('ParticleView: initialized successfully')
    return true
  } catch (error) {
    console.error('ParticleView: initialization error', error)
    return false
  }
}

// 初始化笔记列表和卡片池
const createCards = () => {
  if (!scene || !camera) return

  // 清除旧卡片池
  cardPool.forEach(mesh => {
    scene!.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
    if (mesh.userData.clearTexture) mesh.userData.clearTexture.dispose()
    if (mesh.userData.blurredTexture) mesh.userData.blurredTexture.dispose()
  })
  cardPool = []
  cardMeshes = []

  allNodesList = nodes.value.filter(n => n.transcript && n.transcript.trim())
  currentNodeIndex = 0

  console.log('ParticleView: total nodes', allNodesList.length, 'rendering', MAX_VISIBLE_CARDS)

  if (allNodesList.length === 0) {
    camera.position.z = 0
    return
  }

  // 只创建30个卡片
  const cardsToCreate = Math.min(MAX_VISIBLE_CARDS, allNodesList.length)

  for (let i = 0; i < cardsToCreate; i++) {
    const nodeIndex = currentNodeIndex + i
    if (nodeIndex >= allNodesList.length) break

    const node = allNodesList[nodeIndex]
    const mesh = createCardMesh(node, nodeIndex)

    // 分布位置（从远处到近处）
    const layer = Math.floor(i / 8)
    const zBase = -80 - layer * 60 - Math.random() * 30

    mesh.position.x = (Math.random() - 0.5) * 10
    mesh.position.y = (Math.random() - 0.5) * 20
    mesh.position.z = zBase

    mesh.userData.originalZ = zBase
    mesh.userData.nodeIndex = nodeIndex // 记录当前显示的笔记索引

    scene!.add(mesh)
    cardPool.push(mesh)
    cardMeshes.push(mesh)
  }

  currentNodeIndex = cardsToCreate // 下一个待渲染的笔记索引

  // 相机固定在z=0位置
  camera.position.z = 0
}

// 创建单个卡片mesh
const createCardMesh = (node: CanvasNode, nodeIndex: number): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> => {
  const textures = createCardTextures(node, nodeIndex)
  const textureWidth = textures.clear.image.width
  const textureHeight = textures.clear.image.height
  const aspectRatio = textureHeight / textureWidth

  const cardWidth = 14
  const cardHeight = cardWidth * aspectRatio

  const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight)
  const material = new THREE.MeshBasicMaterial({
    map: textures.clear,
    transparent: true,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.nodeId = node.id
  mesh.userData.clearTexture = textures.clear
  mesh.userData.blurredTexture = textures.blurred


  return mesh
}

// 更新卡片纹理（当卡片循环时）
const updateCardTexture = (mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>, nodeIndex: number) => {
  if (nodeIndex >= allNodesList.length) {
    // 循环回第一个笔记
    nodeIndex = 0
  }

  const node = allNodesList[nodeIndex]

  // 释放旧纹理
  if (mesh.userData.clearTexture) mesh.userData.clearTexture.dispose()
  if (mesh.userData.blurredTexture) mesh.userData.blurredTexture.dispose()

  // 创建新纹理
  const textures = createCardTextures(node, nodeIndex)
  mesh.userData.clearTexture = textures.clear
  mesh.userData.blurredTexture = textures.blurred
  mesh.userData.nodeId = node.id
  mesh.userData.nodeIndex = nodeIndex
  mesh.material.map = textures.clear
  mesh.material.needsUpdate = true

  // 更新几何体尺寸以匹配新的纹理宽高比
  const textureWidth = textures.clear.image.width
  const textureHeight = textures.clear.image.height
  const aspectRatio = textureHeight / textureWidth
  const cardWidth = 14
  const cardHeight = cardWidth * aspectRatio
  mesh.geometry.dispose()
  mesh.geometry = new THREE.PlaneGeometry(cardWidth, cardHeight)

  // 新的随机位置
  mesh.position.x = (Math.random() - 0.5) * 10
  mesh.position.y = (Math.random() - 0.5) * 20

  return nodeIndex + 1 // 返回下一个索引
}

// 启动动画
const startAnimation = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  const animateLoop = () => {
    if (!scene || !camera || !renderer) return

    animationId = requestAnimationFrame(animateLoop)

    // 检查 WebGL 上下文是否有效
    const gl = renderer!.getContext()
    if (!gl || gl.isContextLost()) {
      console.warn('ParticleView: WebGL context lost')
      return
    }

    const now = Date.now()
    // 自动滚动：只在用户不交互时添加速度
    if (now - lastInteractionTime > AUTO_SCROLL_DELAY && !isUserInteracting) {
      cardMeshes.forEach(mesh => {
        mesh.position.z += autoScrollSpeed
      })
    }

    // 检测卡片是否超过相机位置，产生新卡片（始终执行）
    cardMeshes.forEach(mesh => {
      if (mesh.position.z > -10) {
        // 更新纹理为下一个笔记
        currentNodeIndex = updateCardTexture(mesh, currentNodeIndex)
        // 放到远处重新飞来
        const newLayer = Math.floor(cardMeshes.indexOf(mesh) / 8)
        mesh.position.z = -80 - newLayer * 60 - Math.random() * 30
      }
    })

    // 检测遮挡关系并切换纹理（被遮挡的卡片使用模糊纹理）
    const cameraObj = camera!
    const rendererObj = renderer!
    const canvasWidth = rendererObj.domElement.width
    const canvasHeight = rendererObj.domElement.height

    // 按z距离排序（从近到远，z值大的在前）
    const sortedMeshes = [...cardMeshes].sort((a, b) => b.position.z - a.position.z)

    // 存储前面卡片的屏幕区域
    const occluderRegions: { x: number; y: number; w: number; h: number }[] = []

    sortedMeshes.forEach(mesh => {
      // 确保纹理存在
      if (!mesh.userData.clearTexture || !mesh.userData.blurredTexture) return

      // 将3D位置投影到屏幕坐标
      const pos = mesh.position.clone()
      pos.project(cameraObj)

      // 转换为屏幕坐标（-1到1范围转为像素）
      const screenX = (pos.x * 0.5 + 0.5) * canvasWidth
      const screenY = (-pos.y * 0.5 + 0.5) * canvasHeight

      // 计算卡片在屏幕上的尺寸
      const geometry = mesh.geometry as THREE.PlaneGeometry
      const cardWidth = geometry.parameters.width
      const cardHeight = geometry.parameters.height

      // 根据距离估算屏幕尺寸（简单的透视缩放）
      const distance = Math.abs(mesh.position.z - cameraObj.position.z)
      const fov = cameraObj.fov
      const screenHeight = 2 * distance * Math.tan((fov * 0.5) * Math.PI / 180)
      const scale = canvasHeight / screenHeight
      const screenW = cardWidth * scale
      const screenH = cardHeight * scale

      // 检查是否被前面的卡片遮挡
      let isOccluded = false
      const thisRegion = {
        x: screenX - screenW * 0.5,
        y: screenY - screenH * 0.5,
        w: screenW,
        h: screenH
      }

      for (const region of occluderRegions) {
        // 简单的矩形重叠检测
        if (
          thisRegion.x < region.x + region.w &&
          thisRegion.x + thisRegion.w > region.x &&
          thisRegion.y < region.y + region.h &&
          thisRegion.y + thisRegion.h > region.y
        ) {
          // 只要有任何重叠，就认为被遮挡
          isOccluded = true
          break
        }
      }

      // 根据遮挡状态切换纹理
      if (isOccluded) {
        mesh.material.map = mesh.userData.blurredTexture
        mesh.material.opacity = 0.45 // 被遮挡的卡片更透明模糊
      } else {
        mesh.material.map = mesh.userData.clearTexture
        mesh.material.opacity = 0.9 // 未遮挡的卡片清晰
      }
      mesh.material.needsUpdate = true

      // 将当前卡片加入遮挡区域列表（用于检测后面的卡片）
      occluderRegions.push(thisRegion)
    })

    // 只有在有卡片时才渲染
    if (cardMeshes.length > 0) {
      renderer.render(scene, camera)
    }
  }

  animateLoop()
}

// 处理滚轮事件
const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  lastInteractionTime = Date.now()
  isUserInteracting = true

  // 向下滚动后退（卡片z减小，远离），向上滚动前进（卡片z增大，靠近）
  const delta = event.deltaY * 0.03 // 降低滚轮速度
  cardMeshes.forEach(mesh => {
    mesh.position.z -= delta // 向下滚轮：z减小（后退）
  })

  setTimeout(() => {
    isUserInteracting = false
  }, AUTO_SCROLL_DELAY)
}

// 处理点击事件
const handleClick = (event: MouseEvent) => {
  if (!scene || !camera || !renderer) return

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )

  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObjects(cardMeshes)

  if (intersects.length > 0) {
    const mesh = intersects[0].object as THREE.Mesh
    const nodeId = mesh.userData.nodeId
    if (nodeId) {
      openNodePopup(nodeId)
    }
  }
}

// 打开 NodePopup
const openNodePopup = (nodeId: string) => {
  selectedNodeId.value = nodeId
  nodePopupUrl.value = generateDeepLinkUrl(nodeId)
  showNodePopup.value = true
}

// 关闭 NodePopup
const closeNodePopup = () => {
  showNodePopup.value = false
  nodePopupUrl.value = ''
  selectedNodeId.value = ''
}

// 处理 NodePopup 的跳转事件
const handleNavigate = (data: { notebookId: string; nodeId: string }) => {
  closeNodePopup()
  emit('navigate', data)
  emit('switch-to-chat')
}

// 处理窗口大小变化
const handleResize = () => {
  if (!containerRef.value || !camera || !renderer || !initialized.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  if (width <= 0 || height <= 0) return

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// 返回聊天视图
const handleBack = () => {
  emit('switch-to-chat')
}

// 尝试初始化（带重试）
const tryInit = (retries: number = 5) => {
  if (initScene()) return

  if (retries > 0) {
    setTimeout(() => tryInit(retries - 1), 200)
  }
}

// 监听节点变化
watch(nodes, () => {
  if (initialized.value && scene && camera) {
    createCards()
  }
}, { deep: true })

onMounted(() => {
  nextTick(() => {
    setTimeout(() => tryInit(5), 50)
  })

  containerRef.value?.addEventListener('wheel', handleWheel, { passive: false })
  canvasRef.value?.addEventListener('click', handleClick)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  containerRef.value?.removeEventListener('wheel', handleWheel)
  canvasRef.value?.removeEventListener('click', handleClick)
  window.removeEventListener('resize', handleResize)

  cardMeshes.forEach(mesh => {
    mesh.geometry.dispose()
    mesh.material.dispose()
  })
  cardMeshes = []

  if (renderer) {
    renderer.dispose()
    renderer = null
  }

  if (scene) {
    scene.clear()
    scene = null
  }

  camera = null
  initialized.value = false
})
</script>

<style scoped>
.particle-view-panel {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
}

.particle-view-panel canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.back-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 10;
}

.back-btn:hover {
  background: var(--bg-hover);
}

.speed-control {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  z-index: 10;
}

.speed-control label {
  color: var(--text-secondary);
}

.speed-control input[type="range"] {
  width: 80px;
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.speed-control input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
}

.speed-control span {
  min-width: 30px;
  text-align: center;
}

.hint-overlay {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  z-index: 10;
}

.scroll-hint {
  font-size: 10px;
  opacity: 0.8;
}

.empty-hint, .loading-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 16px 32px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  z-index: 10;
}
</style>