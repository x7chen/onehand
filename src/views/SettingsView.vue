<template>
  <div class="settings-view">
    <div class="settings-header">
      <button @click="goBack" class="back-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>
      <h2>设置</h2>
    </div>

    <div class="settings-content">
      <!-- LLM Settings -->
      <section class="settings-section">
        <h3>大模型配置</h3>
        
        <div class="form-group">
          <label>服务提供商</label>
          <select v-model="settingsStore.settings.llm.provider">
            <option value="custom">自定义</option>
          </select>
        </div>

        <div class="form-group">
          <label>API Key</label>
          <input
            v-model="settingsStore.settings.llm.apiKey"
            type="password"
            placeholder="输入 API Key"
          />
        </div>

        <div class="form-group">
          <label>Base URL</label>
          <input
            v-model="settingsStore.settings.llm.baseUrl"
            type="text"
            placeholder="API 基础地址"
          />
        </div>

        <div class="form-group">
          <label>模型</label>
          <input
            v-model="settingsStore.settings.llm.model"
            type="text"
            placeholder="模型名称"
          />
        </div>
      </section>

      <!-- STT Settings -->
      <section class="settings-section">
        <h3>语音转文本配置</h3>
        
        <div class="form-group">
          <label>STT 服务提供商</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" v-model="settingsStore.settings.stt.provider" value="funasr" />
              FunASR (本地)
            </label>
            <label class="radio-label">
              <input type="radio" v-model="settingsStore.settings.stt.provider" value="whisper" />
              OpenAI Whisper
            </label>
          </div>
        </div>

        <template v-if="settingsStore.settings.stt.provider === 'funasr'">
          <div class="form-group">
            <label>服务地址</label>
            <input
              v-model="settingsStore.settings.stt.funasr.serverUrl"
              type="text"
              placeholder="http://localhost:8000"
            />
          </div>

          <div class="form-group">
            <label>语言</label>
            <select v-model="settingsStore.settings.stt.funasr.language">
              <option value="zh">中文</option>
              <option value="en">英文</option>
              <option value="ja">日文</option>
              <option value="yue">粤语</option>
              <option value="ko">韩语</option>
            </select>
          </div>

          <div class="form-group">
            <label>热词</label>
            <input
              v-model="settingsStore.settings.stt.funasr.hotwords"
              type="text"
              placeholder="逗号分隔的专业术语"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="settingsStore.settings.stt.funasr.itn" />
              启用文本逆规整（数字、日期格式化）
            </label>
          </div>
        </template>

        <template v-else>
          <div class="form-group">
            <label>API Key</label>
            <input
              v-model="settingsStore.settings.stt.whisper.apiKey"
              type="password"
              placeholder="OpenAI API Key"
            />
          </div>

          <div class="form-group">
            <label>模型</label>
            <select v-model="settingsStore.settings.stt.whisper.model">
              <option value="whisper-1">whisper-1</option>
            </select>
          </div>

          <div class="form-group">
            <label>语言</label>
            <select v-model="settingsStore.settings.stt.whisper.language">
              <option value="auto">自动检测</option>
              <option value="zh">中文</option>
              <option value="en">英文</option>
              <option value="ja">日语</option>
              <option value="ko">韩语</option>
            </select>
          </div>
        </template>
      </section>

      <!-- General Settings -->
      <section class="settings-section">
        <h3>其他设置</h3>

        <div class="form-group">
          <label>音频格式</label>
          <select v-model="settingsStore.settings.general.audioFormat">
            <option value="webm">WebM</option>
            <option value="wav">WAV</option>
          </select>
        </div>

        <div class="form-group">
          <label>界面语言</label>
          <select v-model="settingsStore.settings.general.language">
            <option value="system">跟随系统</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>

        <div class="form-group">
          <label>主题</label>
          <select v-model="settingsStore.settings.general.theme">
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'

const router = useRouter()
const settingsStore = useSettingsStore()

// 监听设置变化，自动保存
watch(
  () => settingsStore.settings,
  () => {
    settingsStore.saveSettings()
  },
  { deep: true }
)

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.settings-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 12px;
  background: var(--bg-primary);
  box-shadow: 0 2px 4px var(--shadow-color);
}

.back-btn {
  padding: 8px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--border-color);
}

.settings-header h2 {
  font-size: 20px;
  color: var(--text-primary);
}

.settings-content {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
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
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4299e1;
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
