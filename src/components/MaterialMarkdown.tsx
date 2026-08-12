import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { Copy, Send, Sparkles } from 'lucide-react'
import type { ActiveNoteContext, MaterialMnemonic } from '../types/materials'
import { parseMaterialMarkdown, safeMaterialUrl } from '../lib/materials'
import { boundedNoteSelection, noteSelectionPrompt, noteToolbarPosition } from '../lib/noteSelection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const noMnemonics = new Map<string, MaterialMnemonic>()

function fallbackAlt(src: string) {
  const name = src.split('/').pop()?.split(/[?#]/)[0]?.replace(/[-_]+/g, ' ').replace(/\.[^.]+$/, '')
  return name ? `Illustration: ${name}` : 'Study material illustration'
}

type Props = {
  markdown: string
  mnemonics: Map<string, MaterialMnemonic>
  noteContext?: Omit<ActiveNoteContext, 'selectedText'>
  onSelection?: (text: string) => void
  onRequest?: (prompt: string) => void
}

export function MaterialMarkdown({ markdown, mnemonics, noteContext, onSelection, onRequest }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | undefined>(undefined)
  const toolbarInteraction = useRef(false)
  const [selection, setSelection] = useState<{ text: string; style?: CSSProperties }>()
  const [guidance, setGuidance] = useState('')
  const [copied, setCopied] = useState(false)
  const selectionEnabled = Boolean(noteContext)
  const emitSelection = useEffectEvent((text: string) => onSelection?.(text))

  useEffect(() => {
    if (!selectionEnabled) return
    function dismiss(clearBrowserSelection = false) {
      setSelection(undefined)
      setGuidance('')
      setCopied(false)
      savedRange.current = undefined
      emitSelection('')
      if (clearBrowserSelection) window.getSelection()?.removeAllRanges()
    }
    function updateSelection() {
      const current = window.getSelection()
      if (toolbarInteraction.current || toolbar.current?.contains(document.activeElement)) return
      if (!current || current.rangeCount === 0 || current.isCollapsed) { dismiss(); return }
      const range = current.getRangeAt(0)
      const common = range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer as Element
      const start = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as Element
      const end = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentElement : range.endContainer as Element
      if (!root.current?.contains(common) || !root.current.contains(start) || !root.current.contains(end) || start?.closest('button, input, textarea, select, a, [role="button"]') || end?.closest('button, input, textarea, select, a, [role="button"]')) { dismiss(); return }
      const text = boundedNoteSelection(current.toString())
      if (!text) { dismiss(); return }
      const rect = range.getBoundingClientRect()
      if (!rect.width && !rect.height) { dismiss(); return }
      savedRange.current = range.cloneRange()
      const style = window.innerWidth <= 640 ? undefined : noteToolbarPosition(rect, window.innerWidth, window.innerHeight)
      setSelection({ text, style })
      emitSelection(text)
    }
    function onPointerDown(event: PointerEvent) {
      if (toolbar.current?.contains(event.target as Node) || root.current?.contains(event.target as Node)) return
      dismiss(true)
    }
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') dismiss(true) }
    document.addEventListener('selectionchange', updateSelection)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    const onScroll = () => dismiss()
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('selectionchange', updateSelection)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      emitSelection('')
    }
  }, [selectionEnabled])

  function preserveSelection(event: ReactPointerEvent) {
    event.preventDefault()
    const current = window.getSelection()
    if (!current || !savedRange.current) return
    current.removeAllRanges()
    current.addRange(savedRange.current)
  }

  function request(action: 'explain' | 'ask') {
    if (!noteContext || !selection) return
    onRequest?.(noteSelectionPrompt(action, { ...noteContext, selectedText: selection.text }, guidance))
  }

  async function copySelection() {
    if (!selection) return
    await navigator.clipboard.writeText(selection.text)
    setCopied(true)
  }

  return <div ref={root} className="material-markdown">{parseMaterialMarkdown(markdown).map((part, index) => {
    if (part.kind === 'mnemonic') {
      const mnemonic = mnemonics.get(part.id)
      return mnemonic ? <aside className="material-mnemonic" key={`${part.id}-${index}`}><span>Mnemonic</span><h3>{mnemonic.title}</h3><MaterialMarkdown markdown={mnemonic.body} mnemonics={noMnemonics} /></aside> : <aside className="material-mnemonic missing" key={`${part.id}-${index}`}>Mnemonic unavailable</aside>
    }
    return <ReactMarkdown key={index} skipHtml urlTransform={(url) => safeMaterialUrl(url) ?? ''} components={{
      a: ({ href, children }) => <a href={safeMaterialUrl(href ?? '')} target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noreferrer' : undefined}>{children}</a>,
      img: ({ src, alt, title }) => { const safeSrc = safeMaterialUrl(src ?? ''); return safeSrc ? <figure><img src={safeSrc} alt={alt?.trim() || fallbackAlt(safeSrc)} loading="lazy" decoding="async" />{title && <figcaption>{title}</figcaption>}</figure> : null },
    }}>{part.content}</ReactMarkdown>
  })}{selection && <div ref={toolbar} className="note-selection-toolbar" role="dialog" aria-label="Selected note actions" style={selection.style} onPointerDownCapture={() => { toolbarInteraction.current = true; window.setTimeout(() => { toolbarInteraction.current = false }, 0) }}>
    <div className="note-selection-actions"><Button size="sm" variant="ghost" onPointerDown={preserveSelection} onClick={() => request('explain')} aria-label="Prepare an explanation of selected text"><Sparkles />Explain</Button><Button size="sm" variant="ghost" onPointerDown={preserveSelection} onClick={() => void copySelection()} aria-label="Copy selected text"><Copy />{copied ? 'Copied' : 'Copy'}</Button><span aria-live="polite">{copied ? 'Copied' : 'Selected'}</span></div>
    <form onSubmit={(event) => { event.preventDefault(); if (guidance.trim()) request('ask') }}><label><span className="sr-only">Ask Mentor about selected text</span><Input value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder="Ask Mentor..." maxLength={240} /></label><Button type="submit" size="icon-sm" variant="ai" disabled={!guidance.trim()} aria-label="Prepare question for Mentor"><Send /></Button></form>
  </div>}</div>
}
