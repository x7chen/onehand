/**
 * 自动下载 Sherpa-ONNX 模型
 * 在构建前运行，确保模型文件存在
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')

// 模型配置
const MODEL_CONFIG = {
  name: 'sherpa-onnx-paraformer-zh-small-2024-03-09',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2',
  archiveName: 'sherpa-onnx-paraformer-zh-small-2024-03-09.tar.bz2',
}

// 路径配置
const PROJECT_ROOT = path.join(__dirname, '..')
const MODELS_DIR = path.join(PROJECT_ROOT, 'build', 'models')
const MODEL_DIR = path.join(MODELS_DIR, MODEL_CONFIG.name)
const ARCHIVE_PATH = path.join(MODELS_DIR, MODEL_CONFIG.archiveName)

// 需要检查的文件
const REQUIRED_FILES = [
  'model.int8.onnx',
  'tokens.txt',
]

/**
 * 检查模型是否已存在
 */
function checkModelExists() {
  if (!fs.existsSync(MODEL_DIR)) {
    return false
  }

  // 检查必需文件是否存在
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(MODEL_DIR, file)
    if (!fs.existsSync(filePath)) {
      console.log(`Missing file: ${file}`)
      return false
    }
  }

  console.log('Model already exists and is complete.')
  return true
}

/**
 * 下载文件
 */
async function downloadFile(url, dest) {
  console.log(`Downloading from: ${url}`)

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)

    https.get(url, { timeout: 300000 }, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`Redirecting to: ${response.headers.location}`)
        file.close()
        fs.unlinkSync(dest)
        downloadFile(response.headers.location, dest).then(resolve).catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        reject(new Error(`Download failed with status code: ${response.statusCode}`))
        return
      }

      const totalSize = parseInt(response.headers['content-length'], 10)
      let downloadedSize = 0
      let lastPercent = 0

      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        if (totalSize > 0) {
          const percent = Math.floor((downloadedSize / totalSize) * 100)
          if (percent !== lastPercent && percent % 10 === 0) {
            console.log(`Download progress: ${percent}%`)
            lastPercent = percent
          }
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        console.log('Download completed.')
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest)
      }
      reject(err)
    })
  })
}

/**
 * 解压 tar.bz2 文件
 */
function extractArchive(archivePath, destDir) {
  console.log(`Extracting ${path.basename(archivePath)}...`)

  // 确保目标目录存在
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  // 使用 tar 命令解压（Windows 和 Linux/Mac 都支持）
  try {
    // 先尝试使用系统 tar 命令
    if (process.platform === 'win32') {
      // Windows 可能需要使用 7z 或其他工具
      try {
        execSync(`tar -xjf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' })
      } catch (e) {
        // 尝试使用 PowerShell
        console.log('Trying PowerShell extraction...')
        execSync(
          `powershell -Command "& {\$tar = tar -xjf '${archivePath}' -C '${destDir}'; exit \$LASTEXITCODE}"`,
          { stdio: 'inherit' }
        )
      }
    } else {
      execSync(`tar -xjf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' })
    }
    console.log('Extraction completed.')
  } catch (error) {
    throw new Error(`Failed to extract archive: ${error.message}`)
  }
}

/**
 * 清理临时文件
 */
function cleanup(archivePath) {
  try {
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath)
      console.log('Cleaned up archive file.')
    }
  } catch (e) {
    console.warn('Failed to cleanup:', e.message)
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60))
  console.log('Sherpa-ONNX Model Downloader')
  console.log('='.repeat(60))
  console.log(`Model: ${MODEL_CONFIG.name}`)
  console.log(`Target directory: ${MODEL_DIR}`)
  console.log('')

  // 检查模型是否已存在
  if (checkModelExists()) {
    console.log('✓ Model is ready.')
    return
  }

  // 创建模型目录
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true })
    console.log('Created models directory.')
  }

  // 下载模型
  try {
    await downloadFile(MODEL_CONFIG.url, ARCHIVE_PATH)
  } catch (error) {
    console.error('✗ Failed to download model:', error.message)
    console.log('')
    console.log('Please try:')
    console.log('1. Check your network connection')
    console.log('2. Use a proxy or VPN if GitHub is blocked')
    console.log('3. Manually download from:')
    console.log(`   ${MODEL_CONFIG.url}`)
    console.log('   And extract to:', MODEL_DIR)
    process.exit(1)
  }

  // 验证下载文件
  const stats = fs.statSync(ARCHIVE_PATH)
  console.log(`Archive size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)

  if (stats.size < 1000000) {
    console.error('✗ Downloaded file is too small, possibly an error page.')
    cleanup(ARCHIVE_PATH)
    process.exit(1)
  }

  // 解压模型
  try {
    extractArchive(ARCHIVE_PATH, MODELS_DIR)
  } catch (error) {
    console.error('✗ Failed to extract:', error.message)
    cleanup(ARCHIVE_PATH)
    process.exit(1)
  }

  // 清理临时文件
  cleanup(ARCHIVE_PATH)

  // 验证模型文件
  if (!checkModelExists()) {
    console.error('✗ Model files are incomplete after extraction.')
    process.exit(1)
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('✓ Model downloaded and extracted successfully!')
  console.log('='.repeat(60))
}

// 运行主函数
main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
