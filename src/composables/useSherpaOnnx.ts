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
    console.log('Starting transcription with Sherpa-ONNX...')
    console.log('Audio blob info:', {
      type: audioBlob.type,
      size: audioBlob.size
    })

    // 检查是否已经是 WAV 格式（PCM 录音器方案）
    let wavBlob: Blob
    if (audioBlob.type === 'audio/wav') {
      console.log('Audio is already WAV format, skipping conversion')
      wavBlob = audioBlob
    } else {
      // 将音频转换为 WAV 格式（16kHz, 16bit, 单声道）
      console.log('Converting audio to WAV format...')
      try {
        wavBlob = await convertToWav(audioBlob, 16000)
        console.log('Audio converted, size:', wavBlob.size)
      } catch (convertError) {
        console.error('Audio conversion failed:', convertError)
        throw new Error('音频格式转换失败：' + (convertError as Error).message)
      }
    }

    // 将 Blob 转换为 ArrayBuffer
    const arrayBuffer = await wavBlob.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    console.log('Sending audio to main process:', {
      size: uint8Array.length,
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16
    })

    // 通过 Electron IPC 调用主进程进行识别
    const result = await window.electronAPI.transcribeAudio(
      Array.from(uint8Array),
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
