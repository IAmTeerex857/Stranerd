import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mentorHandler from '../api/mentor.js'
import quizHandler from '../api/quiz.js'

const app = express()
const port = Number(process.env.PORT) || 8787
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }))
app.use(express.json({ limit: '32kb' }))

app.post('/api/mentor', mentorHandler)
app.post('/api/quiz', quizHandler)

app.use(express.static(path.join(root, 'dist')))
app.get('/{*splat}', (_request, response) => response.sendFile(path.join(root, 'dist', 'index.html')))

app.listen(port, () => console.log(`Stranerd server listening on http://localhost:${port}`))
