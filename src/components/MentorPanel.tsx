import { FormEvent, useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles } from 'lucide-react'
import type { ChatItem, Lesson, ModelEntry } from '../types'
import { askMentor } from '../lib/mentor'

type Props = {
  model: ModelEntry
  lesson?: Lesson
  selectedHotspot?: string
  messages: ChatItem[]
  typing: boolean
  onMessages: (messages: ChatItem[]) => void
  onTyping: (value: boolean) => void
}

export function MentorPanel({ model, lesson, selectedHotspot, messages, typing, onMessages, onTyping }: Props) {
  const [input, setInput] = useState('')
  const transcript = useRef<HTMLDivElement>(null)
  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || typing) return
    setInput('')
    const student: ChatItem = { id: crypto.randomUUID(), role: 'student', text: question }
    onMessages([...messages, student])
    onTyping(true)
    const answer = await askMentor(question, {
      model: model.name,
      hotspot: selectedHotspot,
      task: lesson?.prompt,
      facts: model.facts,
    }, lesson?.fallback || `Focus on ${model.name} structure-function relationships: ${model.facts[0]}`)
    onMessages([...messages, student, { id: crypto.randomUUID(), role: 'mentor', text: answer }])
    onTyping(false)
  }

  return (
    <aside className="mentor panel anim3">
      <header className="mentor-head"><span className="mentor-avatar"><Sparkles size={17} /></span><div><strong>Stranerd Mentor</strong><small><i /> explanation layer · online</small></div></header>
      {lesson && <div className="pinned-task"><span>Current task</span><strong>{lesson.title}</strong><p>{lesson.prompt}</p></div>}
      <div className="transcript" ref={transcript} aria-live="polite">
        {messages.map((message) => message.role === 'engine' ? (
          <div key={message.id} className={`engine-chip ${message.status}`}>ENGINE · {message.text}</div>
        ) : (
          <div key={message.id} className={`chat-row ${message.role}`}>
            <span>{message.role === 'mentor' ? <Bot size={15} /> : 'YOU'}</span><p>{message.text}</p>
          </div>
        ))}
        {typing && <div className="typing"><i /><i /><i /><span>Mentor is responding</span></div>}
      </div>
      <form className="mentor-input" onSubmit={submit}>
        <label htmlFor="mentor-question">Ask about this model</label>
        <div><input id="mentor-question" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Why is this structure important?" maxLength={500} /><button aria-label="Send question" disabled={!input.trim() || typing}><Send size={17} /></button></div>
        <small>Grounded to the active model and authored facts.</small>
      </form>
    </aside>
  )
}
