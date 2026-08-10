import { useState } from 'react'
import { GalleryVerticalEnd } from 'lucide-react'
import type { ModelEntry } from '../types'
import type { GenerateDeckInput } from '../lib/generatedFlashcards'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = { model: ModelEntry; balance: number; generating: boolean; error?: string; onClose: () => void; onGenerate: (input: GenerateDeckInput) => void }

export function GenerateDeckModal({ model, balance, generating, error, onClose, onGenerate }: Props) {
  const [difficulty, setDifficulty] = useState<GenerateDeckInput['difficulty']>('intermediate')
  const [focus, setFocus] = useState<GenerateDeckInput['focus']>('mixed')
  const [visibility, setVisibility] = useState<GenerateDeckInput['visibility']>('private')
  const [includeDiagrams, setIncludeDiagrams] = useState(true)
  const [topic, setTopic] = useState('')

  return <Dialog open onOpenChange={(open) => { if (!open && !generating) onClose() }}>
    <DialogContent className="generated-deck-modal sm:max-w-xl">
      <DialogHeader><span className="dialog-icon"><GalleryVerticalEnd size={18} /></span><Badge variant="secondary">15 cards | 5 credits</Badge><DialogTitle>Create a {model.name} deck</DialogTitle><DialogDescription>Generate focused anatomy exam questions grounded in Stranerd's verified model context.</DialogDescription></DialogHeader>
      <div className="generated-deck-fields">
        <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as GenerateDeckInput['difficulty'])}><option value="introductory">Introductory</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <label>Focus<select value={focus} onChange={(event) => setFocus(event.target.value as GenerateDeckInput['focus'])}><option value="mixed">Mixed</option><option value="structures">Structures</option><option value="functions">Functions</option><option value="relationships">Relationships</option></select></label>
        <label>Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as GenerateDeckInput['visibility'])}><option value="private">Private</option><option value="public">Public | 5-credit unlock</option></select></label>
        <label>Optional topic<Input value={topic} maxLength={120} onChange={(event) => setTopic(event.target.value)} placeholder={model.metadata.focus} /></label>
        <label className="generated-deck-check"><Switch checked={includeDiagrams} onCheckedChange={setIncludeDiagrams} />Include validated 3D context where supported</label>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <footer><span>{balance} credits available</span><div><Button variant="ghost" onClick={onClose} disabled={generating}>Cancel</Button><Button disabled={generating || balance < 5} onClick={() => onGenerate({ modelId: model.id, difficulty, focus, visibility, includeDiagrams, topic: topic.trim() || undefined })}>{generating ? 'Generating...' : 'Generate deck'}</Button></div></footer>
    </DialogContent>
  </Dialog>
}
