import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@/types/settings'
import { defaultSettings } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })
  const isLoaded = ref(false)

  async function loadSettings() {
    if (isLoaded.value) return // 避免重复加载
    
    try {
      const configResult = await window.electronAPI.readConfig()
      if (configResult.success && configResult.data) {
        const configSettings = JSON.parse(configResult.data)
        settings.value = { ...defaultSettings, ...configSettings }
      } else {
        // 配置文件不存在或加载失败，使用默认设置
        settings.value = { ...defaultSettings }
      }
    } catch (error) {
      console.error('Failed to load config:', error)
      settings.value = { ...defaultSettings }
    }
    
    isLoaded.value = true
  }

  async function saveSettings() {
    if (!isLoaded.value) return // 配置加载完成前不保存
    
    try {
      const result = await window.electronAPI.saveConfig(
        JSON.stringify(settings.value, null, 2)
      )
      if (!result.success) {
        console.error('Failed to save config:', result.error)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  function updateSettings(newSettings: Partial<Settings>) {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings()
  }

  return {
    settings,
    isLoaded,
    loadSettings,
    saveSettings,
    updateSettings
  }
})
