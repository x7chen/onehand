import { BaseEmbeddings } from '@llm-tools/embedjs-interfaces'

/**
 * OpenAI-Compatible Embeddings
 * 支持任何 OpenAI-compatible API（如 ModelScope、SiliconFlow 等）
 */
export interface EmbeddingConfig {
  baseUrl: string
  apiKey: string
  model: string
  dimensions: number
}

export class OpenAICompatibleEmbeddings extends BaseEmbeddings {
  private baseUrl: string
  private apiKey: string
  private model: string
  private dimensions: number

  constructor(config: EmbeddingConfig) {
    super()
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.model = config.model
    this.dimensions = config.dimensions
  }

  override async getDimensions(): Promise<number> {
    return this.dimensions
  }

  override async embedDocuments(texts: string[]): Promise<number[][]> {
    // 批量处理，每次最多处理 10 个文本
    const batchSize = 10
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(text => this.embedQuery(text))
      )
      results.push(...batchResults)
    }

    return results
  }

  override async embedQuery(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> }

    if (!data.data || data.data.length === 0) {
      throw new Error('No embedding data returned')
    }

    return data.data[0].embedding
  }
}