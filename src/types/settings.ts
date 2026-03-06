export interface Settings {
  llm: LLMSettings
  stt: STTSettings
  general: GeneralSettings
}

export interface LLMSettings {
  provider: 'modelscope' | 'qwen' | 'openai' | 'deepseek' | 'custom'
  apiKey: string
  baseUrl: string
  model: string
  enabledProviders: string[]
  enabledModels: string[]
}

export interface STTSettings {
  provider: 'funasr' | 'whisper'
  funasr: {
    serverUrl: string
    language: string
    hotwords: string
    itn: boolean
  }
  whisper: {
    apiKey: string
    model: string
    language: string
  }
}

export interface GeneralSettings {
  audioFormat: 'webm' | 'wav'
  language: 'zh' | 'en' | 'system'
  theme: 'dark' | 'light' | 'system'
}

export const defaultSettings: Settings = {
  llm: {
    provider: 'modelscope',
    apiKey: 'ms-551063a1-7a2e-4415-93ff-223e3bf30d8e',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    model: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
    enabledProviders: ['modelscope'],
    enabledModels: ['Qwen/Qwen3-235B-A22B-Instruct-2507']
  },
  stt: {
    provider: 'whisper',  // 改为 Whisper 作为默认，因为不需要本地服务
    funasr: {
      serverUrl: 'http://localhost:8000',
      language: 'zh',
      hotwords: '',
      itn: true
    },
    whisper: {
      apiKey: '',  // 用户需要自己填写
      model: 'whisper-1',
      language: 'auto'
    }
  },
  general: {
    audioFormat: 'webm',
    language: 'system',
    theme: 'system'
  }
}
