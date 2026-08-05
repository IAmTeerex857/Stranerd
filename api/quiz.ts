import type { Request, Response } from 'express'
import { generateQuizSet, type QuizGenerationRequest } from '../server/quiz.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  response.json(await generateQuizSet(request.body as QuizGenerationRequest))
}
