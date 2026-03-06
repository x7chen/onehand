import type { TranscriptionResponse } from '@/types/api'

export async function transcribeWithWhisper(
  audioBlob: Blob,
  config: {
    apiKey: string
    model: string
    language: string
  }
): Promise<TranscriptionResponse> {
  // Check if API key is provided
  if (!config.apiKey || config.apiKey.trim() === '') {
    return {
      success: false,
      error: '请先在设置中配置 OpenAI API Key（或使用 FunASR 本地服务）'
    }
  }

  try {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('model', config.model)
    if (config.language !== 'auto') {
      formData.append('language', config.language)
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Whisper API 错误 (${response.status}): ${errorData.error?.message || response.statusText}`)
    }

    const result = await response.json()
    return {
      success: true,
      text: result.text
    }
  } catch (error) {
    console.error('Whisper transcription failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '转写失败'
    }
  }
}
