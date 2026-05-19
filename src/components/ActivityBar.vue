<template>
  <div class="activity-bar">
    <!-- 创建笔记按钮（第一个，特殊处理） -->
    <button
      class="activity-item create-note-item"
      :title="t('voiceNote.createNote')"
      @click="handleCreateNote"
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
    </button>

    <!-- 分隔线 -->
    <div class="activity-separator"></div>

    <!-- 活动栏选项 -->
    <div class="activity-items">
      <!-- 笔记本 -->
      <button
        class="activity-item"
        :class="{ active: activeItem === 'notebooks' }"
        :title="t('nav.notebooks')"
        @click="handleSelect('notebooks')"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
          <line x1="8" y1="8" x2="16" y2="8"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="8" y1="16" x2="12" y2="16"/>
        </svg>
      </button>

      <!-- 上下文 -->
      <button
        class="activity-item"
        :class="{ active: activeItem === 'contexts' }"
        :title="t('nav.contexts')"
        @click="handleSelect('contexts')"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
        </svg>
      </button>

      <!-- 标签 -->
      <button
        class="activity-item"
        :class="{ active: activeItem === 'tags' }"
        :title="t('nav.tags')"
        @click="handleSelect('tags')"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/>
        </svg>
      </button>

      <!-- 收藏 -->
      <button
        class="activity-item"
        :class="{ active: activeItem === 'favorites' }"
        :title="t('nav.favorites')"
        @click="handleSelect('favorites')"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
        </svg>
      </button>

      <!-- 设置 -->
      <button
        class="activity-item"
        :class="{ active: activeItem === 'settings' }"
        :title="t('nav.settings')"
        @click="handleSelect('settings')"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
      </button>
    </div>

    <!-- 底部回收站（固定在底部） -->
    <div class="activity-bottom">
      <button
        class="activity-item"
        :class="{ active: activeItem === 'trash' }"
        :title="t('nav.trash')"
        @click="handleSelect('trash')"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  activeItem: string
}>()

const emit = defineEmits<{
  (e: 'select', itemId: string): void
  (e: 'create-note'): void
  (e: 'toggle-collapse'): void
}>()

const { t } = useI18n()

function handleCreateNote() {
  emit('create-note')
}

function handleSelect(itemId: string) {
  if (props.activeItem === itemId) {
    // 二次点击已选中项，触发折叠
    emit('toggle-collapse')
  } else {
    emit('select', itemId)
  }
}
</script>

<style scoped>
.activity-bar {
  width: 48px;
  height: 100%;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
}

.activity-item {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  opacity: 0.5;
  transition: all 0.2s;
  position: relative;
}

.activity-item:hover,
.activity-item.active {
  color: var(--text-primary);
  opacity: 1;
}

/* 选中项左侧边框高亮（VSCode风格） */
.activity-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-primary);
}

/* 创建笔记按钮特殊样式 */
.create-note-item {
  color: var(--color-primary);
  opacity: 1;
}

.create-note-item:hover {
  background: var(--color-primary-light);
}

/* 分隔线 */
.activity-separator {
  height: 1px;
  margin: 8px 12px;
  background: var(--border-color);
}

/* 中间活动项区域（可自动填充） */
.activity-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* 底部固定区域 */
.activity-bottom {
  flex-shrink: 0;
  padding-bottom: 8px;
}
</style>