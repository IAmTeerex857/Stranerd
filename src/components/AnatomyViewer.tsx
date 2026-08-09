import { Component, Suspense, useEffect, useMemo, useReducer, useRef, useState, type ErrorInfo, type ReactNode, type RefObject } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { Box, ChevronDown, ChevronUp, Eye, EyeOff, Focus, Layers3, LoaderCircle, RotateCcw, ScanLine, Scissors, Search, Star, Tags, Undo2, X } from 'lucide-react'
import type { Hotspot, ModelEntry, PersistedDissectionSession, Settings } from '../types'
import { anatomyLayers } from '../data/anatomyGraph'
import { ProgressiveBodyModel } from './ProgressiveBodyModel'
import { SegmentedSpecimenModel } from './SegmentedSpecimenModel'
import { createDissectionState, digestiveStructureGroup, dissectionReducer, type DissectionActionContext, type DissectionActionType, type DissectionSnapshot } from '../data/dissection'
import { useTheme } from '../theme-context'
import type { ResolvedTheme } from '../theme-utils'
import { usePreferences } from '../preferences-context'

type ViewerProps = {
  model: ModelEntry
  selectedIds: string[]
  selectedHotspot?: Hotspot
  settings: Settings
  selectedVariantId: string
  favorite: boolean
  onSelect: (hotspot: Hotspot, multi: boolean, explain?: boolean) => void
  onSettings: (settings: Settings) => void
  onVariant: (variantId: string) => void
  onFavorite: () => void
  onDissectionAction?: (context: DissectionActionContext) => void
  initialDissect?: boolean
  activityLayout?: boolean
  guidedStep?: number | null
  onGuidedStep?: (step: number) => void
  dissectionSession?: PersistedDissectionSession
  onDissectionState?: (session: PersistedDissectionSession) => void
}

class ModelBoundary extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn(`Unable to load ${this.props.name}`, error.message, info.componentStack) }
  render() {
    if (this.state.failed) return <Html center><div className="model-fallback"><Box size={24} /><strong>Model unavailable</strong><span>Add the optimized GLB to <code>public/models</code>.</span></div></Html>
    return this.props.children
  }
}

function LoadingModel() {
  const { progress } = useProgress()
  return <Html center><div className="model-loader"><LoaderCircle className="spin" size={20} /><span>Loading geometry</span><b>{Math.round(progress)}%</b></div></Html>
}

function ModelGeometry({ url, settings, hotspots, onSelect, interactive = true }: { url: string; settings: Settings; hotspots: Hotspot[]; onSelect: (hotspot: Hotspot, multi: boolean) => void; interactive?: boolean }) {
  const { scene } = useGLTF(url)
  const invalidate = useThree((state) => state.invalidate)
  const prepared = useMemo(() => {
    const copy = scene.clone(true)
    const box = new Box3().setFromObject(copy)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = 3.15 / Math.max(size.x, size.y, size.z, 0.001)
    copy.position.copy(center).multiplyScalar(-scale)
    copy.scale.setScalar(scale)
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const cloned = materials.map((material) => material.clone())
      object.material = Array.isArray(object.material) ? cloned : cloned[0]
    })
    return copy
  }, [scene])

  useEffect(() => {
    prepared.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!(material instanceof MeshStandardMaterial)) return
        material.wireframe = settings.wireframe
        material.transparent = false
        material.opacity = 1
        material.depthWrite = true
        material.needsUpdate = true
      })
    })
    invalidate()
  }, [invalidate, prepared, settings.wireframe])

  useEffect(() => () => {
    prepared.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    })
  }, [prepared, url])

  function selectSurface(event: ThreeEvent<MouseEvent>) {
    if (!interactive || hotspots.length === 0) return
    event.stopPropagation()
    const nearest = hotspots.reduce((best, hotspot) => {
      const distance = event.point.distanceToSquared(new Vector3(...hotspot.position))
      return distance < best.distance ? { hotspot, distance } : best
    }, { hotspot: hotspots[0], distance: Number.POSITIVE_INFINITY })
    onSelect(nearest.hotspot, event.nativeEvent.shiftKey)
  }

  return <primitive object={prepared} onClick={selectSurface} onPointerOver={interactive ? () => { document.body.style.cursor = 'pointer' } : undefined} onPointerOut={interactive ? () => { document.body.style.cursor = '' } : undefined} />
}

function Scene({ model, settings, selectedIds, selectedVariantId, onSelect, controlsRef, loadedLayers, visibleLayers, dissection, onStructures, onMoveStart, onMove, onMoveEnd, touchMoveEnabled, theme, reducedMotion }: ViewerProps & { controlsRef: RefObject<{ reset: () => void } | null>; loadedLayers: string[]; visibleLayers: string[]; dissection?: DissectionSnapshot; onStructures: (structures: Hotspot[]) => void; onMoveStart: () => void; onMove: (nodeId: string, offset: [number, number, number]) => void; onMoveEnd: (nodeId: string) => void; touchMoveEnabled: boolean; theme: ResolvedTheme; reducedMotion: boolean }) {
  const variant = model.variants.find((entry) => entry.id === selectedVariantId) ?? model.variants[0]
  const hotspots = variant.hotspots ?? model.hotspots
  const light = theme === 'light'
  return (
    <>
      <ambientLight intensity={light ? 1.2 : 1.6} />
      <hemisphereLight args={light ? ['#ffffff', '#9aadc0', 1.15] : ['#dff3ff', '#1a1020', 1.4]} />
      <directionalLight position={[3, 4, 5]} intensity={light ? 1.8 : 2.2} color={light ? '#ffffff' : '#dff3ff'} />
      <directionalLight position={[-4, -2, -3]} intensity={light ? 0.75 : 1.1} color={light ? '#b6a1d9' : '#e26bd6'} />
      <pointLight position={[0, -2, 3]} intensity={light ? 0.8 : 1.2} color={light ? '#6ca8c9' : '#4db6ff'} distance={8} />
      <group>
        <Suspense fallback={<LoadingModel />}>
          <ModelBoundary key={variant.file} name={`${model.name} · ${variant.label}`}>{model.viewer === 'segmented-body'
            ? <ProgressiveBodyModel layers={anatomyLayers.filter((layer) => loadedLayers.includes(layer.id))} visibleLayerIds={visibleLayers} selectedIds={selectedIds} settings={settings} onSelect={onSelect} dissection={dissection} onStructures={onStructures} onMoveStart={onMoveStart} onMove={onMove} onMoveEnd={onMoveEnd} touchMoveEnabled={touchMoveEnabled} />
            : variant.segmentedSystem
              ? <SegmentedSpecimenModel url={`/models/${variant.file}`} systemId={variant.segmentedSystem} selectedIds={selectedIds} settings={settings} onSelect={onSelect} dissection={dissection} onStructures={onStructures} onMoveStart={onMoveStart} onMove={onMove} onMoveEnd={onMoveEnd} touchMoveEnabled={touchMoveEnabled} />
              : <ModelGeometry url={`/models/${variant.file}`} settings={settings} hotspots={hotspots} onSelect={onSelect} />}</ModelBoundary>
        </Suspense>
        {model.viewer !== 'segmented-body' && !variant.segmentedSystem && settings.layers && !settings.isolate && <>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}><torusGeometry args={[1.3, 0.003, 6, 80]} /><meshBasicMaterial color="#4db6ff" transparent opacity={0.14} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.45, 0]}><torusGeometry args={[1.05, 0.003, 6, 80]} /><meshBasicMaterial color="#e26bd6" transparent opacity={0.12} /></mesh>
        </>}
        {model.viewer !== 'segmented-body' && !variant.segmentedSystem && hotspots.map((hotspot, index) => {
          const selected = selectedIds.includes(hotspot.id)
          const visible = settings.labels || selected
          if (settings.isolate && selectedIds.length > 0 && !selected) return null
          if (!visible) return null
          return (
            <group key={hotspot.id} position={hotspot.position}>
              <mesh onClick={(event) => { event.stopPropagation(); onSelect(hotspot, event.nativeEvent.shiftKey) }}>
                <sphereGeometry args={[selected ? 0.038 : 0.025, 12, 12]} />
                <meshBasicMaterial color={selected ? '#e26bd6' : '#4db6ff'} transparent opacity={selected ? 1 : 0.65} toneMapped={false} />
              </mesh>
              <Html distanceFactor={7} zIndexRange={[10, 0]}>
                <button className={`hotspot-label ${selected ? 'selected' : ''}`} onClick={(event) => onSelect(hotspot, event.shiftKey)} aria-label={`Select ${hotspot.label}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span><strong>{hotspot.label}</strong>
                </button>
              </Html>
            </group>
          )
        })}
      </group>
      <OrbitControls ref={controlsRef as never} makeDefault autoRotate={settings.autoRotate && !reducedMotion} autoRotateSpeed={0.8} enableDamping minDistance={2.2} maxDistance={8} />
    </>
  )
}

export function AnatomyViewer(props: ViewerProps) {
  const { resolvedTheme } = useTheme()
  const { reducedMotion } = usePreferences()
  const controlsRef = useRef<{ reset: () => void } | null>(null)
  const onDissectionStateRef = useRef(props.onDissectionState)
  const defaults = anatomyLayers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
  const restoredLayers = props.dissectionSession?.visibleLayerIds.length ? props.dissectionSession.visibleLayerIds : defaults
  const [visibleLayers, setVisibleLayers] = useState<string[]>(restoredLayers)
  const [loadedLayers, setLoadedLayers] = useState<string[]>([...new Set([...defaults, ...restoredLayers])])
  const [dissectMode, setDissectMode] = useState(Boolean(props.initialDissect || props.dissectionSession?.active))
  const [dissection, dispatchDissection] = useReducer(dissectionReducer, props.dissectionSession, (session) => createDissectionState(session ? {
    hiddenIds: session.hiddenIds,
    transparentIds: session.transparentIds,
    offsets: session.offsets,
    isolate: session.isolate,
  } : undefined))
  const [structures, setStructures] = useState<Hotspot[]>([])
  const [structureQuery, setStructureQuery] = useState('')
  const [dissectPanelOpen, setDissectPanelOpen] = useState(false)
  const [touchMoveEnabled, setTouchMoveEnabled] = useState(false)
  const toggle = (key: keyof Settings) => props.onSettings({ ...props.settings, [key]: !props.settings[key] })
  const variant = props.model.variants.find((entry) => entry.id === props.selectedVariantId) ?? props.model.variants[0]
  const canDissect = props.model.anatomy && (props.model.viewer === 'segmented-body' || props.model.variants.some((entry) => entry.segmentedSystem))
  const selectedStructureIds = props.selectedIds.filter((id) => structures.some((structure) => structure.id === id))
  const structureGroups = useMemo(() => {
    const query = structureQuery.trim().toLowerCase()
    const groups = new Map<string, Hotspot[]>()
    structures
      .filter((structure) => !query || structure.label.toLowerCase().includes(query))
      .sort((left, right) => left.label.localeCompare(right.label))
      .forEach((structure) => {
        const group = props.model.id === 'digestive-system' ? digestiveStructureGroup(structure.label) : props.model.name
        groups.set(group, [...(groups.get(group) ?? []), structure])
      })
    return [...groups]
  }, [props.model.id, props.model.name, structureQuery, structures])

  useEffect(() => {
    if (props.model.id === 'lungs') return
    const timeoutId = window.setTimeout(() => useGLTF.preload('/models/lungs-realistic.glb'), 1500)
    return () => window.clearTimeout(timeoutId)
  }, [props.model.id])

  useEffect(() => {
    onDissectionStateRef.current = props.onDissectionState
  }, [props.onDissectionState])

  useEffect(() => {
    onDissectionStateRef.current?.({
      active: dissectMode,
      hiddenIds: dissection.hiddenIds,
      transparentIds: dissection.transparentIds,
      offsets: dissection.offsets,
      isolate: dissection.isolate,
      selectedIds: props.selectedIds,
      visibleLayerIds: visibleLayers,
    })
  }, [dissectMode, dissection.hiddenIds, dissection.isolate, dissection.offsets, dissection.transparentIds, props.selectedIds, visibleLayers])

  function toggleLayer(layerId: string) {
    setLoadedLayers((current) => current.includes(layerId) ? current : [...current, layerId])
    setVisibleLayers((current) => current.includes(layerId) ? current.filter((id) => id !== layerId) : [...current, layerId])
  }

  function toggleDissectMode() {
    if (dissectMode) {
      setDissectMode(false)
      setDissectPanelOpen(false)
      setTouchMoveEnabled(false)
      dispatchDissection({ type: 'clear' })
      return
    }
    const segmented = props.model.variants.find((entry) => entry.segmentedSystem)
    if (segmented) props.onVariant(segmented.id)
    else if (props.model.viewer !== 'segmented-body') return
    dispatchDissection({ type: 'clear' })
    setDissectMode(true)
    setDissectPanelOpen(false)
    setTouchMoveEnabled(false)
  }

  function changeVariant(variantId: string) {
    const next = props.model.variants.find((entry) => entry.id === variantId)
    if (!next?.segmentedSystem) {
      setDissectMode(false)
      dispatchDissection({ type: 'clear' })
    }
    props.onVariant(variantId)
  }

  function recordAction(action: DissectionActionType, ids: string[]) {
    const labels = ids.map((id) => structures.find((structure) => structure.id === id)?.label).filter((label): label is string => Boolean(label))
    const hiddenIds = action === 'hide'
      ? [...new Set([...dissection.hiddenIds, ...ids])]
      : action === 'show' ? dissection.hiddenIds.filter((id) => !ids.includes(id)) : dissection.hiddenIds
    props.onDissectionAction?.({
      mode: 'dissection',
      action,
      system: props.model.name,
      structureIds: ids,
      structures: labels,
      hiddenStructures: hiddenIds.map((id) => structures.find((structure) => structure.id === id)?.label).filter((label): label is string => Boolean(label)),
      visibleNeighbors: structures.filter((structure) => !hiddenIds.includes(structure.id) && !ids.includes(structure.id)).slice(0, 4).map((structure) => structure.label),
      guidedStep: undefined,
    })
  }

  function selectStructure(hotspot: Hotspot, multi: boolean) {
    props.onSelect(hotspot, multi, !dissectMode)
  }

  function resetDissection() {
    dispatchDissection({ type: 'reset' })
    if (props.settings.isolate) props.onSettings({ ...props.settings, isolate: false })
    recordAction('reset', [])
    if (props.guidedStep !== null && props.guidedStep !== undefined) props.onGuidedStep?.(0)
  }

  function moveStructure(nodeId: string, offset: [number, number, number]) {
    dispatchDissection({ type: 'set-offset', id: nodeId, offset })
  }

  return (
    <section className={`viewer ${props.model.viewer === 'segmented-body' ? 'segmented' : 'standard'} ${props.activityLayout ? 'activity-layout' : ''} panel anim`} aria-label={`${props.model.name} 3D viewer`}>
      <div className="viewer-head">
        <div><span className="eyebrow">{dissectMode ? 'Virtual dissection' : props.model.viewer === 'segmented-body' ? 'Segmented atlas' : 'Live specimen'}</span><h1>{props.model.name}</h1><p>{props.model.scientificName}</p>{props.model.viewer !== 'segmented-body' && <div className="variant-control"><label htmlFor={`variant-${props.model.id}`}>Specimen</label><select id={`variant-${props.model.id}`} value={variant.id} onChange={(event) => changeVariant(event.target.value)}>{props.model.variants.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>{variant.note && <small>{variant.note}</small>}</div>}</div>
        <div className="viewer-tools" aria-label="Viewer controls">
          <button className={props.favorite ? 'active' : ''} onClick={props.onFavorite} title={props.favorite ? 'Remove favorite' : 'Add favorite'} aria-pressed={props.favorite}><Star size={17} fill={props.favorite ? 'currentColor' : 'none'} /><span>Favorite</span></button>
          <button className={props.settings.autoRotate ? 'active' : ''} onClick={() => toggle('autoRotate')} title="Toggle auto rotate"><ScanLine size={17} /><span>Rotate</span></button>
          <button onClick={() => controlsRef.current?.reset()} title="Reset camera"><RotateCcw size={17} /><span>Reset</span></button>
          {props.model.viewer !== 'segmented-body' && <button className={props.settings.labels ? 'active' : ''} onClick={() => toggle('labels')} title="Toggle labels"><Tags size={17} /><span>Labels</span></button>}
          <button className={props.settings.wireframe ? 'active' : ''} onClick={() => toggle('wireframe')} title="Toggle wireframe"><Focus size={17} /><span>Wire</span></button>
          <button className={props.settings.layers ? 'active' : ''} onClick={() => toggle('layers')} title="Toggle reference layers"><Layers3 size={17} /><span>Layers</span></button>
          <button className={props.settings.isolate ? 'active' : ''} onClick={() => toggle('isolate')} title="Reduce reference overlays"><Box size={17} /><span>Focus</span></button>
          {canDissect && <button className={dissectMode ? 'active' : ''} onClick={toggleDissectMode} title="Toggle Dissect Mode" aria-pressed={dissectMode}><Scissors size={17} /><span>Dissect</span></button>}
        </div>
      </div>
      <div className={`canvas-wrap ${dissectMode && props.activityLayout ? 'dissecting' : ''}`}>
        <Canvas frameloop={props.settings.autoRotate && !reducedMotion ? 'always' : 'demand'} dpr={[1, 1.7]} camera={{ position: [0, 0.2, props.activityLayout ? 6.3 : 4.7], fov: 42 }} gl={{ antialias: true, alpha: true }}>
          <Scene {...props} theme={resolvedTheme} reducedMotion={reducedMotion} onSelect={selectStructure} controlsRef={controlsRef} loadedLayers={loadedLayers} visibleLayers={visibleLayers} dissection={dissectMode ? dissection : undefined} onStructures={setStructures} onMoveStart={() => dispatchDissection({ type: 'begin-move' })} onMove={moveStructure} onMoveEnd={(nodeId) => recordAction('move', [nodeId])} touchMoveEnabled={touchMoveEnabled} />
        </Canvas>
        {props.model.viewer === 'segmented-body' && <div className="body-layer-dock"><header><span>Body systems</span><b>{visibleLayers.length} active</b></header>{anatomyLayers.map((layer) => <button key={layer.id} className={visibleLayers.includes(layer.id) ? 'active' : ''} onClick={() => toggleLayer(layer.id)}><i style={{ background: layer.color }} />{layer.label}{visibleLayers.includes(layer.id) ? <Eye size={13} /> : <EyeOff size={13} />}</button>)}</div>}
        <div className="axis"><span>Y</span><i /><b>X</b></div>
        <p className="viewer-help">{dissectMode ? 'Drag a structure to pull it out · drag empty space to orbit' : 'Click the model to inspect · shift-click to multi-select · drag to orbit'}</p>
      </div>
      {dissectMode && (variant.segmentedSystem || props.model.viewer === 'segmented-body') && <aside className={`dissect-dock ${dissectPanelOpen ? 'sheet-open' : 'sheet-collapsed'}`}>
          <header><button className="mobile-sheet-toggle" onClick={() => setDissectPanelOpen((value) => !value)} aria-expanded={dissectPanelOpen}>{dissectPanelOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button><div><span>Dissect Mode</span><b>{structures.length} structures · tap to {dissectPanelOpen ? 'collapse' : 'open'}</b></div><button onClick={toggleDissectMode} title="Exit Dissect Mode"><X size={14} /></button></header>
          <div className="dissect-sheet-content">
          <div className="dissect-search"><Search size={13} /><input value={structureQuery} onChange={(event) => setStructureQuery(event.target.value)} placeholder="Search structures" aria-label="Search digestive structures" /></div>
          <div className="dissect-actions">
            <button disabled={selectedStructureIds.length === 0} onClick={() => { dispatchDissection({ type: 'hide', ids: selectedStructureIds }); recordAction('hide', selectedStructureIds) }}><EyeOff size={13} />Hide</button>
            <button disabled={selectedStructureIds.length === 0} onClick={() => { dispatchDissection({ type: 'show', ids: selectedStructureIds }); recordAction('show', selectedStructureIds) }}><Eye size={13} />Show</button>
            <button className={selectedStructureIds.some((id) => dissection.transparentIds.includes(id)) ? 'active' : ''} disabled={selectedStructureIds.length === 0} onClick={() => { dispatchDissection({ type: 'toggle-transparent', ids: selectedStructureIds }); recordAction('transparent', selectedStructureIds) }}>Fade</button>
            <button className={dissection.isolate ? 'active' : ''} disabled={selectedStructureIds.length === 0} onClick={() => { dispatchDissection({ type: 'toggle-isolate' }); recordAction('isolate', selectedStructureIds) }}>Isolate</button>
            <button className={`touch-move-action ${touchMoveEnabled ? 'active' : ''}`} onClick={() => setTouchMoveEnabled((value) => !value)}>Move</button>
          </div>
          <div className="dissect-structures">{structureGroups.map(([group, entries]) => <section key={group}><h3>{group}<span>{entries.length}</span></h3>{entries.map((structure) => <button key={structure.id} className={`${props.selectedIds.includes(structure.id) ? 'selected' : ''} ${dissection.hiddenIds.includes(structure.id) ? 'hidden' : ''}`} onClick={(event) => selectStructure(structure, event.shiftKey)}><i />{structure.label}{dissection.hiddenIds.includes(structure.id) && <EyeOff size={11} />}</button>)}</section>)}</div>
          <footer><button disabled={dissection.history.length === 0} onClick={() => dispatchDissection({ type: 'undo' })}><Undo2 size={13} />Undo</button><button disabled={dissection.hiddenIds.length === 0} onClick={() => { const ids = dissection.hiddenIds; dispatchDissection({ type: 'show-all' }); recordAction('show', ids) }}>Show all</button><button onClick={resetDissection}>Reset</button></footer>
          </div>
        </aside>}
      <div className="specimen-bar">
        <span><b>{props.model.metadata.region}</b>Region</span><span><b>{props.model.viewer === 'segmented-body' ? 'Layered systems' : props.model.metadata.scale}</b>Reference</span><span><b>{dissectMode ? 'Dissect Mode' : props.model.viewer === 'segmented-body' ? 'Click to explore' : 'Surface selection'}</b>Study mode</span>
      </div>
    </section>
  )
}
