import { Component, Suspense, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode, type RefObject } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { Box, Focus, Layers3, LoaderCircle, RotateCcw, ScanLine, Star } from 'lucide-react'
import type { Hotspot, ModelEntry, Settings } from '../types'

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

function ModelGeometry({ url, settings }: { url: string; settings: Settings }) {
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

  return <primitive object={prepared} />
}

function Scene({ model, settings, selectedIds, selectedVariantId, onSelect, controlsRef }: ViewerProps & { controlsRef: RefObject<{ reset: () => void } | null> }) {
  const variant = model.variants.find((entry) => entry.id === selectedVariantId) ?? model.variants[0]
  return (
    <>
      <ambientLight intensity={1.6} />
      <hemisphereLight args={['#dff3ff', '#1a1020', 1.4]} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} color="#dff3ff" />
      <directionalLight position={[-4, -2, -3]} intensity={1.1} color="#e26bd6" />
      <pointLight position={[0, -2, 3]} intensity={1.2} color="#4db6ff" distance={8} />
      <group>
        <Suspense fallback={<LoadingModel />}>
          <ModelBoundary key={variant.file} name={`${model.name} · ${variant.label}`}><ModelGeometry url={`/models/${variant.file}`} settings={settings} /></ModelBoundary>
        </Suspense>
        {settings.layers && !settings.isolate && <>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}><torusGeometry args={[1.3, 0.008, 8, 80]} /><meshBasicMaterial color="#4db6ff" transparent opacity={0.22} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.45, 0]}><torusGeometry args={[1.05, 0.008, 8, 80]} /><meshBasicMaterial color="#e26bd6" transparent opacity={0.18} /></mesh>
        </>}
        {model.hotspots.map((hotspot, index) => {
          const selected = selectedIds.includes(hotspot.id)
          if (settings.isolate && selectedIds.length > 0 && !selected) return null
          return (
            <group key={hotspot.id} position={hotspot.position}>
              <mesh onClick={(event) => { event.stopPropagation(); onSelect(hotspot, event.nativeEvent.shiftKey) }}>
                <sphereGeometry args={[selected ? 0.085 : 0.065, 18, 18]} />
                <meshBasicMaterial color={selected ? '#e26bd6' : '#4db6ff'} toneMapped={false} />
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
  const toggle = (key: keyof Settings) => props.onSettings({ ...props.settings, [key]: !props.settings[key] })
  const variant = props.model.variants.find((entry) => entry.id === props.selectedVariantId) ?? props.model.variants[0]

  return (
    <section className="viewer panel anim" aria-label={`${props.model.name} 3D viewer`}>
      <div className="viewer-head">
        <div><span className="eyebrow">Live specimen</span><h1>{props.model.name}</h1><p>{props.model.scientificName}</p><div className="variant-control"><label htmlFor={`variant-${props.model.id}`}>Specimen</label><select id={`variant-${props.model.id}`} value={variant.id} onChange={(event) => props.onVariant(event.target.value)}>{props.model.variants.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>{variant.note && <small>{variant.note}</small>}</div></div>
        <div className="viewer-tools" aria-label="Viewer controls">
          <button className={props.favorite ? 'active' : ''} onClick={props.onFavorite} title={props.favorite ? 'Remove favorite' : 'Add favorite'} aria-pressed={props.favorite}><Star size={17} fill={props.favorite ? 'currentColor' : 'none'} /><span>Favorite</span></button>
          <button className={props.settings.autoRotate ? 'active' : ''} onClick={() => toggle('autoRotate')} title="Toggle auto rotate"><ScanLine size={17} /><span>Rotate</span></button>
          <button onClick={() => controlsRef.current?.reset()} title="Reset camera"><RotateCcw size={17} /><span>Reset</span></button>
          <button className={props.settings.wireframe ? 'active' : ''} onClick={() => toggle('wireframe')} title="Toggle wireframe"><Focus size={17} /><span>Wire</span></button>
          <button className={props.settings.layers ? 'active' : ''} onClick={() => toggle('layers')} title="Toggle reference layers"><Layers3 size={17} /><span>Layers</span></button>
          <button className={props.settings.isolate ? 'active' : ''} onClick={() => toggle('isolate')} title="Reduce reference overlays"><Box size={17} /><span>Focus</span></button>
        </div>
      </div>
      <div className="canvas-wrap">
        <Canvas frameloop={props.settings.autoRotate ? 'always' : 'demand'} dpr={[1, 1.7]} camera={{ position: [0, 0.2, 4.4], fov: 42 }} gl={{ antialias: true, alpha: true }}>
          <Scene {...props} controlsRef={controlsRef} />
        </Canvas>
        <div className="axis"><span>Y</span><i /><b>X</b></div>
        <p className="viewer-help">Authored coordinate markers · drag to orbit · shift-select for multiple</p>
      </div>
      <div className="specimen-bar">
        <span><b>{props.model.metadata.region}</b>Region</span><span><b>{props.model.metadata.scale}</b>Reference</span><span><b>{props.model.hotspots.length}</b>Markers</span>
      </div>
    </section>
  )
}
