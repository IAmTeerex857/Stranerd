import OpenAI from 'openai'

export type MentorRequest = {
  question?: string
  context?: {
    model?: string
    hotspot?: string
    task?: string
    engineResult?: string
    facts?: string[]
  }
  fallback?: string
}

export async function getMentorReply(body: MentorRequest) {
  const fallback = body.fallback || 'Review the highlighted structure and relate its form to its physiological role.'

  if (!process.env.OPENAI_API_KEY) {
    return { message: fallback, source: 'offline' }
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: 'You are a patient university anatomy professor. Explain only from the supplied context. The deterministic engine has already judged correctness; never alter or adjudicate its result. Be concise, precise, and avoid diagnosis or medical advice.',
      input: JSON.stringify({ ...body.context, question: body.question || 'Explain the engine result.' }),
      max_output_tokens: 300,
    })
    return { message: completion.output_text || fallback, source: 'openai' }
  } catch (error) {
    console.error('Mentor request failed:', error instanceof Error ? error.message : error)
    return { message: fallback, source: 'offline' }
  }
}
