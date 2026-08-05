import { useState } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { AnatomyViewer } from './AnatomyViewer'
import { modelById } from '../data/models'
import type { Hotspot, ModelEntry, Settings } from '../types'

const currentHeart = modelById('heart')
const candidateModel: ModelEntry = {
  ...currentHeart,
  id: 'heart-source-evaluation',
  name: 'HuBMAP Heart Pilot',
  scientificName: 'Cor, female reference organ v1.3',
  variants: [
    {
      id: 'hubmap-desktop',
      label: 'HuBMAP desktop pilot',
      file: 'heart/heart-desktop.glb',
      note: 'Optimized 575 KB pilot with structure-aware PBR materials.',
      segmentedSystem: 'cardiovascular',
    },
    {
      id: 'hubmap-mobile',
      label: 'HuBMAP mobile pilot',
      file: 'heart/heart-mobile.glb',
      note: 'Simplified 402 KB pilot preserving all stable structure IDs.',
      segmentedSystem: 'cardiovascular',
    },
    ...currentHeart.variants.filter((variant) => variant.id === 'primary' || variant.id === 'interactive'),
  ],
  metadata: { region: 'Thorax / mediastinum', scale: '575 KB desktop', focus: 'Pipeline evaluation' },
}

const initialSettings: Settings = { autoRotate: false, wireframe: false, layers: false, isolate: false, labels: false }

export function HeartCandidateTestView() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot>()
  const [settings, setSettings] = useState(initialSettings)
  const [variantId, setVariantId] = useState(candidateModel.variants[0].id)

  function select(hotspot: Hotspot, multi: boolean) {
    setSelectedHotspot(hotspot)
    setSelectedIds((current) => multi
      ? current.includes(hotspot.id) ? current.filter((id) => id !== hotspot.id) : [...current, hotspot.id]
      : [hotspot.id])
  }

  function changeVariant(id: string) {
    setVariantId(id)
    setSelectedIds([])
    setSelectedHotspot(undefined)
  }

  return <main className="candidate-test">
    <header className="candidate-test-head">
      <div><span className="eyebrow">Phase 1 / source evaluation</span><h1>Heart candidate laboratory</h1></div>
      <a href="/"><ArrowLeft size={15} />Return to Stranerd</a>
    </header>
    <div className="candidate-test-grid">
      <AnatomyViewer
        model={candidateModel}
        selectedIds={selectedIds}
        selectedHotspot={selectedHotspot}
        settings={settings}
        selectedVariantId={variantId}
        favorite={false}
        onSelect={select}
        onSettings={setSettings}
        onVariant={changeVariant}
        onFavorite={() => {}}
      />
      <aside className="candidate-audit panel">
        <span className="eyebrow">Inspection record</span>
        <h2>{selectedHotspot?.label ?? 'Select a structure'}</h2>
        <p>{selectedHotspot?.detail ?? 'Click a chamber, valve, septum, or papillary muscle to verify exact mesh picking and stable ontology identity.'}</p>
        <dl>
          <div><dt>Stable ID</dt><dd>{selectedHotspot?.id ?? 'None selected'}</dd></div>
          <div><dt>Renderable meshes</dt><dd>14</dd></div>
          <div><dt>Desktop geometry</dt><dd>43,560 vertices / 85,914 triangles</dd></div>
          <div><dt>Mobile geometry</dt><dd>28,707 vertices / 56,293 triangles</dd></div>
          <div><dt>Materials</dt><dd>4 structure-aware PBR materials</dd></div>
          <div><dt>License</dt><dd>CC BY 4.0</dd></div>
        </dl>
        <a href="https://humanatlas.io/3d-reference-library" target="_blank" rel="noreferrer">Open official HRA library <ExternalLink size={14} /></a>
        <small>Use the specimen menu to compare the HuBMAP candidate with Stranerd's current realistic and interactive hearts.</small>
      </aside>
    </div>
  </main>
}
