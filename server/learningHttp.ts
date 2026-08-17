import type { Request, Response } from 'express'
import { getProtectedAssessment, getProtectedBuiltInDeck, getProtectedLabActivity, gradeProtectedAssessment, gradeProtectedLabQuestion, learningErrorResponse } from './learning.js'

export default async function handler(request: Request, response: Response) {
  const action = typeof request.query.action === 'string' ? request.query.action : ''
  if (!['lab', 'lab-grade', 'assessment', 'assessment-grade', 'deck'].includes(action)) return void response.status(404).json({ message: 'Not found' })
  if (request.method !== (action === 'lab' || action === 'deck' ? 'GET' : 'POST')) return void response.status(405).json({ message: 'Method not allowed' })
  response.setHeader('Cache-Control', 'private, no-store')
  try {
    if (action === 'lab') return void response.json(await getProtectedLabActivity(request.headers.authorization, request.query.activityId))
    if (action === 'deck') return void response.json(await getProtectedBuiltInDeck(request.headers.authorization, request.query.deckId))
    if (JSON.stringify(request.body || {}).length > 8_192) return void response.status(413).json({ error: 'request_too_large', message: 'The learning response is too large.' })
    if (action === 'lab-grade') return void response.json(await gradeProtectedLabQuestion(request.headers.authorization, request.body))
    if (action === 'assessment') return void response.json(await getProtectedAssessment(request.headers.authorization, request.body))
    response.json(await gradeProtectedAssessment(request.headers.authorization, request.body))
  } catch (error) {
    const result = learningErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}
