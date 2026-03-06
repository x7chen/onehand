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

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
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
