<template>
  <div class="trash-sidebar-content">
    <button
      class="trash-tab"
      :class="{ active: activeTab === 'notes' }"
      @click="handleSelectTab('notes')"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
      <span>{{ t('trash.notes') }}</span>
    </button>
    <button
      class="trash-tab"
      :class="{ active: activeTab === 'notebooks' }"
      @click="handleSelectTab('notebooks')"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
      </svg>
      <span>{{ t('trash.notebooks') }}</span>
    </button>
    <button
      class="trash-tab"
      :class="{ active: activeTab === 'contexts' }"
      @click="handleSelectTab('contexts')"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
      </svg>
      <span>{{ t('trash.contexts') }}</span>
    </button>
    <button
      class="trash-tab"
      :class="{ active: activeTab === 'quickCommands' }"
      @click="handleSelectTab('quickCommands')"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
      <span>{{ t('trash.quickCommands') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  activeTab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands'
}>()

const emit = defineEmits<{
  (e: 'select-tab', tab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands'): void
}>()

const { t } = useI18n()

function handleSelectTab(tab: 'notes' | 'notebooks' | 'contexts' | 'quickCommands') {
  emit('select-tab', tab)
}
</script>

<style scoped>
.trash-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
}

.trash-tab {
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

.trash-tab:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.trash-tab.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--color-primary);
  padding-left: 13px;
}

.trash-tab span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>