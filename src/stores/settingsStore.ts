import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@/types/settings'
import { defaultSettings } from '@/types/settings'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })

  async function loadSettings() {
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
      const appDataPath = await window.electronAPI.getAppPath('userData')
      await window.electronAPI.saveFile(
        `${appDataPath}/settings.json`,
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
