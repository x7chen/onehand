import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type DropdownType = 'model' | 'ai' | 'autoSelect' | null

export const useDropdownStore = defineStore('dropdown', () => {
  const showDropdown = ref(false)
  const dropdownType = ref<DropdownType>(null)
  const filterText = ref('')

  // 获取 placeholder 文本
  function getPlaceholder(t: ReturnType<typeof useI18n>['t']): string {
    switch (dropdownType.value) {
      case 'model':
        return t('statusBar.currentModel')
      case 'ai':
        return t('statusBar.aiAnswer')
      case 'autoSelect':
        return t('statusBar.autoSelect')
      default:
        return t('common.search')
    }
  }

  // 打开下拉框
  function openDropdown(type: DropdownType) {
    dropdownType.value = type
    filterText.value = ''
    showDropdown.value = true
  }

  // 关闭下拉框
  function closeDropdown() {
    showDropdown.value = false
    dropdownType.value = null
    filterText.value = ''
  }

  // 更新过滤文本
  function updateFilterText(text: string) {
    filterText.value = text
  }

  return {
    showDropdown,
    dropdownType,
    filterText,
    getPlaceholder,
    openDropdown,
    closeDropdown,
    updateFilterText
  }
})