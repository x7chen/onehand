export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

// 导入 marked 库进行 Markdown 渲染
let markedInstance: any = null;

// 初始化 marked 实例
async function initMarked() {
  if (!markedInstance) {
    const { marked } = await import('marked');
    const renderer = new marked.Renderer();

    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
    });

    markedInstance = marked;
  }
  return markedInstance;
}

// 渲染 Markdown 为 HTML 的函数
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return '';
  
  try {
    // 预处理 Markdown 文本，移除多余的空行
    const processedMarkdown = markdown
    
    const marked = await initMarked();
    // 防止 XSS 攻击，只允许安全的 HTML 标签
    const rawHtml = marked.parse(processedMarkdown);
    // 简单过滤，实际项目中可以使用 DOMPurify 进行更全面的过滤
    return sanitizeHtml(rawHtml);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // 如果渲染失败，则返回原始文本，同时移除多余空行
    return markdown
  }
}

// 简单的 HTML 净化函数，过滤潜在危险标签和属性，并处理HTML中的空行
function sanitizeHtml(html: string): string {
  // 移除潜在危险的标签和属性
  let sanitized = html
    // 移除 script, iframe, object, embed, form 等标签
    .replace(/<(script|iframe|object|embed|form)[^>]*>.*?<\/\1>|<(script|iframe|object|embed|form)[^>]*\/?>/gi, '')
    // 移除 on 开头的事件属性
    .replace(/\s+on\w+="[^"]*"/gi, '')
    // 移除 javascript:, vbscript:, data: 等协议
    .replace(/(javascript|vbscript|data):/gi, '')
    // 去除HTML标签之间的所有空行和空白字符
    .replace(/\s*\n\s*\n\s*/g, '\n')  // 替换多个换行符为单个换行符
    // 处理HTML中的空行 - 合并多个连续的<br>标签为单个<br>
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>')
    // 去除标签间的空白字符
    .replace(/>[\s\n]+</g, '><')
    // 移除行首和行尾的空白字符
    .trim();

  return sanitized;
}