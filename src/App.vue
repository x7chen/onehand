<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTheme } from '@/composables/useTheme'

const settingsStore = useSettingsStore()
useTheme(settingsStore)

// 在应用启动时加载设置
onMounted(() => {
  settingsStore.loadSettings()
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
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --shadow-color: rgba(0, 0, 0, 0.08);
  --grid-line: rgba(0, 0, 0, 0.05);
}

:root.dark {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --border-color: #404040;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --grid-line: rgba(255, 255, 255, 0.05);
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

:root.dark .project-card,
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
:root.dark span,
:root.dark label,
:root.dark a {
  color: var(--text-primary) !important;
}

:root.dark .transcript-content,
:root.dark .agent-content {
  color: var(--text-primary) !important;
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
