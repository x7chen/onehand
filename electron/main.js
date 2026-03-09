const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow = null

// 配置文件路径 - 始终使用用户数据目录
const getConfigPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'config.json')
}

function createWindow() {
  // Default to dark mode background
  const backgroundColor = '#2d2d2d'
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
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
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
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
