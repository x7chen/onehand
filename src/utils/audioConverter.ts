/**
 * 将音频 Blob 转换为 WAV 格式
 * 使用 Web Audio API 进行解码和重采样
 */
export async function convertToWav(audioBlob: Blob, targetSampleRate = 16000): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

  try {
    // 读取音频数据
    const arrayBuffer = await audioBlob.arrayBuffer()

    // 解码音频
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

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
