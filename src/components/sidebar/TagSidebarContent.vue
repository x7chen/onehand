<template>
  <div class="tag-sidebar-content">
    <div class="tag-list">
      <div
        v-for="tag in tags"
        :key="tag.tagName"
        class="tag-item"
        :class="{ active: selectedTagName === tag.tagName }"
        @click="handleSelectTag(tag.tagName)"
      >
        <span class="tag-color-dot" :style="{ backgroundColor: tag.tagColor }"></span>
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
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  tags: Array<{ tagName: string; tagColor: string; nodes: any[] }>
  selectedTagName: string | null
}>()

const emit = defineEmits<{
  (e: 'select-tag', tagName: string | null): void
}>()

const { t } = useI18n()

function handleSelectTag(tagName: string) {
  emit('select-tag', tagName)
}
</script>

<style scoped>
.tag-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  overflow-y: auto;
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

.tag-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.tag-count {
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.empty-hint {
  padding: 12px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}
</style>