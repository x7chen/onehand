<template>
  <Teleport to="body">
    <div v-if="visible" class="fullscreen-overlay" @click="emit('close')">
      <div class="fullscreen-content" @click.stop>
        <div class="fullscreen-header">
          <span class="fullscreen-title">{{ title || t('common.chartPreview') }}</span>
          <div class="fullscreen-actions">
            <button class="action-btn" :title="t('common.downloadSvg')" @click="handleDownloadSvg">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </button>
            <button class="action-btn" :title="t('common.downloadPng')" @click="handleDownloadPng">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            </button>
            <button class="action-btn close-btn" :title="t('common.close')" @click="emit('close')">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="fullscreen-body">
          <div class="fullscreen-svg-container" v-html="svgContent"></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { downloadSvg, downloadPng } from '@/utils/exportUtils'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  svgContent: string | null
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function getSvgElement(): SVGElement | null {
  const container = document.querySelector('.fullscreen-svg-container')
  return container?.querySelector('svg') || null
}

function handleDownloadSvg() {
  const svg = getSvgElement()
  if (svg) {
    downloadSvg(svg, 'diagram-fullscreen')
  }
}

async function handleDownloadPng() {
  const svg = getSvgElement()
  if (svg) {
    await downloadPng(svg, 'diagram-fullscreen', 2)
  }
}
</script>

<style scoped>
.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.fullscreen-content {
  background: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.fullscreen-title {
  font-size: var(--font-size-heading);
  font-weight: 500;
  color: var(--text-primary);
}

.fullscreen-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:hover {
  background: var(--color-error);
  color: white;
}

.fullscreen-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-svg-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-svg-container svg {
  max-width: 100%;
  height: auto;
}
</style>