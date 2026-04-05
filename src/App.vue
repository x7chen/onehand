<template>
  <TitleBar v-if="isWindows" />
  <div class="app-content" :class="{ 'with-title-bar': isWindows }">
    <router-view />
  </div>
  <!-- Node popup for in-app deep link clicks -->
  <NodePopup
    :visible="showNodePopup"
    :url="popupUrl"
    @close="closeNodePopup"
    @navigate="handleNavigate"
  />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watchEffect, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import { useTheme } from '@/composables/useTheme'
import { useDeepLink } from '@/composables/useDeepLink'
import { useLinkPaste } from '@/composables/useLinkPaste'
import NodePopup from '@/components/NodePopup.vue'
import TitleBar from '@/components/TitleBar.vue'
import type { DeepLinkData } from '@/composables/useDeepLink'

// 导入本地 CSS
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'
import 'highlight.js/styles/github-dark.css'

// 平台检测 - 是否为Windows
const isWindows = navigator.userAgent.toLowerCase().includes('windows')

const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()
const router = useRouter()
const route = useRoute()
useTheme(settingsStore)

// Initialize deep link handler
useDeepLink()

// Initialize link paste handler
useLinkPaste()

// Node popup state
const showNodePopup = ref(false)
const popupUrl = ref<string | undefined>(undefined)

// Handle click on onehand:// links in the app
function handleDeepLinkClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  // Handle anchor links first - prevent navigation to avoid white screen
  const anchorLink = target.closest('a[href^="#"]') as HTMLAnchorElement | null
  if (anchorLink) {
    const href = anchorLink.getAttribute('href') || ''
    if (href.length > 1) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }

  // Handle relative file links (e.g., ./files/document.pdf) - ignore them
  const fileLink = target.closest('a[href^="./"]') as HTMLAnchorElement | null
  if (fileLink) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  // Handle onehand:// deep links
  const link = target.closest('a[href^="onehand://"]') as HTMLAnchorElement | null
  if (link) {
    event.preventDefault()
    event.stopPropagation()

    const url = link.getAttribute('href')
    if (url) {
      popupUrl.value = url
      showNodePopup.value = true
    }
  }
}

function closeNodePopup() {
  showNodePopup.value = false
  popupUrl.value = undefined
}

function handleNavigate(data: DeepLinkData) {
  // Close popup first
  closeNodePopup()

  // Navigate to the node
  const notebook = notebookStore.notebooks.find(p => p.id === data.notebookId)
  if (notebook) {
    notebookStore.setCurrentNotebook(notebook)

    // Navigate with query parameters to activate the node
    if (notebook.pdfPath) {
      // Check if we're already on the PDF view for this notebook
      if (route.path === `/pdf/${data.notebookId}`) {
        // Already on the page, just update nodeId query param
        router.replace({ path: route.path, query: { nodeId: data.nodeId } })
      } else {
        router.push(`/pdf/${data.notebookId}?nodeId=${data.nodeId}`)
      }
    } else {
      router.push(`/multi-chat/${data.notebookId}?canvasId=${data.canvasId}&nodeId=${data.nodeId}`)
    }
  }
}

// 在应用启动时加载设置
onMounted(() => {
  settingsStore.loadSettings()

  // Add global click handler for onehand:// links
  document.addEventListener('click', handleDeepLinkClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDeepLinkClick, true)
})

// 监听主题变化，切换 highlight.js 和 Mermaid 主题
watchEffect(() => {
  const isDark = document.documentElement.classList.contains('dark')
  const styles = document.querySelectorAll('style')

  // 找到 highlight.js 主题的 style 元素（最后导入的两个）
  // github.css 和 github-dark.css 的 CSS 内容有特征可以识别
  const lightThemeStyle: HTMLStyleElement[] = []
  const darkThemeStyle: HTMLStyleElement[] = []

  styles.forEach((style) => {
    const cssText = style.textContent || ''
    if (cssText.includes('.hljs-comment') && cssText.includes('#6a737d')) {
      // GitHub light theme 特征色
      lightThemeStyle.push(style)
    } else if (cssText.includes('.hljs-comment') && cssText.includes('#8b949e')) {
      // GitHub dark theme 特征色
      darkThemeStyle.push(style)
    }
  })

  if (isDark) {
    // 深色模式：启用深色主题，禁用浅色主题
    lightThemeStyle.forEach(s => { s.disabled = true })
    darkThemeStyle.forEach(s => { s.disabled = false })
  } else {
    // 浅色模式：启用浅色主题，禁用深色主题
    lightThemeStyle.forEach(s => { s.disabled = false })
    darkThemeStyle.forEach(s => { s.disabled = true })
  }
})
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
}

:root {
  /* 基础背景和文本色 */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-hover: #e8e8e8;
  --bg-tertiary: #e0e0e0;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  --border-color: #e0e0e0;
  --shadow-color: rgba(0, 0, 0, 0.08);
  --grid-line: rgba(0, 0, 0, 0.05);
  --node-width: 450px;

  /* 主题色彩系统 */
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

  /* 代码块颜色 */
  --code-bg-light: #f6f8fa;
  --code-bg-dark: #0d1117;
  --code-border: #ccc;

  /* 引用块颜色 */
  --blockquote-border: #cccccc;
  --blockquote-text: #666666;

  /* 语义化变量 */
  --accent-color: var(--color-primary);
  --accent-color-hover: var(--color-primary-hover);
  --border-accent: var(--color-primary);
  --text-link: var(--color-primary);
  --bg-node-transcript: #ffffff;
  --bg-node-agent: #ffffff;
  --bg-active-shadow: rgba(66, 153, 225, 0.4);
}

:root.dark {
  /* 基础背景和文本色 */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-hover: #3d3d3d;
  --bg-tertiary: #4d4d4d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-tertiary: #888888;
  --border-color: #404040;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --grid-line: rgba(255, 255, 255, 0.05);

  /* 深色模式下的语义化变量 */
  --bg-node-transcript: #2d2d2d;
  --bg-node-agent: #2d2d2d;
  --bg-active-shadow: rgba(66, 153, 225, 0.4);

  /* 深色模式下的代码块 */
  --code-bg-light: #0d1117;
  --blockquote-text: #a0a0a0;
}

html {
  background: var(--bg-secondary);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  overflow: hidden;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

#app {
  width: 100vw;
  height: 100vh;
}

.app-content {
  width: 100%;
  height: 100%;
}

.app-content.with-title-bar {
  height: calc(100vh - 32px);
  margin-top: 32px;
}

/* Dark mode global overrides */
:root.dark {
  background: var(--bg-secondary);
}

:root.dark .header,
:root.dark .settings-view,
:root.dark .canvas-view,
:root.dark .dialog,
:root.dark .home-view {
  background: var(--bg-primary) !important;
}

:root.dark .voice-note,
:root.dark .section-header,
:root.dark .canvas-header {
  background: var(--bg-primary) !important;
  box-shadow: 0 2px 8px var(--shadow-color) !important;
}

:root.dark input,
:root.dark select,
:root.dark textarea {
  background: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-color) !important;
}

:root.dark h1,
:root.dark h2,
:root.dark h3,
:root.dark h4,
:root.dark p,
:root.dark label,
:root.dark a {
  color: var(--text-primary) !important;
}

/* 排除代码块内的元素，让 highlight.js 主题控制代码颜色 */
:root.dark span:not(.hljs *):not(.katex *):not(.mermaid *):not(.textLayer *) {
  color: var(--text-primary) !important;
}

/* 确保 highlight.js 代码块内的颜色不被覆盖 - 不覆盖子元素 */
:root.dark .hljs,
:root.dark pre.hljs code {
  color: unset;
}

:root.dark .transcript-content,
:root.dark .agent-content {
  color: var(--text-primary);
}

/* 代码块内的文本颜色由 highlight.js 主题控制 */
:root.dark .transcript-content pre.hljs,
:root.dark .agent-content pre.hljs,
:root.dark .transcript-content pre.hljs code,
:root.dark .agent-content pre.hljs code {
  color: unset !important;
}

:root.dark button {
  color: var(--text-primary) !important;
}

:root.dark .settings-btn,
:root.dark .back-btn,
:root.dark .cancel-btn {
  background: var(--bg-secondary) !important;
}

:root.dark .empty-state {
  color: var(--text-secondary) !important;
}

/* Ensure Electron window background matches */
:root.dark html,
:root.dark body {
  background-color: var(--bg-secondary) !important;
}

/* Custom scrollbar for dark mode */
:root.dark ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

:root.dark ::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

:root.dark ::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 5px;
}

:root.dark ::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>
