import { FormEvent, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Bot, CornerDownRight, Send, X } from 'lucide-react'
import type { ChatItem, Hotspot, ModelEntry } from '../types'
import { askMentor } from '../lib/mentor'
import { anatomyGraph, anatomyLayers } from '../data/anatomyGraph'

type Props = {
  model: ModelEntry
  selectedHotspot?: Hotspot
  messages: ChatItem[]
  typing: boolean
  onMessages: Dispatch<SetStateAction<ChatItem[]>>
  onTyping: (value: boolean) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function MentorText({ text }: { text: string }) {
  const blocks = text.replace(/\*\*|__/g, '').split(/\n{2,}/).filter(Boolean)
  return <div className="mentor-copy">{blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.every((line) => /^[-•*]\s+/.test(line))) {
      return <ul key={index}>{lines.map((line) => <li key={line}>{line.replace(/^[-•*]\s+/, '')}</li>)}</ul>
    }
    return <p key={index}>{lines.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}>{line.replace(/^#{1,6}\s*/, '')}{lineIndex < lines.length - 1 && <br />}</span>)}</p>
  })}</div>
}

export function MentorPanel({ model, selectedHotspot, messages, typing, onMessages, onTyping, mobileOpen, onMobileClose }: Props) {
  const [input, setInput] = useState('')
  const transcript = useRef<HTMLDivElement>(null)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nextFrame = window.requestAnimationFrame(() => {
        transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: mobileOpen ? 'auto' : 'smooth' })
      })
      return () => window.cancelAnimationFrame(nextFrame)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, mobileOpen, typing])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const question = input.trim()
    if (!question || typing) return
    setInput('')
    const student: ChatItem = { id: crypto.randomUUID(), role: 'student', text: question }
    const replyId = crypto.randomUUID()
    onMessages((current) => [...current, student, { id: replyId, role: 'mentor', text: 'Preparing a grounded response…', pending: true }])
    onTyping(true)
    try {
      const answer = await askMentor(question, {
        model: model.name,
        hotspot: selectedHotspot?.label,
        nodeId: selectedHotspot?.nodeId,
        system: anatomyLayers.find((layer) => layer.id === selectedHotspot?.systemId)?.label,
        conditions: selectedHotspot?.conditions?.map((condition) => condition.label),
        graphVersion: selectedHotspot?.source === 'mesh' ? anatomyGraph.contentVersion : undefined,
        facts: model.facts,
      }, `Focus on ${model.name} structure-function relationships: ${model.facts[0]}`)
      onMessages((current) => current.map((message) => message.id === replyId ? { ...message, text: answer, pending: false } : message))
    } finally {
      onTyping(false)
    }
  }

  return (
    <aside className={`mentor ${mobileOpen ? 'mobile-open' : ''} panel anim3`}>
      <header className="mentor-head"><span className="mentor-avatar"><Bot size={17} /></span><div><strong>Stranerd Mentor</strong><small><i /> explanation layer · online</small></div>{onMobileClose && <button className="mentor-mobile-close" onClick={onMobileClose} aria-label="Close mentor"><X size={17} /></button>}</header>
      {selectedHotspot && <div className="mentor-context"><header><span>Selected context</span><b>{selectedHotspot.source === 'mesh' ? `KG ${anatomyGraph.contentVersion}` : model.name}</b></header><strong>{selectedHotspot.label}</strong><small>{anatomyLayers.find((layer) => layer.id === selectedHotspot.systemId)?.label || model.system} system</small><button onClick={() => setInput(`Explain the structure and function of ${selectedHotspot.label}.`)}>Ask about this<CornerDownRight size={13} /></button></div>}
      <div className="transcript" ref={transcript} aria-live="polite">
        {messages.map((message) => message.role === 'engine' ? (
          <div key={message.id} className={`engine-chip ${message.status}`}>{message.text}</div>
        ) : (
          <div key={message.id} className={`chat-row ${message.role} ${message.pending ? 'pending' : ''}`}>
            <span>{message.role === 'mentor' ? <Bot size={15} /> : 'YOU'}</span><MentorText text={message.text} />
          </div>
        ))}
        {typing && <div className="typing"><i /><i /><i /><span>Mentor is responding</span></div>}
        <div ref={transcriptEnd} aria-hidden="true" />
      </div>
      <form className="mentor-input" onSubmit={submit}>
        <label htmlFor="mentor-question">Ask about {selectedHotspot?.label || 'this model'}</label>
        <div><input id="mentor-question" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Why is this structure important?" maxLength={500} /><button aria-label="Send question" disabled={!input.trim() || typing}><Send size={17} /></button></div>
        <small>Grounded to the selected structure and active model.</small>
      </form>
    </aside>
  )
}
