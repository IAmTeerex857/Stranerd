import { FormEvent, KeyboardEvent, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowRight, BookOpenCheck, Bot, ChevronDown, CornerDownRight, GalleryVerticalEnd, GitCompareArrows, Mic, PanelRightClose, Send, Sparkles } from 'lucide-react'
import type { ChatItem, DissectionHistoryItem, Hotspot, ModelEntry } from '../types'
import { askMentor } from '../lib/mentor'
import { anatomyGraph, anatomyLayers } from '../data/anatomyGraph'
import { useAuth } from '../auth-context'
import { AIActionError } from '../lib/ai'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { VoiceDock } from './VoiceDock'
import type { VoiceCore } from '../lib/useVoiceCore'
import type { ActiveNoteContext, NoteSelectionRequest } from '../types/materials'
import { useBodyScrollLock } from '../lib/bodyScrollLock'

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
  onDesktopClose?: () => void
  onInsufficientCredits?: () => void
  noteContext?: ActiveNoteContext
  draftRequest?: NoteSelectionRequest
  voice: VoiceCore
}

function MentorText({ text }: { text: string }) {
  const blocks = text.replace(/[\u2013\u2014]/g, '-').replace(/\*\*|__/g, '').split(/\n{2,}/).filter(Boolean)
  return <div className="mentor-copy">{blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.every((line) => /^[-•*]\s+/.test(line))) {
      return <ul key={index}>{lines.map((line) => <li key={line}>{line.replace(/^[-•*]\s+/, '')}</li>)}</ul>
    }
    return <p key={index}>{lines.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}>{line.replace(/^#{1,6}\s*/, '')}{lineIndex < lines.length - 1 && <br />}</span>)}</p>
  })}</div>
}

export function MentorPanel({ model, selectedHotspot, actionHistory, messages, typing, onMessages, onTyping, mobileOpen, onMobileClose, onDesktopClose, onInsufficientCredits, noteContext, draftRequest, voice }: Props) {
  const { user, setBalance } = useAuth()
  const [input, setInput] = useState('')
  const [actionError, setActionError] = useState<{ message: string; needsCredits: boolean }>()
  const [assistantTab, setAssistantTab] = useState(new URLSearchParams(window.location.search).get('assistant') === 'voice' || voice.status && !['ended', 'error'].includes(voice.status) ? 'voice' : 'text')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const wasMobileOpen = useRef(false)
  const visibleMessages = messages.filter((message) => message.role !== 'engine' && !message.text.startsWith('Authored context') && !message.text.startsWith('SELECTED'))
  const showSuggestions = visibleMessages.length <= 1 && !selectedHotspot && !noteContext
  const suggestions = [
    { Icon: BookOpenCheck, label: `Quiz me on ${model.name.toLowerCase()} structure and function` },
    { Icon: GalleryVerticalEnd, label: `Build a quick recall plan for ${model.name.toLowerCase()}` },
    { Icon: GitCompareArrows, label: `Compare the most important structures in ${model.name.toLowerCase()}` },
  ]
  useEffect(() => {
    if (!stickToBottom.current) return
    let nextFrame = 0
    const frame = window.requestAnimationFrame(() => { nextFrame = window.requestAnimationFrame(() => { const element = transcript.current; element?.scrollTo({ top: element.scrollHeight, behavior: mobileOpen ? 'auto' : 'smooth' }) }) })
    return () => { window.cancelAnimationFrame(frame); window.cancelAnimationFrame(nextFrame) }
  }, [messages, mobileOpen, typing])
  useEffect(() => {
    if (mobileOpen && !wasMobileOpen.current) {
      stickToBottom.current = true
      window.requestAnimationFrame(() => { const element = transcript.current; element?.scrollTo({ top: element.scrollHeight }) })
    }
    wasMobileOpen.current = Boolean(mobileOpen)
  }, [mobileOpen])
  useBodyScrollLock(Boolean(mobileOpen) && window.innerWidth < 1200)
  useEffect(() => {
    if (!draftRequest) return
    const frame = window.requestAnimationFrame(() => {
      setInput(draftRequest.prompt)
      setAssistantTab('text')
      window.requestAnimationFrame(() => inputRef.current?.focus())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [draftRequest])

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
        note: noteContext,
      })
      setBalance(answer.balance)
      onMessages((current) => current.map((message) => message.id === replyId ? { ...message, text: answer.message, pending: false } : message))
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') onInsufficientCredits?.()
      const message = error instanceof Error ? error.message : 'The AI request failed. No credit was charged.'
      setActionError({ message, needsCredits: error instanceof AIActionError && error.code === 'insufficient_credits' })
      onMessages((current) => current.filter((item) => item.id !== replyId))
    } finally {
      onTyping(false)
    }
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return <>
    {mobileOpen && <button className="mentor-backdrop" onClick={onMobileClose} aria-label={voice.status && !['ended', 'error'].includes(voice.status) ? 'Minimize Nerd Bot' : 'Close Nerd Bot'} />}
    <aside id="stranerd-mentor" className={`mentor assistant-panel ${mobileOpen ? 'mobile-open' : ''} panel anim3`} aria-label="Nerd Bot" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined}>
      <header className="mentor-head"><span className="mentor-avatar"><Sparkles size={18} /></span><div><strong>Nerd Bot</strong><small>{noteContext?.subject || model.name} · grounded in context</small></div>{onDesktopClose && <Button variant="ghost" size="icon-sm" className="mentor-desktop-close" onClick={onDesktopClose} aria-label="Close Nerd Bot panel"><PanelRightClose size={17} /></Button>}{onMobileClose && <Button variant="ghost" size="icon-sm" className="mentor-mobile-close" onClick={onMobileClose} aria-label={voice.status && !['ended', 'error'].includes(voice.status) ? 'Minimize Nerd Bot' : 'Close Nerd Bot'}><ChevronDown size={17} /></Button>}</header>
      <Tabs value={assistantTab} onValueChange={setAssistantTab} className="assistant-tabs">
        <TabsList className="assistant-tabs-list"><TabsTrigger value="text"><Bot />Text</TabsTrigger><TabsTrigger value="voice"><Mic />Voice</TabsTrigger></TabsList>
        <TabsContent value="text" className="assistant-tab-content assistant-text-tab">
          {noteContext ? <div className="mentor-context note-mentor-context"><header><span>Active note</span></header><strong>{noteContext.subject}</strong><small>{noteContext.section}{noteContext.selectedText ? ' · selection included' : ''}</small></div> : selectedHotspot && <div className="mentor-context"><header><span>Selected context</span><b>{selectedHotspot.source === 'mesh' ? `KG ${anatomyGraph.contentVersion}` : model.name}</b></header><strong>{selectedHotspot.label}</strong><small>{anatomyLayers.find((layer) => layer.id === selectedHotspot.systemId)?.label || model.system} system</small><Button variant="ghost" size="sm" onClick={() => setInput(`Explain the structure and function of ${selectedHotspot.label}.`)}>Ask about this<CornerDownRight size={13} /></Button></div>}
          <div className={`transcript ${showSuggestions ? 'suggestion-state' : ''}`} ref={transcript} aria-live="polite" onScroll={(event) => { const element = event.currentTarget; stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48 }}>
            {showSuggestions ? <div className="mentor-welcome"><span className="mentor-welcome-mark"><Bot /></span><h2>Learn with Nerd Bot</h2><p>Ask about the current model, test your recall, or compare anatomical relationships.</p><div>{suggestions.map(({ Icon, label }) => <button key={label} onClick={() => setInput(label)}><span><Icon /></span>{label}<ArrowRight /></button>)}</div><small>Grounded in your current anatomy context</small></div> : visibleMessages.map((message) => (
              <div key={message.id} className={`chat-row ${message.role} ${message.pending ? 'pending' : ''}`}><span>{message.role === 'mentor' ? <Bot size={15} /> : 'YOU'}</span><MentorText text={message.text} /></div>
            ))}
            {typing && <div className="typing"><i /><i /><i /><span>Nerd Bot is responding</span></div>}
            <div aria-hidden="true" />
          </div>
          {actionError && !actionError.needsCredits && <div className="mentor-action-error"><span>{actionError.message}</span></div>}
          <form className="mentor-input" onSubmit={submit}>
            <div><Textarea ref={inputRef} id="mentor-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} placeholder={`Ask about ${noteContext?.section || selectedHotspot?.label || model.name}...`} maxLength={500} rows={2} /><Button variant="ai" className="mentor-send" aria-label={user ? 'Ask Nerd Bot for 1 credit' : 'Sign in to ask Nerd Bot'} disabled={!input.trim() || typing}><span>Send</span><b><Sparkles size={11} />1</b><Send className="mentor-send-mobile" size={16} /></Button></div>
          </form>
        </TabsContent>
        <TabsContent value="voice" className="assistant-tab-content assistant-voice-tab"><VoiceDock embedded voice={voice} /></TabsContent>
      </Tabs>
    </aside>
  </>
}
