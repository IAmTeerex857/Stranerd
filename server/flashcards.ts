import OpenAI from 'openai'
import { randomUUID } from 'node:crypto'
import { serverAnatomyCatalog } from './anatomyCatalog.js'
import { GENERATED_DECK_SIZE } from '../shared/flashcards.js'

export { GENERATED_DECK_COST, GENERATED_DECK_SIZE } from '../shared/flashcards.js'

type GeneratedCard = { id: string; kind: 'identify-structure' | 'structure-to-function' | 'fact-recall'; front: { heading: string; body: string; diagram?: { modelId: string; variantId: string; selectedStructureIds: string[] } }; back: { heading: string; body: string } }
export type GeneratedDeck = { id: string; modelId: string; contentVersion: string; title: string; description: string; cards: GeneratedCard[]; source: 'ai' }

export type FlashcardGenerationRequest = {
  modelId?: string
  difficulty?: 'introductory' | 'intermediate' | 'advanced'
  focus?: 'structures' | 'functions' | 'relationships' | 'mixed'
  includeDiagrams?: boolean
  visibility?: 'private' | 'public'
  topic?: string
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') return undefined
  const clean = Array.from(value).map((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character).join('').replace(/\s+/g, ' ').trim()
  return clean && clean.length <= max ? clean : undefined
}

export function validateGenerationRequest(body: FlashcardGenerationRequest) {
  const model = serverAnatomyCatalog.find((entry) => entry.id === body.modelId)
  if (!model || !['introductory', 'intermediate', 'advanced'].includes(body.difficulty ?? '') || !['structures', 'functions', 'relationships', 'mixed'].includes(body.focus ?? '') || !['private', 'public'].includes(body.visibility ?? '')) return undefined
  if (body.topic !== undefined && !cleanText(body.topic, 120)) return undefined
  return { model, difficulty: body.difficulty!, focus: body.focus!, visibility: body.visibility!, includeDiagrams: body.includeDiagrams === true, topic: body.topic ? cleanText(body.topic, 120) : undefined }
}

export function parseGeneratedDeck(raw: string, modelId: string, includeDiagrams: boolean, deckId = randomUUID()): GeneratedDeck | undefined {
  try {
    if (raw.length > 32_768) return undefined
    const value = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as Record<string, unknown>
    const title = cleanText(value.title, 120)
    const description = cleanText(value.description, 500)
    const model = serverAnatomyCatalog.find((entry) => entry.id === modelId)
    if (!title || !description || !model || !Array.isArray(value.cards) || value.cards.length !== GENERATED_DECK_SIZE) return undefined
    const seen = new Set<string>()
    const cards = value.cards.map((entry, index): GeneratedCard | undefined => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined
      const item = entry as Record<string, unknown>
      if (!['identify-structure', 'structure-to-function', 'fact-recall'].includes(String(item.kind)) || !item.front || typeof item.front !== 'object' || !item.back || typeof item.back !== 'object') return undefined
      const front = item.front as Record<string, unknown>
      const back = item.back as Record<string, unknown>
      const frontHeading = cleanText(front.heading, 100)
      const frontBody = cleanText(front.body, 800)
      const backHeading = cleanText(back.heading, 100)
      const backBody = cleanText(back.body, 800)
      if (!frontHeading || !frontBody || !backHeading || !backBody) return undefined
      if (/\b(?:identify|name|which)\b.{0,40}\bhighlighted\b/i.test(`${frontHeading} ${frontBody}`)) return undefined
      const duplicateKey = `${frontHeading}|${frontBody}|${backHeading}|${backBody}`.toLowerCase()
      if (seen.has(duplicateKey)) return undefined
      seen.add(duplicateKey)
      let diagram: GeneratedCard['front']['diagram']
      if (includeDiagrams && front.diagram && typeof front.diagram === 'object' && !Array.isArray(front.diagram)) {
        const requested = front.diagram as Record<string, unknown>
        const variantId = requested.variantId === model.diagramVariantId ? model.diagramVariantId : undefined
        const structureIds = Array.isArray(requested.selectedStructureIds) ? [...new Set(requested.selectedStructureIds.filter((id): id is string => typeof id === 'string'))].slice(0, 3) : []
        if (variantId && structureIds.length > 0 && structureIds.every((id) => model.structures.some((hotspot) => hotspot.id === id))) diagram = { modelId, variantId, selectedStructureIds: structureIds }
      }
      return { id: `${deckId}-${index + 1}`, kind: item.kind as GeneratedCard['kind'], front: { heading: frontHeading, body: frontBody, ...(diagram ? { diagram } : {}) }, back: { heading: backHeading, body: backBody } }
    })
    return cards.every(Boolean) ? { id: deckId, modelId, contentVersion: '1', title, description, cards: cards as GeneratedCard[], source: 'ai' } : undefined
  } catch {
    return undefined
  }
}

export async function generateFlashcardDeck(body: FlashcardGenerationRequest) {
  const input = validateGenerationRequest(body)
  if (!input) return { deck: null, source: 'invalid-request' }
  const hasAzure = Boolean(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT)
  if (!process.env.OPENAI_API_KEY && !hasAzure) return { deck: null, source: 'offline' }
  const variants = [{ id: input.model.diagramVariantId, structures: input.model.structures }]
  const prompt = `Create exactly ${GENERATED_DECK_SIZE} challenging, conventional university anatomy exam questions grounded only in the supplied model context. Every front must ask one direct, answerable question with one expected answer. Test structure, function, spatial relationships, pathways, or clinically relevant anatomy at the requested difficulty. Never use generic prompts such as "identify the highlighted structure," "recall this concept," or "explain this fact." Return JSON with title, description, and cards. Each card needs kind (identify-structure, structure-to-function, or fact-recall), front {heading, body, diagram}, and back {heading, body}. The back must state the answer and a concise anatomical explanation. diagram must be null or {variantId, selectedStructureIds}; use only supplied IDs. Diagrams may support a question but the wording must remain complete without one. Prefer fewer diagrams over uncertain mappings. No diagnosis, treatment, markdown, HTML, geometry, URLs, prices, or IDs outside supplied anatomy identifiers.`
  try {
    const client = hasAzure ? new OpenAI({ apiKey: process.env.AZURE_OPENAI_API_KEY, baseURL: `${process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '')}/openai/v1` }) : new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await client.chat.completions.create({
      model: hasAzure ? process.env.AZURE_OPENAI_DEPLOYMENT! : process.env.OPENAI_MODEL || 'gpt-5-mini',
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify({ model: { id: input.model.id, name: input.model.name, system: input.model.system, description: input.model.description, facts: input.model.facts, variants }, difficulty: input.difficulty, focus: input.focus, topic: input.topic, includeDiagrams: input.includeDiagrams }) }],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4500,
    }, { signal: AbortSignal.timeout(40_000) })
    const deck = parseGeneratedDeck(completion.choices[0]?.message.content || '', input.model.id, input.includeDiagrams)
    return { deck: deck ?? null, source: deck ? hasAzure ? 'azure-openai' : 'openai' : 'invalid-ai-response' }
  } catch (error) {
    console.error('Flashcard generation failed:', error instanceof Error ? error.message : error)
    return { deck: null, source: 'offline' }
  }
}
