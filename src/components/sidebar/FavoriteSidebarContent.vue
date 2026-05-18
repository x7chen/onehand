<template>
  <div class="favorite-sidebar-content">
    <!-- 过滤器区域 -->
    <div class="filter-section">
      <div class="filter-item">
        <label>{{ t('common.notebook') }}</label>
        <select v-model="filterNotebookId" @change="handleFilterChange">
          <option value="">{{ t('common.all') }}</option>
          <option v-for="nb in notebooks" :key="nb.id" :value="nb.id">{{ nb.name }}</option>
        </select>
      </div>
      <div class="filter-item">
        <label>{{ t('common.timeFilter') }}</label>
        <select v-model="filterTimeType" @change="handleFilterChange">
          <option value="">{{ t('common.all') }}</option>
          <option value="createdAt">{{ t('common.createdAt') }}</option>
          <option value="updatedAt">{{ t('common.updatedAt') }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Notebook } from '@/types/notebook'

const props = defineProps<{
  notebooks: Notebook[]
  filterNotebookId: string | null
  filterTimeType: string | null
}>()

const emit = defineEmits<{
  (e: 'update-filter', filter: { notebookId?: string | null; timeType?: string | null }): void
}>()

const { t } = useI18n()

const filterNotebookId = ref<string>(props.filterNotebookId || '')
const filterTimeType = ref<string>(props.filterTimeType || '')

// 监听props变化
watch(() => props.filterNotebookId, (val) => {
  filterNotebookId.value = val || ''
})

watch(() => props.filterTimeType, (val) => {
  filterTimeType.value = val || ''
})

function handleFilterChange() {
  emit('update-filter', {
    notebookId: filterNotebookId.value || null,
    timeType: filterTimeType.value || null
  })
}
</script>

<style scoped>
.favorite-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-item label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.filter-item select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.filter-item select:focus {
  outline: none;
  border-color: var(--color-primary);
}
</style>