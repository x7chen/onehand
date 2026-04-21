#!/usr/bin/env node
/**
 * 笔记数据格式转换脚本
 *
 * 将结构性画布格式转换为扁平化格式：
 * - 原来：笔记本 → 画布数组 → 节点数组（嵌套在画布里）
 * - 目标：笔记本 → 节点数组（节点有 canvasId 属性指向所属画布）
 *
 * 使用方法：
 *   node scripts/convert-notebook-format.js [userDataPath]
 *
 * 参数：
 *   userDataPath - 可选，用户数据目录路径。默认使用 Electron 的 userData 目录
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

// 获取 userData 目录
function getUserDataPath() {
  // macOS: ~/Library/Application Support/OneHand
  // Windows: %APPDATA%/OneHand
  // Linux: ~/.config/OneHand
  const appName = 'OneHand'

  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName)
    case 'win32':
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName)
    case 'linux':
      return path.join(os.homedir(), '.config', appName)
    default:
      return path.join(os.homedir(), '.config', appName)
  }
}

// 转换笔记本数据格式
function convertNotebook(notebook) {
  console.log(`转换笔记本: ${notebook.name} (${notebook.id})`)

  // 提取所有节点，并添加 canvasId 属性
  const allNodes = []
  const canvasInfos = []

  if (notebook.canvases && notebook.canvases.length > 0) {
    for (const canvas of notebook.canvases) {
      // 创建画布信息（不含节点）
      canvasInfos.push({
        id: canvas.id,
        type: canvas.type,
        viewport: canvas.viewport,
        createdAt: canvas.createdAt,
        pdfPage: canvas.pdfPage
      })

      // 提取节点并添加 canvasId
      if (canvas.nodes && canvas.nodes.length > 0) {
        for (const node of canvas.nodes) {
          allNodes.push({
            ...node,
            canvasId: canvas.id
          })
        }
      }
    }

    // 获取当前画布 ID（替代 index）
    const currentIndex = notebook.currentCanvasIndex ?? 0
    const currentCanvasId = notebook.canvases[currentIndex]?.id || null

    // 返回转换后的笔记本
    const converted = {
      ...notebook,
      nodes: allNodes,
      canvases: canvasInfos,
      currentCanvasId: currentCanvasId,
      // 移除旧的 index 属性
      currentCanvasIndex: undefined
    }

    console.log(`  - 画布数量: ${canvasInfos.length}`)
    console.log(`  - 节点数量: ${allNodes.length}`)
    console.log(`  - 当前画布 ID: ${currentCanvasId}`)

    return converted
  }

  // 如果没有画布数据，保持原样
  console.log(`  - 无画布数据，跳过`)
  return notebook
}

// 主函数
async function main() {
  // 获取用户数据路径
  const userDataPath = process.argv[2] || getUserDataPath()
  const notebooksDir = path.join(userDataPath, 'notebooks')

  console.log(`用户数据目录: ${userDataPath}`)
  console.log(`笔记本目录: ${notebooksDir}`)

  // 检查目录是否存在
  if (!fs.existsSync(notebooksDir)) {
    console.error(`笔记本目录不存在: ${notebooksDir}`)
    console.log('请先运行应用程序创建笔记本数据，或指定正确的 userData 路径')
    process.exit(1)
  }

  // 读取所有笔记本文件
  const files = fs.readdirSync(notebooksDir)
    .filter(f => f.endsWith('.json'))

  console.log(`找到 ${files.length} 个笔记本文件`)

  // 备份目录
  const backupDir = path.join(userDataPath, 'notebooks-backup-' + Date.now())
  fs.mkdirSync(backupDir, { recursive: true })
  console.log(`备份目录: ${backupDir}`)

  // 转换每个笔记本
  let successCount = 0
  let errorCount = 0

  for (const file of files) {
    const filePath = path.join(notebooksDir, file)

    try {
      // 读取原始数据
      const content = fs.readFileSync(filePath, 'utf-8')
      const notebook = JSON.parse(content)

      // 备份原始文件
      fs.copyFileSync(filePath, path.join(backupDir, file))

      // 转换格式
      const converted = convertNotebook(notebook)

      // 写入转换后的数据
      fs.writeFileSync(filePath, JSON.stringify(converted, null, 2), 'utf-8')

      successCount++
    } catch (error) {
      console.error(`转换失败: ${file}`, error.message)
      errorCount++
    }
  }

  console.log('\n转换完成:')
  console.log(`  - 成功: ${successCount}`)
  console.log(`  - 失败: ${errorCount}`)
  console.log(`  - 备份位置: ${backupDir}`)

  if (errorCount > 0) {
    console.log('\n如果有失败的转换，可以从备份恢复:')
    console.log(`  cp -r ${backupDir}/* ${notebooksDir}/`)
  }
}

main().catch(console.error)