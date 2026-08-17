import type { Request, Response } from 'express'
import learningHandler from '../server/learningHttp.js'
import materialsHandler from '../server/materialsHttp.js'
import { librarySharePreviewHandler } from '../server/librarySharePreview.js'
import {
  bulkEditLibraryItems,
  createLibraryGeneration,
  createLibraryShare,
  deleteLibrarySet,
  getLibrarySet,
  getLibraryShareMetadata,
  getSharedLibrarySet,
  gradeLibrarySet,
  gradeSharedLibrarySet,
  libraryErrorResponse,
  listLibrary,
  renameLibrarySet,
  resetLibraryProgress,
  revokeLibraryShare,
  upsertLibraryProgress,
} from '../server/library.js'

export default async function handler(request: Request, response: Response) {
  if (request.query.service === 'learning') return learningHandler(request, response)
  if (request.query.service === 'materials') return materialsHandler(request, response)
  if (request.query.service === 'share-preview') return librarySharePreviewHandler(request, response)
  const action = typeof request.query.action === 'string' ? request.query.action : ''
  const allowedMethods: Record<string, string[]> = {
    list: ['GET'],
    set: ['GET', 'PATCH', 'DELETE'],
    generation: ['POST'],
    items: ['PATCH'],
    shares: ['POST', 'DELETE'],
    share: ['GET'],
    shared: ['GET'],
    grade: ['POST'],
    'shared-grade': ['POST'],
    progress: ['PUT', 'DELETE'],
  }
  if (!allowedMethods[action]) return void response.status(404).json({ message: 'Not found' })
  if (!allowedMethods[action].includes(request.method)) return void response.status(405).json({ message: 'Method not allowed' })

  try {
    if (action === 'list') {
      response.setHeader('Cache-Control', 'private, no-store')
      return void response.json(await listLibrary(request.headers.authorization))
    }

    if (action === 'set') {
      const setId = typeof request.query.id === 'string' ? request.query.id : ''
      response.setHeader('Cache-Control', 'private, no-store')
      if (request.method === 'GET') return void response.json(await getLibrarySet(request.headers.authorization, setId, request.query.mode === 'edit'))
      if (request.method === 'PATCH') {
        if (JSON.stringify(request.body || {}).length > 1_024) return void response.status(413).json({ error: 'request_too_large', message: 'The rename request is too large.' })
        return void response.json(await renameLibrarySet(request.headers.authorization, setId, request.body?.title))
      }
      return void response.json(await deleteLibrarySet(request.headers.authorization, setId))
    }

    if (action === 'generation') {
      if (JSON.stringify(request.body || {}).length > 256 * 1024) return void response.status(413).json({ error: 'request_too_large', message: 'The generation request is too large.' })
      return void response.status(202).json(await createLibraryGeneration(request.headers.authorization, request.headers['x-request-id'] as string | undefined, request.body))
    }

    if (action === 'items') {
      if (JSON.stringify(request.body || {}).length > 256 * 1024) return void response.status(413).json({ error: 'request_too_large', message: 'The item edit is too large.' })
      const setId = typeof request.query.id === 'string' ? request.query.id : ''
      return void response.json(await bulkEditLibraryItems(request.headers.authorization, setId, request.body?.expectedVersion, request.body?.edits, request.body?.title))
    }

    if (action === 'grade') {
      if (JSON.stringify(request.body || {}).length > 32_768) return void response.status(413).json({ error: 'request_too_large', message: 'The submitted answers are too large.' })
      const setId = typeof request.query.id === 'string' ? request.query.id : ''
      return void response.json(await gradeLibrarySet(request.headers.authorization, setId, request.body?.answers))
    }

    if (action === 'progress') {
      if (JSON.stringify(request.body || {}).length > 128 * 1024) return void response.status(413).json({ error: 'request_too_large', message: 'The progress request is too large.' })
      const setId = typeof request.query.id === 'string' ? request.query.id : ''
      response.setHeader('Cache-Control', 'private, no-store')
      if (request.method === 'PUT') return void response.json(await upsertLibraryProgress(request.headers.authorization, setId, request.body?.progress))
      return void response.json(await resetLibraryProgress(request.headers.authorization, setId))
    }

    if (action === 'shares') {
      if (JSON.stringify(request.body || {}).length > 2_048) return void response.status(413).json({ error: 'request_too_large', message: 'The share request is too large.' })
      response.setHeader('Cache-Control', 'private, no-store')
      if (request.method === 'POST') return void response.status(201).json(await createLibraryShare(request.headers.authorization, request.body?.setId, request.body?.expiresAt))
      return void response.json(await revokeLibraryShare(request.headers.authorization, request.body?.linkId))
    }

    const token = typeof request.query.token === 'string' ? request.query.token : ''
    if (action === 'share') {
      response.setHeader('Cache-Control', 'public, max-age=60')
      return void response.json(await getLibraryShareMetadata(token))
    }

    response.setHeader('Cache-Control', 'private, no-store')
    if (action === 'shared-grade') return void response.json(await gradeSharedLibrarySet(request.headers.authorization, token, request.body?.answers))
    response.json(await getSharedLibrarySet(request.headers.authorization, token))
  } catch (error) {
    const result = libraryErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}
