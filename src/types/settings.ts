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
  enableThinking?: boolean  // 思考模式开关
  temperature?: number  // 温度参数 (0-2)
}

export interface LLMSettings {
  provider: 'custom'
  profiles: LLMProfile[]
  activeProfileId: string
  quickModelProfileId?: string  // 快速模型配置ID（用于纠正、翻译等简单任务）
  enabledProviders: string[]
  enabledModels: string[]
  // Embedding 配置
  embeddingModel?: string  // 默认 'text-embedding-3-small'
  embeddingEnabled?: boolean  // 默认 true
  embeddingProfileId?: string  // 嵌入模型使用的配置ID，默认使用当前激活的配置
  embeddingDimension?: number  // 嵌入向量维度，默认 1536
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
  customPrimaryColor?: string  // 自定义主题色（仅当colorTheme为custom时有效）
  notebooksViewMode?: 'grid' | 'list'  // 笔记本面板视图模式
  nodeListViewMode?: 'card' | 'list' | 'calendar'  // 笔记列表视图模式
  userFilesPath?: string  // 用户文件目录（笔记本、PDF、图片、音频、上下文等）
  defaultNotebookId?: string  // 默认笔记本ID（全部笔记本视图下创建笔记时使用）
  autoAiAnswer?: boolean  // 自动AI回答开关（创建笔记时自动触发AI回答）
  evernoteLinkPrefix?: string  // 印象笔记链接前缀（用于跳转到印象笔记）
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
        name: '',
        apiKey: '',
        baseUrl: 'https://api-inference.modelscope.cn/v1',
        model: 'Qwen/Qwen3-235B-A22B-Instruct-2507',
        enableThinking: false,
        temperature: 0.7
      }
    ],
    activeProfileId: defaultProfileId,
    enabledProviders: ['custom'],
    enabledModels: ['Qwen/Qwen3-235B-A22B-Instruct-2507'],
    embeddingModel: 'text-embedding-3-small',
    embeddingEnabled: true,
    embeddingDimension: 1536
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
    customPrimaryColor: undefined,
    notebooksViewMode: 'grid',
    nodeListViewMode: 'card',
    autoAiAnswer: true,  // 默认开启自动AI回答
    evernoteLinkPrefix: 'evernote:///view/3248616/s15/'  // 默认印象笔记链接前缀
  },
  view: {
    chatViewLeftPanelRatio: 0.6,
    nodeListViewLeftPanelRatio: 0.6,
    pdfReaderViewLeftPanelRatio: 0.6
  }
}
