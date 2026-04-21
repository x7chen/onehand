<template>
  <div class="node-calendar-view">
    <!-- 日历区域 -->
    <div class="calendar-section">
      <!-- 月份导航 -->
      <div class="calendar-header">
        <button class="month-nav-btn" @click="prevMonth" :title="t('nodeList.prevMonth')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span class="month-title">{{ monthTitle }}</span>
        <button class="month-nav-btn" @click="nextMonth" :title="t('nodeList.nextMonth')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <button class="today-btn" @click="goToToday" :title="t('nodeList.today')">
          {{ t('nodeList.today') }}
        </button>
      </div>

      <!-- 星期标题 -->
      <div class="calendar-weekdays">
        <span v-for="day in weekDays" :key="day" class="weekday-label">{{ day }}</span>
      </div>

      <!-- 日历网格 -->
      <div class="calendar-grid">
        <button
          v-for="(day, index) in calendarDays"
          :key="index"
          class="calendar-day"
          :class="{
            'empty': !day,
            'today': isToday(day),
            'selected': isSelected(day),
            'has-notes': hasNotes(day),
            'other-month': isOtherMonth(day)
          }"
          :disabled="!day"
          @click="selectDate(day)"
          :title="day && hasNotes(day) ? t('nodeList.hasNotes', { count: getNotesCount(day) }) : ''"
        >
          <span class="day-number">{{ day?.getDate() }}</span>
          <span v-if="day && hasNotes(day)" class="day-notes-indicator"></span>
        </button>
      </div>
    </div>

    <!-- 笔记列表区域 -->
    <div class="notes-section">
      <div class="notes-header">
        <span v-if="selectedDate">
          {{ formatSelectedDate }}
        </span>
        <span v-else class="select-hint">
          {{ t('nodeList.selectDate') }}
        </span>
      </div>
      <div class="notes-list-container">
        <div v-if="selectedDateNotes.length > 0" class="notes-list">
          <div
            v-for="node in selectedDateNotes"
            :key="node.id"
            class="note-item"
            :class="{ active: activeNodeId === node.id }"
            :data-node-id="node.id"
            @click="handleNodeClick(node.id)"
          >
            <!-- 勾选框 -->
            <input
              type="checkbox"
              class="note-checkbox"
              :checked="node.selectedAsContext"
              :disabled="node.transcriptStatus !== 'done'"
              @change="toggleContext(node.id)"
              @click.stop
            />
            <!-- 收藏按钮 -->
            <button
              class="note-favorite-btn"
              :class="{ active: node.isFavorite }"
              @click.stop="toggleFavorite(node.id)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
              </svg>
            </button>
            <!-- AI状态 -->
            <div
              class="note-ai-indicator"
              :class="{
                'has-ai': node.agentStatus === 'done' || node.agentStatus === 'processing',
                'processing': node.agentStatus === 'processing'
              }"
            ></div>
            <!-- 标题 -->
            <span class="note-title">
              {{ getNoteTitle(node) }}
            </span>
            <!-- 创建时间 -->
            <span class="note-time">
              {{ formatNoteTime(node.createdAt) }}
            </span>
          </div>
        </div>
        <div v-else class="no-notes-hint">
          {{ selectedDate ? t('nodeList.noNotesOnDate') : t('nodeList.selectDate') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CanvasNode } from '@/types/notebook'

const props = withDefaults(defineProps<{
  nodes: CanvasNode[]
  activeNodeId?: string | null
}>(), {
  activeNodeId: null
})

const emit = defineEmits<{
  'toggle-context': [nodeId: string]
  'toggle-favorite': [nodeId: string]
  'activate': [nodeId: string]
}>()

const { t } = useI18n()

// 当前显示的月份
const currentMonth = ref(new Date())
// 选中的日期
const selectedDate = ref<Date | null>(null)

// 星期标签
const weekDays = computed(() => {
  const locale = ['日', '一', '二', '三', '四', '五', '六']
  return locale
})

// 月份标题
const monthTitle = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth() + 1
  return `${year}年${month}月`
})

// 格式化选中的日期
const formatSelectedDate = computed(() => {
  if (!selectedDate.value) return ''
  const year = selectedDate.value.getFullYear()
  const month = selectedDate.value.getMonth() + 1
  const day = selectedDate.value.getDate()
  return `${year}年${month}月${day}日`
})

// 按日期分组的节点
const nodesByDate = computed(() => {
  const map = new Map<string, CanvasNode[]>()
  for (const node of props.nodes) {
    const date = new Date(node.createdAt)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(node)
  }
  return map
})

// 计算日历网格的天数
const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()

  // 获取当月第一天
  const firstDay = new Date(year, month, 1)
  const firstDayOfWeek = firstDay.getDay()

  // 获取当月最后一天
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // 日历网格从周日开始，需要填充前导空格
  const days: (Date | null)[] = []

  // 前导空格（上月末尾的日期）
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevMonthDay = new Date(year, month, -firstDayOfWeek + i + 1)
    days.push(prevMonthDay)
  }

  // 当月的日期
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i))
  }

  // 后续空格（下月开始的日期）
  const remaining = 42 - days.length // 6行 x 7列 = 42
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
})

// 选中日期的笔记
const selectedDateNotes = computed(() => {
  if (!selectedDate.value) return []
  const key = `${selectedDate.value.getFullYear()}-${selectedDate.value.getMonth()}-${selectedDate.value.getDate()}`
  const notes = nodesByDate.value.get(key) || []
  return notes.sort((a, b) => a.createdAt - b.createdAt)
})

// 判断是否是今天
function isToday(day: Date | null) {
  if (!day) return false
  const today = new Date()
  return day.getFullYear() === today.getFullYear() &&
         day.getMonth() === today.getMonth() &&
         day.getDate() === today.getDate()
}

// 判断是否是选中的日期
function isSelected(day: Date | null) {
  if (!day || !selectedDate.value) return false
  return day.getFullYear() === selectedDate.value.getFullYear() &&
         day.getMonth() === selectedDate.value.getMonth() &&
         day.getDate() === selectedDate.value.getDate()
}

// 判断是否是其他月份的日期
function isOtherMonth(day: Date | null) {
  if (!day) return false
  return day.getMonth() !== currentMonth.value.getMonth()
}

// 判断是否有笔记
function hasNotes(day: Date | null) {
  if (!day) return false
  const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
  return nodesByDate.value.has(key)
}

// 获取笔记数量
function getNotesCount(day: Date | null) {
  if (!day) return 0
  const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
  return nodesByDate.value.get(key)?.length || 0
}

// 上个月
function prevMonth() {
  const newMonth = new Date(currentMonth.value)
  newMonth.setMonth(newMonth.getMonth() - 1)
  currentMonth.value = newMonth
}

// 下个月
function nextMonth() {
  const newMonth = new Date(currentMonth.value)
  newMonth.setMonth(newMonth.getMonth() + 1)
  currentMonth.value = newMonth
}

// 回到今天
function goToToday() {
  currentMonth.value = new Date()
  selectedDate.value = new Date()
}

// 选择日期
function selectDate(day: Date | null) {
  if (!day) return
  selectedDate.value = day
}

// 切换上下文勾选
function toggleContext(nodeId: string) {
  emit('toggle-context', nodeId)
}

// 切换收藏
function toggleFavorite(nodeId: string) {
  emit('toggle-favorite', nodeId)
}

// 点击笔记
function handleNodeClick(nodeId: string) {
  emit('activate', nodeId)
}

// 格式化笔记时间（年-月-日 时:分）
function formatNoteTime(timestamp: number) {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 获取笔记标题（无标题时取transcript前10个字）
function getNoteTitle(node: CanvasNode) {
  if (node.title) return node.title
  if (node.transcript) {
    // 去除markdown图片等特殊内容，取纯文本前10字
    const plainText = node.transcript.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\n/g, ' ').trim()
    return plainText.slice(0, 10) || t('nodeList.noTitle')
  }
  return t('nodeList.noTitle')
}

// 初始化时选中今天（如果有笔记）
onMounted(() => {
  const today = new Date()
  if (hasNotes(today)) {
    selectedDate.value = today
  }
})

defineExpose({
  scrollToNode: () => {
    // 日历视图不需要滚动到节点
  }
})
</script>

<style scoped>
.node-calendar-view {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1;
  height: 100%;
}

/* 日历区域 */
.calendar-section {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.month-nav-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.month-nav-btn:hover {
  background: var(--bg-hover);
  color: var(--color-primary);
}

.month-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 100px;
  text-align: center;
}

.today-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.today-btn:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

/* 星期标题 */
.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}

.weekday-label {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px;
}

/* 日历网格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day {
  position: relative;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.calendar-day.empty {
  background: transparent;
  cursor: default;
}

.calendar-day:not(.empty):hover {
  background: var(--bg-hover);
}

.calendar-day.today {
  background: var(--color-primary-bg);
}

.calendar-day.today .day-number {
  color: var(--color-primary);
  font-weight: 600;
}

.calendar-day.selected {
  background: var(--color-primary);
}

.calendar-day.selected .day-number {
  color: white;
}

.calendar-day.other-month {
  opacity: 0.4;
}

.calendar-day.has-notes {
  font-weight: 500;
}

.day-number {
  font-size: 13px;
  color: var(--text-primary);
}

.day-notes-indicator {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-success);
}

/* 笔记列表区域 */
.notes-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notes-header {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  border-bottom: 1px solid var(--border-color);
}

.select-hint {
  color: var(--text-secondary);
}

.notes-list-container {
  flex: 1;
  overflow-y: auto;
}

.notes-list {
  display: flex;
  flex-direction: column;
}

.no-notes-hint {
  padding: 24px 12px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

/* 笔记条目 */
.note-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.note-item:hover {
  background: var(--bg-hover);
}

.note-item.active {
  background: var(--color-primary-bg);
  border-left: 3px solid var(--color-primary);
}

.note-checkbox {
  width: 12px;
  height: 12px;
  margin: 0;
  cursor: pointer;
  flex-shrink: 0;
}

.note-checkbox:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.note-favorite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.2s;
}

.note-favorite-btn:hover {
  color: var(--text-primary);
}

.note-favorite-btn.active {
  color: var(--color-favorite);
}

.note-ai-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.2s;
}

.note-ai-indicator.has-ai {
  background: var(--color-success);
}

.note-ai-indicator.processing {
  background: var(--color-primary);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.note-title {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.note-time {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
</style>