import type { TranscriptionResponse } from '@/types/api'
import { convertToWav } from '@/utils/audioConverter'

/**
 * 使用 Sherpa-ONNX 本地语音识别引擎进行转写
 * 通过 Electron IPC 调用主进程进行识别
 */
export async function transcribeWithSherpaOnnx(
  audioBlob: Blob,
  config: {
    modelPath: string
    tokensPath: string
    configPath?: string
  }
): Promise<TranscriptionResponse> {
  try {
    // 将音频转换为 WAV 格式（16kHz, 16bit, 单声道）
    console.log('Converting audio to WAV format...')
    const wavBlob = await convertToWav(audioBlob, 16000)
    console.log('Audio converted, size:', wavBlob.size)

    // 将 Blob 转换为 ArrayBuffer
    const arrayBuffer = await wavBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // 转换为普通数组以便 IPC 传输
    const audioData = Array.from(uint8Array)

    // 通过 Electron IPC 调用主进程进行识别
    const result = await window.electronAPI.transcribeAudio(
      audioData,
      'audio/wav',
      {
        modelPath: config.modelPath,
        tokensPath: config.tokensPath
      }
    )

    if (result.success && result.text) {
      return {
        success: true,
        text: result.text
      }
    } else {
      throw new Error(result.error || '转写失败')
    }
  } catch (error) {
    console.error('Sherpa-ONNX transcription failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '转写失败'
    }
  }
}
