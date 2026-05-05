/**
 * 增强的 Markdown 渲染器
 * 使用 markdown-it + shiki 替代 marked + highlight.js
 * 支持：代码高亮、LaTeX 公式、Mermaid 图表
 */

import { getNotebookDataDir } from '@/utils/userFilesPath'
import MarkdownIt from 'markdown-it'
import { createHighlighter } from 'shiki'
import { fromHighlighter } from '@shikijs/markdown-it'

// Markdown 渲染缓存
const markdownCache = new Map<string, string>()
const MAX_CACHE_SIZE = 100

// 转义 HTML 特殊字符
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

// 常用语言列表（按需加载其他语言）
const COMMON_LANGS = [
  'javascript',
  'typescript',
  'python',
  'java',
  'cpp',
  'c',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'xml',
  'markdown',
  'sql',
  'shell',
  'bash',
  'dockerfile',
  'diff',
]

// Shiki highlighter 实例（单例）
let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null
let highlighterPromise: Promise<void> | null = null

// 预初始化 highlighter（应用启动时调用）
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

// 初始化 markdown-it 实例
async function initMarkdownIt(): Promise<MarkdownIt> {
  // 确保 highlighter 已初始化
  if (!highlighter) {
    await preInitHighlighter()
  }

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })

  // 使用 shiki 进行代码高亮
  md.use(fromHighlighter(highlighter!, {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
  }))

  // 自定义代码块渲染，支持 Mermaid
  const defaultFenceRenderer = md.renderer.rules.fence || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.fence = function(tokens, idx, options, env, self) {
    const token = tokens[idx]
    const lang = token.info.trim().toLowerCase()
    const content = token.content

    // 检测是否为 Mermaid 图表
    if (lang === 'mermaid') {
      const mermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      return `<div class="mermaid-wrapper" data-mermaid-id="${mermaidId}"><pre class="mermaid" id="${mermaidId}">${escapeHtml(content)}</pre></div>`
    }

    // 其他代码块使用 shiki 默认渲染
    return defaultFenceRenderer(tokens, idx, options, env, self)
  }

  // 自定义链接渲染，添加 target="_blank"
  const defaultLinkRenderer = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.link_open = function(tokens, idx, options, env, self) {
    // 添加 target="_blank" 和 rel 属性
    const targetIdx = tokens[idx].attrIndex('target')
    if (targetIdx < 0) {
      tokens[idx].attrPush(['target', '_blank'])
    } else if (tokens[idx].attrs) {
      tokens[idx].attrs[targetIdx][1] = '_blank'
    }

    const relIdx = tokens[idx].attrIndex('rel')
    if (relIdx < 0) {
      tokens[idx].attrPush(['rel', 'noopener noreferrer'])
    } else if (tokens[idx].attrs) {
      tokens[idx].attrs[relIdx][1] = 'noopener noreferrer'
    }

    return defaultLinkRenderer(tokens, idx, options, env, self)
  }

  return md
}

// LaTeX 公式上下文 - 每个渲染请求独立
interface LatexContext {
  placeholders: Map<string, { type: 'display' | 'inline', equation: string }>
}

// 预处理 LaTeX 公式，修正 \text{} 在 KaTeX 中的渲染问题
function normalizeLatexText(equation: string): string {
  return equation.replace(/\\text\{([^}]+)\}/g, (_, content) => {
    const escapedContent = content.replace(/_/g, '\\_')
    return `\\mathrm{${escapedContent}}`
  })
}

// 生成不会被 markdown-it 处理的占位符
function createPlaceholder(id: string): string {
  return `<span class="latex-placeholder" data-latex-id="${id}"></span>`
}

// 清理公式内容中可能存在的引用块标记
function cleanBlockquoteMarkers(equation: string): string {
  return equation
    .split('\n')
    .map(line => line.replace(/^>\s?/, '').trim())
    .filter(line => line.length > 0)
    .join('\n')
}

// 提取 LaTeX 公式为占位符
function extractLatex(markdown: string, context: LatexContext): string {
  let processed = markdown

  // 提取块级公式 $$...$$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, equation) => {
    const id = `LATEX_DISPLAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const cleanedEquation = cleanBlockquoteMarkers(equation)
    context.placeholders.set(id, { type: 'display', equation: normalizeLatexText(cleanedEquation) })
    return createPlaceholder(id)
  })

  // 提取块级公式 \[...\]
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, equation) => {
    const id = `LATEX_DISPLAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const cleanedEquation = cleanBlockquoteMarkers(equation)
    context.placeholders.set(id, { type: 'display', equation: normalizeLatexText(cleanedEquation) })
    return createPlaceholder(id)
  })

  // 提取行内公式 \(...\)
  processed = processed.replace(/\\\(([^)]+?)\\\)/g, (_, equation) => {
    const trimmedEquation = normalizeLatexText(equation.trim())
    const id = `LATEX_INLINE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    context.placeholders.set(id, { type: 'inline', equation: trimmedEquation })
    return createPlaceholder(id)
  })

  // 提取行内公式 $...$
  processed = processed.replace(/([^`]|^)\$([^`\n$]+?)\$(?![`$])/g, (match, before, equation) => {
    const trimmedEquation = normalizeLatexText(equation.trim())
    if (trimmedEquation.length > 200 || /\p{Script=Han}/u.test(trimmedEquation)) {
      return match
    }
    const id = `LATEX_INLINE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    context.placeholders.set(id, { type: 'inline', equation: trimmedEquation })
    return before + createPlaceholder(id)
  })

  return processed
}

// 渲染 LaTeX 公式并替换占位符
async function renderLatex(html: string, context: LatexContext): Promise<string> {
  const katex = await import('katex')

  const placeholderRegex = /<span class="latex-placeholder" data-latex-id="(.+?)"><\/span>/g
  let match
  const matches: Array<{ full: string, id: string, index: number }> = []

  while ((match = placeholderRegex.exec(html)) !== null) {
    matches.push({
      full: match[0],
      id: match[1],
      index: match.index
    })
  }

  for (let i = matches.length - 1; i >= 0; i--) {
    const { id, index, full } = matches[i]
    const data = context.placeholders.get(id)

    if (!data) {
      console.warn('[MarkdownRenderer] No data for placeholder:', id)
      continue
    }

    try {
      const result = katex.default.renderToString(data.equation, {
        displayMode: data.type === 'display',
        throwOnError: false,
        output: 'html',
        trust: false,
      })
      const rendered = result.replace(/\n/g, '')
      html = html.substring(0, index) + rendered + html.substring(index + full.length)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error('[MarkdownRenderer] Formula render error:', e)
      const errorHtml = `<span class="latex-error">公式渲染失败：${escapeHtml(data.equation)} - ${escapeHtml(errorMsg)}</span>`
      html = html.substring(0, index) + errorHtml + html.substring(index + full.length)
    }
  }

  return html
}

// 渲染 Mermaid 图表（在组件挂载后调用）
export async function renderMermaidCharts(container: HTMLElement): Promise<number> {
  if (!container) {
    console.warn('[MarkdownRenderer] renderMermaidCharts called with null container')
    return 0
  }

  const mermaidWrappers = container.querySelectorAll('.mermaid-wrapper')

  if (mermaidWrappers.length === 0) return 0

  let renderedCount = 0

  try {
    const mermaid = await import('mermaid')

    const isDark = document.documentElement.classList.contains('dark')
    const theme = isDark ? 'dark' : 'default'

    mermaid.default.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: 'loose',
      fontFamily: 'inherit',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
      themeVariables: isDark ? {
        fontFamily: 'inherit',
        primaryColor: '#2d2d2d',
        primaryTextColor: '#ffffff',
        primaryBorderColor: '#ffffff',
        lineColor: '#cccccc',
        secondaryColor: '#2d2d2d',
        tertiaryColor: '#2d2d2d',
        mainBkg: '#2d2d2d',
        altBackground: '#1e2328',
        textColor: '#ffffff',
        edgeLabelBackground: '#1e2328',
        clusterBkg: '#1e2328',
        clusterBorder: '#cccccc',
        labelBoxBorderColor: '#ffffff',
        labelBoxBkgColor: '#2d2d2d',
        actorBorder: '#ffffff',
        actorBkg: '#2d2d2d',
        actorTextColor: '#ffffff',
        messageTextColor: '#ffffff',
        messageLineColor: '#cccccc',
        noteBkgColor: '#2d2d2d',
        noteTextColor: '#ffffff',
        noteBorderColor: '#ffffff',
      } : {}
    })

    for (const wrapper of mermaidWrappers) {
      if (wrapper.classList.contains('mermaid-rendered')) {
        renderedCount++
        continue
      }

      const mermaidEl = wrapper.querySelector('pre.mermaid') as HTMLElement

      if (!mermaidEl) {
        console.warn('[MarkdownRenderer] No mermaid pre element found in wrapper')
        continue
      }

      let graphDefinition = (mermaidEl.textContent || '').trim()

      graphDefinition = graphDefinition
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/：/g, ':')
        .replace(/，/g, ',')
        .replace(/（/g, '(')
        .replace(/）/g, ')')

      const mermaidId = mermaidEl.getAttribute('id') || `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      try {
        const { svg } = await mermaid.default.render(mermaidId, graphDefinition)

        const parser = new DOMParser()
        const doc = parser.parseFromString(svg, 'image/svg+xml')
        const svgEl = doc.querySelector('svg')

        if (svgEl) {
          svgEl.setAttribute('class', 'mermaid-svg')
          svgEl.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 0 auto;')

          mermaidEl.style.display = 'none'
          mermaidEl.setAttribute('data-rendered', 'true')
          wrapper.appendChild(svgEl.cloneNode(true))
          renderedCount++
        } else {
          console.error('[MarkdownRenderer] No SVG element in rendered output')
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

// 简单的 HTML 净化函数
function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|iframe|object|embed|form)[^>]*>.*?<\/\1>|<(script|iframe|object|embed|form)[^>]*\/?>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/(javascript|vbscript):/gi, '')
    .trim()
}

// 渲染 Markdown 为 HTML 的主函数
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return ''

  let processedMarkdown = markdown
    .replace(/<\/?think>/gi, '')
    .replace(/<\|begin_of_box\|>/gi, '')
    .replace(/<\|end_of_box\|>/gi, '')

  const cacheKey = `v4:${processedMarkdown.length}:${processedMarkdown.substring(0, 200)}`

  if (markdownCache.has(cacheKey)) {
    return markdownCache.get(cacheKey)!
  }

  try {
    const context: LatexContext = { placeholders: new Map() }

    // 1. 提取 LaTeX 公式为占位符
    const markdownWithoutLatex = extractLatex(processedMarkdown, context)

    // 2. 解析 Markdown (使用 markdown-it + shiki)
    const md = await initMarkdownIt()
    let html = md.render(markdownWithoutLatex)

    // 3. 渲染 LaTeX 公式并替换占位符
    html = await renderLatex(html, context)

    // 4. HTML 净化
    const sanitized = sanitizeHtml(html)

    if (markdownCache.size < MAX_CACHE_SIZE) {
      markdownCache.set(cacheKey, sanitized)
    }

    return sanitized
  } catch (error) {
    console.error('[MarkdownRenderer] Error rendering markdown:', error)
    return escapeHtml(markdown)
  }
}

// 清除缓存
export function clearMarkdownCache() {
  markdownCache.clear()
}

// 开发模式下禁用缓存的辅助函数
let disableCache = false
export function setMarkdownCacheEnabled(enabled: boolean) {
  disableCache = !enabled
}

// 图片路径缓存
const imageBlobCache = new Map<string, string>()

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

export function clearImageCache() {
  imageBlobCache.clear()
}