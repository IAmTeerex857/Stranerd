import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mentorHandler from '../api/mentor.js'
import quizHandler from '../api/quiz.js'
import billingCheckoutHandler from '../api/billing/checkout.js'
import billingStatusHandler from '../api/billing/status.js'
import billingCancelHandler from '../api/billing/cancel.js'
import spotflowWebhookHandler from '../api/webhooks/spotflow.js'
import { bachsWebhookHandler } from './bachsHttp.js'
import welcomeEmailHandler from '../api/email/welcome.js'
import flashcardsHandler from '../api/flashcards.js'
import realtimeSessionHandler from '../api/realtime/session.js'
import extendRealtimeSessionHandler from '../api/realtime/extend.js'
import endRealtimeSessionHandler from '../api/realtime/end.js'
import libraryHandler from '../api/library.js'
import materialsHandler from './materialsHttp.js'
import learningHandler from './learningHttp.js'
import { isSocialCrawler, librarySharePreviewHandler } from './librarySharePreview.js'

dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const app = express()
const port = Number(process.env.PORT) || 8787
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
app.post('/api/webhooks/spotflow', express.raw({ type: 'application/json', limit: '256kb' }), spotflowWebhookHandler)
app.post('/api/webhooks/bachs', express.raw({ type: 'application/json', limit: '256kb' }), bachsWebhookHandler)
app.use('/api/library', express.json({ limit: '256kb' }))
app.use(express.json({ limit: '32kb' }))

app.post('/api/mentor', mentorHandler)
app.post('/api/quiz', quizHandler)
app.all('/api/flashcards', flashcardsHandler)
app.post('/api/realtime/session', realtimeSessionHandler)
app.post('/api/realtime/extend', extendRealtimeSessionHandler)
app.post('/api/realtime/end', endRealtimeSessionHandler)
app.post('/api/email/welcome', welcomeEmailHandler)
app.post('/api/billing/checkout', billingCheckoutHandler)
app.get('/api/billing/checkout', billingCheckoutHandler)
app.get('/api/billing/status', billingStatusHandler)
app.post('/api/billing/cancel', billingCancelHandler)
app.all('/api/library', libraryHandler)
app.all('/api/materials', materialsHandler)
app.all('/api/learning', learningHandler)

app.get('/library/share', (request, response, next) => {
  if (!isSocialCrawler(request.headers['user-agent'])) return next()
  void librarySharePreviewHandler(request, response)
})
app.use(express.static(path.join(root, 'dist')))
app.get('/{*splat}', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, () => console.log(`Stranerd server listening on http://localhost:${port}`))
