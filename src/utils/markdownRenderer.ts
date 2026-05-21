/**
 * Markdown 渲染器 - unified/remark/rehype 生态
 * 支持：代码高亮、LaTeX 公式、Mermaid 图表、任务列表、表格
 * 使用 remark-cjk-friendly 解决中文 emphasis 问题
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeStringify from 'rehype-stringify'
import rehypeExternalLinks from 'rehype-external-links'
import { visit } from 'unist-util-visit'
import { fromHtml } from 'hast-util-from-html'
import { createHighlighter, type Highlighter } from 'shiki'
import { getNotebookDataDir } from '@/utils/userFilesPath'
import {
  downloadTextFile,
  svgToPng,
  copyPngToClipboard,
  downloadSvg,
  downloadPng,
  getLanguageExtension
} from '@/utils/exportUtils'
import i18n from '@/i18n'
import type { Element, Root } from 'hast'

const t = i18n.global.t

// ============================================
// 缓存机制
// ============================================
const markdownCache = new Map<string, string>()
const MAX_CACHE_SIZE = 100
const imageBlobCache = new Map<string, string>()
let disableCache = false

export function clearMarkdownCache() {
  markdownCache.clear()
}

export function clearImageCache() {
  imageBlobCache.clear()
}

export function setMarkdownCacheEnabled(enabled: boolean) {
  disableCache = !enabled
}

// ============================================
// Shiki Highlighter 单例
// ============================================
let highlighter: Highlighter | null = null
let highlighterPromise: Promise<void> | null = null

const COMMON_LANGS = [
  'javascript', 'typescript', 'vue', 'python', 'java',
  'cpp', 'c', 'csharp', 'go', 'rust', 'ruby', 'php', 'swift',
  'kotlin', 'html', 'css', 'scss', 'json', 'yaml',
  'xml', 'markdown', 'sql', 'shell', 'bash',
  'dockerfile', 'diff', 'tsx', 'jsx', 'vue-html'
]

export async function preInitHighlighter(): Promise<void> {
  if (highlighter || highlighterPromise) {
    return highlighterPromise || Promise.resolve()
  }

  highlighterPromise = createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: COMMON_LANGS,
  }).then(h => {
    highlighter = h
  })

  return highlighterPromise
}

// ============================================
// 辅助函数
// ============================================
function escapeHtml(html: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return html.replace(/[&<>"']/g, (char) => escapeMap[char])
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed|form)[^>]*>.*?<\/\1>|<(script|iframe|object|embed|form)[^>]*\/?>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/(javascript|vbscript):/gi, '')
    .trim()
}

function getLanguageFromClass(className: string | string[] | undefined): string | null {
  if (!className) return null
  const classes = Array.isArray(className) ? className : [className]
  const langClass = classes.find(c => typeof c === 'string' && c.startsWith('language-'))
  return langClass ? langClass.replace('language-', '') : null
}

function getTextContent(node: Element | Root): string {
  let text = ''
  if ('value' in node && typeof node.value === 'string') {
    text += node.value
  }
  if ('children' in node && node.children) {
    for (const child of node.children) {
      if (child.type === 'text' && 'value' in child) {
        text += child.value
      } else if (child.type === 'element') {
        text += getTextContent(child)
      }
    }
  }
  return text
}

// ============================================
// 自定义 rehype 插件：Shiki 代码高亮
// ============================================
function rehypeShiki(options: { highlighter: Highlighter }) {
  const { highlighter } = options

  return (tree: Root) => {
    const isDark = document.documentElement.classList.contains('dark')

    visit(tree, 'element', (node: Element, index: number | undefined, parent: Element | Root | undefined) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return

      const codeNode = node.children?.find(
        (child) => child.type === 'element' && child.tagName === 'code'
      ) as Element | undefined

      if (!codeNode) return

      const lang = getLanguageFromClass(codeNode.properties?.className as string | string[] | undefined) || 'text'
      const content = getTextContent(codeNode)

      // Mermaid 特殊处理
      if (lang === 'mermaid') {
        const mermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        console.log('[MarkdownRenderer] Processing mermaid block, lang:', lang, 'content:', content.substring(0, 50))
        node.tagName = 'div'
        node.properties = {
          ...node.properties,
          className: ['mermaid-wrapper'],
          // HAST 属性名使用驼峰命名，会被转换为 data-mermaid-id
          dataMermaidId: mermaidId,
          dataMermaidDefinition: content
        }
        node.children = [{
          type: 'element',
          tagName: 'pre',
          properties: { className: ['mermaid'], id: mermaidId },
          children: [{ type: 'text', value: content }]
        }]
        return 'skip' // 停止遍历子节点
      }

      // Shiki 高亮
      try {
        const html = highlighter.codeToHtml(content, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' }
        })

        // 解析 Shiki 输出的 HTML 并注入到 HAST
        const hast = fromHtml(html, { fragment: true })
        if (hast.children && hast.children.length > 0) {
          // 找到 pre 元素
          const preElement = hast.children.find(
            (child) => child.type === 'element' && child.tagName === 'pre'
          ) as Element | undefined

          if (preElement) {
            node.children = preElement.children
            node.properties = {
              ...node.properties,
              className: ['shiki', `language-${lang}`, ...((preElement.properties?.className as string[]) || [])],
              dataLang: lang  // 添加语言标识属性
            }
          }
        }
      } catch (e) {
        console.warn('[MarkdownRenderer] Shiki highlight error:', e)
        // 保持原样
      }
    })

    return tree
  }
}

// ============================================
// 自定义 rehype 插件：Mermaid 占位符处理（已集成到 rehypeShiki）
// ============================================
function rehypeMermaidPlaceholder() {
  return (tree: Root) => {
    // 此插件主要用于后处理，确保 mermaid-wrapper 结构正确
    // 实际 mermaid 代码块已在 rehypeShiki 中处理
    return tree
  }
}

// ============================================
// 主渲染函数
// ============================================
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return ''

  // 预处理：清理特殊标签
  let processed = markdown
    .replace(/<\/?think>/gi, '')
    .replace(/<\|begin_of_box\|>/gi, '')
    .replace(/<\|end_of_box\|>/gi, '')

  // 缓存检查
  const cacheKey = `v9:${processed.length}:${processed.substring(0, 200)}`
  if (!disableCache && markdownCache.has(cacheKey)) {
    return markdownCache.get(cacheKey)!
  }

  // 确保 highlighter 已初始化
  if (!highlighter) {
    await preInitHighlighter()
  }

  try {
    // 构建 unified processor
    const processor = unified()
      .use(remarkParse)                                    // Markdown → MDAST
      .use(remarkGfm, { singleTilde: false })              // GFM 扩展（表格、任务列表等）
      .use(remarkCjkFriendly)                              // 中文 emphasis 问题修复
      .use(remarkMath)                              // LaTeX 公式识别（默认支持 $...$）
      .use(remarkRehype, { allowDangerousHtml: true })     // MDAST → HAST
      .use(rehypeRaw)                                      // 允许原始 HTML
      .use(rehypeShiki, { highlighter: highlighter! })     // Shiki 代码高亮 + Mermaid
      .use(rehypeMermaidPlaceholder)                       // Mermaid 后处理
      .use(rehypeKatex as any)                           // LaTeX 公式渲染
      .use(rehypeExternalLinks, {                          // 外部链接处理
        target: '_blank',
        rel: ['noopener', 'noreferrer']
      })
      .use(rehypeStringify)                                // HAST → HTML

    const result = await processor.process(processed)
    let html = String(result)

    // 处理 Shiki 双主题切换的 CSS
    html = html.replace(/class="shiki"/g, 'class="shiki" data-theme="auto"')

    // HTML 净化
    const sanitized = sanitizeHtml(html)

    // 缓存结果
    if (!disableCache && markdownCache.size < MAX_CACHE_SIZE) {
      markdownCache.set(cacheKey, sanitized)
    }

    return sanitized
  } catch (error) {
    console.error('[MarkdownRenderer] Error rendering markdown:', error)
    return escapeHtml(markdown)
  }
}

// ============================================
// Mermaid 渲染（客户端）
// ============================================

/**
 * 调整 SVG 以适应容器（最大高度 1000px）
 */
function fitSvgToContainer(wrapper: HTMLElement): void {
  const svg = wrapper.querySelector('.mermaid-svg') as SVGElement | null
  if (!svg) return

  // 获取 SVG 的原始尺寸（通过 viewBox 或 bounding box）
  const viewBox = svg.getAttribute('viewBox')
  if (!viewBox) return

  const viewBoxValues = viewBox.split(' ').map(Number)
  const svgWidth = viewBoxValues[2] || 0
  const svgHeight = viewBoxValues[3] || 0

  if (svgWidth <= 0 || svgHeight <= 0) return

  // 容器尺寸（最大高度 1000px）
  const containerWidth = wrapper.clientWidth || 800
  const maxHeight = 1000

  // 计算缩放比例以适应容器
  const scaleX = containerWidth / svgWidth
  const scaleY = maxHeight / svgHeight
  const scale = Math.min(scaleX, scaleY, 1) // 不放大，只缩小

  // 设置 SVG 尺寸
  const fittedWidth = svgWidth * scale
  const fittedHeight = svgHeight * scale

  svg.style.width = `${fittedWidth}px`
  svg.style.height = `${fittedHeight}px`
  svg.style.maxWidth = '100%'
  svg.style.maxHeight = `${maxHeight}px`
  svg.style.display = 'block'
  svg.style.margin = '0 auto'
}

export async function renderMermaidCharts(container: HTMLElement): Promise<number> {
  if (!container) {
    console.warn('[MarkdownRenderer] renderMermaidCharts called with null container')
    return 0
  }

  const mermaidWrappers = container.querySelectorAll('.mermaid-wrapper')
  console.log('[MarkdownRenderer] Found mermaid wrappers:', mermaidWrappers.length)
  if (mermaidWrappers.length === 0) return 0

  let renderedCount = 0

  try {
    const mermaid = await import('mermaid')

    const isDark = document.documentElement.classList.contains('dark')

    mermaid.default.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    })

    for (const wrapper of mermaidWrappers) {
      if (wrapper.classList.contains('mermaid-rendered')) {
        renderedCount++
        continue
      }

      const mermaidEl = wrapper.querySelector('pre.mermaid') as HTMLElement
      if (!mermaidEl) continue

      let graphDefinition = (mermaidEl.textContent || '').trim()
      graphDefinition = graphDefinition
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/：/g, ':')
        .replace(/，/g, ',')
        .replace(/（/g, '(')
        .replace(/）/g, ')')

      // 保存原始定义到 wrapper 的 data 属性
      wrapper.setAttribute('data-mermaid-definition', graphDefinition)

      const mermaidId = mermaidEl.getAttribute('id') || `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      try {
        const { svg } = await mermaid.default.render(mermaidId, graphDefinition)

        const parser = new DOMParser()
        const doc = parser.parseFromString(svg, 'image/svg+xml')
        const svgEl = doc.querySelector('svg')

        if (svgEl) {
          svgEl.setAttribute('class', 'mermaid-svg')
          // 移除固定尺寸属性，保留 viewBox
          svgEl.removeAttribute('width')
          svgEl.removeAttribute('height')
          svgEl.removeAttribute('style')

          // 确保 viewBox 存在
          const viewBox = svgEl.getAttribute('viewBox')
          if (!viewBox) {
            // 如果没有 viewBox，从内容推断
            const bbox = svgEl.getBBox ? svgEl.getBBox() : null
            if (bbox) {
              svgEl.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
            }
          }

          // 移除 pre.mermaid 元素，只保留 SVG
          mermaidEl.remove()
          wrapper.appendChild(svgEl.cloneNode(true))
          renderedCount++

          // 渲染后调整 SVG 以适应容器
          fitSvgToContainer(wrapper as HTMLElement)
        }

        wrapper.classList.add('mermaid-rendered')
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e)
        console.error('[MarkdownRenderer] Mermaid render error:', e)
        mermaidEl.innerHTML = `<div class="mermaid-error">图表渲染失败：<br/>${escapeHtml(errorMsg)}<br/><br/>原始定义:<br/>${escapeHtml(graphDefinition)}</div>`
        wrapper.classList.add('mermaid-rendered')
      }
    }
  } catch (e) {
    console.error('[MarkdownRenderer] Failed to load mermaid:', e)
  }

  return renderedCount
}

// 重新渲染 Mermaid 图表（主题切换时调用）
export async function reRenderMermaidCharts(container: HTMLElement): Promise<number> {
  if (!container) return 0

  const mermaidWrappers = container.querySelectorAll('.mermaid-wrapper')
  if (mermaidWrappers.length === 0) return 0

  let reRenderedCount = 0

  try {
    const mermaid = await import('mermaid')

    const isDark = document.documentElement.classList.contains('dark')

    mermaid.default.mermaidAPI.reset()
    mermaid.default.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    })

    for (const wrapper of mermaidWrappers) {
      const graphDefinition = wrapper.getAttribute('data-mermaid-definition')
      if (!graphDefinition) continue

      // 移除旧的 SVG 和工具栏
      const oldSvg = wrapper.querySelector('.mermaid-svg')
      if (oldSvg) oldSvg.remove()
      const oldToolbar = wrapper.querySelector('.mermaid-toolbar')
      if (oldToolbar) oldToolbar.remove()

      // 移除已处理标记，以便重新注入工具栏
      wrapper.classList.remove('toolbar-injected')

      const newMermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      try {
        const { svg } = await mermaid.default.render(newMermaidId, graphDefinition)

        const parser = new DOMParser()
        const doc = parser.parseFromString(svg, 'image/svg+xml')
        const svgEl = doc.querySelector('svg')

        if (svgEl) {
          svgEl.setAttribute('class', 'mermaid-svg')
          // 移除固定尺寸属性
          svgEl.removeAttribute('width')
          svgEl.removeAttribute('height')
          svgEl.removeAttribute('style')

          // 确保 viewBox 存在
          const viewBox = svgEl.getAttribute('viewBox')
          if (!viewBox) {
            const bbox = svgEl.getBBox ? svgEl.getBBox() : null
            if (bbox) {
              svgEl.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
            }
          }

          wrapper.appendChild(svgEl.cloneNode(true))
          reRenderedCount++

          // 调整 SVG 以适应容器
          fitSvgToContainer(wrapper as HTMLElement)
        }
      } catch (e) {
        console.error('[MarkdownRenderer] Mermaid re-render error:', e)
      }
    }
  } catch (e) {
    console.error('[MarkdownRenderer] Failed to load mermaid:', e)
  }

  return reRenderedCount
}

// ============================================
// 图片路径处理
// ============================================
export async function processImagePaths(html: string, notebookId: string): Promise<string> {
  if (!html || !notebookId) return html

  const imgRegex = /<img([^>]*?)src=["'](images\/[^"']+)["']([^>]*)>/gi

  let result = html

  const imgMatches = html.matchAll(imgRegex)
  for (const match of imgMatches) {
    const [fullMatch, before, relativePath, after] = match
    const blobUrl = await loadImageAsBlobUrl(relativePath, notebookId)
    if (blobUrl) {
      result = result.replace(fullMatch, `<img${before}src="${blobUrl}"${after}>`)
    }
  }

  return result
}

async function loadImageAsBlobUrl(relativePath: string, notebookId: string): Promise<string | null> {
  const cacheKey = `${notebookId}/${relativePath}`

  if (imageBlobCache.has(cacheKey)) {
    return imageBlobCache.get(cacheKey)!
  }

  try {
    const notebookDir = await getNotebookDataDir(notebookId)
    const fullPath = `${notebookDir}/${relativePath}`
    const result = await window.electronAPI.readFile(fullPath, 'arraybuffer')

    if (result.success && result.data) {
      const buffer = result.data as ArrayBuffer
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }

      const ext = relativePath.split('.').pop()?.toLowerCase() || 'png'
      const mimeTypes: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml'
      }
      const mimeType = mimeTypes[ext] || 'image/png'

      const base64 = btoa(binary)
      const blobUrl = `data:${mimeType};base64,${base64}`

      imageBlobCache.set(cacheKey, blobUrl)
      return blobUrl
    }
  } catch (e) {
    console.warn('[MarkdownRenderer] Failed to load image:', relativePath, e)
  }

  return null
}

// ============================================
// 工具栏注入
// ============================================

/**
 * 从 className 中提取语言名称
 */
function extractLanguageFromClass(className: string | string[] | undefined): string {
  if (!className) return 'text'
  const classes = Array.isArray(className) ? className : className.split(' ')
  const langClass = classes.find(c => typeof c === 'string' && c.startsWith('language-'))
  return langClass ? langClass.replace('language-', '') : 'text'
}

/**
 * 注入代码块和图表工具栏
 * 在 renderMermaidCharts 之后调用
 */
export async function injectToolbars(container: HTMLElement): Promise<void> {
  if (!container) return

  // 处理代码块 - 包装并添加工具栏
  const codeBlocks = container.querySelectorAll('pre.shiki:not(.toolbar-injected)')
  for (const block of codeBlocks) {
    // 标记已处理
    block.classList.add('toolbar-injected')

    // 创建包装器
    const wrapper = document.createElement('div')
    wrapper.className = 'code-block-wrapper'

    // 获取代码内容和语言（优先从 data-lang 属性获取）
    const code = block.textContent || ''
    const langFromAttr = block.getAttribute('data-lang')
    const lang = langFromAttr || extractLanguageFromClass(block.className)

    // 创建工具栏
    const toolbar = createCodeBlockToolbarDOM(code, lang)

    // 包装代码块
    block.parentNode?.insertBefore(wrapper, block)
    wrapper.appendChild(block)
    wrapper.appendChild(toolbar)
  }

  // 处理 Mermaid 图表 - 添加工具栏和拖动支持
  const mermaidWrappers = container.querySelectorAll('.mermaid-wrapper.mermaid-rendered:not(.toolbar-injected)')
  for (const wrapper of mermaidWrappers) {
    // 标记已处理
    wrapper.classList.add('toolbar-injected')

    // 获取 SVG 和 ID
    const svg = wrapper.querySelector('.mermaid-svg') as SVGElement | null
    const mermaidId = wrapper.getAttribute('data-mermaid-id') || `mermaid-${Date.now()}`

    if (svg) {
      // 启用拖动和缩放
      enableMermaidDragAndZoom(wrapper as HTMLElement, svg)

      // 创建工具栏
      const toolbar = createMermaidToolbarDOM(svg, mermaidId, wrapper as HTMLElement, (svgContent: string) => {
        // 触发自定义事件，通知 Vue 组件打开全屏预览
        const event = new CustomEvent('mermaid-fullscreen', {
          detail: { svgContent, title: t('common.mermaidChart') }
        })
        container.dispatchEvent(event)
      })

      wrapper.appendChild(toolbar)
    }
  }
}

/**
 * 创建代码块工具栏 DOM
 */
function createCodeBlockToolbarDOM(code: string, language: string): HTMLElement {
  const toolbar = document.createElement('div')
  toolbar.className = 'code-block-toolbar'

  // 语言标签
  const langLabel = document.createElement('span')
  langLabel.className = 'code-language'
  langLabel.textContent = language.toUpperCase()
  toolbar.appendChild(langLabel)

  // 复制按钮
  const copyBtn = document.createElement('button')
  copyBtn.className = 'toolbar-btn'
  copyBtn.title = t('common.copyCode')
  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
  </svg>`
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(code)
      copyBtn.title = t('common.copied')
      setTimeout(() => { copyBtn.title = t('common.copyCode') }, 2000)
    } catch (e) {
      console.error('Copy failed:', e)
    }
  }
  toolbar.appendChild(copyBtn)

  // 下载按钮
  const downloadBtn = document.createElement('button')
  downloadBtn.className = 'toolbar-btn'
  downloadBtn.title = t('common.downloadCode')
  downloadBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>`
  downloadBtn.onclick = () => {
    const ext = getLanguageExtension(language)
    downloadTextFile(code, `code-${Date.now()}`, ext)
  }
  toolbar.appendChild(downloadBtn)

  return toolbar
}

/**
 * 启用 Mermaid 图表的拖动和缩放功能
 */
function enableMermaidDragAndZoom(wrapper: HTMLElement, svgElement: SVGElement): void {
  // 变换状态 - 使用对象存储避免闭包问题
  const transformState = { scale: 1, x: 0, y: 0 }
  let isDragging = false
  let startPos = { x: 0, y: 0 }
  let startTransform = { x: 0, y: 0 }

  // 设置 SVG 可变换
  svgElement.style.transformOrigin = 'top left'
  svgElement.style.cursor = 'grab'

  // 应用变换
  const applyTransform = () => {
    svgElement.style.transform = `translate(${transformState.x}px, ${transformState.y}px) scale(${transformState.scale})`
  }

  // 鼠标按下 - 开始拖拽
  const handleMouseDown = (e: MouseEvent) => {
    // 只响应左键，排除工具栏按钮
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('.mermaid-toolbar')) return

    isDragging = true
    startPos = { x: e.clientX, y: e.clientY }
    startTransform = { x: transformState.x, y: transformState.y }
    svgElement.style.cursor = 'grabbing'
    e.preventDefault()
  }

  // 鼠标移动 - 实时变换
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const dx = e.clientX - startPos.x
    const dy = e.clientY - startPos.y
    transformState.x = startTransform.x + dx
    transformState.y = startTransform.y + dy
    applyTransform()
    e.preventDefault()
  }

  // 鼠标释放 - 结束拖拽
  const handleMouseUp = () => {
    isDragging = false
    svgElement.style.cursor = 'grab'
  }

  // 滚轮缩放 - Ctrl/Cmd + 滚轮
  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.1 : -0.1
      const newScale = Math.max(0.1, Math.min(3, transformState.scale + delta))
      transformState.scale = newScale
      applyTransform()
    }
  }

  // 添加事件监听
  wrapper.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  wrapper.addEventListener('wheel', handleWheel, { passive: false })

  // 存储清理函数，以便将来可能的需要
  ;(wrapper as any)._mermaidCleanup = () => {
    wrapper.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    wrapper.removeEventListener('wheel', handleWheel)
  }
}

/**
 * 创建 Mermaid 工具栏 DOM
 */
function createMermaidToolbarDOM(
  svgElement: SVGElement,
  mermaidId: string,
  wrapper: HTMLElement,
  onFullscreen: (svgContent: string) => void
): HTMLElement {
  const toolbar = document.createElement('div')
  toolbar.className = 'mermaid-toolbar'

  // 复制 PNG 按钮
  const copyPngBtn = document.createElement('button')
  copyPngBtn.className = 'toolbar-btn'
  copyPngBtn.title = t('common.copyAsPng')
  copyPngBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
  </svg>`
  copyPngBtn.onclick = async () => {
    const blob = await svgToPng(svgElement, 2)
    if (blob) {
      await copyPngToClipboard(blob)
      copyPngBtn.title = t('common.copied')
      setTimeout(() => { copyPngBtn.title = t('common.copyAsPng') }, 2000)
    }
  }
  toolbar.appendChild(copyPngBtn)

  // 下载 SVG 按钮
  const downloadSvgBtn = document.createElement('button')
  downloadSvgBtn.className = 'toolbar-btn'
  downloadSvgBtn.title = t('common.downloadSvg')
  downloadSvgBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>`
  downloadSvgBtn.onclick = () => {
    downloadSvg(svgElement, `diagram-${mermaidId}`)
  }
  toolbar.appendChild(downloadSvgBtn)

  // 下载 PNG 按钮
  const downloadPngBtn = document.createElement('button')
  downloadPngBtn.className = 'toolbar-btn'
  downloadPngBtn.title = t('common.downloadPng')
  downloadPngBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>`
  downloadPngBtn.onclick = async () => {
    await downloadPng(svgElement, `diagram-${mermaidId}`, 2)
  }
  toolbar.appendChild(downloadPngBtn)

  // 全屏预览按钮
  const fullscreenBtn = document.createElement('button')
  fullscreenBtn.className = 'toolbar-btn'
  fullscreenBtn.title = t('common.fullscreenPreview')
  fullscreenBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
  </svg>`
  fullscreenBtn.onclick = () => {
    const svgContent = new XMLSerializer().serializeToString(svgElement)
    onFullscreen(svgContent)
  }
  toolbar.appendChild(fullscreenBtn)

  // 重置视图按钮
  const resetBtn = document.createElement('button')
  resetBtn.className = 'toolbar-btn'
  resetBtn.title = t('common.resetView')
  resetBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
  </svg>`
  resetBtn.onclick = () => {
    // 重置 SVG 变换
    svgElement.style.transform = 'translate(0px, 0px) scale(1)'
  }
  toolbar.appendChild(resetBtn)

  return toolbar
}