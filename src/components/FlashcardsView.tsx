import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { ArrowLeft, ArrowRight, ScanLine, Shuffle } from 'lucide-react'
import type { FlashcardDeck, FlashcardDeckProgress, FlashcardGrade } from '../types'
import { flashcardGradeTransition, isTapGesture, shuffledIds } from '../lib/flashcards'
import { usePreferences } from '../preferences-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { VoiceAction, VoiceActionResult } from '../lib/voiceActions'

export type FlashcardVoiceState = {
  deckId: string
  cardId: string
  index: number
  count: number
  side: 'question' | 'answer'
  graded: boolean
  question: { heading: string; body: string }
  answer?: { heading: string; body: string }
}

export type FlashcardsController = {
  executeVoiceAction: (action: Extract<VoiceAction, { type: `flashcard.${string}` }>) => VoiceActionResult
}

type Props = {
  deck: FlashcardDeck
  progress?: FlashcardDeckProgress
  onGrade: (cardId: string, grade: FlashcardGrade) => void
  onBack: () => void
  onVoiceState?: (state: FlashcardVoiceState) => void
}

export const FlashcardsView = forwardRef<FlashcardsController, Props>(function FlashcardsView({ deck, progress, onGrade, onBack, onVoiceState }, ref) {
  const [order, setOrder] = useState(() => deck.cards.map((card) => card.id))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(() => new URLSearchParams(window.location.search).get('side') === 'answer')
  const [graded, setGraded] = useState(false)
  const pointer = useRef<{ id: number; start: [number, number]; end: [number, number] } | undefined>(undefined)
  const { reducedMotion } = usePreferences()
  const cardById = useMemo(() => new Map(deck.cards.map((card) => [card.id, card])), [deck.cards])
  const card = cardById.get(order[index]) ?? deck.cards[0]
  const currentProgress = progress?.contentVersion === deck.contentVersion ? progress : undefined
  const reviewed = deck.cards.filter((entry) => currentProgress?.cards[entry.id]?.grade !== undefined && currentProgress.cards[entry.id].grade !== 'again').length
  const onVoiceStateRef = useRef(onVoiceState)

  useEffect(() => { onVoiceStateRef.current = onVoiceState }, [onVoiceState])
  useEffect(() => {
    onVoiceStateRef.current?.({
      deckId: deck.id,
      cardId: card.id,
      index,
      count: order.length,
      side: flipped ? 'answer' : 'question',
      graded,
      question: { heading: card.front.heading, body: card.front.body },
      answer: flipped ? { heading: card.back.heading, body: card.back.body } : undefined,
    })
  }, [card, deck.id, flipped, graded, index, order.length])

  function navigate(next: number) {
    setIndex(Math.max(0, Math.min(order.length - 1, next)))
    setFlipped(false)
    setGraded(false)
  }

  function flip() {
    setFlipped(!flipped)
  }

  function shuffle() {
    const activeId = card.id
    const next = shuffledIds(order)
    setOrder(next)
    setIndex(Math.max(0, next.indexOf(activeId)))
    setFlipped(false)
    setGraded(false)
  }

  function gradeCurrent(grade: FlashcardGrade) {
    if (graded) return false
    onGrade(card.id, grade)
    const transition = flashcardGradeTransition(grade, index, order.length)
    if (transition === 'repeat') {
      setFlipped(false)
      setGraded(false)
    } else if (transition === 'next') navigate(index + 1)
    else setGraded(true)
    return true
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

  useImperativeHandle(ref, () => ({
    executeVoiceAction(action) {
      if (action.type === 'flashcard.side') {
        setFlipped(action.side === 'answer')
        return { ok: true, message: `${action.side === 'answer' ? 'Answer' : 'Question'} shown.` }
      }
      if (action.type === 'flashcard.navigate') {
        const next = index + (action.direction === 'next' ? 1 : -1)
        if (next < 0 || next >= order.length) return { ok: false, error: `There is no ${action.direction} card.` }
        navigate(next)
        return { ok: true, message: `Moved to card ${next + 1}.` }
      }
      if (action.type === 'flashcard.shuffle') {
        shuffle()
        return { ok: true, message: 'Deck shuffled.' }
      }
      if (!flipped) return { ok: false, error: 'Reveal the answer before grading this card.' }
      return gradeCurrent(action.grade) ? { ok: true, message: `Card graded ${action.grade}.` } : { ok: false, error: 'This card has already been graded. Move to another card first.' }
    },
  }))

  return <section className="content-view flashcards-view learn-redesign anim" aria-labelledby="flashcard-deck-heading">
    <header className="flashcard-study-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />All flashcards</Button><div><span className="page-kicker">Flashcards</span><h1 id="flashcard-deck-heading">{deck.title}</h1><p>{reviewed} of {deck.cards.length} reviewed</p></div><aside><div><span>Reviewed</span><strong>{reviewed}/{deck.cards.length}</strong></div><Progress value={(reviewed / deck.cards.length) * 100} aria-label={`${reviewed} of ${deck.cards.length} cards reviewed`} /></aside></header>
    <div className="flashcard-toolbar"><Button variant="ghost" size="sm" onClick={() => navigate(index - 1)} disabled={index === 0} aria-label="Previous card"><ArrowLeft /></Button><div><Button variant="ghost" size="sm" onClick={shuffle}><Shuffle />Shuffle</Button><span>Card {index + 1} of {order.length}</span></div><Button variant="ghost" size="sm" onClick={() => navigate(index + 1)} disabled={index === order.length - 1} aria-label="Next card"><ArrowRight /></Button></div>
    <Progress className="flashcard-mobile-progress" value={(reviewed / deck.cards.length) * 100} aria-label={`${reviewed} of ${deck.cards.length} cards reviewed`} />
    <Card className={`flashcard-stage ${flipped ? 'flipped' : ''} ${reducedMotion ? 'reduced-motion' : ''}`} tabIndex={0} role="button" aria-label={`${flipped ? 'Answer' : 'Question'} side. ${flipped ? 'Tap to return to the question.' : 'Tap to reveal the answer.'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointer.current = undefined }} onKeyDown={onKeyDown}>
      <div className="flashcard-inner">
        <div className="flashcard-face flashcard-front text-only" aria-hidden={flipped} inert={flipped ? true : undefined}><div className="flashcard-copy"><span>Question</span><h2>{card.front.heading}</h2><p>{card.front.body}</p></div><small><ScanLine />Tap the card to flip and reveal the answer.</small></div>
        <div className="flashcard-face flashcard-back" aria-hidden={!flipped} inert={!flipped ? true : undefined}><div className="flashcard-answer-mark">Answer</div><h2>{card.back.heading}</h2><p>{card.back.body}</p><small>Review the explanation, then continue.</small></div>
      </div>
    </Card>
    <div className="flashcard-reveal">{flipped && <section className="study-grading" aria-labelledby="flashcard-grade-heading"><p id="flashcard-grade-heading">How well did you recall it?</p><div className="flashcard-grades">{(['again', 'hard', 'good', 'easy'] as const).map((grade) => <Button key={grade} variant="grade" disabled={graded} onClick={() => gradeCurrent(grade)}>{grade[0].toUpperCase() + grade.slice(1)}</Button>)}</div></section>}<Button variant="outline" className="mobile-flashcard-shuffle" onClick={shuffle}><Shuffle />Shuffle</Button></div>
  </section>
})
