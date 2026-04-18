import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface SearchHistoryItem {
  query: string
  timestamp: number
  searchMode: 'keyword' | 'semantic'
}

export const useSearchHistoryStore = defineStore('searchHistory', () => {
  const historyItems = ref<SearchHistoryItem[]>([])
  const MAX_HISTORY = 5
  const MAX_STORED_HISTORY = 50
  const HISTORY_FILE = 'search-history.json'

  // 加载搜索历史
  async function loadHistory() {
    try {
      const userDataPath = await window.electronAPI.getAppPath('userData')
      const historyPath = `${userDataPath}/${HISTORY_FILE}`
      const exists = await window.electronAPI.exists(historyPath)

      if (exists) {
        const result = await window.electronAPI.readFile(historyPath, 'utf-8')
        if (result.success && result.data) {
          const content = result.data as string
          const data = JSON.parse(content)
          historyItems.value = data.items || []
        }
      }
    } catch (error) {
      console.error('Failed to load search history:', error)
      historyItems.value = []
    }
  }

  // 保存搜索历史
  async function saveHistory() {
    try {
      const userDataPath = await window.electronAPI.getAppPath('userData')
      const historyPath = `${userDataPath}/${HISTORY_FILE}`
      const data = JSON.stringify({ items: historyItems.value }, null, 2)
      await window.electronAPI.saveFile(historyPath, data)
    } catch (error) {
      console.error('Failed to save search history:', error)
    }
  }

  // 添加搜索记录
  async function addHistoryItem(query: string, searchMode: 'keyword' | 'semantic') {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    // 移除已存在的相同查询（避免重复）
    const existingIndex = historyItems.value.findIndex(item => item.query === trimmedQuery)
    if (existingIndex !== -1) {
      historyItems.value.splice(existingIndex, 1)
    }

    // 添加新记录到开头
    const newItem: SearchHistoryItem = {
      query: trimmedQuery,
      timestamp: Date.now(),
      searchMode
    }
    historyItems.value.unshift(newItem)

    // 限制存储数量（最多 50 条）
    if (historyItems.value.length > MAX_STORED_HISTORY) {
      historyItems.value = historyItems.value.slice(0, MAX_STORED_HISTORY)
    }

    await saveHistory()
  }

  // 删除单条历史记录
  async function removeHistoryItem(index: number) {
    if (index < 0 || index >= historyItems.value.length) return
    
    historyItems.value.splice(index, 1)
    await saveHistory()
  }

  // 清空所有历史记录
  async function clearHistory() {
    historyItems.value = []
    await saveHistory()
  }

  // 获取最近的搜索历史（最多 5 条）
  const recentHistory = computed(() => {
    return historyItems.value.slice(0, MAX_HISTORY)
  })

  // 格式化时间显示
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // 少于 1 分钟
    if (diff < 60000) {
      return '刚刚'
    }
    
    // 少于 1 小时
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}分钟前`
    }
    
    // 少于 24 小时
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}小时前`
    }
    
    // 少于 7 天
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000)
      return `${days}天前`
    }
    
    // 超过 7 天，显示具体日期
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hours}:${minutes}`
  }

  return {
    historyItems,
    recentHistory,
    loadHistory,
    addHistoryItem,
    removeHistoryItem,
    clearHistory,
    formatTime
  }
})
