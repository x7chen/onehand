<template>
  <TitleBar />
  <div class="app-content">
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
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNotebookStore } from '@/stores/notebookStore'
import { useTagStore } from '@/stores/tagStore'
import { useTheme } from '@/composables/useTheme'
import { useDeepLink } from '@/composables/useDeepLink'
import { useLinkPaste } from '@/composables/useLinkPaste'
import { getNotebookDataDir } from '@/utils/userFilesPath'
import { preInitHighlighter } from '@/utils/markdownRenderer'
import NodePopup from '@/components/NodePopup.vue'
import TitleBar from '@/components/TitleBar.vue'
import type { DeepLinkData } from '@/composables/useDeepLink'

// 导入本地 CSS
import 'katex/dist/katex.min.css'

const settingsStore = useSettingsStore()
const notebookStore = useNotebookStore()
const tagStore = useTagStore()
const router = useRouter()
const route = useRoute()
useTheme(settingsStore)

// 应用字体大小
function applyFontSize(fontSize: number | undefined) {
  const size = fontSize ?? 13
  const root = document.documentElement
  root.style.setProperty('--font-size-title', `${size}px`)
  root.style.setProperty('--font-size-heading', `${size}px`)
  root.style.setProperty('--font-size-body', `${size}px`)
  root.style.setProperty('--font-size-small', `${size}px`)
  root.style.setProperty('--font-size-mini', `${size}px`)
}

// 监听字体大小变化
watch(
  () => settingsStore.settings.general.fontSize,
  (fontSize) => {
    applyFontSize(fontSize)
  },
  { immediate: true }
)

// Initialize deep link handler
useDeepLink()

// Initialize link paste handler
useLinkPaste()

// Node popup state
const showNodePopup = ref(false)
const popupUrl = ref<string | undefined>(undefined)

// Handle click on onehand:// links in the app
async function handleDeepLinkClick(event: MouseEvent) {
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

  // Handle file attachment links (e.g., files/document.pdf) - open with system
  const fileLink = target.closest('a[href^="files/"]') as HTMLAnchorElement | null
  if (fileLink) {
    event.preventDefault()
    event.stopPropagation()

    const href = fileLink.getAttribute('href') || ''
    if (href) {
      // Get current notebook ID from route
      const notebookId = route.params.notebookId as string
      if (notebookId) {
        try {
          const notebookDir = await getNotebookDataDir(notebookId)
          const fullPath = `${notebookDir}/${href}`
          const result = await window.electronAPI.openPath(fullPath)
          if (!result.success) {
            console.error('Failed to open file:', result.error)
          }
        } catch (error) {
          console.error('Error opening file:', error)
        }
      }
    }
    return
  }

  // Handle relative file links (e.g., ./files/document.pdf) - ignore them
  const relativeLink = target.closest('a[href^="./"]') as HTMLAnchorElement | null
  if (relativeLink) {
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
      // Check if we're already on the multi-chat view for this notebook
      if (route.path === `/multi-chat/${data.notebookId}`) {
        // Already on the page, just update nodeId query param
        router.replace({ path: route.path, query: { nodeId: data.nodeId } })
      } else {
        router.push(`/multi-chat/${data.notebookId}?nodeId=${data.nodeId}`)
      }
    }
  }
}

// Handle Ctrl+A - prevent selecting all UI content, only select input/textarea content
function handleSelectAll(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    const target = event.target as HTMLElement
    // 如果焦点在输入框或文本区域，允许默认的全选行为
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }
    // 否则阻止默认的全选行为
    event.preventDefault()
  }
}

// 在应用启动时加载设置
onMounted(async () => {
  settingsStore.loadSettings()
  await tagStore.loadTags()
  await notebookStore.loadNotebooks()
  // 同步笔记本中的标签到 tagStore
  await tagStore.syncTagsFromNotebooks(notebookStore.notebooks)

  // 预初始化 shiki highlighter（后台进行，不阻塞 UI）
  preInitHighlighter()

  // Add global click handler for onehand:// links
  document.addEventListener('click', handleDeepLinkClick, true)
  // Add global keydown handler for Ctrl+A
  document.addEventListener('keydown', handleSelectAll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDeepLinkClick, true)
  document.removeEventListener('keydown', handleSelectAll, true)
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
  /* 字体大小规范 - 默认中等(13px)，可通过设置调整 */
  --font-size-title: 13px;
  --font-size-heading: 13px;
  --font-size-body: 13px;
  --font-size-small: 13px;
  --font-size-mini: 13px;

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

  /* 主题色 - 用户可自定义 */
  --color-primary: #4299e1;
  --color-primary-hover: #3182ce;
  --color-primary-light: rgba(66, 153, 225, 0.1);
  --color-primary-dark: #2b6cb0;

  /* 固定功能色 - 不可自定义 */
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

  /* 标题栏颜色 */
  --titlebar-close-hover: #e81123;

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
  --bg-primary: #181818;
  --bg-secondary: #202020;
  --bg-hover: #3d3d3d;
  --bg-tertiary: #4d4d4d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-tertiary: #888888;
  --border-color: #404040;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --grid-line: rgba(255, 255, 255, 0.05);

  /* 深色模式下的语义化变量 */
  --bg-node-transcript: #202020;
  --bg-node-agent: #202020;
  --bg-active-shadow: rgba(66, 153, 225, 0.4);

  /* 引用块颜色 */
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
  user-select: none;
}

/* 允许选取的元素：可编辑内容、markdown渲染内容 */
input,
textarea,
[contenteditable="true"],
[contenteditable=""],
.markdown,
.transcript-content,
.agent-content,
.thinking-content,
.small-transcript-content,
.render-container {
  user-select: text;
}

#app {
  width: 100vw;
  height: 100vh;
}

.app-content {
  width: 100%;
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
  background: var(--bg-primary);
}

:root.dark .voice-note,
:root.dark .canvas-header {
  background: var(--bg-primary);
  box-shadow: 0 2px 8px var(--shadow-color);
}

:root.dark input,
:root.dark select,
:root.dark textarea {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border-color);
}

:root.dark h1,
:root.dark h2,
:root.dark h3,
:root.dark h4,
:root.dark p,
:root.dark label,
:root.dark a {
  color: var(--text-primary);
}

/* 排除代码块内的元素，让 shiki 主题控制代码颜色 */
:root.dark span:not(.shiki *):not(.katex *):not(.mermaid *):not(.textLayer *) {
  color: var(--text-primary);
}

:root.dark .transcript-content,
:root.dark .agent-content {
  color: var(--text-primary);
}

:root.dark button {
  color: var(--text-primary);
}

:root.dark .settings-btn,
:root.dark .back-btn,
:root.dark .cancel-btn {
  background: var(--bg-secondary);
}

:root.dark .empty-state {
  color: var(--text-secondary);
}

/* Ensure Electron window background matches */
:root.dark html,
:root.dark body {
  background-color: var(--bg-secondary);
}

/* 全局 checkbox 主题颜色 */
input[type="checkbox"] {
  accent-color: var(--color-primary);
}

:root.dark input[type="checkbox"] {
  accent-color: var(--color-primary);
}

/* 全局滚动条样式 */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}

/* 深色模式滚动条 */
:root.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

:root.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* Firefox 滚动条 */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(128, 128, 128, 0.3) transparent;
}

:root.dark * {
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
</style>