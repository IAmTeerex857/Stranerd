type MentorContext = {
  model: string
  hotspot?: string
  task?: string
  engineResult?: string
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
