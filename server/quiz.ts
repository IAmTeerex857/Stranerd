import OpenAI from 'openai'

type GeneratedQuiz = {
  id: string
  modelId: string
  kind: 'multiple-choice'
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type QuizGenerationRequest = {
  modelId?: string
  model?: string
  system?: string
  description?: string
  facts?: string[]
  structures?: { label: string; detail: string }[]
  previousQuestions?: string[]
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function parseQuizSet(raw: string, modelId: string): GeneratedQuiz[] | undefined {
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const value = JSON.parse(clean) as { quizzes?: unknown[] }
    if (!Array.isArray(value.quizzes) || value.quizzes.length !== 20) return undefined
    const quizzes = value.quizzes.map((entry, index) => {
      if (!entry || typeof entry !== 'object') return undefined
      const item = entry as Record<string, unknown>
      if (!validText(item.question) || !Array.isArray(item.options) || item.options.length !== 4 || !item.options.every(validText)) return undefined
      if (new Set(item.options).size !== 4 || !Number.isInteger(item.correctIndex) || Number(item.correctIndex) < 0 || Number(item.correctIndex) > 3 || !validText(item.explanation)) return undefined
      return {
        id: `${modelId}-ai-${index + 1}`,
        modelId,
        kind: 'multiple-choice' as const,
        question: item.question.trim(),
        options: item.options.map((option) => option.trim()),
        correctIndex: Number(item.correctIndex),
        explanation: item.explanation.trim(),
      }
    })
    return quizzes.every(Boolean) ? quizzes as GeneratedQuiz[] : undefined
  } catch {
    return undefined
  }
}

export async function generateQuizSet(body: QuizGenerationRequest) {
  const modelId = validText(body.modelId) ? body.modelId : 'model'
  const hasAzure = Boolean(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT)
  if (!process.env.OPENAI_API_KEY && !hasAzure) return { quizzes: null, source: 'offline' }

  const prompt = `Create exactly 20 university-level multiple-choice questions about the specified study model.
Return only a JSON object with a "quizzes" array. Every item must contain: question, options, correctIndex, explanation.
Every options array must contain exactly four unique plausible answers. correctIndex must be zero-based from 0 to 3.
Vary question wording, concepts, and correct-answer positions. Do not repeat or merely paraphrase previousQuestions.
Use established scientific facts. Keep explanations concise. Do not include markdown.`
  const context = {
    model: body.model,
    system: body.system,
    description: body.description,
    facts: body.facts?.slice(0, 10),
    structures: body.structures?.slice(0, 30),
    previousQuestions: body.previousQuestions?.slice(0, 20),
  }

  try {
    const client = hasAzure
      ? new OpenAI({ apiKey: process.env.AZURE_OPENAI_API_KEY, baseURL: `${process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '')}/openai/v1` })
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await client.chat.completions.create({
      model: hasAzure ? process.env.AZURE_OPENAI_DEPLOYMENT! : process.env.OPENAI_MODEL || 'gpt-5-mini',
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(context) }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 5000,
    }, { signal: AbortSignal.timeout(40_000) })
    const quizzes = parseQuizSet(completion.choices[0]?.message.content || '', modelId)
    return quizzes ? { quizzes, source: hasAzure ? 'azure-openai' : 'openai' } : { quizzes: null, source: 'invalid-ai-response' }
  } catch (error) {
    console.error('Quiz generation failed:', error instanceof Error ? error.message : error)
    return { quizzes: null, source: 'offline' }
  }
}
