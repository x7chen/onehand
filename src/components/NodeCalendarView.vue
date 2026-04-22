<template>
  <div class="node-calendar-view">
    <!-- 日历区域 -->
    <div class="calendar-section">
      <!-- 年月选择器（同一行） -->
      <div class="year-month-selector">
        <div class="selector-wrapper">
          <button ref="yearBtnRef" class="selector-btn" @click="toggleYearPicker">
            {{ currentYear }}年
          </button>
          <!-- 年份选择器气泡 -->
          <div v-if="showYearPicker" class="picker-popover year-popover">
            <button
              v-for="year in yearOptions"
              :key="year"
              class="picker-option"
              :class="{ selected: year === currentYear }"
              @click="selectYear(year)"
            >
              {{ year }}年
            </button>
          </div>
        </div>
        <div class="selector-wrapper">
          <button ref="monthBtnRef" class="selector-btn" @click="toggleMonthPicker">
            {{ currentMonth + 1 }}月
          </button>
          <!-- 月份选择器气泡 -->
          <div v-if="showMonthPicker" class="picker-popover month-popover">
            <button
              v-for="month in 12"
              :key="month"
              class="picker-option"
              :class="{ selected: month === currentMonth + 1 }"
              @click="selectMonth(month - 1)"
            >
              {{ month }}月
            </button>
          </div>
        </div>
        <button class="today-btn" @click="goToToday" :title="t('nodeList.today')">
          {{ t('nodeList.today') }}
        </button>
      </div>

      <!-- 星期标题 -->
      <div class="calendar-weekdays">
        <span v-for="day in weekDays" :key="day" class="weekday-label">{{ day }}</span>
      </div>

      <!-- 日历网格 -->
      <div ref="calendarGridRef" class="calendar-grid">
        <button
          v-for="(day, index) in calendarDays"
          :key="index"
          class="calendar-day"
          :class="{
            'empty': !day,
            'today': isToday(day),
            'selected': isSelected(day),
            'in-range': isInCustomRange(day),
            'drag-selecting': isDragSelectingDay(day),
            'has-notes': hasNotes(day),
            'other-month': isOtherMonth(day)
          }"
          :data-day-index="index"
          @mousedown="handleDateDragStart(day, $event)"
          @mouseup="handleDateDragEnd"
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
        <!-- 时间范围选择器 -->
        <div class="range-selector">
          <button
            class="range-btn"
            :class="{ active: viewRange === 'day' }"
            @click="setViewRange('day')"
          >
            {{ t('nodeList.rangeDay') }}
          </button>
          <button
            class="range-btn"
            :class="{ active: viewRange === 'week' }"
            @click="setViewRange('week')"
          >
            {{ t('nodeList.rangeWeek') }}
          </button>
          <button
            class="range-btn"
            :class="{ active: viewRange === 'month' }"
            @click="setViewRange('month')"
          >
            {{ t('nodeList.rangeMonth') }}
          </button>
          <button
            class="range-btn"
            :class="{ active: viewRange === 'year' }"
            @click="setViewRange('year')"
          >
            {{ t('nodeList.rangeYear') }}
          </button>
          <button
            v-if="viewRange === 'custom'"
            class="range-btn active"
          >
            {{ t('nodeList.rangeCustom') }}
          </button>
        </div>
        <!-- 日期范围显示 -->
        <span v-if="selectedDate" class="range-title">
          {{ formatRangeTitle }}
        </span>
        <span v-else class="select-hint">
          {{ t('nodeList.selectDate') }}
        </span>
        <!-- 笔记个数（靠右对齐） -->
        <span class="notes-count">
          {{ rangeNotes.length }} {{ t('notebook.notes') }}
        </span>
      </div>
      <div ref="notesListContainerRef" class="notes-list-container">
        <div v-if="rangeNotes.length > 0" class="notes-list">
          <div
            v-for="node in rangeNotes"
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
  'visible-nodes-change': [nodes: CanvasNode[]]
  'batch-select-context': [nodeIds: string[], selected: boolean]
}>()

const { t } = useI18n()

// 拖拽多选状态
const isDragSelecting = ref(false)
const dragSelectedIds = ref<Set<string>>(new Set())
const dragStartY = ref(0)
const dragStartX = ref(0)
const isSelecting = ref(true) // true表示选取，false表示取消选取
const isDragStarted = ref(false) // 是否已进入拖拽模式
const startNodeId = ref<string | null>(null) // 开始时的节点ID

const DRAG_THRESHOLD = 5 // 拖拽阈值，超过此距离才进入拖拽模式

// 当前显示的年份
const currentYear = ref(new Date().getFullYear())
// 当前显示的月份 (0-11)
const currentMonth = ref(new Date().getMonth())
// 选中的日期
const selectedDate = ref<Date | null>(null)
// 时间范围选择 (day/week/month/year/custom)
const viewRange = ref<'day' | 'week' | 'month' | 'year' | 'custom'>('day')
// 自定义日期范围
const customRangeStart = ref<Date | null>(null)
const customRangeEnd = ref<Date | null>(null)

// 笔记列表容器引用
const notesListContainerRef = ref<HTMLElement | null>(null)
// 日历网格容器引用
const calendarGridRef = ref<HTMLElement | null>(null)

// 日期拖拽选择状态
const isDateDragSelecting = ref(false)
const dateDragStartDay = ref<Date | null>(null)
const dateDragEndDay = ref<Date | null>(null)

// 年份/月份选择器弹窗
const showYearPicker = ref(false)
const showMonthPicker = ref(false)
const yearBtnRef = ref<HTMLElement | null>(null)
const monthBtnRef = ref<HTMLElement | null>(null)

// 切换年份选择器
function toggleYearPicker() {
  showYearPicker.value = !showYearPicker.value
  if (showYearPicker.value) {
    showMonthPicker.value = false
  }
}

// 切换月份选择器
function toggleMonthPicker() {
  showMonthPicker.value = !showMonthPicker.value
  if (showMonthPicker.value) {
    showYearPicker.value = false
  }
}

// 年份选项（过去12年，不显示未来）
const yearOptions = computed(() => {
  const thisYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = thisYear; y >= thisYear - 11; y--) {
    years.push(y)
  }
  return years
})

// 星期标签
const weekDays = computed(() => {
  const locale = ['日', '一', '二', '三', '四', '五', '六']
  return locale
})

// 格式化范围标题
const formatRangeTitle = computed(() => {
  if (viewRange.value === 'custom' && customRangeStart.value && customRangeEnd.value) {
    const startMonth = customRangeStart.value.getMonth() + 1
    const startDay = customRangeStart.value.getDate()
    const endMonth = customRangeEnd.value.getMonth() + 1
    const endDay = customRangeEnd.value.getDate()
    if (customRangeStart.value.getFullYear() !== customRangeEnd.value.getFullYear()) {
      return `${customRangeStart.value.getFullYear()}年${startMonth}月${startDay}日 - ${customRangeEnd.value.getFullYear()}年${endMonth}月${endDay}日`
    }
    return `${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`
  }

  if (!selectedDate.value) return ''
  const year = selectedDate.value.getFullYear()
  const month = selectedDate.value.getMonth() + 1
  const day = selectedDate.value.getDate()

  switch (viewRange.value) {
    case 'day':
      return `${year}年${month}月${day}日`
    case 'week':
      const weekStart = getWeekStart(selectedDate.value)
      const weekEnd = getWeekEnd(selectedDate.value)
      return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 - ${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`
    case 'month':
      return `${year}年${month}月`
    case 'year':
      return `${year}年`
    default:
      return ''
  }
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
  const year = currentYear.value
  const month = currentMonth.value

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

// 根据时间范围获取笔记
const rangeNotes = computed(() => {
  // 自定义范围
  if (viewRange.value === 'custom' && customRangeStart.value && customRangeEnd.value) {
    const startDate = new Date(customRangeStart.value)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(customRangeEnd.value)
    endDate.setHours(23, 59, 59, 999)
    return props.nodes
      .filter(node => {
        const nodeDate = new Date(node.createdAt)
        return nodeDate >= startDate && nodeDate <= endDate
      })
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  if (!selectedDate.value) return []

  let startDate: Date
  let endDate: Date

  switch (viewRange.value) {
    case 'day':
      startDate = new Date(selectedDate.value)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(selectedDate.value)
      endDate.setHours(23, 59, 59, 999)
      break
    case 'week':
      startDate = getWeekStart(selectedDate.value)
      endDate = getWeekEnd(selectedDate.value)
      break
    case 'month':
      startDate = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth(), 1)
      endDate = new Date(selectedDate.value.getFullYear(), selectedDate.value.getMonth() + 1, 0, 23, 59, 59, 999)
      break
    case 'year':
      startDate = new Date(selectedDate.value.getFullYear(), 0, 1)
      endDate = new Date(selectedDate.value.getFullYear(), 11, 31, 23, 59, 59, 999)
      break
    default:
      return []
  }

  return props.nodes
    .filter(node => {
      const nodeDate = new Date(node.createdAt)
      return nodeDate >= startDate && nodeDate <= endDate
    })
    .sort((a, b) => a.createdAt - b.createdAt)
})

// 获取一周的开始（周日）
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// 获取一周的结束（周六）
function getWeekEnd(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (6 - day))
  d.setHours(23, 59, 59, 999)
  return d
}

// 判断是否是今天
function isToday(day: Date | null) {
  if (!day) return false
  const today = new Date()
  return day.getFullYear() === today.getFullYear() &&
         day.getMonth() === today.getMonth() &&
         day.getDate() === today.getDate()
}

// 判断是否是选中的日期（只在非自定义范围模式下生效）
function isSelected(day: Date | null) {
  if (!day) return false
  // 自定义范围时，不单独高亮某个日期
  if (viewRange.value === 'custom') return false
  if (!selectedDate.value) return false
  return isSameDay(day, selectedDate.value)
}

// 判断是否在自定义范围内（包括开始和结束）
function isInCustomRange(day: Date | null) {
  if (!day || viewRange.value !== 'custom' || !customRangeStart.value || !customRangeEnd.value) return false
  const dayTime = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const startTime = new Date(customRangeStart.value.getFullYear(), customRangeStart.value.getMonth(), customRangeStart.value.getDate()).getTime()
  const endTime = new Date(customRangeEnd.value.getFullYear(), customRangeEnd.value.getMonth(), customRangeEnd.value.getDate()).getTime()
  return dayTime >= startTime && dayTime <= endTime
}

// 判断是否正在被拖拽选择
function isDragSelectingDay(day: Date | null) {
  if (!day || !isDateDragSelecting.value || !dateDragStartDay.value || !dateDragEndDay.value) return false
  const dayTime = day.getTime()
  const startTime = dateDragStartDay.value.getTime()
  const endTime = dateDragEndDay.value.getTime()
  return dayTime >= Math.min(startTime, endTime) && dayTime <= Math.max(startTime, endTime)
}

// 判断两个日期是否是同一天
function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate()
}

// 判断是否是其他月份的日期
function isOtherMonth(day: Date | null) {
  if (!day) return false
  return day.getMonth() !== currentMonth.value
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

// 上一年
function prevYear() {
  currentYear.value--
}

// 下一年
function nextYear() {
  currentYear.value++
}

// 选择年份
function selectYear(year: number) {
  if (year !== currentYear.value) {
    currentYear.value = year
    // 年份变化时重置为1号
    selectedDate.value = new Date(year, currentMonth.value, 1)
  }
  showYearPicker.value = false
}

// 上个月
function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

// 下个月
function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

// 选择月份
function selectMonth(month: number) {
  if (month !== currentMonth.value) {
    currentMonth.value = month
    // 月份变化时重置为1号
    selectedDate.value = new Date(currentYear.value, month, 1)
  }
  showMonthPicker.value = false
}

// 回到今天
function goToToday() {
  const today = new Date()
  currentYear.value = today.getFullYear()
  currentMonth.value = today.getMonth()
  selectedDate.value = today
  // 清除自定义范围
  customRangeStart.value = null
  customRangeEnd.value = null
  viewRange.value = 'day'
}

// 设置时间范围模式
function setViewRange(range: 'day' | 'week' | 'month' | 'year') {
  viewRange.value = range
  // 清除自定义范围
  customRangeStart.value = null
  customRangeEnd.value = null
}

// 日期拖拽：开始
function handleDateDragStart(day: Date | null, e: MouseEvent) {
  if (!day || e.button !== 0) return
  isDateDragSelecting.value = true
  dateDragStartDay.value = day
  dateDragEndDay.value = day
  document.addEventListener('mousemove', handleDateDragMove)
  document.addEventListener('mouseup', handleDateDragEnd)
}

// 日期拖拽：移动
function handleDateDragMove(e: MouseEvent) {
  if (!isDateDragSelecting.value || !calendarGridRef.value) return

  // 找到鼠标下的日期元素
  const elements = document.elementsFromPoint(e.clientX, e.clientY)
  for (const el of elements) {
    const dayEl = (el as HTMLElement).closest('.calendar-day')
    if (dayEl && calendarGridRef.value.contains(dayEl)) {
      const index = parseInt(dayEl.getAttribute('data-day-index') || '0')
      const day = calendarDays.value[index]
      if (day) {
        dateDragEndDay.value = day
      }
      break
    }
  }
}

// 日期拖拽：结束
function handleDateDragEnd() {
  if (isDateDragSelecting.value && dateDragStartDay.value && dateDragEndDay.value) {
    // 判断是否是真正的拖拽（开始和结束日期不同）
    const startTime = new Date(dateDragStartDay.value.getFullYear(), dateDragStartDay.value.getMonth(), dateDragStartDay.value.getDate()).getTime()
    const endTime = new Date(dateDragEndDay.value.getFullYear(), dateDragEndDay.value.getMonth(), dateDragEndDay.value.getDate()).getTime()

    if (startTime !== endTime) {
      // 有拖拽，设置自定义范围
      if (startTime <= endTime) {
        customRangeStart.value = dateDragStartDay.value
        customRangeEnd.value = dateDragEndDay.value
      } else {
        customRangeStart.value = dateDragEndDay.value
        customRangeEnd.value = dateDragStartDay.value
      }

      viewRange.value = 'custom'
      selectedDate.value = customRangeStart.value
      // 更新日历显示的年月
      currentYear.value = customRangeStart.value.getFullYear()
      currentMonth.value = customRangeStart.value.getMonth()
    } else {
      // 单击，只选中日期，不切换模式
      selectedDate.value = dateDragStartDay.value
      // 清除自定义范围
      customRangeStart.value = null
      customRangeEnd.value = null
      viewRange.value = 'day'
      // 更新日历显示的年月
      currentYear.value = dateDragStartDay.value.getFullYear()
      currentMonth.value = dateDragStartDay.value.getMonth()
    }
  }

  isDateDragSelecting.value = false
  dateDragStartDay.value = null
  dateDragEndDay.value = null
  document.removeEventListener('mousemove', handleDateDragMove)
  document.removeEventListener('mouseup', handleDateDragEnd)
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

// 点击外部关闭选择器
function handlePickerClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (
    showYearPicker.value &&
    yearBtnRef.value &&
    !yearBtnRef.value.contains(target) &&
    !target.closest('.year-popover')
  ) {
    showYearPicker.value = false
  }
  if (
    showMonthPicker.value &&
    monthBtnRef.value &&
    !monthBtnRef.value.contains(target) &&
    !target.closest('.month-popover')
  ) {
    showMonthPicker.value = false
  }
}

// 拖拽多选：开始拖拽
function handleDragStart(e: MouseEvent) {
  // 只响应左键，排除checkbox、favorite按钮等交互元素
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.note-checkbox, .note-favorite-btn, .note-ai-indicator')) return

  isDragSelecting.value = true
  isDragStarted.value = false
  dragSelectedIds.value.clear()
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY

  // 记录起始位置的节点
  const node = getNodeAtPosition(e.clientX, e.clientY)
  startNodeId.value = node?.id || null

  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
}

// 拖拽多选：移动时处理经过的节点
function handleDragMove(e: MouseEvent) {
  if (!isDragSelecting.value) return

  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  // 只有超过阈值才进入拖拽选择模式
  if (!isDragStarted.value && distance > DRAG_THRESHOLD) {
    isDragStarted.value = true
    dragSelectedIds.value.clear()
  }

  if (!isDragStarted.value) return

  // 根据当前方向更新选择模式
  if (e.clientY < dragStartY.value) {
    // 从下到上（向上拖）：取消选取
    isSelecting.value = false
  } else {
    // 从上到下（向下拖）：选取
    isSelecting.value = true
  }

  // 处理起始位置的节点（根据当前方向决定）
  const startNode = getNodeAtPosition(dragStartX.value, dragStartY.value)
  if (startNode && startNode.transcriptStatus === 'done' && !dragSelectedIds.value.has(startNode.id)) {
    dragSelectedIds.value.add(startNode.id)
    if (isSelecting.value && !startNode.selectedAsContext) {
      emit('batch-select-context', [startNode.id], true)
    } else if (!isSelecting.value && startNode.selectedAsContext) {
      emit('batch-select-context', [startNode.id], false)
    }
  }

  // 处理当前位置的节点
  processNodeAtPosition(e.clientX, e.clientY)
}

// 拖拽多选：结束拖拽
function handleDragEnd(e: MouseEvent) {
  // 如果没有进入拖拽模式，视为点击，只激活笔记
  if (!isDragStarted.value && startNodeId.value) {
    emit('activate', startNodeId.value)
  }

  isDragSelecting.value = false
  isDragStarted.value = false
  dragSelectedIds.value.clear()
  startNodeId.value = null
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
}

// 获取指定位置的节点
function getNodeAtPosition(x: number, y: number): CanvasNode | null {
  const container = notesListContainerRef.value
  if (!container) return null

  const elements = document.elementsFromPoint(x, y)
  for (const el of elements) {
    const noteItem = (el as HTMLElement).closest('.note-item')
    if (noteItem && container.contains(noteItem)) {
      const nodeId = noteItem.getAttribute('data-node-id')
      if (nodeId) {
        return props.nodes.find(n => n.id === nodeId) || null
      }
      break
    }
  }
  return null
}

// 拖拽多选：处理指定位置的节点
function processNodeAtPosition(x: number, y: number) {
  const node = getNodeAtPosition(x, y)
  if (!node) return

  const nodeId = node.id
  // 检查节点是否可选中（转录完成）
  if (node.transcriptStatus !== 'done') return

  if (!dragSelectedIds.value.has(nodeId)) {
    dragSelectedIds.value.add(nodeId)

    if (isSelecting.value) {
      // 选取模式：选中未选中的节点
      if (!node.selectedAsContext) {
        emit('batch-select-context', [nodeId], true)
      }
    } else {
      // 取消模式：取消已选中的节点
      if (node.selectedAsContext) {
        emit('batch-select-context', [nodeId], false)
      }
    }
  }
}

// 初始化时选中今天
onMounted(() => {
  const today = new Date()
  selectedDate.value = today
  document.addEventListener('click', handlePickerClickOutside)
  emit('visible-nodes-change', rangeNotes.value)
  // 添加笔记列表拖拽多选事件监听
  if (notesListContainerRef.value) {
    notesListContainerRef.value.addEventListener('mousedown', handleDragStart)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handlePickerClickOutside)
  // 移除笔记列表拖拽多选事件监听
  if (notesListContainerRef.value) {
    notesListContainerRef.value.removeEventListener('mousedown', handleDragStart)
  }
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
  // 移除日期拖拽事件监听
  document.removeEventListener('mousemove', handleDateDragMove)
  document.removeEventListener('mouseup', handleDateDragEnd)
})

// 监听可见节点变化
watch(rangeNotes, (notes) => {
  emit('visible-nodes-change', notes)
}, { immediate: true })

defineExpose({
  scrollToNode: () => {
    // 日历视图不需要滚动到节点
  },
  getVisibleNodes: () => {
    return rangeNotes.value
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

/* 年月选择器（同一行） */
.year-month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.selector-wrapper {
  position: relative;
}

.selector-btn {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.selector-btn:hover {
  background: var(--bg-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.today-btn {
  padding: 4px 8px;
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

/* 气泡选择器 */
.picker-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.year-popover {
  width: 200px;
}

.month-popover {
  width: 200px;
}

.picker-option {
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 0 0 calc(33.33% - 4px);
  text-align: center;
}

.picker-option:hover {
  background: var(--bg-hover);
}

.picker-option.selected {
  background: var(--color-primary);
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

/* 自定义范围内的日期 */
.calendar-day.in-range {
  background: var(--color-primary);
  border-radius: 4px;
}

.calendar-day.in-range .day-number {
  color: white;
}

/* 拖拽选择过程中的日期 */
.calendar-day.drag-selecting {
  background: var(--color-primary);
  border-radius: 4px;
}

.calendar-day.drag-selecting .day-number {
  color: white;
}

/* 范围内的笔记指示器显示白色 */
.calendar-day.in-range.has-notes .day-notes-indicator,
.calendar-day.drag-selecting.has-notes .day-notes-indicator {
  background: white;
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
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 时间范围选择器 */
.range-selector {
  display: flex;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 2px;
}

.range-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.range-btn:hover {
  color: var(--text-primary);
}

.range-btn.active {
  background: var(--color-primary);
  color: white;
}

.range-title {
  font-weight: 500;
  color: var(--text-primary);
}

.select-hint {
  color: var(--text-secondary);
}

.notes-count {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-left: auto;
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
  user-select: none;
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