import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Check for single instance lock (needed for deep link handling on Windows)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit()
}

// Sherpa-ONNX 相关
let sherpaOnnx = null
try {
  sherpaOnnx = await import('sherpa-onnx')
  console.log('Sherpa-ONNX loaded successfully')
} catch (e) {
  console.warn('Failed to load sherpa-onnx:', e.message)
}

// VectorDb Manager
let vectorDbManager = null
try {
  const { VectorDbManager } = await import('./vectorDbManager.js')
  vectorDbManager = new VectorDbManager(app.getPath('userData'))
  console.log('VectorDbManager loaded successfully')
} catch (e) {
  console.warn('Failed to load VectorDbManager:', e.message)
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

  // 标题栏策略：
  // macOS: 保持原生标题栏，红绿灯按钮由系统提供
  // Windows/Linux: 无边框窗口，使用自定义标题栏 + Window Controls Overlay (WCO)
  const isCustomTitlebar = process.platform !== 'darwin'

  // 窗口配置
  const windowOptions = {
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
    frame: !isCustomTitlebar, // macOS 有原生frame，Windows/Linux 无边框
    backgroundColor: backgroundColor,
    show: false, // Don't show until ready
    paintWhenInitiallyHidden: true
  }

  // Windows/Linux: 使用 titleBarStyle: 'hidden' + titleBarOverlay 启用 WCO
  // 这样可以显示系统的 Snap Layout 选择器（悬停最大化按钮时的桌面布局选择）
  if (isCustomTitlebar) {
    windowOptions.titleBarStyle = 'hidden'
    windowOptions.titleBarOverlay = {
      height: 32,  // 标题栏高度
      color: backgroundColor,  // 标题栏背景色
      symbolColor: '#e0e0e0'  // 控制按钮颜色（深色背景用浅色图标）
    }
  }

  mainWindow = new BrowserWindow(windowOptions)

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

// 获取 embedding 配置
async function getEmbeddingConfig() {
  try {
    const configPath = getConfigPath()
    if (!fs.existsSync(configPath)) {
      return null
    }
    const configData = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configData)

    // 从 settings 中获取 embedding 配置
    const embeddingProfileId = config.llm?.embeddingProfileId
    const profiles = config.llm?.profiles || []
    let profile = embeddingProfileId
      ? profiles.find(p => p.id === embeddingProfileId)
      : profiles[0]

    if (!profile) {
      profile = profiles[0]
    }

    if (!profile) {
      console.error('No embedding profile available')
      return null
    }

    return {
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      model: profile.model,
      dimensions: config.llm?.embeddingDimension || 1536
    }
  } catch (error) {
    console.error('Failed to get embedding config:', error)
    return null
  }
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

ipcMain.handle('copy-file', async (event, srcPath, destPath) => {
  try {
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.copyFileSync(srcPath, destPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
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

ipcMain.handle('move-file', async (event, srcPath, destPath) => {
  try {
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.renameSync(srcPath, destPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('move-dir', async (event, srcPath, destPath) => {
  try {
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.renameSync(srcPath, destPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('rmdir', async (event, dirPath) => {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
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

// 窗口控制 IPC 处理（用于Windows自定义标题栏）
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close()
})

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false
})

// 获取应用图标 DataURL (base64)
ipcMain.handle('get-icon-data-url', () => {
  const isDev = process.argv.includes('--dev') || !fs.existsSync(path.join(__dirname, '../dist/index.html'))

  let iconPath
  if (isDev) {
    iconPath = path.join(PROJECT_ROOT, 'build/icon.ico')
  } else {
    iconPath = path.join(__dirname, '../build/icon.ico')
  }

  if (!fs.existsSync(iconPath)) {
    console.error('Icon file not found:', iconPath)
    return null
  }

  const iconBuffer = fs.readFileSync(iconPath)
  const base64 = iconBuffer.toString('base64')
  return `data:image/x-icon;base64,${base64}`
})

// 获取系统语言
ipcMain.handle('get-system-locale', () => {
  return app.getLocale()
})

// 打开本地文件（使用系统默认程序）
ipcMain.handle('open-path', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }
    // shell.openPath 会用系统默认程序打开文件
    await shell.openPath(filePath)
    return { success: true }
  } catch (error) {
    console.error('Failed to open path:', error)
    return { success: false, error: String(error) }
  }
})

// ========== Vector Database IPC Handlers (embedJs) ==========

/**
 * 初始化向量数据库
 */
ipcMain.handle('init-vector-db', async (event, dimension = 1536, maxElements = 100000) => {
  try {
    if (!vectorDbManager) {
      return { success: false, error: 'VectorDbManager not available' }
    }

    // 读取用户配置，获取自定义路径
    try {
      const configPath = getConfigPath()
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const userFilesPath = configData?.general?.userFilesPath
        if (userFilesPath && userFilesPath.trim() !== '') {
          vectorDbManager.setCustomPath(userFilesPath.trim())
        }
      }
    } catch (e) {
      console.warn('Failed to read user config for custom path:', e.message)
    }

    // 获取 embedding 配置
    const config = await getEmbeddingConfig()
    if (!config) {
      return { success: false, error: 'No embedding configuration found' }
    }

    // 使用配置中的 dimension
    const finalDimension = config.dimensions || dimension

    const result = await vectorDbManager.init({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      dimensions: finalDimension
    })

    return { success: true, dimension: result.dimension, maxElements }
  } catch (error) {
    console.error('Failed to init vector DB:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 索引笔记本节点（分批处理，发送进度更新，跳过失败的节点）
 * 全量索引：删除所有旧数据后重新索引
 */
ipcMain.handle('index-nodes', async (event, nodes) => {
  try {
    if (!vectorDbManager || !vectorDbManager.isInitialized()) {
      return { success: false, error: 'Vector DB not initialized' }
    }

    console.log(`index-nodes: received ${nodes.length} nodes from frontend`)

    // 获取并删除所有已有的 loaders，确保干净的状态
    const existingLoaders = await vectorDbManager.getLoaders()
    for (const loader of existingLoaders) {
      try {
        await vectorDbManager.deleteByLoaderId(loader.uniqueId)
      } catch (e) {
        console.warn(`Failed to delete loader ${loader.uniqueId}:`, e.message || e)
      }
    }

    // 使用时间戳作为本次索引的唯一ID，避免批次间的 loaderId 冲突
    const sessionId = `NotebookLoader_${Date.now()}`

    const BATCH_SIZE = 10  // 每批处理10个节点
    const totalNodes = nodes.length
    let totalIndexed = 0
    let failedCount = 0
    const failedNodes = []

    event.sender.send('index-progress', { progress: 0, total: totalNodes, indexed: 0, failed: 0 })

    for (let i = 0; i < totalNodes; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE)
      const batchLoaderId = `${sessionId}_batch_${i}`

      try {
        const count = await vectorDbManager.indexNodesWithLoaderId(batch, batchLoaderId)
        totalIndexed += count
      } catch (batchError) {
        console.warn(`Batch failed at index ${i}:`, batchError.message || batchError)
        for (const node of batch) {
          try {
            const nodeLoaderId = `${node.notebookId}:${node.nodeId}:${node.fieldType}`
            const count = await vectorDbManager.indexNodesWithLoaderId([node], nodeLoaderId)
            totalIndexed += count
          } catch (nodeError) {
            console.warn(`Failed to index node ${node.nodeId} (${node.fieldType}):`, nodeError.message || nodeError)
            failedCount++
            failedNodes.push(`${node.nodeId}:${node.fieldType}`)
          }
        }
      }

      const progress = Math.round((Math.min(i + BATCH_SIZE, totalNodes) / totalNodes) * 100)
      event.sender.send('index-progress', { progress, total: totalNodes, indexed: totalIndexed, failed: failedCount })
    }

    console.log(`Indexing complete: ${totalIndexed} indexed, ${failedCount} failed`)

    const finalCount = await vectorDbManager.getEmbeddingsCount()
    console.log(`Final embeddings count after indexing: ${finalCount}`)

    return { success: true, entriesAdded: totalIndexed, failedCount, failedNodes }
  } catch (error) {
    console.error('Failed to index nodes:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 增量索引：只索引传入的节点，不删除旧数据
 * 使用 source 作为 loaderId 支持精确更新
 */
ipcMain.handle('index-nodes-incremental', async (event, nodes) => {
  try {
    if (!vectorDbManager || !vectorDbManager.isInitialized()) {
      return { success: false, error: 'Vector DB not initialized' }
    }

    if (nodes.length === 0) {
      return { success: true, entriesAdded: 0 }
    }

    let totalIndexed = 0
    let skippedCount = 0
    const BATCH_SIZE = 5

    event.sender.send('index-progress', { progress: 0, total: nodes.length, indexed: 0, failed: 0 })

    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE)

      for (const node of batch) {
        try {
          const loaderId = `${node.notebookId}:${node.nodeId}:${node.fieldType}`
          const count = await vectorDbManager.indexNodesWithLoaderId([node], loaderId)
          totalIndexed += count
          if (count === 0) {
            skippedCount++
          }
        } catch (nodeError) {
          console.warn(`index-nodes-incremental: FAILED node ${node.nodeId}:`, nodeError.message || nodeError)
        }
      }

      const progress = Math.round((Math.min(i + BATCH_SIZE, nodes.length) / nodes.length) * 100)
      event.sender.send('index-progress', { progress, total: nodes.length, indexed: totalIndexed, failed: 0 })
    }

    const finalCount = await vectorDbManager.getEmbeddingsCount()

    return { success: true, entriesAdded: totalIndexed, skippedCount }
  } catch (error) {
    console.error('Failed to index nodes incrementally:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 删除指定 source 的索引数据
 */
ipcMain.handle('delete-indexed-nodes', async (event, sources) => {
  try {
    if (!vectorDbManager || !vectorDbManager.isInitialized()) {
      return { success: false, error: 'Vector DB not initialized' }
    }

    let deletedCount = 0

    for (const source of sources) {
      try {
        const deleted = await vectorDbManager.deleteBySource(source)
        if (deleted) {
          deletedCount++
        }
      } catch (e) {
        console.warn(`Failed to delete source ${source}:`, e.message || e)
      }
    }

    return { success: true, deletedCount }
  } catch (error) {
    console.error('Failed to delete indexed nodes:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 删除基于 textHash 的索引数据
 * 用于删除已不存在的内容
 */
ipcMain.handle('delete-indexed-nodes-by-text-hash', async (event, textHash) => {
  try {
    if (!vectorDbManager || !vectorDbManager.isInitialized()) {
      return { success: false, error: 'Vector DB not initialized' }
    }

    const deletedCount = await vectorDbManager.deleteByTextHash(textHash)
    return { success: true, deletedCount }
  } catch (error) {
    console.error('Failed to delete indexed nodes by textHash:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 语义搜索
 */
ipcMain.handle('semantic-search', async (event, query, topK = 20) => {
  try {
    if (!vectorDbManager || !vectorDbManager.isInitialized()) {
      return { success: false, error: 'Vector DB not initialized' }
    }

    const results = await vectorDbManager.search(query, topK)

    // 转换结果格式
    const formattedResults = results.map(r => ({
      pageContent: r.pageContent,
      score: r.score,
      metadata: r.metadata
    }))

    return { success: true, results: formattedResults }
  } catch (error) {
    console.error('Semantic search error:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 重置向量数据库
 */
ipcMain.handle('reset-vector-db', async () => {
  try {
    if (!vectorDbManager) {
      return { success: false, error: 'VectorDbManager not available' }
    }

    await vectorDbManager.reset()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

/**
 * 删除指定 loader 的数据
 */
ipcMain.handle('delete-loader', async (event, loaderId) => {
  try {
    if (!vectorDbManager || !vectorDbManager.isInitialized()) {
      return { success: false, error: 'Vector DB not initialized' }
    }

    const result = await vectorDbManager.deleteByLoaderId(loaderId)
    return { success: result }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

/**
 * 获取向量数据库状态
 */
ipcMain.handle('get-vector-db-status', async () => {
  try {
    const initialized = vectorDbManager?.isInitialized() || false
    const entriesCount = initialized ? await vectorDbManager.getEmbeddingsCount() : 0
    console.log(`get-vector-db-status: initialized=${initialized}, entriesCount=${entriesCount}`)

    // 如果已初始化，也获取 loaders 信息
    if (initialized) {
      const loaders = await vectorDbManager.getLoaders()
    }

    return {
      success: true,
      status: {
        initialized,
        entriesCount,
        dimension: 0,  // embedJs 不直接提供 dimension
        maxElements: 0,
        hnswlibAvailable: vectorDbManager !== null
      }
    }
  } catch (error) {
    console.error('get-vector-db-status error:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 获取已加载的 loaders 列表
 */
ipcMain.handle('get-loaders', async () => {
  try {
    if (!vectorDbManager || !vectorDbManager.isInitialized()) {
      return { success: true, loaders: [] }
    }

    const loaders = await vectorDbManager.getLoaders()
    return { success: true, loaders }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

/**
 * 获取所有已索引数据的 textHash
 * 同时计算索引状态（基于 textHash 内容去重判断）
 */
ipcMain.handle('get-index-status-full', async (event, currentNodes) => {
  try {
    const uniqueTextHashes = new Set(currentNodes.map(n => n.textHash))
    const totalNodes = uniqueTextHashes.size

    if (!vectorDbManager) {
      return {
        success: true,
        totalNodes,
        indexedNodes: 0,
        outdatedNodes: totalNodes,
        hashes: {}
      }
    }

    const indexedHashes = await vectorDbManager.getAllIndexedHashes()
    const indexedTextHashes = new Set(Object.values(Object.fromEntries(indexedHashes)))

    let newContentCount = 0
    for (const textHash of uniqueTextHashes) {
      if (!indexedTextHashes.has(textHash)) {
        newContentCount++
      }
    }

    let deletedContentCount = 0
    for (const indexedTextHash of indexedTextHashes) {
      if (!uniqueTextHashes.has(indexedTextHash)) {
        deletedContentCount++
      }
    }

    const indexedNodes = indexedTextHashes.size
    const outdatedNodes = newContentCount + deletedContentCount

    return {
      success: true,
      totalNodes,
      indexedNodes,
      outdatedNodes,
      hashes: Object.fromEntries(indexedHashes)
    }
  } catch (error) {
    console.error('get-index-status-full error:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 获取所有已索引数据的 source 和 textHash（用于增量更新计算）
 * 用于检测内容变化
 */
ipcMain.handle('get-indexed-hashes', async () => {
  try {
    if (!vectorDbManager) {
      return { success: false, hashes: {} }
    }

    const hashes = await vectorDbManager.getAllIndexedHashes()
    // Map 转 Object 以便 IPC 传输
    return { success: true, hashes: Object.fromEntries(hashes) }
  } catch (error) {
    console.error('get-indexed-hashes error:', error)
    return { success: false, error: String(error) }
  }
})