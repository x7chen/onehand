import { ref, watchEffect, watch } from 'vue'
import type { Settings } from '@/types/settings'

// 内置主题CSS内容
const builtinThemeCSS: Record<string, string> = {
  default: `
:root {
  --color-primary: #4299e1;
  --color-primary-hover: #3182ce;
  --color-primary-light: rgba(66, 153, 225, 0.1);
  --color-primary-dark: #2b6cb0;
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
}
:root.dark {}
  `,
  green: `
:root {
  --color-primary: #48bb78;
  --color-primary-hover: #38a169;
  --color-primary-light: rgba(72, 187, 120, 0.1);
  --color-primary-dark: #2f855a;
  --color-success: #68d391;
  --color-success-hover: #4caf50;
  --color-success-light: rgba(104, 211, 145, 0.1);
  --color-warning: #ecc94b;
  --color-warning-light: rgba(236, 201, 75, 0.1);
  --color-error: #e53e3e;
  --color-error-hover: #c53030;
  --color-error-light: rgba(229, 62, 62, 0.1);
  --color-info: #ed8936;
  --color-info-light: rgba(237, 137, 54, 0.15);
  --color-favorite: #ecc94b;
  --color-recording: #fc8181;
}
:root.dark {}
  `,
  purple: `
:root {
  --color-primary: #9f7aea;
  --color-primary-hover: #805ad5;
  --color-primary-light: rgba(159, 122, 234, 0.1);
  --color-primary-dark: #6b46c1;
  --color-success: #68d391;
  --color-success-hover: #4caf50;
  --color-success-light: rgba(104, 211, 145, 0.1);
  --color-warning: #ecc94b;
  --color-warning-light: rgba(236, 201, 75, 0.1);
  --color-error: #e53e3e;
  --color-error-hover: #c53030;
  --color-error-light: rgba(229, 62, 62, 0.1);
  --color-info: #ff9800;
  --color-info-light: rgba(255, 152, 0, 0.15);
  --color-favorite: #fbbf24;
  --color-recording: #fc8181;
}
:root.dark {}
  `,
  orange: `
:root {
  --color-primary: #ed8936;
  --color-primary-hover: #dd6b20;
  --color-primary-light: rgba(237, 137, 54, 0.1);
  --color-primary-dark: #c05621;
  --color-success: #68d391;
  --color-success-hover: #4caf50;
  --color-success-light: rgba(104, 211, 145, 0.1);
  --color-warning: #ecc94b;
  --color-warning-light: rgba(236, 201, 75, 0.1);
  --color-error: #e53e3e;
  --color-error-hover: #c53030;
  --color-error-light: rgba(229, 62, 62, 0.1);
  --color-info: #ff9800;
  --color-info-light: rgba(255, 152, 0, 0.15);
  --color-favorite: #fbbf24;
  --color-recording: #fc8181;
}
:root.dark {}
  `,
  red: `
:root {
  --color-primary: #e53e3e;
  --color-primary-hover: #c53030;
  --color-primary-light: rgba(229, 62, 62, 0.1);
  --color-primary-dark: #9b2c2c;
  --color-success: #68d391;
  --color-success-hover: #4caf50;
  --color-success-light: rgba(104, 211, 145, 0.1);
  --color-warning: #ecc94b;
  --color-warning-light: rgba(236, 201, 75, 0.1);
  --color-error: #e53e3e;
  --color-error-hover: #c53030;
  --color-error-light: rgba(229, 62, 62, 0.1);
  --color-info: #ff9800;
  --color-info-light: rgba(255, 152, 0, 0.15);
  --color-favorite: #fbbf24;
  --color-recording: #fc8181;
}
:root.dark {}
  `
}

// 当前加载的主题样式元素
let currentThemeStyle: HTMLStyleElement | null = null

/**
 * 加载自定义主题CSS文件
 */
async function loadCustomTheme(filePath: string): Promise<string> {
  try {
    // 使用 'utf-8' 编码读取文件，确保返回字符串
    const result = await window.electronAPI.readFile(filePath, 'utf-8')
    if (result.success && result.data && typeof result.data === 'string') {
      return result.data
    } else {
      console.error(`Failed to load custom theme: ${result.error}`)
      return ''
    }
  } catch (error) {
    console.error(`Error loading custom theme:`, error)
    return ''
  }
}

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
  async function updateColorTheme() {
    const colorTheme = settings.settings.general.colorTheme
    const customPath = settings.settings.general.customThemePath

    let cssContent = ''

    if (colorTheme === 'custom' && customPath) {
      // 加载自定义主题
      cssContent = await loadCustomTheme(customPath)
    } else if (colorTheme && builtinThemeCSS[colorTheme]) {
      // 加载内置主题（非default时才加载，default已内置在App.vue）
      if (colorTheme !== 'default') {
        cssContent = builtinThemeCSS[colorTheme]
      } else {
        // default主题，清除额外的主题样式
        clearThemeCSS()
      }
    }

    if (cssContent) {
      injectThemeCSS(cssContent)
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
    () => [settings.settings.general.colorTheme, settings.settings.general.customThemePath],
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