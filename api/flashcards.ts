import type { Request, Response } from 'express'
import { generateFlashcardsHandler, unlockFlashcardsHandler } from '../server/flashcardHandlers.js'

export default function handler(request: Request, response: Response) {
  const action = typeof request.query.action === 'string' ? request.query.action : ''
  if (action === 'generate') return generateFlashcardsHandler(request, response)
  if (action === 'unlock') return unlockFlashcardsHandler(request, response)
  response.status(404).json({ message: 'Not found' })
}
