import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Settings, LLMProfile } from '@/types/settings'
import { defaultSettings, generateProfileId, getActiveProfile } from '@/types/settings'

/**
 * 深度合并对象
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        const targetValue = target[key] as any
        result[key] = deepMerge(targetValue || {}, sourceValue)
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as any
      }
    }
  }

  return result
}

/**
 * 迁移旧格式配置到新的多配置格式
 */
function migrateToProfiles(oldSettings: any): Settings {
  // 如果已经是新格式，直接返回
  if (oldSettings.llm?.profiles && Array.isArray(oldSettings.llm.profiles)) {
    return oldSettings as Settings
  }

  // 旧格式迁移：将单个配置转换为配置列表
  const profileId = generateProfileId()
  const migratedSettings: Settings = {
    ...defaultSettings,
    llm: {
      provider: 'custom',
      profiles: [
        {
          id: profileId,
          name: '模型1',
          apiKey: oldSettings.llm?.apiKey || '',
          baseUrl: oldSettings.llm?.baseUrl || defaultSettings.llm.profiles[0].baseUrl,
          model: oldSettings.llm?.model || defaultSettings.llm.profiles[0].model
        }
      ],
      activeProfileId: profileId,
      enabledProviders: oldSettings.llm?.enabledProviders || ['custom'],
      enabledModels: oldSettings.llm?.enabledModels || []
    }
  }

  // 合并其他设置
  if (oldSettings.stt) {
    migratedSettings.stt = deepMerge(defaultSettings.stt, oldSettings.stt)
  }
  if (oldSettings.general) {
    migratedSettings.general = deepMerge(defaultSettings.general, oldSettings.general)
  }
  if (oldSettings.view) {
    migratedSettings.view = deepMerge(defaultSettings.view, oldSettings.view)
  }

  return migratedSettings
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })
  const isLoaded = ref(false)

  // 当前激活的配置
  const activeProfile = computed(() => getActiveProfile(settings.value))

  async function loadSettings() {
    if (isLoaded.value) return // 避免重复加载

    try {
      const configResult = await window.electronAPI.readConfig()
      if (configResult.success && configResult.data) {
        const configSettings = JSON.parse(configResult.data)
        // 迁移旧格式配置
        settings.value = migrateToProfiles(configSettings)
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
    settings.value = deepMerge(settings.value, newSettings)
    saveSettings()
  }

  // 添加新配置（复制已激活的配置，若无激活则复制最后一个）
  function addProfile(): LLMProfile {
    // 查找要复制的源配置
    let sourceProfile = settings.value.llm.profiles.find(
      p => p.id === settings.value.llm.activeProfileId
    )

    // 如果没有激活配置，使用最后一个配置
    if (!sourceProfile && settings.value.llm.profiles.length > 0) {
      sourceProfile = settings.value.llm.profiles[settings.value.llm.profiles.length - 1]
    }

    const newProfile: LLMProfile = {
      id: generateProfileId(),
      name: sourceProfile
        ? `${sourceProfile.name} (副本)`
        : `模型${settings.value.llm.profiles.length + 1}`,
      apiKey: sourceProfile?.apiKey || '',
      baseUrl: sourceProfile?.baseUrl || 'https://api-inference.modelscope.cn/v1',
      model: sourceProfile?.model || 'Qwen/Qwen3-235B-A22B-Instruct-2507'
    }
    settings.value.llm.profiles.push(newProfile)
    settings.value.llm.activeProfileId = newProfile.id
    saveSettings()
    return newProfile
  }

  // 删除配置（至少保留一个）
  function removeProfile(profileId: string) {
    if (settings.value.llm.profiles.length <= 1) return

    const index = settings.value.llm.profiles.findIndex(p => p.id === profileId)
    if (index === -1) return

    settings.value.llm.profiles.splice(index, 1)

    // 如果删除的是当前激活的配置，切换到第一个
    if (settings.value.llm.activeProfileId === profileId) {
      settings.value.llm.activeProfileId = settings.value.llm.profiles[0].id
    }
    saveSettings()
  }

  // 切换配置
  function switchProfile(profileId: string) {
    const profile = settings.value.llm.profiles.find(p => p.id === profileId)
    if (profile) {
      settings.value.llm.activeProfileId = profileId
      saveSettings()
    }
  }

  // 更新配置名称
  function updateProfileName(profileId: string, name: string) {
    const profile = settings.value.llm.profiles.find(p => p.id === profileId)
    if (profile) {
      profile.name = name
      saveSettings()
    }
  }

  // 更新当前激活配置的字段
  function updateActiveProfileField(field: keyof LLMProfile, value: string) {
    const profile = activeProfile.value
    if (profile) {
      profile[field] = value
      saveSettings()
    }
  }

  return {
    settings,
    isLoaded,
    activeProfile,
    loadSettings,
    saveSettings,
    updateSettings,
    addProfile,
    removeProfile,
    switchProfile,
    updateProfileName,
    updateActiveProfileField
  }
})
