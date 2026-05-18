<template>
  <div class="title-bar" :class="{ maximized: isMaximized, inactive: isInactive, light: isLight, 'wco-enabled': isWCOEnabled }">
    <!-- 窗口拖拽区域 -->
    <div class="title-bar-drag" @dblclick="handleDoubleClick">
      <img :src="iconPath" class="app-icon" alt="OneHand" />
    </div>
    <!-- 窗口控制按钮容器 - 仅在 WCO 未启用时显示自定义按钮 -->
    <!-- 当 WCO 启用时，系统会自动绘制控制按钮，包括 Snap Layout 选择器 -->
    <div v-if="!isWCOEnabled" class="window-controls-container">
      <!-- 最小化按钮 -->
      <button class="window-icon window-minimize" @click="minimize" :title="t('common.minimize')">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M3 8h10v1H3z"/>
        </svg>
      </button>
      <!-- 最大化/恢复按钮 -->
      <button
        class="window-icon window-max-restore"
        @click="maximize"
        :title="isMaximized ? t('common.restore') : t('common.maximize')"
      >
        <!-- 最大化图标 -->
        <svg v-if="!isMaximized" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M3 3v10h10V3H3zm1 1h8v8H4V4z"/>
        </svg>
        <!-- 恢复图标 - 两个叠加的窗口 -->
        <svg v-else viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M5 5v10h10V5H5zm1 1h8v8H6V6z"/>
          <path d="M3 3v10h2V5h8V3H3z" fill="var(--bg-secondary)"/>
          <path d="M3 3h10v2H5v8H3V3z" fill="currentColor"/>
        </svg>
      </button>
      <!-- 关闭按钮 -->
      <button class="window-icon window-close" @click="close" :title="t('common.close')">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M8 8.707l3.536-3.536.707.707L8.707 9.414l3.536 3.536-.707.707L8 10.121l-3.536 3.536-.707-.707L7.293 9.414 3.757 5.878l.707-.707L8 8.707z"/>
        </svg>
      </button>
    </div>
    <!-- WCO 启用时：预留系统控制按钮的空间 -->
    <div v-else class="window-controls-container wco-placeholder"></div>
    <!-- 窗口调整大小区域（仅未最大化时显示） -->
    <div v-if="!isMaximized" class="title-bar-resizer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const isMaximized = ref(false)
const iconPath = ref('')
const isInactive = ref(false)
const isWCOEnabled = ref(false)

// 判断是否为浅色主题
const isLight = computed(() => {
  const theme = settingsStore.settings.general.theme
  if (theme === 'system') {
    // 系统主题：检查 CSS 变量或 document 类
    return !document.documentElement.classList.contains('dark')
  }
  return theme === 'light'
})

// 检测 Window Controls Overlay 是否启用
// 参考 VSCode: navigator.windowControlsOverlay?.visible
function checkWCOEnabled() {
  const nav = navigator as Navigator & {
    windowControlsOverlay?: { visible: boolean }
  }
  isWCOEnabled.value = nav.windowControlsOverlay?.visible ?? false
}

onMounted(async () => {
  // 获取图标 DataURL
  try {
    if (window.electronAPI.getIconDataUrl) {
      const dataUrl = await window.electronAPI.getIconDataUrl()
      if (dataUrl) {
        iconPath.value = dataUrl
      }
    }
  } catch {
    // 忽略错误
  }

  // 获取初始最大化状态
  try {
    isMaximized.value = await window.electronAPI.windowIsMaximized()
  } catch {
    // 如果API不存在，保持默认状态
  }

  // 检测 WCO 是否启用
  checkWCOEnabled()

  // 监听窗口大小变化和焦点变化
  window.addEventListener('resize', checkMaximized)
  window.addEventListener('blur', handleBlur)
  window.addEventListener('focus', handleFocus)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMaximized)
  window.removeEventListener('blur', handleBlur)
  window.removeEventListener('focus', handleFocus)
})

function handleBlur() {
  isInactive.value = true
}

function handleFocus() {
  isInactive.value = false
}

async function checkMaximized() {
  try {
    isMaximized.value = await window.electronAPI.windowIsMaximized()
  } catch {
    // 忽略错误
  }
}

async function minimize() {
  try {
    await window.electronAPI.windowMinimize()
  } catch {
    // 忽略错误
  }
}

async function maximize() {
  try {
    await window.electronAPI.windowMaximize()
    isMaximized.value = await window.electronAPI.windowIsMaximized()
  } catch {
    // 忽略错误
  }
}

async function close() {
  try {
    await window.electronAPI.windowClose()
  } catch {
    // 忽略错误
  }
}

async function handleDoubleClick() {
  await maximize()
}
</script>

<style scoped>
/* 标题栏容器 - 参考 VSCode part.titlebar */
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  z-index: 9999;
  user-select: none;
  -webkit-user-select: none;
  box-shadow: var(--shadow-color);
}

.title-bar.maximized {
  border-bottom: none;
}

/* 窗口非活动状态 - 参考 VSCode titlebar.inactive */
.title-bar.inactive > * {
  opacity: 0.6;
}

/* 窗口拖拽区域 */
.title-bar-drag {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 100%;
  flex: 1;
  -webkit-app-region: drag;
}

.app-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

/* 窗口控制按钮容器 - 参考 VSCode window-controls-container */
.window-controls-container {
  display: flex;
  flex-grow: 0;
  flex-shrink: 0;
  text-align: center;
  z-index: 3000;
  -webkit-app-region: no-drag;
  height: 100%;
}

/* WCO 启用时的占位容器 - 参考 VSCode CSS
   使用 CSS env() 函数获取系统控制按钮的位置 */
.window-controls-container.wco-placeholder {
  /* Windows/Linux Desktop: 使用固定宽度预留空间 */
  width: 138px;
}

/* WCO 启用时，使用 env() 获取实际区域大小 */
.title-bar.wco-enabled .window-controls-container.wco-placeholder {
  width: calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px));
  height: env(titlebar-area-height, 32px);
}

/* 窗口控制按钮图标 - 参考 VSCode window-icon */
.window-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 46px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  padding: 0;
}

/* 非活动状态按钮颜色 */
.title-bar.inactive .window-icon {
  color: var(--text-secondary);
}

/* Hover 效果 - 参考 VSCode (深色主题使用白色半透明) */
.window-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* 浅色主题 Hover 效果 - 参考 VSCode (浅色主题使用黑色半透明) */
.title-bar.light .window-icon:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

/* 关闭按钮特殊 Hover 效果 - 参考 VSCode 红色背景 rgba(232, 17, 35, 0.9) */
.window-icon.window-close:hover {
  background-color: rgba(232, 17, 35, 0.9);
  color: white;
}

/* 窗口调整大小区域 - 参考 VSCode resizer */
.title-bar-resizer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  -webkit-app-region: no-drag;
  cursor: n-resize;
}
</style>