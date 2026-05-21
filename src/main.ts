import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n, { initI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'

// 导入全局样式
import '@/assets/styles/markdown.css'
import '@/assets/styles/toolbar.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(router)

// 初始化应用
async function bootstrap() {
  // 加载设置并初始化 i18n
  const settingsStore = useSettingsStore()
  await settingsStore.loadSettings()
  await initI18n(() => settingsStore.settings.general.language)

  app.mount('#app')
}

bootstrap()
