import { FormEvent, KeyboardEvent, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Bot, CornerDownRight, Send, X } from 'lucide-react'
import type { ChatItem, DissectionHistoryItem, Hotspot, ModelEntry } from '../types'
import { askMentor } from '../lib/mentor'
import { anatomyGraph, anatomyLayers } from '../data/anatomyGraph'
import { useAuth } from '../auth-context'
import { AIActionError } from '../lib/ai'

type Props = {
  model: ModelEntry
  selectedHotspot?: Hotspot
  actionHistory: DissectionHistoryItem[]
  messages: ChatItem[]
  typing: boolean
  onMessages: Dispatch<SetStateAction<ChatItem[]>>
  onTyping: (value: boolean) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  onInsufficientCredits?: () => void
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

export function MentorPanel({ model, selectedHotspot, actionHistory, messages, typing, onMessages, onTyping, mobileOpen, onMobileClose, onInsufficientCredits }: Props) {
  const { user, balance, setBalance } = useAuth()
  const [input, setInput] = useState('')
  const [actionError, setActionError] = useState<{ message: string; needsCredits: boolean }>()
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
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(`/app?model=${model.id}`)}`)
      return
    }
    setActionError(undefined)
    setInput('')
    const student: ChatItem = { id: crypto.randomUUID(), role: 'student', text: question }
    const replyId = crypto.randomUUID()
    onMessages((current) => [...current, student, { id: replyId, role: 'mentor', text: 'Preparing a grounded response…', pending: true }])
    onTyping(true)
    try {
      const movedStructures = [...new Set(actionHistory.filter((action) => action.action === 'move').flatMap((action) => action.structures))]
      const selectedStructures = [...new Set(actionHistory.filter((action) => action.action === 'select').flatMap((action) => action.structures))]
      const answer = await askMentor(question, {
        model: model.name,
        hotspot: selectedHotspot?.label,
        nodeId: selectedHotspot?.nodeId,
        system: anatomyLayers.find((layer) => layer.id === selectedHotspot?.systemId)?.label,
        conditions: selectedHotspot?.conditions?.map((condition) => condition.label),
        graphVersion: selectedHotspot?.source === 'mesh' ? anatomyGraph.contentVersion : undefined,
        recentActions: actionHistory.slice(-20).map(({ action, structures, hiddenStructures }) => ({ action, structures, hiddenStructures })),
        movedStructures,
        selectedStructures,
        facts: model.facts,
      })
      setBalance(answer.balance)
      onMessages((current) => current.map((message) => message.id === replyId ? { ...message, text: answer.message, pending: false } : message))
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') onInsufficientCredits?.()
      const message = error instanceof Error ? error.message : 'The AI request failed. No credit was charged.'
      setActionError({ message, needsCredits: error instanceof AIActionError && error.code === 'insufficient_credits' })
      const fallback = `Focus on ${model.name} structure-function relationships: ${model.facts[0]}`
      onMessages((current) => current.map((item) => item.id === replyId ? { ...item, text: `Authored fallback · ${fallback}`, pending: false } : item))
    } finally {
      onTyping(false)
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <aside id="stranerd-mentor" className={`mentor ${mobileOpen ? 'mobile-open' : ''} panel anim3`} aria-label="Stranerd Mentor">
      <header className="mentor-head"><span className="mentor-avatar"><Bot size={17} /></span><div><strong>Stranerd Mentor</strong><small><i /> explicit AI · 1 credit</small></div>{onMobileClose && <button className="mentor-mobile-close" onClick={onMobileClose} aria-label="Close mentor"><X size={17} /></button>}</header>
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
      {actionError && !actionError.needsCredits && <div className="mentor-action-error"><span>{actionError.message}</span></div>}
      <form className="mentor-input" onSubmit={submit}>
        <label htmlFor="mentor-question">Ask about {selectedHotspot?.label || 'this model'}</label>
        <div><textarea id="mentor-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} placeholder="Why is this structure important?" maxLength={500} rows={2} /><button aria-label={user ? 'Ask AI Mentor for 1 credit' : 'Sign in to ask AI Mentor'} disabled={!input.trim() || typing}><Send size={15} /><span>{user ? 'Ask AI · 1 credit' : 'Sign in to ask'}</span></button></div>
        <small>{user ? `${balance ? `${balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance} credits available` : 'Loading credits'} · ` : ''}Enter to send · Shift+Enter for a new line.</small>
      </form>
    </aside>
  )
}
