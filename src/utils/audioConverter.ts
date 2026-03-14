/**
 * 将音频 Blob 转换为 WAV 格式
 * 使用 Web Audio API 进行解码和重采样
 */

// 调试日志：确认此模块被加载
console.log('🔵 audioConverter.ts module loaded')

export async function convertToWav(audioBlob: Blob, targetSampleRate = 16000): Promise<Blob> {
  console.log('🔵 convertToWav called with blob type:', audioBlob.type)
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

  try {
    // 读取音频数据
    const arrayBuffer = await audioBlob.arrayBuffer()

    console.log('Audio blob info:', {
      type: audioBlob.type,
      size: audioBlob.size,
      arrayBufferSize: arrayBuffer.byteLength
    })

    // 解码音频 - 添加错误处理以处理不支持的格式
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      console.log('Audio decoded successfully:', {
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      })
    } catch (decodeError) {
      console.error('decodeAudioData failed:', decodeError)
      console.error('Audio blob type:', audioBlob.type)
      console.error('ArrayBuffer size:', arrayBuffer.byteLength)

      // 提供更有用的错误信息
      let errorMessage = '无法解码音频数据'
      if (audioBlob.type === 'audio/webm' || audioBlob.type.includes('webm')) {
        errorMessage = '音频格式问题：某些浏览器可能不支持此 webm 编码格式。请尝试使用最新版本的 Chrome 或 Edge 浏览器。'
      } else if (audioBlob.type === 'audio/mp4' || audioBlob.type.includes('mp4')) {
        errorMessage = '音频格式问题：Safari 可能无法正确解码录制的 mp4 音频。请尝试重新录制。'
      }

      throw new Error(errorMessage)
    }

    // 重采样到目标采样率
    const offlineContext = new OfflineAudioContext(
      1, // 单声道
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    )

    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start()

    const renderedBuffer = await offlineContext.startRendering()

    // 转换为 WAV 格式
    const wavBlob = audioBufferToWav(renderedBuffer)

    console.log('WAV conversion complete:', {
      size: wavBlob.size,
      targetSampleRate
    })

    return wavBlob
  } finally {
    await audioContext.close()
  }
}

/**
 * 将 AudioBuffer 转换为 WAV Blob
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const bytesPerSample = bitDepth / 8
  const blockAlign = numberOfChannels * bytesPerSample

  const dataLength = audioBuffer.length * numberOfChannels * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  // 写入 WAV 头部
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // 写入音频数据
  const offset = 44
  const channelData = audioBuffer.getChannelData(0) // 获取第一个声道

  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
    view.setInt16(offset + i * 2, intSample, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
