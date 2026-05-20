<template>
  <div class="settings-sidebar-content">
    <button
      class="settings-tab"
      :class="{ active: activeTab === 'general' }"
      @click="handleSelectTab('general')"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      <span>{{ t('settings.generalTab') }}</span>
    </button>
    <button
      class="settings-tab"
      :class="{ active: activeTab === 'model' }"
      @click="handleSelectTab('model')"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
      </svg>
      <span>{{ t('settings.modelTab') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  activeTab: 'general' | 'model'
}>()

const emit = defineEmits<{
  (e: 'select-tab', tab: 'general' | 'model'): void
}>()

const { t } = useI18n()

function handleSelectTab(tab: 'general' | 'model') {
  emit('select-tab', tab)
}
</script>

<style scoped>
.settings-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
}

.settings-tab {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-heading);
  transition: all 0.2s;
  text-align: left;
  width: 100%;
  position: relative;
}

.settings-tab:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.settings-tab.active {
  background: var(--bg-secondary);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  padding-left: 13px;
}

.settings-tab span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>