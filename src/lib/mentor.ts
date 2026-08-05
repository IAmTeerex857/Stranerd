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
  facts: string[]
}

export async function askMentor(question: string, context: MentorContext, fallback: string): Promise<string> {
  try {
    const response = await fetch('/api/mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, context, fallback }),
    })
    if (!response.ok) throw new Error(`Mentor request returned ${response.status}`)
    const data = await response.json() as { message?: string }
    return data.message || fallback
  } catch {
    return fallback
  }
}
