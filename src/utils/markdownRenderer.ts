/**
 * 增强的 Markdown 渲染器
 * 支持：代码高亮、LaTeX 公式、Mermaid 图表
 */

import type { RendererObject, Tokens } from 'marked'

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

// 初始化 marked 实例
async function initMarked() {
  const { marked, Renderer } = await import('marked')
  const hljs = await import('highlight.js')

  // 创建自定义 renderer
  const renderer = new Renderer()

  // 重写代码块渲染，支持语法高亮和 mermaid
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const language = lang || 'plaintext'
    
    console.log('[MarkdownRenderer] Code block detected:', { lang: language, textLength: text.length })

    // 检测是否为 Mermaid 图表
    if (language.toLowerCase() === 'mermaid') {
      const mermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      // 不转义 mermaid 内容，使用 pre 标签保存原始内容
      return `<div class="mermaid-wrapper" data-mermaid-id="${mermaidId}"><pre class="mermaid" id="${mermaidId}">${text}</pre></div>`
    }

    // 普通代码块 - 使用 highlight.js 高亮
    const validLang = hljs.default.getLanguage(language) ? language : 'plaintext'
    const highlighted = hljs.default.highlight(text, { language: validLang }).value

    console.log('[MarkdownRenderer] Code block:', { language, validLang, hasHighlight: highlighted.includes('<span') })

    return `<pre class="hljs"><code class="hljs language-${language}">${highlighted}</code></pre>`
  }

  // 重写行内代码渲染
  renderer.codespan = ({ text }: Tokens.Codespan) => {
    const escapedCode = escapeHtml(text)
    return `<code class="inline-code">${escapedCode}</code>`
  }

  // 使用 marked.use() 配置（marked v17+ API）
  marked.use({
    renderer,
    gfm: true,
    breaks: false,
  })

  // 重写链接渲染，添加 target="_blank"
  renderer.link = ({ href, title, text }: Tokens.Link) => {
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`
  }

  return marked
}

// LaTeX 公式上下文 - 每个渲染请求独立
interface LatexContext {
  placeholders: Map<string, { type: 'display' | 'inline', equation: string }>
}

// 生成不会被 marked 处理的占位符
function createPlaceholder(id: string): string {
  return `<span class="latex-placeholder" data-latex-id="${id}"></span>`
}

// 提取 LaTeX 公式为占位符
function extractLatex(markdown: string, context: LatexContext): string {
  let processed = markdown

  // 提取块级公式 $$...$$
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, equation) => {
    const id = `LATEX_DISPLAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    context.placeholders.set(id, { type: 'display', equation: equation.trim() })
    console.log('[MarkdownRenderer] Extracted display formula ($$):', id)
    return createPlaceholder(id)
  })

  // 提取块级公式 \[...\] (LaTeX 标准语法)
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_, equation) => {
    const id = `LATEX_DISPLAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    context.placeholders.set(id, { type: 'display', equation: equation.trim() })
    console.log('[MarkdownRenderer] Extracted display formula (\\[):', id)
    return createPlaceholder(id)
  })

  // 提取行内公式 \(...\) (LaTeX 标准语法) - 需要在 $...$ 之前处理
  processed = processed.replace(/\\\(([^)]+?)\\\)/g, (_, equation) => {
    const trimmedEquation = equation.trim()
    const id = `LATEX_INLINE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    context.placeholders.set(id, { type: 'inline', equation: trimmedEquation })
    console.log('[MarkdownRenderer] Extracted inline formula (\\():', id)
    return createPlaceholder(id)
  })

  // 提取行内公式 $...$
  processed = processed.replace(/([^`]|^)\$([^`\n$]+?)\$(?![`$])/g, (match, before, equation) => {
    const trimmedEquation = equation.trim()
    // 跳过可能是普通文本的情况（包含中文或过长）
    if (trimmedEquation.length > 200 || /\p{Script=Han}/u.test(trimmedEquation)) {
      return match
    }
    const id = `LATEX_INLINE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    context.placeholders.set(id, { type: 'inline', equation: trimmedEquation })
    console.log('[MarkdownRenderer] Extracted inline formula ($):', id)
    // 保留前面的字符
    return before + createPlaceholder(id)
  })

  console.log('[MarkdownRenderer] Total formulas extracted:', context.placeholders.size)
  return processed
}

// 渲染 LaTeX 公式并替换占位符
async function renderLatex(html: string, context: LatexContext): Promise<string> {
  const katex = await import('katex')

  console.log('[MarkdownRenderer] renderLatex called, placeholders:', context.placeholders.size)

  // 使用正则表达式查找所有占位符
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

  console.log('[MarkdownRenderer] Found placeholders in HTML:', matches.length)

  // 从后往前替换，避免索引偏移问题
  for (let i = matches.length - 1; i >= 0; i--) {
    const { id, index, full } = matches[i]
    const data = context.placeholders.get(id)
    
    if (!data) {
      console.warn('[MarkdownRenderer] No data for placeholder:', id)
      continue
    }
    
    console.log('[MarkdownRenderer] Rendering formula:', id, 'type:', data.type)
    
    try {
      const result = katex.default.renderToString(data.equation, {
        displayMode: data.type === 'display',
        throwOnError: false,
        output: 'html',
        trust: false,
      })
      // 移除 KaTeX HTML 中的换行符
      const rendered = result.replace(/\n/g, '')
      console.log('[MarkdownRenderer] Formula rendered, length:', rendered.length)
      // 替换占位符
      html = html.substring(0, index) + rendered + html.substring(index + full.length)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error('[MarkdownRenderer] Formula render error:', e)
      const errorHtml = `<span class="latex-error">公式渲染失败：${escapeHtml(data.equation)} - ${escapeHtml(errorMsg)}</span>`
      html = html.substring(0, index) + errorHtml + html.substring(index + full.length)
    }
  }

  console.log('[MarkdownRenderer] renderLatex completed')
  return html
}

// 处理 Mermaid 图表
async function processMermaid(html: string): Promise<string> {
  if (!html.includes('mermaid-wrapper')) {
    return html
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
  console.log('[MarkdownRenderer] Found mermaid wrappers:', mermaidWrappers.length, 'in container')

  if (mermaidWrappers.length === 0) return 0

  let renderedCount = 0

  try {
    const mermaid = await import('mermaid')

    // 检测当前主题
    const isDark = document.documentElement.classList.contains('dark')
    
    // 使用 Mermaid 自带的主题
    const theme = isDark ? 'dark' : 'default'
    
    console.log('[MarkdownRenderer] Using mermaid theme:', theme)

    // 初始化 mermaid，使用自带主题
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
      // 深色主题变量覆盖
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

    // 遍历所有 mermaid 图表并渲染
    for (const wrapper of mermaidWrappers) {
      // 跳过已经渲染的
      if (wrapper.classList.contains('mermaid-rendered')) {
        console.log('[MarkdownRenderer] Skipping already rendered wrapper')
        renderedCount++
        continue
      }

      const mermaidEl = wrapper.querySelector('pre.mermaid') as HTMLElement

      if (!mermaidEl) {
        console.warn('[MarkdownRenderer] No mermaid pre element found in wrapper')
        continue
      }

      // 从 pre 元素获取原始定义（textContent 会包含原始文本）
      const graphDefinition = (mermaidEl.textContent || '').trim()
      const mermaidId = mermaidEl.getAttribute('id') || `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      console.log('[MarkdownRenderer] Rendering mermaid:', {
        mermaidId,
        definitionLength: graphDefinition?.length,
        definition: graphDefinition?.substring(0, 50)
      })

      try {
        // 使用 mermaid 渲染
        const { svg } = await mermaid.default.render(mermaidId, graphDefinition)
        console.log('[MarkdownRenderer] Mermaid rendered successfully, SVG length:', svg.length)

        // 解析 SVG
        const parser = new DOMParser()
        const doc = parser.parseFromString(svg, 'image/svg+xml')
        const svgEl = doc.querySelector('svg')

        if (svgEl) {
          // 确保 SVG 有正确的属性
          svgEl.setAttribute('class', 'mermaid-svg')
          svgEl.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 0 auto;')
          
          // 不替换 pre 元素，而是隐藏它并在 wrapper 内追加 SVG
          mermaidEl.style.display = 'none'
          mermaidEl.setAttribute('data-rendered', 'true')
          wrapper.appendChild(svgEl.cloneNode(true))
          
          console.log('[MarkdownRenderer] SVG appended to wrapper')
          renderedCount++
        } else {
          console.error('[MarkdownRenderer] No SVG element in rendered output')
        }
        
        // 添加包装类用于样式控制
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

  // 移除 <think>、</think>、begin_of_box、end_of_box 标签
  let processedMarkdown = markdown
    .replace(/<\/?think>/gi, '')
    .replace(/<\|begin_of_box\|>/gi, '')
    .replace(/<\|end_of_box\|>/gi, '')

  // 使用完整内容的 hash 作为缓存 key
  const cacheKey = `v3:${processedMarkdown.length}:${processedMarkdown.substring(0, 200)}`

  // 检查缓存（开发模式可禁用）
  if (markdownCache.has(cacheKey)) {
    console.log('[MarkdownRenderer] Cache hit for key:', cacheKey.substring(0, 50))
    return markdownCache.get(cacheKey)!
  }

  console.log('[MarkdownRenderer] Cache miss, rendering markdown...')

  try {
    // 创建独立的 LaTeX 上下文
    const context: LatexContext = { placeholders: new Map() }

    // 1. 提取 LaTeX 公式为占位符
    const markdownWithoutLatex = extractLatex(processedMarkdown, context)
    console.log('[MarkdownRenderer] After extractLatex:', markdownWithoutLatex.substring(0, 100))

    // 2. 解析 Markdown
    const marked = await initMarked()
    let html = marked.parse(markdownWithoutLatex) as string
    console.log('[MarkdownRenderer] After marked parse, HTML length:', html.length)

    // 3. 渲染 LaTeX 公式并替换占位符
    html = await renderLatex(html, context)
    console.log('[MarkdownRenderer] After renderLatex, HTML length:', html.length)

    // 4. 处理 Mermaid（标记位置，稍后渲染）
    html = await processMermaid(html)

    // 5. HTML 净化
    const sanitized = sanitizeHtml(html)

    // 缓存结果
    if (markdownCache.size < MAX_CACHE_SIZE) {
      markdownCache.set(cacheKey, sanitized)
    }

    console.log('[MarkdownRenderer] Rendering completed, cached size:', markdownCache.size)
    return sanitized
  } catch (error) {
    console.error('[MarkdownRenderer] Error rendering markdown:', error)
    return escapeHtml(markdown)
  }
}

// 清除缓存
export function clearMarkdownCache() {
  markdownCache.clear()
  console.log('[MarkdownRenderer] Cache cleared')
}

// 开发模式下禁用缓存的辅助函数
let disableCache = false
export function setMarkdownCacheEnabled(enabled: boolean) {
  disableCache = !enabled
  console.log('[MarkdownRenderer] Cache', enabled ? 'enabled' : 'disabled')
}

// 图片路径缓存
const imageBlobCache = new Map<string, string>()

/**
 * 处理 HTML 中的相对路径图片，转换为 blob URL
 * @param html 原始 HTML
 * @param notebookId 笔记本 ID
 * @returns 处理后的 HTML
 */
export async function processImagePaths(html: string, notebookId: string): Promise<string> {
  if (!html || !notebookId) return html

  // 匹配 <img src="images/..."> 或 <img src="audio/..."> 等相对路径
  const imgRegex = /<img([^>]*?)src=["'](images\/[^"']+)["']([^>]*)>/gi
  const audioRegex = /<img([^>]*?)src=["'](audio\/[^"']+)["']([^>]*)>/gi

  let result = html

  // 处理 images 目录下的图片
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

/**
 * 加载图片并返回 blob URL
 */
async function loadImageAsBlobUrl(relativePath: string, notebookId: string): Promise<string | null> {
  const cacheKey = `${notebookId}/${relativePath}`

  // 检查缓存
  if (imageBlobCache.has(cacheKey)) {
    return imageBlobCache.get(cacheKey)!
  }

  try {
    const appDataPath = await window.electronAPI.getAppPath('userData')
    const fullPath = `${appDataPath}/notebooks/${notebookId}/${relativePath}`
    const result = await window.electronAPI.readFile(fullPath, 'arraybuffer')

    if (result.success && result.data) {
      const buffer = result.data as ArrayBuffer
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
      }

      // 获取 MIME 类型
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

      // 缓存结果
      imageBlobCache.set(cacheKey, blobUrl)
      return blobUrl
    }
  } catch (e) {
    console.warn('[MarkdownRenderer] Failed to load image:', relativePath, e)
  }

  return null
}

/**
 * 清除图片缓存
 */
export function clearImageCache() {
  imageBlobCache.clear()
  console.log('[MarkdownRenderer] Image cache cleared')
}
