<template>
  <div class="title-bar" :class="{ maximized: isMaximized }">
    <div class="title-bar-drag" @dblclick="handleDoubleClick">
      <img :src="iconPath" class="app-icon" alt="OneHand" />
    </div>
    <div class="window-controls">
      <button class="control-btn minimize" @click="minimize" :title="t('common.minimize')">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M1 6h10" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
      <button class="control-btn maximize" @click="maximize" :title="isMaximized ? t('common.restore') : t('common.maximize')">
        <svg v-if="isMaximized" viewBox="0 0 14 14" width="14" height="14">
          <!-- 恢复图标：两个窗口叠加 -->
          <polyline points="4.5,1 13,1 13,9.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
          <polygon points="1,4.5 1,13 8.5,13 8.5,4.5" stroke="currentColor" stroke-width="1.5" fill="var(--bg-secondary)"/>
        </svg>
        <svg v-else viewBox="0 0 14 14" width="14" height="14">
          <rect x="1.5" y="1.5" width="11" height="11" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
      <button class="control-btn close" @click="close" :title="t('common.close')">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M1 1l10 10M11 1l-10 10" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const isMaximized = ref(false)

// 图标路径 - 使用Electron原生图标或打包后的图标
const iconPath = ref('')

// 初始化图标和最大化状态
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

  // 监听窗口大小变化
  window.addEventListener('resize', checkMaximized)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMaximized)
})

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
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  z-index: 9999;
  user-select: none;
}

.title-bar.maximized {
  border-bottom: none;
}

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
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.app-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.window-controls {
  display: flex;
  align-items: stretch;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  transition: background-color 0.15s;
}

.control-btn:hover {
  background: var(--bg-hover);
}

.control-btn.close:hover {
  background: #e81123;
  color: white;
}

:root.dark .control-btn.close:hover {
  background: #e81123;
  color: white;
}
</style>