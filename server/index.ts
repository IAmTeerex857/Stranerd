import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getMentorReply, type MentorRequest } from './mentor.js'

const app = express()
const port = Number(process.env.PORT) || 8787
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
app.use(express.json({ limit: '32kb' }))

app.post('/api/mentor', async (request, response) => {
  response.json(await getMentorReply(request.body as MentorRequest))
})

app.use(express.static(path.join(root, 'dist')))
app.get('/{*splat}', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, () => console.log(`Stranerd server listening on http://localhost:${port}`))
