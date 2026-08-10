import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, RotateCcw, Shuffle } from 'lucide-react'
import type { FlashcardDeck, FlashcardDeckProgress, FlashcardGrade } from '../types'
import { isTapGesture, shuffledIds } from '../lib/flashcards'
import { FlashcardDiagram } from './FlashcardDiagram'
import { usePreferences } from '../preferences-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

type Props = {
  deck: FlashcardDeck
  progress?: FlashcardDeckProgress
  onGrade: (cardId: string, grade: FlashcardGrade) => void
  onBack: () => void
}

export function FlashcardsView({ deck, progress, onGrade, onBack }: Props) {
  const [order, setOrder] = useState(() => deck.cards.map((card) => card.id))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(() => new URLSearchParams(window.location.search).get('side') === 'answer')
  const pointer = useRef<{ id: number; start: [number, number]; end: [number, number] } | undefined>(undefined)
  const { reducedMotion } = usePreferences()
  const cardById = useMemo(() => new Map(deck.cards.map((card) => [card.id, card])), [deck.cards])
  const card = cardById.get(order[index]) ?? deck.cards[0]
  const reviewed = deck.cards.filter((entry) => progress?.cards[entry.id]).length

  function navigate(next: number) {
    setIndex(Math.max(0, Math.min(order.length - 1, next)))
    setFlipped(false)
  }

  function flip() {
    if (!flipped && !progress?.cards[card.id]) onGrade(card.id, 'good')
    setFlipped(!flipped)
  }

  function shuffle() {
    const activeId = card.id
    const next = shuffledIds(order)
    setOrder(next)
    setIndex(Math.max(0, next.indexOf(activeId)))
    setFlipped(false)
  }

  function interactiveTarget(target: EventTarget) {
    return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, canvas, .flashcard-diagram'))
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
    if (isTapGesture(gesture.start, gesture.end)) flip()
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (interactiveTarget(event.target) && event.target !== event.currentTarget) return
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); flip() }
    else if (event.key === 'ArrowLeft') navigate(index - 1)
    else if (event.key === 'ArrowRight') navigate(index + 1)
    else if (event.key.toLowerCase() === 's') shuffle()
    else if (event.key === 'Escape') {
      if (flipped) setFlipped(false)
      else onBack()
    }
  }

  return <section className="content-view flashcards-view anim">
    <header className="flashcard-study-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />Library</Button><div><Badge variant="secondary">{deck.source === 'ai' ? 'AI deck' : 'Verified deck'}</Badge><h1>{deck.title}</h1><p>{deck.description}</p></div><aside><div><span>Reviewed</span><strong>{reviewed}/{deck.cards.length}</strong></div><Progress value={(reviewed / deck.cards.length) * 100} /></aside></header>
    <div className="flashcard-toolbar"><span>Card {index + 1} of {order.length}</span><div><Button variant="ghost" size="sm" onClick={shuffle}><Shuffle />Shuffle</Button><Button variant="outline" size="sm" onClick={() => navigate(index - 1)} disabled={index === 0}><ArrowLeft />Previous</Button><Button variant="outline" size="sm" onClick={() => navigate(index + 1)} disabled={index === order.length - 1}>Next<ArrowRight /></Button></div></div>
    <Card className={`flashcard-stage ${flipped ? 'flipped' : ''} ${reducedMotion ? 'reduced-motion' : ''}`} tabIndex={0} role="button" aria-label={`${flipped ? 'Answer' : 'Question'} side. ${flipped ? 'Tap to return to the question.' : 'Tap to reveal the answer.'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointer.current = undefined }} onKeyDown={onKeyDown}>
      <div className="flashcard-inner">
        <div className={`flashcard-face flashcard-front ${card.front.diagram ? '' : 'text-only'}`} aria-hidden={flipped}><div className="flashcard-copy"><span>Question</span><h2>{card.front.heading}</h2><p>{card.front.body}</p></div>{card.front.diagram ? <FlashcardDiagram key={`${card.id}:${card.front.diagram.variantId}`} diagram={card.front.diagram} /> : <div className="flashcard-text-visual"><RotateCcw size={24} /><span>Think before revealing</span></div>}<small>{card.front.diagram ? 'Drag the model to inspect it.' : 'Answer from memory before revealing.'}</small></div>
        <div className="flashcard-face flashcard-back" aria-hidden={!flipped}><div className="flashcard-answer-mark">Answer</div><h2>{card.back.heading}</h2><p>{card.back.body}</p><small>Review the explanation, then continue.</small></div>
      </div>
    </Card>
    <div className="flashcard-reveal"><Button size="lg" onClick={flip}>{flipped ? <><RotateCcw />Show question</> : <><Eye />Reveal answer</>}</Button></div>
  </section>
}
