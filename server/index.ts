import 'dotenv/config'
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
import welcomeEmailHandler from '../api/email/welcome.js'

const app = express()
const port = Number(process.env.PORT) || 8787
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://bezxmhtakraxschfftkj.supabase.co wss://bezxmhtakraxschfftkj.supabase.co; upgrade-insecure-requests",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}

app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
app.use((_request, response, next) => {
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value)
  next()
})
app.post('/api/webhooks/spotflow', express.raw({ type: 'application/json', limit: '256kb' }), spotflowWebhookHandler)
app.use(express.json({ limit: '32kb' }))

app.post('/api/mentor', mentorHandler)
app.post('/api/quiz', quizHandler)
app.post('/api/email/welcome', welcomeEmailHandler)
app.post('/api/billing/checkout', billingCheckoutHandler)
app.get('/api/billing/status', billingStatusHandler)
app.post('/api/billing/cancel', billingCancelHandler)

app.use(express.static(path.join(root, 'dist')))
app.get('/{*splat}', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, () => console.log(`Stranerd server listening on http://localhost:${port}`))
