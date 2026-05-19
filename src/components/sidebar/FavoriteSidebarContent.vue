<template>
  <div class="favorite-sidebar-content">
    <!-- 过滤器区域 -->
    <div class="filter-section">
      <div class="filter-item">
        <label>{{ t('common.notebook') }}</label>
        <select v-model="filterNotebookId" @change="handleFilterChange">
          <option value="">{{ t('common.allNotebooks') }}</option>
          <option v-for="nb in notebooks" :key="nb.id" :value="nb.id">{{ nb.name }}</option>
        </select>
      </div>
      <div class="filter-item">
        <label>{{ t('common.timeFilter') }}</label>
        <select v-model="filterTimeType" @change="handleFilterChange">
          <option value="">{{ t('common.allTime') }}</option>
          <option value="createdAt">{{ t('common.createdAt') }}</option>
          <option value="updatedAt">{{ t('common.updatedAt') }}</option>
        </select>
      </div>
      <div v-if="filterTimeType" class="filter-item date-range">
        <label>{{ t('common.dateRange') }}</label>
        <div class="date-inputs">
          <input
            type="text"
            v-model="filterDateStart"
            class="date-input"
            :placeholder="t('common.startDate')"
            @change="handleFilterChange"
            onfocus="this.type='date'"
            onblur="if(!this.value)this.type='text'"
          />
          <input
            type="text"
            v-model="filterDateEnd"
            class="date-input"
            :placeholder="t('common.endDate')"
            @change="handleFilterChange"
            onfocus="this.type='date'"
            onblur="if(!this.value)this.type='text'"
          />
        </div>
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
  filterDateStart?: string
  filterDateEnd?: string
}>()

const emit = defineEmits<{
  (e: 'update-filter', filter: { notebookId?: string | null; timeType?: string | null; dateStart?: string; dateEnd?: string }): void
}>()

const { t } = useI18n()

const filterNotebookId = ref<string>(props.filterNotebookId || '')
const filterTimeType = ref<string>(props.filterTimeType || '')
const filterDateStart = ref<string>(props.filterDateStart || '')
const filterDateEnd = ref<string>(props.filterDateEnd || '')

// 监听props变化
watch(() => props.filterNotebookId, (val) => {
  filterNotebookId.value = val || ''
})

watch(() => props.filterTimeType, (val) => {
  filterTimeType.value = val || ''
  // 清空时间类型时，清空日期范围
  if (!val) {
    filterDateStart.value = ''
    filterDateEnd.value = ''
  }
})

watch(() => props.filterDateStart, (val) => {
  filterDateStart.value = val || ''
})

watch(() => props.filterDateEnd, (val) => {
  filterDateEnd.value = val || ''
})

function handleFilterChange() {
  emit('update-filter', {
    notebookId: filterNotebookId.value || null,
    timeType: filterTimeType.value || null,
    dateStart: filterTimeType.value ? filterDateStart.value : undefined,
    dateEnd: filterTimeType.value ? filterDateEnd.value : undefined
  })
}
</script>

<style scoped>
.favorite-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  width: 100%;
  box-sizing: border-box;
}

.filter-item select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.date-range .date-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-input {
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
}

.date-input:focus {
  outline: none;
  border-color: var(--color-primary);
}
</style>