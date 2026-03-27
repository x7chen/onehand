const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

// Check for single instance lock (needed for deep link handling on Windows)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit()
}

// Sherpa-ONNX 相关
let sherpaOnnx = null
try {
  sherpaOnnx = require('sherpa-onnx')
  console.log('Sherpa-ONNX loaded successfully')
} catch (e) {
  console.warn('Failed to load sherpa-onnx:', e.message)
}

let mainWindow = null

// Deep link URL storage
let pendingDeepLinkUrl = null

// 配置文件路径 - 始终使用用户数据目录
const getConfigPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'config.json')
}

// 笔记根目录（根据当前文件位置计算）
const PROJECT_ROOT = path.join(__dirname, '..')

// 获取模型路径 - 尝试多个可能的位置
const getModelPath = () => {
  const possiblePaths = [
    // 开发环境：从 electron 目录往上到笔记根目录
    path.join(PROJECT_ROOT, 'build/models/sherpa-onnx-paraformer-zh-small-2024-03-09'),
    // 生产环境：resources/app/build/models
    path.join(process.resourcesPath || '', 'app/build/models/sherpa-onnx-paraformer-zh-small-2024-03-09'),
    // 生产环境备选：resources/build/models
    path.join(process.resourcesPath || '', 'build/models/sherpa-onnx-paraformer-zh-small-2024-03-09'),
    // 当前工作目录
    path.join(process.cwd(), 'build/models/sherpa-onnx-paraformer-zh-small-2024-03-09'),
  ]

  for (const modelPath of possiblePaths) {
    const modelFile = path.join(modelPath, 'model.int8.onnx')
    const tokensFile = path.join(modelPath, 'tokens.txt')

    if (fs.existsSync(modelFile) && fs.existsSync(tokensFile)) {
      console.log('Found model at:', modelPath)
      return modelPath
    }
  }

  // 返回笔记根目录下的路径作为默认值
  console.warn('Model not found, using default path:', possiblePaths[0])
  return possiblePaths[0]
}

// 创建语音识别器
let recognizer = null
let recognizerInitializing = false
let recognizerReady = false
function createRecognizer() {
  if (!sherpaOnnx) {
    console.error('Sherpa-ONNX not available - module failed to load')
    return null
  }

  console.log('Sherpa-ONNX module loaded, creating recognizer...')
  console.log('Available APIs:', Object.keys(sherpaOnnx))

  try {
    const modelPath = getModelPath()
    const modelFile = path.join(modelPath, 'model.int8.onnx')
    const tokensFile = path.join(modelPath, 'tokens.txt')

    console.log('Model path:', modelPath)
    console.log('Model file:', modelFile)
    console.log('Tokens file:', tokensFile)
    console.log('Model exists:', fs.existsSync(modelFile))
    console.log('Tokens exists:', fs.existsSync(tokensFile))

    if (!fs.existsSync(modelFile)) {
      console.error('Model file not found:', modelFile)
      return null
    }
    if (!fs.existsSync(tokensFile)) {
      console.error('Tokens file not found:', tokensFile)
      return null
    }

    // 检查 createOfflineRecognizer 是否存在
    if (!sherpaOnnx.createOfflineRecognizer) {
      console.error('createOfflineRecognizer not found in sherpa-onnx module')
      return null
    }

    // 使用正确的配置格式
    const config = {
      modelConfig: {
        paraformer: {
          model: modelFile,
        },
        tokens: tokensFile,
      },
    }

    console.log('Creating recognizer with config:', JSON.stringify(config, null, 2))
    recognizer = sherpaOnnx.createOfflineRecognizer(config)
    recognizerReady = true
    recognizerInitializing = false
    console.log('Sherpa-ONNX recognizer created successfully')
    return recognizer
  } catch (error) {
    console.error('Failed to create recognizer:', error)
    console.error('Error stack:', error.stack)
    recognizerInitializing = false
    return null
  }
}

function createWindow() {
  // Default to dark mode background
  const backgroundColor = '#2d2d2d'

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 500,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    frame: true,
    backgroundColor: backgroundColor,
    show: false, // Don't show until ready
    paintWhenInitiallyHidden: true
  })

  // In development, load from Vite dev server
  // In production, load from built files
  const isDev = process.argv.includes('--dev') || !fs.existsSync(path.join(__dirname, '../dist/index.html'))

  if (isDev) {
    // Try ports 5173, 5174, 5175, 5176, 5177 in case one is occupied
    const ports = [5173, 5174, 5175, 5176, 5177]
    let loaded = false

    for (const port of ports) {
      try {
        const url = `http://localhost:${port}`
        console.log(`Trying to connect to Vite at ${url}...`)
        mainWindow.loadURL(url)
        mainWindow.webContents.openDevTools()
        loaded = true
        break
      } catch (error) {
        console.log(`Port ${port} failed, trying next...`)
      }
    }

    if (!loaded) {
      console.error('Could not connect to Vite dev server on any port')
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Show window when ready to prevent blank screen
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show')
    mainWindow.show()
  })

  // Add error handling for page load
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load page:', errorDescription)
    // Still show the window even if page fails to load
    setTimeout(() => {
      mainWindow.show()
    }, 1000)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 处理链接点击，使用外部浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 所有新窗口都在外部浏览器中打开
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 处理页面内链接点击
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // 允许内部导航（如路由跳转）和 onehand:// 协议
    const isInternal = url.startsWith('http://localhost:') || url.startsWith('file://') || url.startsWith('onehand://')
    if (!isInternal) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
}

// Register onehand:// protocol
if (process.defaultApp) {
  // Development mode: need to pass the app path
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('onehand', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  // Production mode
  app.setAsDefaultProtocolClient('onehand')
}

// Handle deep link from second instance (Windows/Linux)
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, focus our window instead
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }

  // Find the onehand:// URL in command line arguments
  const deepLinkUrl = commandLine.find(arg => arg.startsWith('onehand://'))
  if (deepLinkUrl) {
    console.log('Deep link received (second-instance):', deepLinkUrl)
    handleDeepLink(deepLinkUrl)
  }
})

// Handle deep link from open-url (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault()
  console.log('Deep link received (open-url):', url)
  handleDeepLink(url)
})

// Process deep link URL
function handleDeepLink(url) {
  if (!url || !url.startsWith('onehand://')) return

  // If window is not ready yet, store the URL for later
  if (!mainWindow || !mainWindow.webContents) {
    pendingDeepLinkUrl = url
    return
  }

  // Send the URL to the renderer process
  mainWindow.webContents.send('deep-link', url)
}

app.whenReady().then(() => {
  createWindow()

  // Check for deep link in command line arguments (first launch)
  const deepLinkUrl = process.argv.find(arg => arg.startsWith('onehand://'))
  if (deepLinkUrl) {
    console.log('Deep link received (first launch):', deepLinkUrl)
    // Store it for the renderer to pick up
    pendingDeepLinkUrl = deepLinkUrl
  }

  // If there was a pending deep link from before window was ready, send it now
  if (pendingDeepLinkUrl && mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('deep-link', pendingDeepLinkUrl)
    pendingDeepLinkUrl = null
  }

  // 异步初始化语音识别器
  recognizerInitializing = true
  setTimeout(() => {
    createRecognizer()
  }, 100)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 清理识别器
  if (recognizer) {
    try {
      recognizer.free()
    } catch (e) {
      console.error('Error freeing recognizer:', e)
    }
    recognizer = null
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('save-file', async (event, filePath, data) => {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, data)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('save-file-buffer', async (event, filePath, buffer) => {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    // Convert ArrayBuffer to Buffer and write
    const data = Buffer.from(buffer)
    fs.writeFileSync(filePath, data)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('set-theme', async (event, isDark) => {
  if (mainWindow) {
    mainWindow.setBackgroundColor(isDark ? '#2d2d2d' : '#f5f5f5')
  }
  return { success: true }
})

ipcMain.handle('read-file', async (event, filePath, encoding = 'utf-8') => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }

    // 如果请求的是 arraybuffer，返回 buffer
    if (encoding === 'arraybuffer') {
      const data = fs.readFileSync(filePath)
      return { success: true, data: data.buffer }
    }

    // 否则返回文本
    const data = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  })
  return result
})

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options.title || '选择文件',
    filters: options.filters || [],
    properties: options.properties || ['openFile']
  })
  return result
})

ipcMain.handle('get-app-path', (event, name) => {
  return app.getPath(name)
})

ipcMain.handle('exists', async (event, filePath) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('mkdir', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('readdir', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: true, data: [] }
    }
    const files = fs.readdirSync(dirPath)
    return { success: true, data: files }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('unlink', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('read-config', async () => {
  try {
    const configPath = getConfigPath()
    if (!fs.existsSync(configPath)) {
      return { success: false, error: 'Config file not found' }
    }
    const data = fs.readFileSync(configPath, 'utf-8')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('save-config', async (event, data) => {
  try {
    const configPath = getConfigPath()
    fs.writeFileSync(configPath, data, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// Deep link IPC handler
ipcMain.handle('get-deep-link', () => {
  const url = pendingDeepLinkUrl
  pendingDeepLinkUrl = null // Clear after reading
  return url
})

// 音频转写 IPC 处理
ipcMain.handle('transcribe-audio', async (event, audioData, mimeType, config) => {
  try {
    if (!sherpaOnnx) {
      return { success: false, error: 'Sherpa-ONNX not available' }
    }

    // 等待识别器初始化完成
    if (!recognizerReady) {
      if (!recognizerInitializing) {
        console.log('Recognizer not ready, creating...')
        recognizerInitializing = true
        recognizer = createRecognizer()
      } else {
        console.log('Recognizer is initializing, waiting...')
        const maxWait = 10000
        const startTime = Date.now()
        while (!recognizerReady && (Date.now() - startTime) < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        if (!recognizerReady) {
          return { success: false, error: '识别器初始化超时，请稍后重试' }
        }
      }
    }

    if (!recognizer) {
      return { success: false, error: 'Failed to create recognizer' }
    }

    // 将数组转换为 Buffer
    const buffer = Buffer.from(audioData)

    console.log('Transcribe audio received:', {
      mimeType,
      bufferSize: buffer.length,
      audioDataLength: audioData.length
    })

    // 创建临时文件保存音频
    const tempDir = path.join(app.getPath('temp'), 'sherpa-onnx')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const tempWavPath = path.join(tempDir, `audio_${Date.now()}.wav`)
    const tempInputPath = path.join(tempDir, `input_${Date.now()}.${mimeType.split('/')[1] || 'webm'}`)

    // 写入原始音频文件
    fs.writeFileSync(tempInputPath, buffer)
    console.log('Input audio saved to:', tempInputPath, 'size:', buffer.length)

    // 如果是 webm 格式，尝试使用 ffmpeg 转换，或者直接使用 sherpa-onnx 读取
    let wave = null
    let finalWavPath = tempInputPath

    // 检查是否是 WAV 格式
    if (mimeType === 'audio/wav' || tempInputPath.endsWith('.wav')) {
      // 直接读取 WAV
      wave = sherpaOnnx.readWave(tempInputPath)
      if (!wave || wave.samples.length === 0) {
        console.error('Failed to read wave file or empty samples')
        fs.unlinkSync(tempInputPath)
        return { success: false, error: '无法读取音频文件或音频为空' }
      }
    } else {
      // 对于非 WAV 格式，尝试直接读取（sherpa-onnx 可能支持）
      // 如果失败，则需要使用 ffmpeg 转换
      try {
        wave = sherpaOnnx.readWave(tempInputPath)
        if (wave && wave.samples.length > 0) {
          console.log('Successfully read non-WAV file')
        } else {
          throw new Error('Empty samples')
        }
      } catch (readError) {
        console.warn('Cannot read non-WAV file directly, need ffmpeg conversion:', readError)
        // TODO: 集成 ffmpeg 进行格式转换
        fs.unlinkSync(tempInputPath)
        return { 
          success: false, 
          error: '不支持的音频格式。请使用 WAV 格式录音，或安装 ffmpeg 进行格式转换。' 
        }
      }
    }

    // 使用 Sherpa-ONNX 进行识别
    const stream = recognizer.createStream()
    stream.acceptWaveform(wave.sampleRate, wave.samples)
    recognizer.decode(stream)
    const result = recognizer.getResult(stream)

    console.log('Transcription result:', result)

    // 清理资源
    stream.free()

    // 删除临时文件
    try {
      fs.unlinkSync(tempInputPath)
      if (finalWavPath !== tempInputPath && fs.existsSync(finalWavPath)) {
        fs.unlinkSync(finalWavPath)
      }
    } catch (e) {
      console.warn('Failed to delete temp file:', e)
    }

    return {
      success: true,
      text: result.text
    }
  } catch (error) {
    console.error('Transcription error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})
