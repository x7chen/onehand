export interface TranscriptionResponse {
  success: boolean
  text?: string
  error?: string
}

export interface ChatCompletionRequest {
  model: string
  messages: Message[]
  stream?: boolean
}

// 消息内容项类型（支持 Vision API）
export interface MessageContentItem {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string  // base64 格式: "data:image/png;base64,..."
  }
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | MessageContentItem[]  // 支持字符串或内容数组（Vision API）
}

export interface ChatCompletionResponse {
  id: string
  choices: {
    index: number
    message: Message
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  id: string
  choices: {
    index: number
    delta: {
      content?: string
    }
    finish_reason: string | null
  }[]
}
