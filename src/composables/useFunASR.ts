import type { TranscriptionResponse } from '@/types/api'

export async function transcribeWithFunASR(
  audioBlob: Blob,
  config: {
    serverUrl: string
    language: string
    hotwords: string
    itn: boolean
  }
): Promise<TranscriptionResponse> {
  try {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('language', config.language)
    formData.append('itn', config.itn.toString())
    if (config.hotwords) {
      formData.append('hotwords', config.hotwords)
    }

    const response = await fetch(`${config.serverUrl}/v1/transcriptions`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return {
      success: true,
      text: result.text
    }
  } catch (error) {
    console.error('FunASR transcription failed:', error)
    let errorMsg = error instanceof Error ? error.message : '转写失败'
    
    // Add helpful context for common errors
    if (errorMsg.includes('fetch') || errorMsg.includes('NetworkError')) {
      errorMsg = `无法连接到 FunASR 服务 (${config.serverUrl})，请确保服务已启动并在设置中检查服务地址`
    }
    
    return {
      success: false,
      error: errorMsg
    }
  }
}
