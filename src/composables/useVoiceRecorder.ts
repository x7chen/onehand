import { ref, onUnmounted } from 'vue'

export function useVoiceRecorder() {
  const isRecording = ref(false)
  const recordingTime = ref(0)
  const mediaRecorder = ref<MediaRecorder | null>(null)
  const audioChunks = ref<Blob[]>([])
  const timerInterval = ref<number | null>(null)

  let stream: MediaStream | null = null

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.value = new MediaRecorder(stream)
      audioChunks.value = []

      mediaRecorder.value.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.value.push(event.data)
        }
      }

      mediaRecorder.value.start()
      isRecording.value = true
      recordingTime.value = 0

      timerInterval.value = window.setInterval(() => {
        recordingTime.value += 100
      }, 100)

      return true
    } catch (error) {
      console.error('Failed to start recording:', error)
      return false
    }
  }

  function stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder.value || !stream) {
        reject(new Error('No active recording'))
        return
      }

      mediaRecorder.value.onstop = () => {
        const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' })
        cleanup()
        resolve(audioBlob)
      }

      mediaRecorder.value.onerror = (event) => {
        cleanup()
        reject(new Error('Recording error'))
      }

      mediaRecorder.value.stop()
    })
  }

  function cleanup() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
    mediaRecorder.value = null
    isRecording.value = false
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording
  }
}
