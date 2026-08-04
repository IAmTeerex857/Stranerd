import type { Request, Response } from 'express'
import { getMentorReply, type MentorRequest } from '../server/mentor.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }

  response.json(await getMentorReply(request.body as MentorRequest))
}
