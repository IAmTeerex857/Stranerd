import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowLeft, ArrowRight, RotateCcw, Shuffle } from 'lucide-react'
import type { FlashcardDeck, FlashcardDeckProgress, FlashcardGrade } from '../types'
import { isTapGesture, shuffledIds } from '../lib/flashcards'
import { FlashcardDiagram } from './FlashcardDiagram'
import { usePreferences } from '../preferences-context'

type Props = {
  deck: FlashcardDeck
  progress?: FlashcardDeckProgress
  onGrade: (cardId: string, grade: FlashcardGrade) => void
  onBack: () => void
}

const grades: { value: FlashcardGrade; key: string }[] = [{ value: 'again', key: '1' }, { value: 'hard', key: '2' }, { value: 'good', key: '3' }, { value: 'easy', key: '4' }]

export function FlashcardsView({ deck, progress, onGrade, onBack }: Props) {
  const [order, setOrder] = useState(() => deck.cards.map((card) => card.id))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const pointer = useRef<{ id: number; start: [number, number]; end: [number, number] } | undefined>(undefined)
  const { reducedMotion } = usePreferences()
  const cardById = useMemo(() => new Map(deck.cards.map((card) => [card.id, card])), [deck.cards])
  const card = cardById.get(order[index]) ?? deck.cards[0]
  const reviewed = deck.cards.filter((entry) => progress?.cards[entry.id]).length

  function navigate(next: number) {
    setIndex(Math.max(0, Math.min(order.length - 1, next)))
    setFlipped(false)
  }

  function grade(value: FlashcardGrade) {
    if (!flipped) return
    onGrade(card.id, value)
    if (index < order.length - 1) navigate(index + 1)
  }

  function shuffle() {
    const activeId = card.id
    const next = shuffledIds(order)
    setOrder(next)
    setIndex(Math.max(0, next.indexOf(activeId)))
    setFlipped(false)
  }

  function interactiveTarget(target: EventTarget) {
    return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea'))
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (interactiveTarget(event.target)) return
    pointer.current = { id: event.pointerId, start: [event.clientX, event.clientY], end: [event.clientX, event.clientY] }
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (pointer.current?.id === event.pointerId) pointer.current.end = [event.clientX, event.clientY]
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const gesture = pointer.current
    pointer.current = undefined
    if (!gesture || gesture.id !== event.pointerId || interactiveTarget(event.target)) return
    gesture.end = [event.clientX, event.clientY]
    if (isTapGesture(gesture.start, gesture.end)) setFlipped((value) => !value)
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (interactiveTarget(event.target) && event.target !== event.currentTarget) return
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setFlipped((value) => !value) }
    else if (event.key === 'ArrowLeft') navigate(index - 1)
    else if (event.key === 'ArrowRight') navigate(index + 1)
    else if (event.key.toLowerCase() === 's') shuffle()
    else if (event.key === 'Escape') {
      if (flipped) setFlipped(false)
      else onBack()
    } else {
      const selectedGrade = grades.find((entry) => entry.key === event.key)
      if (selectedGrade && flipped) grade(selectedGrade.value)
    }
  }

  return <section className="content-view flashcards-view anim">
    <button className="library-back" onClick={onBack}><ArrowLeft size={14} />Back to Library</button>
    <header className="flashcard-deck-head"><div><span className="eyebrow">{deck.source === 'ai' ? `AI-generated · ${deck.visibility}` : 'Default flashcards · free'}</span><h1>{deck.title}</h1><p>{deck.description}</p></div><aside><span>Reviewed</span><strong>{reviewed}<small>/ {deck.cards.length}</small></strong><i><b style={{ width: `${(reviewed / deck.cards.length) * 100}%` }} /></i></aside></header>
    <div className="flashcard-toolbar"><span>Card {index + 1} of {order.length}</span><div><button onClick={() => navigate(index - 1)} disabled={index === 0}><ArrowLeft size={14} />Previous</button><button onClick={shuffle}><Shuffle size={14} />Shuffle</button><button onClick={() => navigate(index + 1)} disabled={index === order.length - 1}>Next<ArrowRight size={14} /></button></div></div>
    <article className={`flashcard-stage ${flipped ? 'flipped' : ''} ${reducedMotion ? 'reduced-motion' : ''}`} tabIndex={0} role="button" aria-label={`${flipped ? 'Answer' : 'Question'} side. ${flipped ? 'Tap to return to the question.' : 'Tap to reveal the answer.'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointer.current = undefined }} onKeyDown={onKeyDown}>
      {!flipped ? <div className="flashcard-face flashcard-front"><div className="flashcard-copy"><span>{card.kind.replaceAll('-', ' ')}</span><h2>{card.front.heading}</h2><p>{card.front.body}</p></div>{card.front.diagram ? <FlashcardDiagram key={`${card.id}:${card.front.diagram.variantId}`} diagram={card.front.diagram} /> : <div className="flashcard-text-visual"><RotateCcw size={24} /><span>Recall before revealing</span></div>}<small>{card.front.diagram ? 'Tap or press Space to reveal · drag the model to rotate' : 'Tap or press Space to reveal'}</small></div> : <div className="flashcard-face flashcard-back"><div className="flashcard-answer-mark">Answer</div><h2>{card.back.heading}</h2><p>{card.back.body}</p><small>Tap or press Space to see the question</small></div>}
    </article>
    <div className="flashcard-grades" aria-label="Grade this card">{grades.map(({ value, key }) => <button key={value} disabled={!flipped} onClick={() => grade(value)}><span>{key}</span>{value}</button>)}</div>
    <p className="flashcard-help">Keyboard: Space flip · arrows navigate · S shuffle · 1–4 grade</p>
  </section>
}
