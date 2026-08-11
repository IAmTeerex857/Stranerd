import { aiRequest, type CreditBalance } from './ai'

type MentorContext = {
  model: string
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
  recentActions?: { action: string; structures: string[]; hiddenStructures: string[] }[]
  movedStructures?: string[]
  selectedStructures?: string[]
  facts: string[]
  note?: {
    subject: string
    subjectSlug: string
    releaseId: string
    sectionId: string
    section: string
    pageStart: number
    pageEnd: number
    selectedText: string
  }
}

export async function askMentor(question: string, context: MentorContext): Promise<{ message: string; balance: CreditBalance }> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 17_000)
  try {
    const data = await aiRequest('/api/mentor', { question, context }, controller.signal) as { message?: string; balance?: CreditBalance }
    if (!data.message || !data.balance) throw new Error('Mentor response was incomplete.')
    return { message: data.message, balance: data.balance }
  } finally {
    window.clearTimeout(timeout)
  }
}
