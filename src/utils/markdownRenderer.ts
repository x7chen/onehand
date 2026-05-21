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
import type { Element, Root } from 'hast'

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
  'cpp', 'c', 'go', 'rust', 'ruby', 'php', 'swift',
  'kotlin', 'html', 'css', 'scss', 'json', 'yaml',
  'xml', 'markdown', 'sql', 'shell', 'bash',
  'dockerfile', 'diff'
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
              className: ['shiki', ...((preElement.properties?.className as string[]) || [])]
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
          svgEl.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 0 auto;')

          // 移除 pre.mermaid 元素，只保留 SVG
          mermaidEl.remove()
          wrapper.appendChild(svgEl.cloneNode(true))
          renderedCount++
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

      // 移除旧的 SVG
      const oldSvg = wrapper.querySelector('.mermaid-svg')
      if (oldSvg) oldSvg.remove()

      const newMermaidId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      try {
        const { svg } = await mermaid.default.render(newMermaidId, graphDefinition)

        const parser = new DOMParser()
        const doc = parser.parseFromString(svg, 'image/svg+xml')
        const svgEl = doc.querySelector('svg')

        if (svgEl) {
          svgEl.setAttribute('class', 'mermaid-svg')
          svgEl.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 0 auto;')
          wrapper.appendChild(svgEl.cloneNode(true))
          reRenderedCount++
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