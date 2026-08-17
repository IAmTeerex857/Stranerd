import { models } from '../data/models'
import type { FlashcardDiagram } from '../types'

export function resolveFlashcardDiagram(diagram: FlashcardDiagram) {
  const model = models.find((entry) => entry.id === diagram.modelId)
  const variant = model?.variants.find((entry) => entry.id === diagram.variantId)
  if (!model || !variant || diagram.selectedStructureIds.length === 0) return undefined
  const hotspots = variant.hotspots ?? model.hotspots
  const selected = diagram.selectedStructureIds.map((id) => hotspots.find((hotspot) => hotspot.id === id))
  if (selected.some((hotspot) => !hotspot)) return undefined
  return { model, variant, hotspots, selected: selected.filter((hotspot) => hotspot !== undefined) }
}
