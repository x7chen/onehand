export interface Settings {
  llm: LLMSettings
  stt: STTSettings
  general: GeneralSettings
  view: ViewSettings
}

export interface LLMSettings {
  provider: 'custom'
  apiKey: string
  baseUrl: string
  model: string
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

export interface GeneralSettings {
  audioFormat: 'webm' | 'wav'
  language: 'zh' | 'en' | 'system'
  theme: 'dark' | 'light' | 'system'
}

export interface ViewSettings {
  chatViewLeftPanelRatio: number
  nodeListViewLeftPanelRatio: number
  pdfReaderViewLeftPanelRatio: number
}

export const defaultSettings: Settings = {
  llm: {
    provider: 'custom',
    apiKey: '',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    model: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
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
    theme: 'system'
  },
  view: {
    chatViewLeftPanelRatio: 0.6,
    nodeListViewLeftPanelRatio: 0.6,
    pdfReaderViewLeftPanelRatio: 0.6
  }
}
