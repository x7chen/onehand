import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@/types/settings'
import { defaultSettings } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })

  async function loadSettings() {
    try {
      // 首先尝试从配置文件加载
      const configResult = await window.electronAPI.readConfig()
      if (configResult.success && configResult.data) {
        const configSettings = JSON.parse(configResult.data)
        settings.value = { ...defaultSettings, ...configSettings }
        return
      }
    } catch (error) {
      console.error('Failed to load config file:', error)
    }

    // 配置文件加载失败，尝试从用户数据目录加载
    try {
      const appDataPath = await window.electronAPI.getAppPath('userData')
      const result = await window.electronAPI.readFile(`${appDataPath}/settings.json`)
      if (result.success && result.data) {
        settings.value = { ...defaultSettings, ...JSON.parse(result.data) }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  async function saveSettings() {
    try {
      // 保存到配置文件
      await window.electronAPI.saveConfig(
        JSON.stringify(settings.value, null, 2)
      )
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
    loadSettings,
    saveSettings,
    updateSettings
  }
})
