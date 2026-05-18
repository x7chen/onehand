<template>
  <div class="title-bar" :class="{ maximized: isMaximized, inactive: isInactive, light: isLight, 'wco-enabled': isWCOEnabled }">
    <!-- 左侧：应用图标 -->
    <div class="title-bar-left">
      <img :src="iconPath" class="app-icon" alt="OneHand" />
    </div>

    <!-- 中间：搜索输入框（功能待定） -->
    <div class="title-bar-center">
      <!-- 下拉激活时隐藏标题栏中的输入框 -->
      <div v-if="!dropdownStore.showDropdown" class="center-input-wrapper">
        <input
          ref="centerInputRef"
          v-model="centerInputText"
          class="center-input"
          type="text"
          :placeholder="centerPlaceholder"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          @keydown.escape="handleInputEscape"
        />
      </div>
      <!-- 下拉激活时显示占位区域，保持布局稳定 -->
      <div v-else class="center-input-placeholder"></div>
    </div>

    <!-- 右侧功能区：主题 + 窗口控制 -->
    <div class="title-bar-actions">
      <!-- 主题切换按钮 -->
      <button class="title-bar-btn theme-btn" @click="cycleTheme" :title="t('theme.currentTheme', { name: getThemeLabel() })">
        <svg v-if="getThemeIcon() === 'moon'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
        </svg>
        <svg v-else-if="getThemeIcon() === 'sun'" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h2v-4h4v-2h-4V7h-2v4H8v2h4v4z"/>
        </svg>
      </button>
    </div>

    <!-- 窗口控制按钮容器 -->
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
        <!-- 恢复图标 -->
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

    <!-- 搜索对话框 -->
    <SearchDialog :visible="showSearchDialog" @close="showSearchDialog = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDropdownStore } from '@/stores/dropdownStore'
import SearchDialog from '@/components/SearchDialog.vue'

const props = defineProps<{
  centerPlaceholder?: string
}>()

const emit = defineEmits<{
  'input-focus': []
  'input-blur': []
  'input-escape': []
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()
const dropdownStore = useDropdownStore()

const isMaximized = ref(false)
const iconPath = ref('')
const isInactive = ref(false)
const isWCOEnabled = ref(false)
const showSearchDialog = ref(false)
const centerInputRef = ref<HTMLInputElement | null>(null)
const centerInputText = ref('')

// 输入框 placeholder - 根据下拉状态动态变化
const centerPlaceholder = computed(() => {
  // 如果下拉框激活，显示下拉类型的标题
  if (dropdownStore.showDropdown && dropdownStore.dropdownType) {
    return dropdownStore.getPlaceholder(t)
  }
  // 否则显示默认的搜索placeholder
  return props.centerPlaceholder || t('common.search')
})

// 监听输入框文本变化，更新dropdownStore的filterText
watch(centerInputText, (text) => {
  if (dropdownStore.showDropdown) {
    dropdownStore.updateFilterText(text)
  }
})

// 监听下拉框状态，清空输入框
watch(() => dropdownStore.showDropdown, (show) => {
  if (!show) {
    // 下拉框关闭时清空输入框
    centerInputText.value = ''
  }
})

// 判断是否为浅色主题
const isLight = computed(() => {
  const theme = settingsStore.settings.general.theme
  if (theme === 'system') {
    return !document.documentElement.classList.contains('dark')
  }
  return theme === 'light'
})

// 当前主题
const currentTheme = computed(() => settingsStore.settings.general.theme)
const themeOrder: ('dark' | 'light' | 'system')[] = ['dark', 'light', 'system']

// 检测 Window Controls Overlay 是否启用
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

// 搜索
function handleSearch() {
  showSearchDialog.value = true
}

// 中间输入框事件
function handleInputFocus() {
  emit('input-focus')
  // 当下拉框激活时，保持焦点
}

function handleInputBlur() {
  emit('input-blur')
  // 下拉框关闭时清空输入
  if (!dropdownStore.showDropdown) {
    centerInputText.value = ''
  }
}

function handleInputEscape() {
  emit('input-escape')
  // ESC键关闭下拉框
  if (dropdownStore.showDropdown) {
    dropdownStore.closeDropdown()
    centerInputText.value = ''
  }
}

// 主题切换
async function cycleTheme() {
  const currentIndex = themeOrder.indexOf(currentTheme.value)
  const nextIndex = (currentIndex + 1) % themeOrder.length
  const nextTheme = themeOrder[nextIndex]

  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      theme: nextTheme
    }
  })

  // 更新 Electron 窗口主题
  const isDark = nextTheme === 'dark' || (nextTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  try {
    if (window.electronAPI.setTheme) {
      await window.electronAPI.setTheme(isDark)
    }
  } catch {
    // 忽略错误
  }
}

function getThemeIcon() {
  switch (currentTheme.value) {
    case 'dark':
      return 'moon'
    case 'light':
      return 'sun'
    case 'system':
      return 'auto'
    default:
      return 'auto'
  }
}

function getThemeLabel() {
  switch (currentTheme.value) {
    case 'dark':
      return t('settings.themeDark')
    case 'light':
      return t('settings.themeLight')
    case 'system':
      return t('settings.themeSystem')
    default:
      return t('settings.themeSystem')
  }
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
  transition: background-color 0.3s, border-color 0.3s;
}

.title-bar.maximized {
  border-bottom: none;
}

/* 窗口非活动状态 - 参考 VSCode titlebar.inactive */
.title-bar.inactive > * {
  opacity: 0.6;
}

/* 左侧图标区域 */
.title-bar-left {
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.app-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

/* 中间输入框区域 - 严格居中 */
.title-bar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  -webkit-app-region: drag;
}

.center-input-wrapper {
  width: 560px;
  max-width: calc(100vw - 200px);
  -webkit-app-region: no-drag;
}

.center-input {
  width: 100%;
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  cursor: text;
}

.center-input:focus {
  border-color: var(--color-primary);
  background: var(--bg-secondary);
}

.center-input::placeholder {
  color: var(--text-tertiary);
}

/* 下拉激活时的占位区域 */
.center-input-placeholder {
  width: 600px;
  max-width: calc(100vw - 200px);
  height: 24px;
}

/* 右侧功能区（主题按钮） */
.title-bar-actions {
  display: flex;
  align-items: center;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.title-bar-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 32px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  transition: color 0.2s, background 0.2s;
}

.title-bar-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
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

/* WCO 启用时的占位容器 */
.window-controls-container.wco-placeholder {
  width: 138px;
}

.title-bar.wco-enabled .window-controls-container.wco-placeholder {
  width: calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px));
  height: env(titlebar-area-height, 32px);
}

/* 窗口控制按钮图标 */
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
  transition: background 0.2s, color 0.3s;
}

.title-bar.inactive .window-icon {
  color: var(--text-secondary);
}

.window-icon:hover {
  background: var(--bg-hover);
}

.window-icon.window-close:hover {
  background-color: var(--titlebar-close-hover);
  color: white;
}

/* 窗口调整大小区域 */
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