<template>
  <div ref="scrollContainerRef" class="tag-sidebar-content" @scroll="handleScroll">
    <div class="tag-list">
      <div
        v-for="tag in tags"
        :key="tag.tagName"
        class="tag-item"
        :class="{ active: selectedTagName === tag.tagName }"
        @click="handleSelectTag(tag.tagName)"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="tag-icon" :style="{ color: tag.tagColor }">
          <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
        </svg>
        <span class="tag-name">{{ tag.tagName }}</span>
        <span class="tag-count">{{ tag.nodes.length }}</span>
      </div>
      <div v-if="tags.length === 0" class="empty-hint">
        {{ t('nav.noTags') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  tags: Array<{ tagName: string; tagColor: string; nodes: any[] }>
  selectedTagName: string | null
}>()

const emit = defineEmits<{
  (e: 'select-tag', tagName: string | null): void
}>()

const { t } = useI18n()

const scrollContainerRef = ref<HTMLElement | null>(null)
let scrollbarTimer: ReturnType<typeof setTimeout> | null = null

function handleSelectTag(tagName: string) {
  emit('select-tag', tagName)
}

// 滚动条显示逻辑
function handleScroll() {
  if (!scrollContainerRef.value) return
  scrollContainerRef.value.classList.add('is-scrolling')
  if (scrollbarTimer !== null) {
    clearTimeout(scrollbarTimer)
  }
  scrollbarTimer = setTimeout(() => {
    scrollContainerRef.value?.classList.remove('is-scrolling')
    scrollbarTimer = null
  }, 1000)
}
</script>

<style scoped>
.tag-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.tag-sidebar-content.is-scrolling {
  scrollbar-color: rgba(128, 128, 128, 0.4) transparent;
}

.tag-sidebar-content::-webkit-scrollbar {
  width: 4px;
}

.tag-sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.tag-sidebar-content::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.tag-sidebar-content.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
}

:root.dark .tag-sidebar-content.is-scrolling {
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
}

:root.dark .tag-sidebar-content.is-scrolling::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-item:hover {
  background: var(--bg-secondary);
}

.tag-item.active {
  background: var(--bg-secondary);
  border-left: 2px solid var(--color-primary);
  padding-left: 10px;
}

.tag-icon {
  flex-shrink: 0;
}

.tag-name {
  font-size: var(--font-size-body);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tag-count {
  font-size: var(--font-size-small);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.empty-hint {
  padding: 12px;
  font-size: var(--font-size-body);
  color: var(--text-tertiary);
  text-align: center;
}
</style>