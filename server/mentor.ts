import OpenAI from 'openai'

export type MentorRequest = {
  question?: string
  context?: {
    model?: string
    hotspot?: string
    nodeId?: string
    system?: string
    conditions?: string[]
    graphVersion?: string
    task?: string
    engineResult?: string
    mode?: 'dissection'
    action?: string
    structureIds?: string[]
    structures?: string[]
    hiddenStructures?: string[]
    visibleNeighbors?: string[]
    guidedStep?: string
    facts?: string[]
  }
}

const mentorInstructions = `You are Stranerd Mentor, a patient university-level anatomy and engineering educator.
Use the selected structure and model context to identify the topic, then use established scientific knowledge to explain it accurately. The context is a focus signal, not a restriction on your knowledge. Never say that the supplied context is insufficient or discuss the phrase "supplied context". If a structure label contains a minor source typo, infer the standard anatomical term and use the corrected name.
For a selected structure, explain what it is, its primary function, and one useful anatomical or physiological relationship. For dissection actions, briefly explain what the action reveals and one spatial or functional relationship relevant to the current guided step. Be concise but substantive. Do not diagnose, prescribe, or give patient-specific medical advice.
Return plain text only. Do not use Markdown headings, asterisks, bold markers, or tables. Use short paragraphs. When listing several distinct points, put each on its own line beginning with "- ".`

function cleanReply(message: string) {
  return message
    .replace(/\*\*|__/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[•*]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function getMentorReply(body: MentorRequest) {
  const fallback = 'Review the highlighted structure and relate its form to its physiological role.'

  const hasAzure = Boolean(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT)
  if (!process.env.OPENAI_API_KEY && !hasAzure) {
    return { message: fallback, source: 'offline' }
  }

  try {
    if (hasAzure) {
      const client = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '')}/openai/v1`,
      })
      const completion = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages: [
          { role: 'system', content: mentorInstructions },
          { role: 'user', content: JSON.stringify({ ...body.context, question: body.question || 'Explain this structure.' }) },
        ],
        max_completion_tokens: 500,
      }, { signal: AbortSignal.timeout(12_000) })
      return { message: cleanReply(completion.choices[0]?.message.content || fallback), source: 'azure-openai' }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: mentorInstructions,
      input: JSON.stringify({ ...body.context, question: body.question || 'Explain the engine result.' }),
      max_output_tokens: 300,
      }, { signal: AbortSignal.timeout(12_000) })
    return { message: cleanReply(completion.output_text || fallback), source: 'openai' }
  } catch (error) {
    console.error('Mentor request failed:', error instanceof Error ? error.message : error)
    return { message: fallback, source: 'offline' }
  }
}
