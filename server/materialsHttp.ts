import type { Request, Response } from 'express'
import { getMaterialFlashcards, getMaterialNotes, getMaterialQuestions, gradeMaterialQuestions, materialsErrorResponse } from './materials.js'

export default async function handler(request: Request, response: Response) {
  const action = typeof request.query.action === 'string' ? request.query.action : ''
  const releaseId = typeof request.query.releaseId === 'string' ? request.query.releaseId : ''
  const methods: Record<string, string> = { notes: 'GET', flashcards: 'GET', questions: 'GET', grade: 'POST' }
  if (!methods[action]) return void response.status(404).json({ message: 'Not found' })
  if (request.method !== methods[action]) return void response.status(405).json({ message: 'Method not allowed' })
  response.setHeader('Cache-Control', 'private, no-store')
  try {
    if (action === 'notes') return void response.json(await getMaterialNotes(request.headers.authorization, releaseId))
    if (action === 'flashcards') return void response.json(await getMaterialFlashcards(request.headers.authorization, releaseId))
    if (action === 'questions') return void response.json(await getMaterialQuestions(request.headers.authorization, releaseId))
    if (JSON.stringify(request.body || {}).length > 16_384) return void response.status(413).json({ error: 'request_too_large', message: 'The submitted answers are too large.' })
    response.json(await gradeMaterialQuestions(request.headers.authorization, releaseId, request.body?.answers))
  } catch (error) {
    const result = materialsErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}
