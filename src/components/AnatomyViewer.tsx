import { Component, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode, type RefObject } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { Box, Eye, EyeOff, Focus, Layers3, LoaderCircle, RotateCcw, ScanLine, Star, Tags } from 'lucide-react'
import type { Hotspot, ModelEntry, Settings } from '../types'
import { anatomyLayers } from '../data/anatomyGraph'
import { ProgressiveBodyModel } from './ProgressiveBodyModel'
import { SegmentedSpecimenModel } from './SegmentedSpecimenModel'

type ViewerProps = {
  model: ModelEntry
  selectedIds: string[]
  selectedHotspot?: Hotspot
  settings: Settings
  selectedVariantId: string
  favorite: boolean
  onSelect: (hotspot: Hotspot, multi: boolean) => void
  onSettings: (settings: Settings) => void
  onVariant: (variantId: string) => void
  onFavorite: () => void
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

function Scene({ model, settings, selectedIds, selectedVariantId, onSelect, controlsRef, loadedLayers, visibleLayers }: ViewerProps & { controlsRef: RefObject<{ reset: () => void } | null>; loadedLayers: string[]; visibleLayers: string[] }) {
  const variant = model.variants.find((entry) => entry.id === selectedVariantId) ?? model.variants[0]
  const hotspots = variant.hotspots ?? model.hotspots
  return (
    <>
      <ambientLight intensity={1.6} />
      <hemisphereLight args={['#dff3ff', '#1a1020', 1.4]} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} color="#dff3ff" />
      <directionalLight position={[-4, -2, -3]} intensity={1.1} color="#e26bd6" />
      <pointLight position={[0, -2, 3]} intensity={1.2} color="#4db6ff" distance={8} />
      <group>
        <Suspense fallback={<LoadingModel />}>
          <ModelBoundary key={variant.file} name={`${model.name} · ${variant.label}`}>{model.viewer === 'segmented-body'
            ? <ProgressiveBodyModel layers={anatomyLayers.filter((layer) => loadedLayers.includes(layer.id))} visibleLayerIds={visibleLayers} selectedIds={selectedIds} settings={settings} onSelect={onSelect} />
            : variant.segmentedSystem
              ? <SegmentedSpecimenModel url={`/models/${variant.file}`} systemId={variant.segmentedSystem} selectedIds={selectedIds} settings={settings} onSelect={onSelect} />
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
      <OrbitControls ref={controlsRef as never} makeDefault autoRotate={settings.autoRotate} autoRotateSpeed={0.8} enableDamping minDistance={2.2} maxDistance={8} />
    </>
  )
}

export function AnatomyViewer(props: ViewerProps) {
  const controlsRef = useRef<{ reset: () => void } | null>(null)
  const defaults = anatomyLayers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
  const [visibleLayers, setVisibleLayers] = useState<string[]>(defaults)
  const [loadedLayers, setLoadedLayers] = useState<string[]>(defaults)
  const toggle = (key: keyof Settings) => props.onSettings({ ...props.settings, [key]: !props.settings[key] })
  const variant = props.model.variants.find((entry) => entry.id === props.selectedVariantId) ?? props.model.variants[0]

  function toggleLayer(layerId: string) {
    setLoadedLayers((current) => current.includes(layerId) ? current : [...current, layerId])
    setVisibleLayers((current) => current.includes(layerId) ? current.filter((id) => id !== layerId) : [...current, layerId])
  }

  return (
    <section className={`viewer ${props.model.viewer === 'segmented-body' ? 'segmented' : 'standard'} panel anim`} aria-label={`${props.model.name} 3D viewer`}>
      <div className="viewer-head">
        <div><span className="eyebrow">{props.model.viewer === 'segmented-body' ? 'Segmented atlas' : 'Live specimen'}</span><h1>{props.model.name}</h1><p>{props.model.scientificName}</p>{props.model.viewer !== 'segmented-body' && <div className="variant-control"><label htmlFor={`variant-${props.model.id}`}>Specimen</label><select id={`variant-${props.model.id}`} value={variant.id} onChange={(event) => props.onVariant(event.target.value)}>{props.model.variants.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>{variant.note && <small>{variant.note}</small>}</div>}</div>
        <div className="viewer-tools" aria-label="Viewer controls">
          <button className={props.favorite ? 'active' : ''} onClick={props.onFavorite} title={props.favorite ? 'Remove favorite' : 'Add favorite'} aria-pressed={props.favorite}><Star size={17} fill={props.favorite ? 'currentColor' : 'none'} /><span>Favorite</span></button>
          <button className={props.settings.autoRotate ? 'active' : ''} onClick={() => toggle('autoRotate')} title="Toggle auto rotate"><ScanLine size={17} /><span>Rotate</span></button>
          <button onClick={() => controlsRef.current?.reset()} title="Reset camera"><RotateCcw size={17} /><span>Reset</span></button>
          {props.model.viewer !== 'segmented-body' && <button className={props.settings.labels ? 'active' : ''} onClick={() => toggle('labels')} title="Toggle labels"><Tags size={17} /><span>Labels</span></button>}
          <button className={props.settings.wireframe ? 'active' : ''} onClick={() => toggle('wireframe')} title="Toggle wireframe"><Focus size={17} /><span>Wire</span></button>
          <button className={props.settings.layers ? 'active' : ''} onClick={() => toggle('layers')} title="Toggle reference layers"><Layers3 size={17} /><span>Layers</span></button>
          <button className={props.settings.isolate ? 'active' : ''} onClick={() => toggle('isolate')} title="Reduce reference overlays"><Box size={17} /><span>Focus</span></button>
        </div>
      </div>
      <div className="canvas-wrap">
        <Canvas frameloop={props.settings.autoRotate ? 'always' : 'demand'} dpr={[1, 1.7]} camera={{ position: [0, 0.2, 4.4], fov: 42 }} gl={{ antialias: true, alpha: true }}>
          <Scene {...props} controlsRef={controlsRef} loadedLayers={loadedLayers} visibleLayers={visibleLayers} />
        </Canvas>
        {props.model.viewer === 'segmented-body' && <div className="body-layer-dock"><header><span>Body systems</span><b>{visibleLayers.length} active</b></header>{anatomyLayers.map((layer) => <button key={layer.id} className={visibleLayers.includes(layer.id) ? 'active' : ''} onClick={() => toggleLayer(layer.id)}><i style={{ background: layer.color }} />{layer.label}{visibleLayers.includes(layer.id) ? <Eye size={13} /> : <EyeOff size={13} />}</button>)}</div>}
        <div className="axis"><span>Y</span><i /><b>X</b></div>
        <p className="viewer-help">Click the model to inspect · shift-click to multi-select · drag to orbit</p>
      </div>
      <div className="specimen-bar">
        <span><b>{props.model.metadata.region}</b>Region</span><span><b>{props.model.viewer === 'segmented-body' ? 'Layered systems' : props.model.metadata.scale}</b>Reference</span><span><b>{props.model.viewer === 'segmented-body' ? 'Click to explore' : 'Surface selection'}</b>Study mode</span>
      </div>
    </section>
  )
}
