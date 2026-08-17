import { Component, forwardRef, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState, type ErrorInfo, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Spherical, Vector3 } from 'three'
import { Box, ChevronDown, ChevronUp, Eye, EyeOff, Grid3X3, Layers3, LoaderCircle, Move3D, RotateCcw, RotateCw, Scissors, Search, SlidersHorizontal, Tags, Undo2, X } from 'lucide-react'
import type { CanonicalCamera, Hotspot, ModelEntry, PersistedDissectionSession, Settings } from '../types'
import { anatomyLayers } from '../data/anatomyGraph'
import { ProgressiveBodyModel } from './ProgressiveBodyModel'
import { SegmentedSpecimenModel } from './SegmentedSpecimenModel'
import { createDissectionState, digestiveStructureGroup, dissectionReducer, resolveDissectionStructures, separateStructureOffsets, type DissectionActionContext, type DissectionActionType, type DissectionSnapshot, type DissectionState } from '../data/dissection'
import { useTheme } from '../theme-context'
import type { ResolvedTheme } from '../theme-utils'
import { usePreferences } from '../preferences-context'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { VoiceAction, VoiceActionResult } from '../lib/voiceActions'
import { measuredInsets, offsetForInsets } from '../lib/cameraViewOffset'
import { canonicalCameraPosition, fitDistance, framedDistance } from '../lib/canonicalCamera'
import { reservedInsets, safePadding, unionInsets } from '../lib/canvasInsets'
import { useBodyScrollLock } from '../lib/bodyScrollLock'

const EMPTY_STRUCTURES: Hotspot[] = []

function ControlsReady({ controlsRef, onReady }: { controlsRef: RefObject<ViewerControls | null>; onReady: () => void }) {
  const reported = useRef(false)
  useFrame(() => {
    if (!reported.current && controlsRef.current) {
      reported.current = true
      onReady()
    }
  })
  return null
}

type ViewerControls = {
  reset: () => void
  update: () => void
  saveState?: () => void
  object: { position: Vector3 }
  target: Vector3
  minDistance?: number
  maxDistance?: number
}

export type ViewerVoiceState = {
  dissectMode: boolean
  variantId: string
  structures: { id: string; label: string }[]
  visibleLayerIds: string[]
  hiddenStructureIds: string[]
  fadedStructureIds: string[]
  isolated: boolean
  isolationSource: 'none' | 'settings' | 'dissection' | 'both'
  movedStructureIds: string[]
  camera: { position: number[]; target: number[]; zoom: number }
  loading: boolean
  selectedStructureIds: string[]
}

export type AnatomyViewerController = {
  executeVoiceAction: (action: Extract<VoiceAction, { type: `viewer.${string}` }>) => Promise<VoiceActionResult>
}

type ViewerProps = {
  model: ModelEntry
  selectedIds: string[]
  selectedHotspot?: Hotspot
  settings: Settings
  selectedVariantId: string
  favorite: boolean
  onSelect: (hotspot: Hotspot, multi: boolean, explain?: boolean) => void
  onClearSelection: () => void
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
  onVoiceState?: (state: ViewerVoiceState) => void
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

function Scene({ model, settings, selectedIds, selectedVariantId, onSelect, controlsRef, loadedLayers, visibleLayers, dissection, onStructures, onMoveStart, onMove, onMoveEnd, onCameraChange, touchMoveEnabled, theme, reducedMotion }: ViewerProps & { controlsRef: RefObject<ViewerControls | null>; loadedLayers: string[]; visibleLayers: string[]; dissection?: DissectionSnapshot; onStructures: (structures: Hotspot[]) => void; onMoveStart: () => void; onMove: (nodeId: string, offset: [number, number, number]) => void; onMoveEnd: (nodeId: string) => void; onCameraChange: () => void; touchMoveEnabled: boolean; theme: ResolvedTheme; reducedMotion: boolean }) {
  const variant = model.variants.find((entry) => entry.id === selectedVariantId) ?? model.variants[0]
  const hotspots = variant.hotspots ?? model.hotspots
  const light = theme === 'light'
  const size = useThree((state) => state.size)
  // A portrait canvas needs the camera further back than the subject's authored ceiling, so the
  // zoom clamp has to grow with it or the specimen is pulled back in and crops at the sides.
  const maxDistance = Math.max(model.camera.maxDistance, fitDistance(size.width / size.height, 42, 0.14))
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
      <OrbitControls ref={controlsRef as never} makeDefault autoRotate={settings.autoRotate && !reducedMotion} autoRotateSpeed={0.8} enableDamping minDistance={model.camera.minDistance} maxDistance={maxDistance} onEnd={onCameraChange} />
      <ControlsReady controlsRef={controlsRef} onReady={onCameraChange} />
    </>
  )
}

function OpticalCameraCenter({ canvasWrapRef, dissectDockRef, panelState, subjectCamera, controlsRef }: { canvasWrapRef: RefObject<HTMLDivElement | null>; dissectDockRef: RefObject<HTMLElement | null>; panelState: string; subjectCamera: CanonicalCamera; controlsRef: RefObject<ViewerControls | null> }) {
  const { camera, gl, invalidate } = useThree()
  const framingKey = useRef('')

  useEffect(() => { framingKey.current = '' }, [subjectCamera])

  useEffect(() => {
    if (!('setViewOffset' in camera) || !('clearViewOffset' in camera)) return
    let frame = 0
    const measure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const canvas = gl.domElement.getBoundingClientRect()
        const panels = [dissectDockRef.current, document.querySelector<HTMLElement>('.lab-guided-workspace > .activity-pane'), document.getElementById('stranerd-mentor')]
          .filter((element): element is HTMLElement => Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden'))
          .map((element) => element.getBoundingClientRect())
        const captionsVisible = Boolean(document.querySelector('[data-voice-captions]:not([hidden])'))
        const reserved = reservedInsets(window.innerWidth, captionsVisible)
        const insets = unionInsets(measuredInsets(canvas, panels), reserved)
        const offset = offsetForInsets(canvas, insets)

        // Reframe when the usable canvas changes. Preserve the learner's orbit direction after
        // the initial canonical view, but keep the current reset state aligned with the layout.
        const controls = controlsRef.current
        const nextFramingKey = `${Math.round(canvas.width - insets.left - insets.right)}:${Math.round(canvas.height - insets.top - insets.bottom)}`
        if (controls && framingKey.current !== nextFramingKey && canvas.width > 1 && canvas.height > 1) {
          const usableWidth = Math.max(1, canvas.width - insets.left - insets.right)
          const usableHeight = Math.max(1, canvas.height - insets.top - insets.bottom)
          const distance = framedDistance(subjectCamera, usableWidth / usableHeight, safePadding(window.innerWidth))
          const currentOffset = camera.position.clone().sub(controls.target)
          const [x, y, z] = canonicalCameraPosition({ ...subjectCamera, distance })
          if (framingKey.current && currentOffset.lengthSq() > 0) camera.position.copy(controls.target).add(currentOffset.setLength(distance))
          else camera.position.set(x, y, z)
          controls.target.set(0, 0, 0)
          controls.update()
          controls.saveState?.()
          framingKey.current = nextFramingKey
        }

        if (offset.x === 0 && offset.y === 0) camera.clearViewOffset()
        else camera.setViewOffset(Math.max(1, Math.round(canvas.width)), Math.max(1, Math.round(canvas.height)), offset.x, offset.y, Math.max(1, Math.round(canvas.width)), Math.max(1, Math.round(canvas.height)))
        camera.updateProjectionMatrix()
        invalidate()
      })
    }
    const elements = [canvasWrapRef.current, dissectDockRef.current, document.getElementById('stranerd-mentor')].filter((element): element is HTMLElement => Boolean(element))
    const resizeObserver = new ResizeObserver(measure)
    elements.forEach((element) => resizeObserver.observe(element))
    const mutationObserver = new MutationObserver(measure)
    elements.forEach((element) => mutationObserver.observe(element, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] }))
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    measure()
    const transitionTimer = window.setInterval(measure, 32)
    const stopTimer = window.setTimeout(() => window.clearInterval(transitionTimer), 320)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearInterval(transitionTimer)
      window.clearTimeout(stopTimer)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
      camera.clearViewOffset()
      camera.updateProjectionMatrix()
    }
  }, [camera, canvasWrapRef, controlsRef, dissectDockRef, gl.domElement, invalidate, panelState, subjectCamera])
  return null
}

export const AnatomyViewer = forwardRef<AnatomyViewerController, ViewerProps>(function AnatomyViewer(props, ref) {
  const { resolvedTheme } = useTheme()
  const { reducedMotion } = usePreferences()
  const controlsRef = useRef<ViewerControls | null>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const dissectDockRef = useRef<HTMLElement>(null)
  const onDissectionStateRef = useRef(props.onDissectionState)
  const onVoiceStateRef = useRef(props.onVoiceState)
  const committedVoiceStateRef = useRef<{ voice: ViewerVoiceState; dissection: DissectionState; settingsIsolate: boolean; loadedStructures: Hotspot[] } | undefined>(undefined)
  const committedStateListeners = useRef(new Set<() => void>())
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
  const [structureCatalog, setStructureCatalog] = useState<{ variantId: string; entries: Hotspot[] }>({ variantId: props.selectedVariantId, entries: [] })
  const structures = structureCatalog.variantId === props.selectedVariantId ? structureCatalog.entries : EMPTY_STRUCTURES
  const [structureQuery, setStructureQuery] = useState('')
  const [dissectPanelOpen, setDissectPanelOpen] = useState(false)
  const [touchMoveEnabled, setTouchMoveEnabled] = useState(false)
  const [activityToolsOpen, setActivityToolsOpen] = useState(false)
  const [cameraResetToken, setCameraResetToken] = useState(0)
  const [cameraRevision, setCameraRevision] = useState(0)
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
  const receiveStructures = useCallback((entries: Hotspot[]) => setStructureCatalog({ variantId: props.selectedVariantId, entries }), [props.selectedVariantId])

  useEffect(() => {
    if (props.model.id === 'lungs') return
    const timeoutId = window.setTimeout(() => useGLTF.preload('/models/lungs-realistic.glb'), 1500)
    return () => window.clearTimeout(timeoutId)
  }, [props.model.id])

  useEffect(() => {
    onDissectionStateRef.current = props.onDissectionState
  }, [props.onDissectionState])

  useEffect(() => {
    onVoiceStateRef.current = props.onVoiceState
  }, [props.onVoiceState])

  useEffect(() => {
    if (cameraResetToken > 0) controlsRef.current?.reset()
  }, [cameraResetToken])

  useBodyScrollLock(dissectPanelOpen && window.innerWidth < 1200)

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

  useEffect(() => {
    const fallbackStructures = variant.hotspots ?? props.model.hotspots
    const availableStructures = structures.length > 0 ? structures : fallbackStructures
    const movedStructureIds = [...new Set(Object.keys(dissection.offsets).map((id) => id.split('::')[0]))].slice(0, 50)
    const isolationSource = props.settings.isolate ? dissection.isolate ? 'both' : 'settings' : dissection.isolate ? 'dissection' : 'none'
    const voice: ViewerVoiceState = {
      dissectMode,
      variantId: variant.id,
      structures: availableStructures.map(({ id, label }) => ({ id, label })),
      visibleLayerIds: visibleLayers,
      hiddenStructureIds: dissection.hiddenIds,
      fadedStructureIds: dissection.transparentIds,
      isolated: props.settings.isolate || dissection.isolate,
      isolationSource,
      movedStructureIds,
      camera: { position: controlsRef.current?.object.position.toArray() ?? [], target: controlsRef.current?.target.toArray() ?? [], zoom: controlsRef.current ? controlsRef.current.object.position.distanceTo(controlsRef.current.target) : 0 },
      loading: !controlsRef.current,
      selectedStructureIds: props.selectedIds.slice(0, 20),
    }
    committedVoiceStateRef.current = { voice, dissection, settingsIsolate: props.settings.isolate, loadedStructures: structures }
    committedStateListeners.current.forEach((listener) => listener())
    onVoiceStateRef.current?.(voice)
  }, [cameraRevision, dissectMode, dissection, props.model.hotspots, props.selectedIds, props.settings.isolate, structures, variant, visibleLayers])

  function waitForCommittedState(predicate: (state: NonNullable<typeof committedVoiceStateRef.current>) => boolean, timeoutMs = 2_500) {
    const current = committedVoiceStateRef.current
    if (current && predicate(current)) return Promise.resolve(current)
    return new Promise<NonNullable<typeof committedVoiceStateRef.current>>((resolve, reject) => {
      const listener = () => {
        const next = committedVoiceStateRef.current
        if (!next || !predicate(next)) return
        window.clearTimeout(timeout)
        committedStateListeners.current.delete(listener)
        resolve(next)
      }
      const timeout = window.setTimeout(() => {
        committedStateListeners.current.delete(listener)
        reject(new Error('The anatomy viewer did not reach the requested state.'))
      }, timeoutMs)
      committedStateListeners.current.add(listener)
    })
  }

  function toggleLayer(layerId: string) {
    setLoadedLayers((current) => current.includes(layerId) ? current : [...current, layerId])
    setVisibleLayers((current) => current.includes(layerId) ? current.filter((id) => id !== layerId) : [...current, layerId])
  }

  function toggleDissectMode() {
    if (dissectMode) {
      if (props.activityLayout || window.matchMedia('(max-width: 1199px)').matches) {
        setDissectPanelOpen((open) => !open)
        return
      }
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
    setDissectPanelOpen(true)
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

  function resolveStructures(requestedIds: string[]): { structures: Hotspot[] } | { error: string } {
    return resolveDissectionStructures(requestedIds, [structures, variant.hotspots ?? [], props.model.hotspots, ...props.model.variants.map((entry) => entry.hotspots ?? [])])
  }

  function controlCamera(operation: Extract<VoiceAction, { type: 'viewer.camera' }>['operation']): VoiceActionResult {
    const controls = controlsRef.current
    if (!controls) return { ok: false, error: 'The canvas camera is still loading.' }
    if (operation === 'reset') controls.reset()
    else if (operation === 'zoom_in' || operation === 'zoom_out') {
      const offset = controls.object.position.clone().sub(controls.target)
       const minDistance = controls.minDistance ?? props.model.camera.minDistance
       const maxDistance = controls.maxDistance ?? props.model.camera.maxDistance
       const distance = Math.max(minDistance, Math.min(maxDistance, offset.length() * (operation === 'zoom_in' ? 0.78 : 1.28)))
      controls.object.position.copy(controls.target).add(offset.setLength(distance))
      controls.update()
    } else {
      const offset = controls.object.position.clone().sub(controls.target)
      const spherical = new Spherical().setFromVector3(offset)
      if (operation === 'rotate_left' || operation === 'rotate_right') spherical.theta += operation === 'rotate_left' ? Math.PI / 8 : -Math.PI / 8
      else spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi + (operation === 'rotate_up' ? -Math.PI / 10 : Math.PI / 10)))
      controls.object.position.copy(controls.target).add(offset.setFromSpherical(spherical))
      controls.update()
    }
    return { ok: true, message: `Camera ${operation.replace('_', ' ')} completed.` }
  }

  useImperativeHandle(ref, () => ({
    async executeVoiceAction(action) {
      if (action.type === 'viewer.camera') return controlCamera(action.operation)
      if (action.type === 'viewer.settings') {
        props.onSettings({ ...props.settings, ...action.settings })
        return { ok: true, message: 'Viewer settings updated.' }
      }
      if (action.type === 'viewer.variant') {
        if (!props.model.variants.some((entry) => entry.id === action.variantId)) return { ok: false, error: `Unknown specimen variant: ${action.variantId}` }
        changeVariant(action.variantId)
        return { ok: true, message: 'Specimen variant changed.' }
      }
      if (action.type === 'viewer.layer') {
        if (props.model.viewer !== 'segmented-body') return { ok: false, error: 'System layers are only available in the segmented whole-body atlas.' }
        if (!anatomyLayers.some((entry) => entry.id === action.layerId)) return { ok: false, error: `Unknown anatomy layer: ${action.layerId}` }
        const isVisible = visibleLayers.includes(action.layerId)
        if (isVisible !== action.visible) toggleLayer(action.layerId)
        return { ok: true, message: `${action.layerId} layer ${action.visible ? 'shown' : 'hidden'}.` }
      }
      if (action.type === 'viewer.selection') {
        const resolved = resolveStructures(action.structureIds)
        if ('error' in resolved) return { ok: false, error: resolved.error }
        const ids = resolved.structures.map((entry) => entry.id)
        if (ids.length === 0) props.onClearSelection()
        else resolved.structures.forEach((entry, index) => selectStructure(entry, index > 0))
        return { ok: true, message: ids.length === 0 ? 'Selection cleared.' : `${ids.length} structure${ids.length === 1 ? '' : 's'} selected.` }
      }
      if (!canDissect) return { ok: false, error: 'This model has no dissectable segmented representation.' }
      if (action.operation === 'reset' && !window.confirm('Reset the current dissection?')) return { ok: false, error: 'The learner did not confirm the dissection reset.' }

      const segmented = props.model.viewer === 'segmented-body' ? undefined : props.model.variants.find((entry) => entry.segmentedSystem)
      const expectedVariantId = segmented?.id ?? variant.id
      if (!dissectMode) {
        dispatchDissection({ type: 'clear' })
        setDissectMode(true)
        setDissectPanelOpen(true)
        setTouchMoveEnabled(false)
      }
      if (segmented && variant.id !== segmented.id) props.onVariant(segmented.id)
      if (props.settings.isolate) props.onSettings({ ...props.settings, isolate: false })

      const wholeModelOperation = ['show_all', 'undo', 'reset', 'restore'].includes(action.operation)
      let activated: NonNullable<typeof committedVoiceStateRef.current>
      try {
        activated = await waitForCommittedState((state) => state.voice.dissectMode && state.voice.variantId === expectedVariantId && (wholeModelOperation || state.loadedStructures.length > 0))
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'The segmented model did not become ready.' }
      }
      const resolved = resolveDissectionStructures(action.structureIds, [activated.loadedStructures, props.model.hotspots, ...props.model.variants.map((entry) => entry.hotspots ?? [])])
      if ('error' in resolved) return { ok: false, error: resolved.error }
      const ids = resolved.structures.map((entry) => entry.id)
      if (!wholeModelOperation && ids.length === 0) return { ok: false, error: 'Choose at least one structure for this dissection action.' }
      if (action.operation === 'separate' && ids.length < 2) return { ok: false, error: 'Separate requires at least two structures.' }
      let expected = activated.dissection

      if (action.operation === 'hide') {
        dispatchDissection({ type: 'hide', ids })
        expected = dissectionReducer(expected, { type: 'hide', ids })
      } else if (action.operation === 'show') {
        dispatchDissection({ type: 'show', ids })
        expected = dissectionReducer(expected, { type: 'show', ids })
      }
      else if (action.operation === 'transparent') {
        if (!ids.every((id) => expected.transparentIds.includes(id))) {
          dispatchDissection({ type: 'toggle-transparent', ids })
          expected = dissectionReducer(expected, { type: 'toggle-transparent', ids })
        }
      } else if (action.operation === 'isolate') {
        props.onClearSelection()
        resolved.structures.forEach((entry, index) => selectStructure(entry, index > 0))
        dispatchDissection({ type: 'set-isolate', value: true })
        expected = dissectionReducer(expected, { type: 'set-isolate', value: true })
      } else if (action.operation === 'move') {
        const distance = action.distance ?? 0.45
        const offsets: Record<NonNullable<typeof action.direction>, [number, number, number]> = {
          left: [-distance, 0, 0], right: [distance, 0, 0], up: [0, distance, 0], down: [0, -distance, 0], out: [0, 0, distance],
        }
        dispatchDissection({ type: 'begin-move' })
        expected = dissectionReducer(expected, { type: 'begin-move' })
        ids.forEach((id) => {
          const move = { type: 'set-offset', id, offset: offsets[action.direction ?? 'out'] } as const
          dispatchDissection(move)
          expected = dissectionReducer(expected, move)
        })
      } else if (action.operation === 'separate') {
        const offsets = separateStructureOffsets(ids, action.distance ?? 0.45)
        dispatchDissection({ type: 'begin-move' })
        expected = dissectionReducer(expected, { type: 'begin-move' })
        Object.entries(offsets).forEach(([id, offset]) => {
          const move = { type: 'set-offset', id, offset } as const
          dispatchDissection(move)
          expected = dissectionReducer(expected, move)
        })
      } else if (action.operation === 'show_all' || action.operation === 'restore') {
        dispatchDissection({ type: 'reset' })
        expected = dissectionReducer(expected, { type: 'reset' })
        if (props.settings.isolate) props.onSettings({ ...props.settings, isolate: false })
      }
      else if (action.operation === 'undo') {
        dispatchDissection({ type: 'undo' })
        expected = dissectionReducer(expected, { type: 'undo' })
      } else {
        dispatchDissection({ type: 'reset' })
        expected = dissectionReducer(expected, { type: 'reset' })
        if (props.settings.isolate) props.onSettings({ ...props.settings, isolate: false })
      }

      if (action.operation !== 'undo' && action.operation !== 'reset' && action.operation !== 'restore') {
        const recordedAction: DissectionActionType = action.operation === 'transparent' ? 'transparent' : action.operation === 'show_all' ? 'reset' : action.operation === 'separate' ? 'move' : action.operation
        recordAction(recordedAction, action.operation === 'show_all' ? dissection.hiddenIds : ids)
      }
      const expectedSnapshot = expected
      try {
        const committed = await waitForCommittedState((state) => {
          const actual = state.dissection
          const matchesDissection = JSON.stringify({ hiddenIds: actual.hiddenIds, transparentIds: actual.transparentIds, offsets: actual.offsets, isolate: actual.isolate }) === JSON.stringify({ hiddenIds: expectedSnapshot.hiddenIds, transparentIds: expectedSnapshot.transparentIds, offsets: expectedSnapshot.offsets, isolate: expectedSnapshot.isolate })
          const matchesSelection = action.operation !== 'isolate' || state.voice.selectedStructureIds.length === ids.length && ids.every((id) => state.voice.selectedStructureIds.includes(id))
          const legacyIsolationCleared = !state.settingsIsolate
          return state.voice.dissectMode && state.voice.variantId === expectedVariantId && matchesDissection && matchesSelection && legacyIsolationCleared
        })
        return { ok: true, message: `Dissection action ${action.operation.replace('_', ' ')} completed.`, context: { ...committed.voice, structures: committed.voice.structures.slice(0, 50), hiddenStructureIds: committed.voice.hiddenStructureIds.slice(0, 50), fadedStructureIds: committed.voice.fadedStructureIds.slice(0, 50), movedStructureIds: committed.voice.movedStructureIds.slice(0, 50), selectedStructureIds: committed.voice.selectedStructureIds.slice(0, 20) } }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'The anatomy viewer did not reach the requested state.' }
      }
    },
  }))

  /**
   * Explore's canvas tool rail: a floating vertical rail on the left edge, icon-only at
   * 42x42 inside a 44px hit area. Each control carries its name through an accessible label
   * and a tooltip rather than visible text, because the design's reserved left inset (64px)
   * only accommodates an icon-width rail.
   */
  function renderToolRail() {
    const tools: { key: string; icon: typeof RotateCw; label: string; active?: boolean; onClick: () => void }[] = [
      { key: 'rotate', icon: RotateCw, label: 'Auto rotate', active: props.settings.autoRotate, onClick: () => toggle('autoRotate') },
      { key: 'reset', icon: RotateCcw, label: 'Reset camera', onClick: () => setCameraResetToken((token) => token + 1) },
      { key: 'labels', icon: Tags, label: 'Labels', active: props.model.viewer !== 'segmented-body' ? props.settings.labels : undefined, onClick: () => props.model.viewer !== 'segmented-body' && toggle('labels') },
      { key: 'wireframe', icon: Grid3X3, label: 'Wireframe', active: props.settings.wireframe, onClick: () => toggle('wireframe') },
      { key: 'layers', icon: Layers3, label: 'Reference layers', active: props.model.viewer !== 'segmented-body' ? props.settings.layers : undefined, onClick: () => props.model.viewer !== 'segmented-body' && toggle('layers') },
    ]
    const dissectActive = dissectMode && (!props.activityLayout || dissectPanelOpen)
    return <TooltipProvider delayDuration={200}>
      <div className="viewer-tool-rail" role="toolbar" aria-orientation="vertical" aria-label="Viewer controls">
        {tools.map((tool) => <Tooltip key={tool.key}>
          <TooltipTrigger asChild>
            <Button variant={tool.active ? 'tool-active' : 'tool'} size="tool" aria-label={tool.label} disabled={(tool.key === 'labels' || tool.key === 'layers') && props.model.viewer === 'segmented-body'} {...(tool.active === undefined ? {} : { 'aria-pressed': tool.active })} onClick={tool.onClick}><tool.icon size={17} /></Button>
          </TooltipTrigger>
          <TooltipContent side="right">{tool.label}</TooltipContent>
        </Tooltip>)}
        {canDissect && <>
          <span className="tool-rail-divider" role="separator" aria-orientation="horizontal" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={dissectActive ? 'tool-active' : 'tool'} size="tool" aria-label="Dissect Mode" aria-pressed={dissectActive} onClick={toggleDissectMode}><Scissors size={17} /></Button>
            </TooltipTrigger>
            <TooltipContent side="right">Dissect Mode</TooltipContent>
          </Tooltip>
        </>}
      </div>
    </TooltipProvider>
  }

  function renderViewerTools() {
    return <div className="viewer-tools" aria-label="Viewer controls">
      <Button variant={props.settings.autoRotate ? 'tool-active' : 'tool'} size="tool" onClick={() => toggle('autoRotate')} title="Toggle auto rotate" aria-pressed={props.settings.autoRotate}><RotateCw size={17} /><span>Rotate</span></Button>
      <Button variant="tool" size="tool" onClick={() => setCameraResetToken((token) => token + 1)} title="Reset camera"><RotateCcw size={17} /><span>Reset</span></Button>
      {props.model.viewer !== 'segmented-body' && <Button variant={props.settings.labels ? 'tool-active' : 'tool'} size="tool" onClick={() => toggle('labels')} title="Toggle labels" aria-pressed={props.settings.labels}><Tags size={17} /><span>Labels</span></Button>}
      <Button variant={props.settings.wireframe ? 'tool-active' : 'tool'} size="tool" onClick={() => toggle('wireframe')} title="Toggle wireframe" aria-pressed={props.settings.wireframe}><Grid3X3 size={17} /><span>Wireframe</span></Button>
      {props.model.viewer !== 'segmented-body' && <Button variant={props.settings.layers ? 'tool-active' : 'tool'} size="tool" onClick={() => toggle('layers')} title="Toggle reference layers" aria-pressed={props.settings.layers}><Layers3 size={17} /><span>Reference</span></Button>}
      {canDissect && <Button variant={dissectMode && (!props.activityLayout || dissectPanelOpen) ? 'tool-active' : 'tool'} size="tool" onClick={toggleDissectMode} title="Toggle Dissect Mode" aria-pressed={dissectMode && (!props.activityLayout || dissectPanelOpen)}><Scissors size={17} /><span>Dissect</span></Button>}
    </div>
  }

  function renderActivityTools() {
    return <div className={`activity-tools-menu ${activityToolsOpen ? 'open' : ''}`}>
      <Button className="activity-tools-fab" variant="outline" size="icon" aria-label={activityToolsOpen ? 'Close tools' : 'Open tools'} aria-expanded={activityToolsOpen} onClick={() => setActivityToolsOpen((open) => !open)}>{activityToolsOpen ? <X size={18} /> : <SlidersHorizontal size={18} />}</Button>
      <div className="activity-tools-popover">{renderViewerTools()}</div>
    </div>
  }

  return (
    <section className={`viewer explore-viewer ${props.model.viewer === 'segmented-body' ? 'segmented' : 'standard'} ${props.activityLayout ? 'activity-layout' : ''} ${dissectMode ? 'is-dissecting' : ''} ${touchMoveEnabled ? 'move-armed' : ''} panel anim`} aria-label={`${props.model.name} 3D viewer`}>
      <header className="viewer-head">
        <div className="explore-heading"><span className="eyebrow">{dissectMode ? 'Virtual dissection' : props.model.viewer === 'segmented-body' ? 'Segmented atlas' : 'Live specimen'}</span><h1>{props.model.name}</h1><span className="viewer-mode-pill mobile-inline-mode">{dissectMode ? 'Dissect Mode' : 'Explore mode'}</span><p>{props.model.system}{props.model.metadata.region.toLowerCase() !== props.model.system.toLowerCase() && ` · ${props.model.metadata.region}`}</p><div className="variant-control"><span>Specimen</span><Select value={variant.id} onValueChange={changeVariant}><SelectTrigger className="specimen-selector" size="sm" aria-label={`Select ${props.model.name} specimen`}><SelectValue>{variant.label}</SelectValue></SelectTrigger><SelectContent className="specimen-selector-content" position="popper" align="start">{props.model.variants.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.label}</SelectItem>)}</SelectContent></Select>{variant.note && <small>{variant.note}</small>}</div></div><span className="viewer-mode-pill desktop-viewer-mode">{dissectMode ? 'Dissect Mode' : 'Explore mode'}</span>
      </header>
      {props.activityLayout ? renderActivityTools() : renderToolRail()}
      <div ref={canvasWrapRef} className={`canvas-wrap ${dissectMode && props.activityLayout ? 'dissecting' : ''}`}>
        <Canvas onPointerMissed={props.onClearSelection} frameloop={props.settings.autoRotate && !reducedMotion ? 'always' : 'demand'} dpr={[1, 1.7]} camera={{ position: canonicalCameraPosition(props.model.camera), fov: 42 }} gl={{ antialias: true, alpha: true }}>
          <OpticalCameraCenter canvasWrapRef={canvasWrapRef} dissectDockRef={dissectDockRef} panelState={`${dissectMode}:${dissectPanelOpen}:${props.activityLayout}`} subjectCamera={props.model.camera} controlsRef={controlsRef} />
          <Scene {...props} theme={resolvedTheme} reducedMotion={reducedMotion} onSelect={selectStructure} controlsRef={controlsRef} loadedLayers={loadedLayers} visibleLayers={visibleLayers} dissection={dissectMode ? dissection : undefined} onStructures={receiveStructures} onMoveStart={() => dispatchDissection({ type: 'begin-move' })} onMove={moveStructure} onMoveEnd={(nodeId) => recordAction('move', [nodeId])} onCameraChange={() => setCameraRevision((revision) => revision + 1)} touchMoveEnabled={touchMoveEnabled} />
        </Canvas>
        {props.model.viewer === 'segmented-body' && <div className="body-layer-dock"><header><span>Body systems</span><b>{visibleLayers.length} active</b></header>{anatomyLayers.map((layer) => <button key={layer.id} className={visibleLayers.includes(layer.id) ? 'active' : ''} onClick={() => toggleLayer(layer.id)}><i style={{ background: layer.color }} />{layer.label}{visibleLayers.includes(layer.id) ? <Eye size={13} /> : <EyeOff size={13} />}</button>)}</div>}
        <div className="axis"><span>Y</span><i /><b>X</b></div>
        <p className="viewer-help">{dissectMode ? 'Drag a structure to pull it out · drag empty space to orbit' : 'Select a structure to inspect · drag to orbit'}</p>
      </div>
      {dissectMode && dissectPanelOpen && <button className="dissect-backdrop" onClick={() => setDissectPanelOpen(false)} aria-label="Close dissection tools" />}
      {dissectMode && (variant.segmentedSystem || props.model.viewer === 'segmented-body') && <aside ref={dissectDockRef} className={`dissect-dock ${dissectPanelOpen ? 'sheet-open' : 'sheet-collapsed'}`} aria-label="Dissection tools">
          <header><button className="mobile-sheet-toggle" onClick={() => setDissectPanelOpen((value) => !value)} aria-expanded={dissectPanelOpen}>{dissectPanelOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button><div><span>Dissect · {structures.length} structures</span><b>{props.model.name}</b></div><button onClick={props.activityLayout || window.innerWidth < 1200 ? () => setDissectPanelOpen(false) : toggleDissectMode} title={props.activityLayout || window.innerWidth < 1200 ? 'Close dissection tools' : 'Exit Dissect Mode'}><X size={14} /></button></header>
          <div className="dissect-sheet-content">
          <div className="dissect-search"><Search size={13} /><input value={structureQuery} onChange={(event) => setStructureQuery(event.target.value)} placeholder="Search structures" aria-label="Search digestive structures" /></div>
          <div className="dissect-actions">
            <button disabled={selectedStructureIds.length === 0} onClick={() => { dispatchDissection({ type: 'hide', ids: selectedStructureIds }); recordAction('hide', selectedStructureIds) }}><EyeOff size={13} />Hide</button>
            <button disabled={selectedStructureIds.length === 0} onClick={() => { dispatchDissection({ type: 'show', ids: selectedStructureIds }); recordAction('show', selectedStructureIds) }}><Eye size={13} />Show</button>
            <button className={selectedStructureIds.some((id) => dissection.transparentIds.includes(id)) ? 'active' : ''} disabled={selectedStructureIds.length === 0} aria-pressed={selectedStructureIds.some((id) => dissection.transparentIds.includes(id))} onClick={() => { dispatchDissection({ type: 'toggle-transparent', ids: selectedStructureIds }); recordAction('transparent', selectedStructureIds) }}><Eye size={13} opacity={0.55} />Fade</button>
            <button className={dissection.isolate ? 'active' : ''} disabled={selectedStructureIds.length === 0} aria-pressed={dissection.isolate} onClick={() => { dispatchDissection({ type: 'toggle-isolate' }); recordAction('isolate', selectedStructureIds) }}><Box size={13} />Isolate</button>
            <button className={`touch-move-action ${touchMoveEnabled ? 'active' : ''}`} aria-pressed={touchMoveEnabled} onClick={() => setTouchMoveEnabled((value) => !value)} title="Arm structure dragging on touch screens"><Move3D size={13} />Move</button>
          </div>
          <div className="dissect-structures">{structureGroups.map(([group, entries]) => <section key={group}><h3>{group}<span>{entries.length}</span></h3>{entries.map((structure) => <button key={structure.id} className={`${props.selectedIds.includes(structure.id) ? 'selected' : ''} ${dissection.hiddenIds.includes(structure.id) ? 'hidden' : ''}`} onClick={(event) => selectStructure(structure, event.shiftKey || window.matchMedia('(pointer: coarse)').matches)}><i />{structure.label}{dissection.hiddenIds.includes(structure.id) && <EyeOff size={11} />}</button>)}</section>)}</div>
          <footer><button disabled={dissection.history.length === 0} onClick={() => dispatchDissection({ type: 'undo' })}><Undo2 size={13} />Undo</button><button disabled={dissection.hiddenIds.length === 0} onClick={() => { const ids = dissection.hiddenIds; dispatchDissection({ type: 'show-all' }); recordAction('show', ids) }}>Show all</button><button onClick={resetDissection}>Reset</button></footer>
          </div>
        </aside>}
      <div className="specimen-bar">
        <span><b>{props.model.metadata.region}</b>Region</span><span><b>{props.model.viewer === 'segmented-body' ? 'Layered systems' : props.model.metadata.scale}</b>Reference</span><span><b>{dissectMode ? 'Dissect Mode' : props.model.viewer === 'segmented-body' ? 'Click to explore' : 'Surface selection'}</b>Study mode</span>
      </div>
    </section>
  )
})
