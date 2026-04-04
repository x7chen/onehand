import type { Message, MessageContentItem } from '@/types/api'

export async function chatWithLLM(
  messages: Message[],
  config: {
    baseUrl: string
    apiKey: string
    model: string
    enableThinking?: boolean
    temperature?: number
  },
  onChunk?: (chunk: string) => void
): Promise<string> {
  try {
    // 移除 baseUrl 末尾的斜杠，避免双斜杠问题
    const baseUrl = config.baseUrl.replace(/\/+$/, '')

    // 构建请求体
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages,
      stream: true
    }

    // 添加温度参数
    if (config.temperature !== undefined) {
      requestBody.temperature = config.temperature
    }

    // 添加思考参数（针对支持的模型）
    if (config.enableThinking) {
      requestBody.enable_thinking = true
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    let fullContent = ''
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              onChunk?.(content)
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return fullContent
  } catch (error) {
    console.error('LLM chat failed:', error)
    throw error
  }
}

/**
 * 构建包含静态上下文和动态上下文的完整消息
 */
export function buildFullContextMessages(
  contextNodes: Array<{ transcript: string; agentResult: string; imageBase64?: string; embeddedImages?: string[] }>,
  currentTranscript: string,
  staticContext?: string,
  dynamicContext?: string,
  currentEmbeddedImages?: string[]
): Message[] {
  const systemMessage: Message = {
    role: 'system',
    content: `YYou are an intelligent assistant. Based on the user's note content and context, provide useful responses, summaries, or expanded information. Reply in the same language as the user's input.`
  }

  const messages: Message[] = []

  // 1. 静态上下文
  if (staticContext && staticContext.trim()) {
    messages.push({
      role: 'user',
      content: staticContext
    })
  }

  // 2. 动态上下文
  if (dynamicContext && dynamicContext.trim()) {
    messages.push({
      role: 'user',
      content: dynamicContext
    })
  }

  // 3. 已选择的上下文记录
  for (const node of contextNodes) {
    // 图片节点：使用Vision API格式
    if (node.imageBase64) {
      const content: MessageContentItem[] = [
        { type: 'text', text: node.transcript || '[图片]' }
      ]
      content.push({ type: 'image_url', image_url: { url: node.imageBase64 } })

      messages.push({ role: 'user', content })

      if (node.agentResult) {
        messages.push({ role: 'assistant', content: node.agentResult })
      }
    }
    // 文本节点内嵌图片：使用Vision API格式
    else if (node.embeddedImages && node.embeddedImages.length > 0) {
      const content: MessageContentItem[] = [
        { type: 'text', text: node.transcript || '' }
      ]
      // 添加所有内嵌图片
      for (const imgBase64 of node.embeddedImages) {
        content.push({ type: 'image_url', image_url: { url: imgBase64 } })
      }

      messages.push({ role: 'user', content })

      if (node.agentResult) {
        messages.push({ role: 'assistant', content: node.agentResult })
      }
    }
    // 纯文本节点
    else if (node.transcript) {
      if (node.agentResult) {
        messages.push(
          { role: 'user', content: node.transcript },
          { role: 'assistant', content: node.agentResult }
        )
      } else {
        messages.push({ role: 'user', content: node.transcript })
      }
    }
  }

  // 4. 当前问题（可能包含内嵌图片）
  if (currentEmbeddedImages && currentEmbeddedImages.length > 0) {
    const content: MessageContentItem[] = [
      { type: 'text', text: currentTranscript }
    ]
    for (const imgBase64 of currentEmbeddedImages) {
      content.push({ type: 'image_url', image_url: { url: imgBase64 } })
    }
    messages.push({ role: 'user', content })
  } else {
    messages.push({
      role: 'user',
      content: currentTranscript
    })
  }

  return [systemMessage, ...messages]
}

export function buildContextMessages(
  contextNodes: Array<{ transcript: string; agentResult: string }>,
  currentTranscript: string
): Message[] {
  return buildFullContextMessages(contextNodes, currentTranscript, undefined, undefined)
}

/**
 * 构建包含图片的消息（Vision API）
 */
export function buildImageMessage(text: string, imageBase64: string): Message {
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageBase64 } }
    ]
  }
}

/**
 * 构建图片分析请求消息
 */
export function buildImageAnalysisMessages(
  imageBase64: string,
  prompt: string,
  staticContext?: string,
  dynamicContext?: string,
  contextNodes?: Array<{ transcript: string; agentResult: string; imageBase64?: string; embeddedImages?: string[] }>
): Message[] {
  const systemMessage: Message = {
    role: 'system',
    content: `You are an intelligent PDF analysis assistant. Analyze the PDF page image and provide helpful responses based on the user's request. Reply in the same language as the user's input.`
  }

  const messages: Message[] = []

  // 1. 静态上下文
  if (staticContext && staticContext.trim()) {
    messages.push({
      role: 'user',
      content: staticContext
    })
  }

  // 2. 动态上下文
  if (dynamicContext && dynamicContext.trim()) {
    messages.push({
      role: 'user',
      content: dynamicContext
    })
  }

  // 3. 已选择的上下文记录
  if (contextNodes) {
    for (const node of contextNodes) {
      // 图片节点：使用Vision API格式
      if (node.imageBase64) {
        const content: MessageContentItem[] = [
          { type: 'text', text: node.transcript || '[图片]' }
        ]
        content.push({ type: 'image_url', image_url: { url: node.imageBase64 } })

        messages.push({ role: 'user', content })

        if (node.agentResult) {
          messages.push({ role: 'assistant', content: node.agentResult })
        }
      }
      // 文本节点内嵌图片：使用Vision API格式
      else if (node.embeddedImages && node.embeddedImages.length > 0) {
        const content: MessageContentItem[] = [
          { type: 'text', text: node.transcript || '' }
        ]
        // 添加所有内嵌图片
        for (const imgBase64 of node.embeddedImages) {
          content.push({ type: 'image_url', image_url: { url: imgBase64 } })
        }

        messages.push({ role: 'user', content })

        if (node.agentResult) {
          messages.push({ role: 'assistant', content: node.agentResult })
        }
      }
      // 纯文本节点
      else if (node.transcript) {
        if (node.agentResult) {
          messages.push(
            { role: 'user', content: node.transcript },
            { role: 'assistant', content: node.agentResult }
          )
        } else {
          messages.push({ role: 'user', content: node.transcript })
        }
      }
    }
  }

  // 4. 当前问题（包含图片）
  messages.push(buildImageMessage(prompt, imageBase64))

  return [systemMessage, ...messages]
}
