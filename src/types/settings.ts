export interface Settings {
  llm: LLMSettings
  stt: STTSettings
  general: GeneralSettings
  view: ViewSettings
}

export interface LLMProfile {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  model: string
}

export interface LLMSettings {
  provider: 'custom'
  profiles: LLMProfile[]
  activeProfileId: string
  enabledProviders: string[]
  enabledModels: string[]
}

export interface STTSettings {
  provider: 'sherpa-onnx'
  sherpaOnnx: {
    modelPath: string
    tokensPath: string
    numThreads: number
    decodingMethod: 'greedy_search' | 'modified_beam_search'
  }
}

// 内置主题名称
export type BuiltinTheme = 'default' | 'green' | 'purple' | 'orange' | 'red'

export interface GeneralSettings {
  audioFormat: 'webm' | 'wav'
  language: 'zh' | 'en' | 'system'
  theme: 'dark' | 'light' | 'system'  // 深浅色模式
  colorTheme: BuiltinTheme | 'custom'  // 颜色主题
  customThemePath?: string  // 自定义CSS文件路径（仅当colorTheme为custom时有效）
}

export interface ViewSettings {
  chatViewLeftPanelRatio: number
  nodeListViewLeftPanelRatio: number
  pdfReaderViewLeftPanelRatio: number
}

/**
 * 生成唯一ID
 */
export function generateProfileId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取当前激活的配置
 */
export function getActiveProfile(settings: Settings): LLMProfile | undefined {
  return settings.llm.profiles.find(p => p.id === settings.llm.activeProfileId)
}

const defaultProfileId = 'default'

export const defaultSettings: Settings = {
  llm: {
    provider: 'custom',
    profiles: [
      {
        id: defaultProfileId,
        name: '模型1',
        apiKey: '',
        baseUrl: 'https://api-inference.modelscope.cn/v1',
        model: 'Qwen/Qwen3-235B-A22B-Instruct-2507'
      }
    ],
    activeProfileId: defaultProfileId,
    enabledProviders: ['custom'],
    enabledModels: ['Qwen/Qwen3-235B-A22B-Instruct-2507']
  },
  stt: {
    provider: 'sherpa-onnx',
    sherpaOnnx: {
      modelPath: 'build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/model.int8.onnx',
      tokensPath: 'build/models/sherpa-onnx-paraformer-zh-small-2024-03-09/tokens.txt',
      numThreads: 4,
      decodingMethod: 'greedy_search'
    }
  },
  general: {
    audioFormat: 'wav', // 默认使用 WAV 格式，避免 decodeAudioData 问题
    language: 'system',
    theme: 'system',
    colorTheme: 'default',
    customThemePath: undefined
  },
  view: {
    chatViewLeftPanelRatio: 0.6,
    nodeListViewLeftPanelRatio: 0.6,
    pdfReaderViewLeftPanelRatio: 0.6
  }
}
