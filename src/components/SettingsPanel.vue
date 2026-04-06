<template>
  <div class="settings-panel">
    <div class="panel-header">
      <h2>{{ t('settings.title') }}</h2>
    </div>

    <div class="settings-content">
      <!-- General Settings -->
      <section class="settings-section">
        <h3>{{ t('settings.generalSettings') }}</h3>

        <div class="form-group">
          <label>{{ t('settings.language') }}</label>
          <select
            :value="settingsStore.settings.general.language"
            @change="settingsStore.setLanguage(($event.target as HTMLSelectElement).value as 'zh' | 'en' | 'system')"
          >
            <option value="system">{{ t('settings.languageSystem') }}</option>
            <option value="zh">{{ t('settings.languageZh') }}</option>
            <option value="en">{{ t('settings.languageEn') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>{{ t('settings.theme') }}</label>
          <select v-model="settingsStore.settings.general.theme">
            <option value="system">{{ t('settings.themeSystem') }}</option>
            <option value="light">{{ t('settings.themeLight') }}</option>
            <option value="dark">{{ t('settings.themeDark') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>{{ t('settings.colorTheme') }}</label>
          <div class="theme-colors">
            <button
              v-for="theme in predefinedThemes"
              :key="theme.value"
              class="theme-color-btn"
              :class="{ active: settingsStore.settings.general.colorTheme === theme.value }"
              :style="{ backgroundColor: theme.color }"
              :title="theme.label"
              @click="selectTheme(theme.value)"
            >
              <svg v-if="settingsStore.settings.general.colorTheme === theme.value" viewBox="0 0 24 24" width="16" height="16" fill="white">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </button>
            <button
              class="theme-color-btn custom-theme-btn"
              :class="{ active: settingsStore.settings.general.colorTheme === 'custom' }"
              :title="t('settings.colorThemeCustom')"
              @click="selectTheme('custom')"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.04-.23-.26-.38-.61-.38-.96 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </button>
          </div>
        </div>

        <div v-if="settingsStore.settings.general.colorTheme === 'custom'" class="form-group">
          <label>{{ t('settings.customThemeFile') }}</label>
          <div class="custom-theme-row">
            <input
              :value="settingsStore.settings.general.customThemePath || ''"
              type="text"
              :placeholder="t('settings.customThemePlaceholder')"
              readonly
              class="custom-theme-path"
            />
            <button class="select-theme-btn" @click="selectCustomThemeFile">
              {{ t('settings.selectFile') }}
            </button>
          </div>
          <p class="theme-hint">{{ t('settings.customThemeHint') }}</p>
        </div>
      </section>

      <!-- LLM Settings -->
      <section class="settings-section">
        <h3>{{ t('settings.llmConfig') }}</h3>

        <!-- Profile Tabs -->
        <div class="profile-tabs">
          <div
            v-for="profile in settingsStore.settings.llm.profiles"
            :key="profile.id"
            class="profile-tab"
            :class="{ active: profile.id === settingsStore.settings.llm.activeProfileId, dragging: draggedProfileId === profile.id }"
            :draggable="renamingProfileId !== profile.id"
            @click="settingsStore.switchProfile(profile.id)"
            @dragstart="handleDragStart($event, profile.id)"
            @dragend="handleDragEnd($event)"
          >
            <span
              class="tab-name"
              @dblclick="startRename(profile.id)"
            >
              {{ profile.name || t('settings.defaultModel') }}
            </span>
            <input
              v-if="renamingProfileId === profile.id"
              v-model="renameValue"
              class="rename-input"
              ref="renameInput"
              @blur="finishRename"
              @keyup.enter="finishRename"
              @keyup.escape="cancelRename"
            />
          </div>
          <button
            class="profile-tab add-tab"
            @click="settingsStore.addProfile()"
            :title="t('settings.addProfile')"
          >
            +
          </button>
        </div>

        <div class="form-group">
          <label>{{ t('settings.provider') }}</label>
          <select v-model="settingsStore.settings.llm.provider">
            <option value="custom">{{ t('settings.openaiCompatible') }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>{{ t('settings.apiKey') }}</label>
          <div class="password-input-wrapper">
            <input
              :value="settingsStore.activeProfile?.apiKey || ''"
              @input="settingsStore.updateActiveProfileField('apiKey', ($event.target as HTMLInputElement).value)"
              :type="showApiKey ? 'text' : 'password'"
              :placeholder="t('settings.apiKeyPlaceholder')"
            />
            <button
              type="button"
              class="password-toggle-btn"
              @click="showApiKey = !showApiKey"
              :title="showApiKey ? t('settings.hide') : t('settings.show')"
            >
              <svg v-if="showApiKey" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('settings.baseUrl') }}</label>
          <input
            :value="settingsStore.activeProfile?.baseUrl || ''"
            @input="settingsStore.updateActiveProfileField('baseUrl', ($event.target as HTMLInputElement).value)"
            type="text"
            :placeholder="t('settings.baseUrlPlaceholder')"
          />
        </div>

        <div class="form-group">
          <label>{{ t('settings.model') }}</label>
          <input
            :value="settingsStore.activeProfile?.model || ''"
            @input="settingsStore.updateActiveProfileField('model', ($event.target as HTMLInputElement).value)"
            type="text"
            :placeholder="t('settings.modelPlaceholder')"
          />
        </div>

        <div class="form-group">
          <label>{{ t('settings.enableThinking') }}</label>
          <div class="toggle-switch">
            <input
              type="checkbox"
              :checked="settingsStore.activeProfile?.enableThinking ?? false"
              @change="settingsStore.updateActiveProfileField('enableThinking', ($event.target as HTMLInputElement).checked)"
            />
            <span class="toggle-label">{{ settingsStore.activeProfile?.enableThinking ? t('settings.enabled') : t('settings.disabled') }}</span>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('settings.temperature') }}</label>
          <div class="temperature-control">
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              :value="settingsStore.activeProfile?.temperature ?? 0.7"
              @input="settingsStore.updateActiveProfileField('temperature', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <span class="temperature-value">{{ (settingsStore.activeProfile?.temperature ?? 0.7).toFixed(1) }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import type { BuiltinTheme } from '@/types/settings'

const { t } = useI18n()

const emit = defineEmits<{
  (e: 'dragStart', event: DragEvent, profileId: string): void
  (e: 'dragEnd', event: DragEvent): void
}>()

const settingsStore = useSettingsStore()

const renamingProfileId = ref<string | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const showApiKey = ref(false)
const draggedProfileId = ref<string | null>(null)

// 预定义主题颜色
const predefinedThemes = computed(() => [
  { value: 'default' as BuiltinTheme, label: t('settings.colorThemeDefault'), color: '#4299e1' },
  { value: 'green' as BuiltinTheme, label: t('settings.colorThemeGreen'), color: '#48bb78' },
  { value: 'purple' as BuiltinTheme, label: t('settings.colorThemePurple'), color: '#9f7aea' },
  { value: 'orange' as BuiltinTheme, label: t('settings.colorThemeOrange'), color: '#ed8936' },
  { value: 'red' as BuiltinTheme, label: t('settings.colorThemeRed'), color: '#e53e3e' }
])

function selectTheme(theme: BuiltinTheme | 'custom') {
  settingsStore.updateSettings({
    general: {
      ...settingsStore.settings.general,
      colorTheme: theme
    }
  })
}

onMounted(async () => {
  if (!settingsStore.isLoaded) {
    await settingsStore.loadSettings()
  }
})

watch(
  () => settingsStore.settings,
  () => {
    if (settingsStore.isLoaded) {
      settingsStore.saveSettings()
    }
  },
  { deep: true }
)

function startRename(profileId: string) {
  const profile = settingsStore.settings.llm.profiles.find(p => p.id === profileId)
  if (profile) {
    renamingProfileId.value = profileId
    renameValue.value = profile.name
    nextTick(() => {
      renameInput.value?.focus()
      renameInput.value?.select()
    })
  }
}

function finishRename() {
  if (renamingProfileId.value && renameValue.value.trim()) {
    settingsStore.updateProfileName(renamingProfileId.value, renameValue.value.trim())
  }
  renamingProfileId.value = null
  renameValue.value = ''
}

function cancelRename() {
  renamingProfileId.value = null
  renameValue.value = ''
}

// 拖拽删除功能
function handleDragStart(event: DragEvent, profileId: string) {
  draggedProfileId.value = profileId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', profileId)
    event.dataTransfer.setData('application/profile', profileId)
    const target = event.target as HTMLElement
    target.style.opacity = '0.5'
  }
  emit('dragStart', event, profileId)
}

function handleDragEnd(event: DragEvent) {
  const target = event.target as HTMLElement
  target.style.opacity = '1'
  draggedProfileId.value = null
  emit('dragEnd', event)
}

// 选择自定义主题文件
async function selectCustomThemeFile() {
  const result = await window.electronAPI.showOpenDialog({
    filters: [{ name: 'CSS文件', extensions: ['css'] }],
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    settingsStore.updateSettings({
      general: {
        ...settingsStore.settings.general,
        customThemePath: result.filePaths[0]
      }
    })
  }
}
</script>

<style scoped>
.settings-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.panel-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  box-sizing: border-box;
}

.settings-section {
  background: var(--bg-primary);
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.settings-section h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.profile-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 20px;
}

.profile-tab {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.profile-tab:hover {
  background: var(--bg-hover);
}

.profile-tab.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.profile-tab.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.tab-name {
  font-size: 14px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rename-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  padding: 8px 12px;
  border: 2px solid var(--accent-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  box-sizing: border-box;
  z-index: 1;
}

.add-tab {
  min-width: 36px;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-secondary);
}

.add-tab:hover {
  color: var(--accent-color);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* 主题选择样式 */
.theme-colors {
  display: flex;
  gap: 12px;
  align-items: center;
}

.theme-color-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.theme-color-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.theme-color-btn.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--border-color);
}

.custom-theme-btn {
  background: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  color: var(--text-secondary);
}

.custom-theme-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.custom-theme-btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  border-style: solid;
}

.custom-theme-row {
  display: flex;
  gap: 8px;
}

.custom-theme-path {
  flex: 1;
  background: var(--bg-secondary);
}

.select-theme-btn {
  padding: 10px 16px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.select-theme-btn:hover {
  background: var(--color-primary-hover);
}

.theme-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  flex: 1;
  padding-right: 40px;
}

.password-toggle-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.password-toggle-btn:hover {
  opacity: 1;
}

/* Toggle switch */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-switch input[type="checkbox"] {
  width: 44px;
  height: 24px;
  appearance: none;
  background: var(--bg-secondary);
  border-radius: 12px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid var(--border-color);
}

.toggle-switch input[type="checkbox"]::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--text-secondary);
  top: 2px;
  left: 2px;
  transition: all 0.2s;
}

.toggle-switch input[type="checkbox"]:checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.toggle-switch input[type="checkbox"]:checked::before {
  transform: translateX(20px);
  background: white;
}

.toggle-label {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Temperature control */
.temperature-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.temperature-control input[type="range"] {
  flex: 1;
  height: 6px;
  appearance: none;
  background: var(--bg-secondary);
  border-radius: 3px;
  cursor: pointer;
}

.temperature-control input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  transition: transform 0.2s;
}

.temperature-control input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.temperature-value {
  min-width: 36px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
}
</style>