import { createI18n } from 'vue-i18n'
import zh from '@/locales/zh'
import en from '@/locales/en'

// 语言映射
const messages = {
  zh,
  en,
}

// 获取系统语言
async function getSystemLocale(): Promise<string> {
  try {
    if (window.electronAPI?.getSystemLocale) {
      const locale = await window.electronAPI.getSystemLocale()
      // zh-CN, zh-TW, zh-HK -> zh, 其他 -> en
      if (locale.startsWith('zh')) {
        return 'zh'
      }
      return 'en'
    }
  } catch {
    // ignore
  }
  // 默认中文
  return 'zh'
}

// 创建 i18n 实例
const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: 'zh',
  fallbackLocale: 'en',
  messages,
})

// 监听 settingsStore 语言变化并切换
export async function initI18n(getLanguage: () => string) {
  const language = getLanguage()

  if (language === 'system') {
    const systemLocale = await getSystemLocale()
    i18n.global.locale.value = systemLocale as 'zh' | 'en'
  } else {
    i18n.global.locale.value = language as 'zh' | 'en'
  }
}

// 切换语言
export async function switchLocale(language: string) {
  if (language === 'system') {
    const systemLocale = await getSystemLocale()
    i18n.global.locale.value = systemLocale as 'zh' | 'en'
  } else {
    i18n.global.locale.value = language as 'zh' | 'en'
  }
}

export default i18n