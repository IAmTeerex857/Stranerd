import { useEffect, useEffectEvent, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import { Copy, Send, Sparkles } from 'lucide-react'
import type { ActiveNoteContext, MaterialImageMetadata, MaterialMnemonic } from '../types/materials'
import { parseMaterialMarkdown, safeMaterialUrl } from '../lib/materials'
import { boundedNoteSelection, noteSelectionPrompt, noteToolbarPosition } from '../lib/noteSelection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const noMnemonics = new Map<string, MaterialMnemonic>()

function fallbackAlt(src: string) {
  const name = src.split('/').pop()?.split(/[?#]/)[0]?.replace(/[-_]+/g, ' ').replace(/\.[^.]+$/, '')
  return name ? `Illustration: ${name}` : 'Study material illustration'
}

const materialImageSizes = '(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) calc(100vw - 96px), 760px'

function MaterialImage({ src, alt, title, priority, metadata }: { src: string; alt: string; title?: string; priority: boolean; metadata?: MaterialImageMetadata }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  return <figure className={`material-image material-image-${status}`}>
    <div className="material-image-frame" style={metadata ? { aspectRatio: `${metadata.width} / ${metadata.height}` } : undefined}>
      {status !== 'error' && <img src={src} alt={alt} width={metadata?.width} height={metadata?.height} srcSet={metadata?.srcSet} sizes={metadata ? materialImageSizes : undefined} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />}
      {status === 'error' && <span role="img" aria-label={alt}>Image unavailable</span>}
    </div>
    {title && <figcaption>{title}</figcaption>}
  </figure>
}

type Props = {
  markdown: string
  mnemonics: Map<string, MaterialMnemonic>
  noteContext?: Omit<ActiveNoteContext, 'selectedText'>
  onSelection?: (text: string) => void
  onRequest?: (prompt: string) => void
  imageMetadata?: ReadonlyMap<string, MaterialImageMetadata>
  prioritizeFirstImage?: boolean
}

const NOTE_SELECTION_HIGHLIGHT = 'stranerd-note-selection'

function updateSelectionHighlight(range?: Range) {
  const registry = (CSS as typeof CSS & { highlights?: { delete: (name: string) => void; set: (name: string, highlight: unknown) => void } }).highlights
  const HighlightConstructor = (window as typeof window & { Highlight?: new (...ranges: Range[]) => unknown }).Highlight
  if (!registry) return
  registry.delete(NOTE_SELECTION_HIGHLIGHT)
  if (range && HighlightConstructor) registry.set(NOTE_SELECTION_HIGHLIGHT, new HighlightConstructor(range))
}

export function MaterialMarkdown({ markdown, mnemonics, noteContext, onSelection, onRequest, imageMetadata, prioritizeFirstImage = true }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | undefined>(undefined)
  const toolbarInteraction = useRef(false)
  const selectionActive = useRef(false)
  const lastEmittedSelection = useRef('')
  const [selection, setSelection] = useState<{ text: string; style?: CSSProperties }>()
  const [guidance, setGuidance] = useState('')
  const [copied, setCopied] = useState(false)
  const selectionEnabled = Boolean(noteContext)
  const emitSelection = useEffectEvent((text: string) => onSelection?.(text))

  useEffect(() => {
    if (!selectionEnabled) return
    function publishSelection(text: string) {
      if (lastEmittedSelection.current === text) return
      lastEmittedSelection.current = text
      emitSelection(text)
    }
    function dismiss(clearBrowserSelection = false) {
      if (!selectionActive.current) return
      selectionActive.current = false
      setSelection(undefined)
      setGuidance('')
      setCopied(false)
      savedRange.current = undefined
      updateSelectionHighlight()
      publishSelection('')
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
      updateSelectionHighlight(savedRange.current)
      const workspace = root.current?.closest('.center-pane')?.getBoundingClientRect()
      const mentor = document.getElementById('stranerd-mentor')?.getBoundingClientRect()
      const workspaceRight = mentor && mentor.width > 0 && mentor.left > (workspace?.left ?? 0) ? Math.min(workspace?.right ?? window.innerWidth, mentor.left) : workspace?.right ?? window.innerWidth
      const style = window.innerWidth <= 640 ? undefined : noteToolbarPosition(rect, workspace?.left ?? 0, workspaceRight, window.innerHeight)
      selectionActive.current = true
      setSelection((previous) => previous?.text === text && previous.style?.left === style?.left && previous.style?.top === style?.top ? previous : { text, style })
    }
    let publishTimer = 0
    function publishCompletedSelection() {
      window.clearTimeout(publishTimer)
      publishTimer = window.setTimeout(() => {
        const text = boundedNoteSelection(window.getSelection()?.toString() ?? '')
        if (text) publishSelection(text)
      }, 120)
    }
    function onPointerDown(event: PointerEvent) {
      if (toolbar.current?.contains(event.target as Node) || root.current?.contains(event.target as Node)) return
      dismiss(true)
    }
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') dismiss(true) }
    document.addEventListener('selectionchange', updateSelection)
    document.addEventListener('pointerup', publishCompletedSelection)
    document.addEventListener('keyup', publishCompletedSelection)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    const onScroll = () => dismiss()
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('selectionchange', updateSelection)
      document.removeEventListener('pointerup', publishCompletedSelection)
      document.removeEventListener('keyup', publishCompletedSelection)
      window.clearTimeout(publishTimer)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      if (selectionActive.current) dismiss()
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
    selectionActive.current = false
    setSelection(undefined)
    setGuidance('')
    setCopied(false)
    savedRange.current = undefined
    updateSelectionHighlight()
    window.getSelection()?.removeAllRanges()
  }

  async function copySelection() {
    if (!selection) return
    await navigator.clipboard.writeText(selection.text)
    setCopied(true)
  }

  const selectionToolbar = selection && <div className="learn-redesign note-selection-portal"><div ref={toolbar} className="note-selection-toolbar" role="dialog" aria-label="Selected note actions" style={selection.style} onPointerDownCapture={() => { toolbarInteraction.current = true; window.setTimeout(() => { toolbarInteraction.current = false }, 0) }}>
    <div className="note-selection-actions"><Button size="sm" variant="ghost" onPointerDown={preserveSelection} onClick={() => request('explain')} aria-label="Send selected text to Nerd Bot for explanation"><Sparkles />Explain</Button><Button size="sm" variant="ghost" onPointerDown={preserveSelection} onClick={() => void copySelection()} aria-label="Copy selected text"><Copy />{copied ? 'Copied' : 'Copy'}</Button><span aria-live="polite">{copied ? 'Copied' : 'Selected'}</span></div>
    <form onSubmit={(event) => { event.preventDefault(); if (guidance.trim()) request('ask') }}><label><span className="sr-only">Ask Nerd Bot about selected text</span><Input value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder="Ask Nerd Bot..." maxLength={240} /></label><Button type="submit" size="icon-sm" variant="ai" disabled={!guidance.trim()} aria-label="Send question to Nerd Bot"><Send /></Button></form>
  </div></div>

  let imageIndex = 0
  return <><div ref={root} className="material-markdown">{parseMaterialMarkdown(markdown).map((part, index) => {
    if (part.kind === 'mnemonic') {
      const mnemonic = mnemonics.get(part.id)
      return mnemonic ? <aside className="material-mnemonic" key={`${part.id}-${index}`}><span>Mnemonic</span><h3>{mnemonic.title}</h3><MaterialMarkdown markdown={mnemonic.body} mnemonics={noMnemonics} imageMetadata={imageMetadata} prioritizeFirstImage={false} /></aside> : <aside className="material-mnemonic missing" key={`${part.id}-${index}`}>Mnemonic unavailable</aside>
    }
    return <ReactMarkdown key={index} skipHtml urlTransform={(url) => safeMaterialUrl(url) ?? ''} components={{
      a: ({ href, children }) => <a href={safeMaterialUrl(href ?? '')} target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noreferrer' : undefined}>{children}</a>,
      p: ({ node, children }) => node?.children.length === 1 && node.children[0].type === 'element' && node.children[0].tagName === 'img' ? <>{children}</> : <p>{children}</p>,
      img: ({ src, alt, title }) => { const safeSrc = safeMaterialUrl(src ?? ''); return safeSrc ? <MaterialImage key={safeSrc} src={safeSrc} alt={alt?.trim() || fallbackAlt(safeSrc)} title={title} priority={prioritizeFirstImage && imageIndex++ === 0} metadata={imageMetadata?.get(safeSrc)} /> : null },
    }}>{part.content}</ReactMarkdown>
  })}</div>{selectionToolbar && createPortal(selectionToolbar, document.body)}</>
}
