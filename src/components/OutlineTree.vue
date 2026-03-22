<template>
  <div class="outline-tree">
    <div 
      v-for="(item, index) in items" 
      :key="index"
      class="outline-item"
    >
      <div 
        class="outline-item-header"
        :class="{ clickable: hasChildren(item) || item.dest || item.url }"
        @click="handleClick(item)"
      >
        <button 
          v-if="hasChildren(item)" 
          class="expand-btn"
          @click.stop="toggleExpand(index)"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" :style="{ transform: expanded[index] ? 'rotate(90deg)' : '' }">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
        <span v-else class="expand-placeholder"></span>
        <span class="outline-title">{{ item.title }}</span>
      </div>
      <div v-if="hasChildren(item) && expanded[index]" class="outline-children">
        <OutlineTree 
          :items="item.items" 
          @navigate="$emit('navigate', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface OutlineItem {
  title: string
  dest: string | null
  items: OutlineItem[]
  url?: string
}

interface Props {
  items: OutlineItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'navigate': [dest: string | null, url?: string]
}>()

const expanded = ref<Record<number, boolean>>({})

function hasChildren(item: OutlineItem): boolean {
  return item.items && item.items.length > 0
}

function toggleExpand(index: number) {
  expanded.value[index] = !expanded.value[index]
}

function handleClick(item: OutlineItem) {
  if (item.dest || item.url) {
    emit('navigate', item.dest, item.url)
  }
}
</script>

<style scoped>
.outline-tree {
  font-size: 13px;
}

.outline-item {
  margin-bottom: 2px;
}

.outline-item-header {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.outline-item-header.clickable {
  cursor: pointer;
}

.outline-item-header.clickable:hover {
  background: var(--bg-secondary);
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: transform 0.2s;
}

.expand-btn svg {
  transition: transform 0.2s;
}

.expand-placeholder {
  width: 20px;
  height: 20px;
}

.outline-title {
  flex: 1;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.outline-children {
  margin-left: 16px;
}
</style>
