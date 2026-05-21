/**
 * 导出工具函数
 * 用于代码块和图表的复制、下载功能
 */

/**
 * 下载文本文件
 * @param content 文件内容
 * @param filename 文件名（不含扩展名）
 * @param extension 文件扩展名
 */
export function downloadTextFile(
  content: string,
  filename: string,
  extension: string = 'txt'
): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${extension}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  URL.revokeObjectURL(url)
}

/**
 * SVG 元素转换为 PNG Blob
 * @param svgElement SVG 元素
 * @param scale 缩放比例（提高分辨率）
 * @returns PNG Blob
 */
export async function svgToPng(
  svgElement: SVGElement,
  scale: number = 2
): Promise<Blob | null> {
  try {
    // 获取 SVG 尺寸
    const svgRect = svgElement.getBoundingClientRect()
    const width = svgRect.width || svgElement.getAttribute('width') || 800
    const height = svgRect.height || svgElement.getAttribute('height') || 600

    // 序列化 SVG
    const svgData = new XMLSerializer().serializeToString(svgElement)

    // 确保 SVG 有正确的 xmlns
    const svgWithNamespace = svgData.includes('xmlns')
      ? svgData
      : svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')

    // 创建 Blob 和 URL
    const svgBlob = new Blob([svgWithNamespace], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    // 创建 Image 加载 SVG
    const img = new Image()
    img.src = url

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load SVG'))
    })

    // 创建 Canvas 并绘制
    const canvas = document.createElement('canvas')
    canvas.width = Number(width) * scale
    canvas.height = Number(height) * scale

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(url)
      return null
    }

    // 设置白色背景（避免透明背景问题）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, Number(width), Number(height))

    URL.revokeObjectURL(url)

    // 转换为 PNG Blob
    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else resolve(null as any)
      }, 'image/png')
    })
  } catch (err) {
    console.error('[ExportUtils] svgToPng error:', err)
    return null
  }
}

/**
 * 复制 PNG 到剪贴板
 * @param blob PNG Blob
 * @returns 是否成功
 */
export async function copyPngToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ])
    return true
  } catch (err) {
    console.error('[ExportUtils] copyPngToClipboard error:', err)
    return false
  }
}

/**
 * 复制文本到剪贴板
 * @param text 文本内容
 * @returns 是否成功
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('[ExportUtils] copyTextToClipboard error:', err)
    return false
  }
}

/**
 * 下载 Blob 文件
 * @param blob Blob 对象
 * @param filename 文件名
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 下载 SVG 元素为 SVG 文件
 * @param svgElement SVG 元素
 * @param filename 文件名
 */
export function downloadSvg(svgElement: SVGElement, filename: string): void {
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const svgWithNamespace = svgData.includes('xmlns')
    ? svgData
    : svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')

  const blob = new Blob([svgWithNamespace], { type: 'image/svg+xml;charset=utf-8' })
  downloadBlob(blob, `${filename}.svg`)
}

/**
 * 下载 SVG 元素为 PNG 文件
 * @param svgElement SVG 元素
 * @param filename 文件名
 * @param scale 缩放比例
 */
export async function downloadPng(
  svgElement: SVGElement,
  filename: string,
  scale: number = 2
): Promise<boolean> {
  const blob = await svgToPng(svgElement, scale)
  if (blob) {
    downloadBlob(blob, `${filename}.png`)
    return true
  }
  return false
}

/**
 * 获取语言对应的文件扩展名
 * @param language 语言名称
 * @returns 文件扩展名
 */
export function getLanguageExtension(language: string): string {
  const extensionMap: Record<string, string> = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'csharp': 'cs',
    'go': 'go',
    'rust': 'rs',
    'ruby': 'rb',
    'php': 'php',
    'swift': 'swift',
    'kotlin': 'kt',
    'scala': 'scala',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'shell': 'sh',
    'bash': 'sh',
    'powershell': 'ps1',
    'markdown': 'md',
    'dockerfile': 'dockerfile',
    'vue': 'vue',
    'react': 'jsx',
    'tsx': 'tsx'
  }

  const normalized = language.toLowerCase()
  return extensionMap[normalized] || normalized || 'txt'
}