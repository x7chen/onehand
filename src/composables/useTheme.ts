import { ref, watchEffect, watch } from 'vue'
import type { Settings } from '@/types/settings'

// 内置主题的 primary 颜色
const builtinPrimaryColors: Record<string, string> = {
  default: '#4299e1',
  green: '#48bb78',
  purple: '#9f7aea',
  orange: '#ed8936',
  red: '#e53e3e'
}

// 固定的非主题色颜色变量
const fixedColorVariables = `
  --color-success: #66bb6a;
  --color-success-hover: #4caf50;
  --color-success-light: rgba(102, 187, 106, 0.1);
  --color-warning: #ffc107;
  --color-warning-light: rgba(255, 193, 7, 0.1);
  --color-error: #f44;
  --color-error-hover: #d32f2f;
  --color-error-light: rgba(255, 68, 68, 0.1);
  --color-info: #ff9800;
  --color-info-light: rgba(255, 152, 0, 0.15);
  --color-favorite: #fbbf24;
  --color-recording: #ff4444;
  --color-thinking: #9c7cf4;
  --bg-thinking: rgba(156, 124, 244, 0.08);
  --bg-thinking-dark: rgba(156, 124, 244, 0.15);
`

/**
 * 将 hex 颜色转换为 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * 将 RGB 转换为 hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

/**
 * 调整颜色亮度
 * @param hex - hex 颜色值
 * @param amount - 调整量，负数变暗，正数变亮
 */
function adjustBrightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  return rgbToHex(
    Math.max(0, Math.min(255, rgb.r + amount)),
    Math.max(0, Math.min(255, rgb.g + amount)),
    Math.max(0, Math.min(255, rgb.b + amount))
  )
}

/**
 * 从 primary 颜色计算主题变量
 */
function computeThemeVariables(primaryColor: string): string {
  const rgb = hexToRgb(primaryColor)
  if (!rgb) return ''

  // hover: 变暗约 20
  const hoverColor = adjustBrightness(primaryColor, -20)

  // dark: 变暗约 50
  const darkColor = adjustBrightness(primaryColor, -50)

  // light: 10% 透明度
  const lightColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`

  return `
  --color-primary: ${primaryColor};
  --color-primary-hover: ${hoverColor};
  --color-primary-light: ${lightColor};
  --color-primary-dark: ${darkColor};
`
}

/**
 * 生成完整的主题 CSS
 */
function generateThemeCSS(primaryColor: string): string {
  const themeVars = computeThemeVariables(primaryColor)
  return `
:root {
${themeVars}${fixedColorVariables}
}
:root.dark {}
`
}

// 当前加载的主题样式元素
let currentThemeStyle: HTMLStyleElement | null = null

/**
 * 注入主题CSS到页面
 */
function injectThemeCSS(cssContent: string) {
  // 移除旧的主题样式
  if (currentThemeStyle) {
    currentThemeStyle.remove()
    currentThemeStyle = null
  }

  if (!cssContent) return

  // 创建新的样式元素
  const styleElement = document.createElement('style')
  styleElement.id = 'theme-style'
  styleElement.textContent = cssContent
  document.head.appendChild(styleElement)
  currentThemeStyle = styleElement
}

/**
 * 清除主题样式
 */
function clearThemeCSS() {
  if (currentThemeStyle) {
    currentThemeStyle.remove()
    currentThemeStyle = null
  }
}

export function useTheme(settings: { settings: Settings }) {
  const isDark = ref(false)

  function updateTheme() {
    const theme = settings.settings.general.theme

    if (theme === 'dark') {
      isDark.value = true
    } else if (theme === 'light') {
      isDark.value = false
    } else {
      // System preference
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    // Apply theme class to document
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Notify Electron main process to update window background
    if (window.electronAPI) {
      window.electronAPI.setTheme(isDark.value)
    }
  }

  /**
   * 更新颜色主题
   */
  function updateColorTheme() {
    const colorTheme = settings.settings.general.colorTheme
    const customPrimaryColor = settings.settings.general.customPrimaryColor

    let primaryColor = ''

    if (colorTheme === 'custom' && customPrimaryColor) {
      // 使用自定义主题色
      primaryColor = customPrimaryColor
    } else if (colorTheme && builtinPrimaryColors[colorTheme]) {
      // 使用内置主题色
      primaryColor = builtinPrimaryColors[colorTheme]
    }

    if (primaryColor) {
      // 对于非 default 主题，注入完整 CSS
      // default 主题已经在 App.vue 中定义，只需要清除额外的样式
      if (colorTheme !== 'default') {
        const cssContent = generateThemeCSS(primaryColor)
        injectThemeCSS(cssContent)
      } else {
        // default 主题，清除额外的主题样式
        clearThemeCSS()
      }
    } else {
      clearThemeCSS()
    }
  }

  // Watch for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (settings.settings.general.theme === 'system') {
      updateTheme()
    }
  })

  // Update theme when settings change
  watchEffect(() => {
    updateTheme()
  })

  // Watch for color theme changes
  watch(
    () => [settings.settings.general.colorTheme, settings.settings.general.customPrimaryColor],
    () => {
      updateColorTheme()
    },
    { immediate: true }
  )

  return {
    isDark,
    updateColorTheme
  }
}