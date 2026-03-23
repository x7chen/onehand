/**
 * 使用 AudioWorklet 录制 PCM 数据
 */

const workletCode = `
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffers = []
    this.isRecording = false
    
    this.port.onmessage = (event) => {
      if (event.data.command === 'start') {
        this.isRecording = true
        this.buffers = []
        console.log('[Worklet] Recording started')
      } else if (event.data.command === 'stop') {
        this.isRecording = false
        console.log('[Worklet] Recording stopped, buffers:', this.buffers.length)
        this.port.postMessage({
          eventType: 'audioComplete',
          buffers: this.buffers
        })
      }
    }
  }

  process(inputs) {
    if (!this.isRecording) return true

    const input = inputs[0]
    if (input && input.length > 0) {
      const channelData = input[0]
      if (channelData && channelData.length > 0) {
        this.buffers.push(new Float32Array(channelData))
      }
    }
    return true
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor)
`

export function createAudioWorkletRecorder() {
  let audioContext: AudioContext | null = null
  let workletNode: AudioWorkletNode | null = null
  let mediaStream: MediaStream | null = null
  let isRecording = false
  const sampleRate = 16000
  let blobUrl: string | null = null

  async function start(): Promise<void> {
    if (isRecording) {
      throw new Error('Already recording')
    }

    console.log('[AudioWorkletRecorder] Initializing...')

    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate
    })

    // 确保 AudioContext 处于运行状态
    if (audioContext.state === 'suspended') {
      console.log('[AudioWorkletRecorder] Resuming AudioContext from suspended state')
      await audioContext.resume()
    }

    console.log('[AudioWorkletRecorder] AudioContext state:', audioContext.state)

    // 创建 AudioWorklet
    const blob = new Blob([workletCode], { type: 'application/javascript' })
    blobUrl = URL.createObjectURL(blob)
    
    console.log('[AudioWorkletRecorder] Loading worklet...')
    await audioContext.audioWorklet.addModule(blobUrl)
    console.log('[AudioWorkletRecorder] Worklet loaded')

    // 获取麦克风
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate,
        echoCancellation: true,
        noiseSuppression: true
      }
    })
    console.log('[AudioWorkletRecorder] Microphone acquired')

    // 创建 AudioWorkletNode
    workletNode = new AudioWorkletNode(audioContext, 'audio-recorder-processor')
    
    // 监听 worklet 消息
    workletNode.port.onmessage = (event) => {
      console.log('[AudioWorkletRecorder] Message from worklet:', event.data)
    }
    
    // 连接音频图
    const source = audioContext.createMediaStreamSource(mediaStream)
    source.connect(workletNode)
    
    console.log('[AudioWorkletRecorder] Audio graph connected')

    // 开始录制 - 发送 start 命令到 worklet
    workletNode.port.postMessage({ command: 'start' })
    console.log('[AudioWorkletRecorder] Start command sent to worklet')
    isRecording = true

    console.log('🎤 [AudioWorkletRecorder] Recording started')
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!workletNode || !isRecording) {
        reject(new Error('Not recording'))
        return
      }

      console.log('[AudioWorkletRecorder] Stopping..., workletNode:', !!workletNode)

      const handler = (event: MessageEvent) => {
        console.log('[AudioWorkletRecorder] Message received:', event.data.eventType)
        if (event.data.eventType === 'audioComplete') {
          workletNode?.port.removeEventListener('message', handler)
          
          const buffers = event.data.buffers as Float32Array[]
          console.log('[AudioWorkletRecorder] Received buffers:', buffers.length)
          
          const wavBlob = pcmToWav(buffers, sampleRate)
          console.log('[AudioWorkletRecorder] WAV size:', wavBlob.size)

          // 清理
          cleanup()
          resolve(wavBlob)
        }
      }

      workletNode.port.addEventListener('message', handler)
      workletNode.port.postMessage({ command: 'stop' })
      console.log('[AudioWorkletRecorder] Stop command sent to worklet')
    })
  }

  function cleanup() {
    console.log('[AudioWorkletRecorder] Cleaning up...')
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }
    if (workletNode) {
      workletNode.disconnect()
      workletNode = null
    }
    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      blobUrl = null
    }
    isRecording = false
  }

  function pcmToWav(pcmData: Float32Array[], rate: number): Blob {
    const totalLength = pcmData.reduce((sum, buf) => sum + buf.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const buf of pcmData) {
      merged.set(buf, offset)
      offset += buf.length
    }

    const int16 = new Int16Array(merged.length)
    for (let i = 0; i < merged.length; i++) {
      const s = Math.max(-1, Math.min(1, merged[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    const bytesPerSample = 2
    const blockAlign = bytesPerSample
    const dataLength = int16.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)

    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, rate, true)
    view.setUint32(28, rate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, 'data')
    view.setUint32(40, dataLength, true)

    for (let i = 0; i < int16.length; i++) {
      view.setInt16(44 + i * 2, int16[i], true)
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  return { start, stop }
}
