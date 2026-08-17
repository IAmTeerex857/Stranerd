import { supabase } from './supabase'
import { aiRequest, type CreditBalance } from './ai'
import type { Flashcard, FlashcardDeck, GeneratedDeckSummary } from '../types'
import { GENERATED_DECK_SIZE } from '../../shared/flashcards'

export type GenerateDeckInput = {
  modelId: string
  difficulty: 'introductory' | 'intermediate' | 'advanced'
  focus: 'structures' | 'functions' | 'relationships' | 'mixed'
  includeDiagrams: boolean
  visibility: 'private' | 'public'
  topic?: string
}

export async function generateDeck(input: GenerateDeckInput): Promise<{ deck: FlashcardDeck; balance: CreditBalance }> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 50_000)
  try {
    const data = await aiRequest('/api/flashcards?action=generate', input, controller.signal) as { deck?: FlashcardDeck; balance?: CreditBalance }
    if (!data.deck || data.deck.cards.length !== GENERATED_DECK_SIZE || !data.balance) throw new Error('Generated deck response was incomplete.')
    return { deck: data.deck, balance: data.balance }
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function unlockDeck(deckId: string): Promise<{ balance: CreditBalance }> {
  const data = await aiRequest('/api/flashcards?action=unlock', { deckId }) as { unlocked?: boolean; balance?: CreditBalance }
  if (!data.unlocked || !data.balance) throw new Error('Deck unlock response was incomplete.')
  return { balance: data.balance }
}

export async function listGeneratedDecks(): Promise<GeneratedDeckSummary[]> {
  if (!supabase) return []
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) return []
  const userId = auth.session.user.id
  const [metadata, unlocks, content] = await Promise.all([
    supabase.from('flashcard_decks').select('id,owner_user_id,model_id,title,description,visibility,status,card_count,unlock_cost,created_at').eq('status', 'ready').order('created_at', { ascending: false }).limit(100),
    supabase.from('flashcard_deck_unlocks').select('deck_id').eq('user_id', userId),
    supabase.from('flashcard_deck_content').select('deck_id,content_version,cards'),
  ])
  if (metadata.error) throw metadata.error
  const unlocked = new Set((unlocks.data ?? []).map((entry) => entry.deck_id))
  const contents = new Map((content.data ?? []).map((entry) => [entry.deck_id, entry]))
  return (metadata.data ?? []).map((entry) => {
    const owner = entry.owner_user_id === userId
    const deckContent = contents.get(entry.id)
    return {
      id: entry.id,
      modelId: entry.model_id,
      contentVersion: deckContent?.content_version ?? '1',
      title: entry.title,
      description: entry.description,
      source: 'ai' as const,
      visibility: entry.visibility as 'private' | 'public',
      owner,
      unlocked: owner || unlocked.has(entry.id),
      unlockCost: entry.unlock_cost,
      createdAt: entry.created_at,
      cards: Array.isArray(deckContent?.cards) ? deckContent.cards as Flashcard[] : undefined,
    }
  })
}

export async function reportGeneratedDeck(deckId: string, reason: 'inaccurate' | 'unsafe' | 'spam' | 'other') {
  if (!supabase) throw new Error('Sign in to report a deck.')
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Sign in to report a deck.')
  const { error } = await supabase.from('flashcard_deck_reports').upsert({ deck_id: deckId, reporter_user_id: data.session.user.id, reason }, { onConflict: 'deck_id,reporter_user_id' })
  if (error) throw error
}
