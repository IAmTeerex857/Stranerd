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
  action?: 'generate' | 'hint' | 'corrections'
  modelId?: string
  model?: string
  system?: string
  description?: string
  facts?: string[]
  structures?: { label: string; detail: string }[]
  previousQuestions?: string[]
  quiz?: GeneratedQuiz
  quizzes?: GeneratedQuiz[]
  answers?: (number | null)[]
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

export function parseQuizHint(raw: string) {
  try {
    const value = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { hint?: unknown }
    return validText(value.hint) ? value.hint.trim() : undefined
  } catch {
    return undefined
  }
}

export function parseQuizCorrections(raw: string) {
  try {
    const value = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { corrections?: unknown }
    return Array.isArray(value.corrections) && value.corrections.length === 20 && value.corrections.every(validText)
      ? value.corrections.map((correction) => correction.trim())
      : undefined
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

function quizClient() {
  const hasAzure = Boolean(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT)
  if (!process.env.OPENAI_API_KEY && !hasAzure) return undefined
  return {
    source: hasAzure ? 'azure-openai' : 'openai',
    model: hasAzure ? process.env.AZURE_OPENAI_DEPLOYMENT! : process.env.OPENAI_MODEL || 'gpt-5-mini',
    client: hasAzure
      ? new OpenAI({ apiKey: process.env.AZURE_OPENAI_API_KEY, baseURL: `${process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '')}/openai/v1` })
      : new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  }
}

export async function generateQuizHint(body: QuizGenerationRequest) {
  const provider = quizClient()
  if (!provider || !body.quiz) return { hint: null, source: 'offline' }
  try {
    const completion = await provider.client.chat.completions.create({
      model: provider.model,
      messages: [{ role: 'system', content: 'Give one concise, useful hint for the anatomy assessment question. Do not state, quote, or identify the correct answer. Return only JSON with a non-empty "hint" string.' }, { role: 'user', content: JSON.stringify({ model: body.model, system: body.system, question: body.quiz.question, options: body.quiz.options }) }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 220,
    }, { signal: AbortSignal.timeout(25_000) })
    const hint = parseQuizHint(completion.choices[0]?.message.content || '') || null
    return { hint, source: hint ? provider.source : 'invalid-ai-response' }
  } catch (error) {
    console.error('Quiz hint generation failed:', error instanceof Error ? error.message : error)
    return { hint: null, source: 'offline' }
  }
}

export async function generateQuizCorrections(body: QuizGenerationRequest) {
  const provider = quizClient()
  if (!provider || !Array.isArray(body.quizzes) || body.quizzes.length !== 20 || !Array.isArray(body.answers) || body.answers.length !== 20) return { corrections: null, source: 'offline' }
  try {
    const questions = body.quizzes.map((quiz, index) => ({
      number: index + 1,
      question: quiz.question,
      options: quiz.options,
      selectedIndex: body.answers![index],
      correctIndex: quiz.correctIndex,
      authoredExplanation: quiz.explanation,
    }))
    const completion = await provider.client.chat.completions.create({
      model: provider.model,
      messages: [{ role: 'system', content: 'Explain the correction for exactly 20 anatomy assessment questions. Each explanation must directly explain why the correct answer is right and clarify the learner\'s selected answer when it was wrong. Be accurate and concise. Return only JSON with a "corrections" array of exactly 20 non-empty strings in question order.' }, { role: 'user', content: JSON.stringify({ model: body.model, system: body.system, questions }) }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 5000,
    }, { signal: AbortSignal.timeout(40_000) })
    const corrections = parseQuizCorrections(completion.choices[0]?.message.content || '') || null
    return { corrections, source: corrections ? provider.source : 'invalid-ai-response' }
  } catch (error) {
    console.error('Quiz correction generation failed:', error instanceof Error ? error.message : error)
    return { corrections: null, source: 'offline' }
  }
}
