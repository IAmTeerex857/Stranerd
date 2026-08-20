import { Component, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three'
import { Eye, EyeOff, Focus, LoaderCircle, RotateCcw, ScanSearch } from 'lucide-react'

export type StructureRecord = { id: string; name: string; parent?: string; triangles: number; vertices: number }
export type ModelMetrics = { meshes: number; triangles: number; vertices: number; materials: number; loadMs: number; structures: StructureRecord[] }

function cleanName(object: Object3D, index: number) {
  return (object.name || `Mesh ${index + 1}`).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

class ViewerBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() { return this.state.error ? <Html center><div className="eval-loader error"><strong>Unable to read model</strong><span>{this.state.error.message}</span></div></Html> : this.props.children }
}

function LoadedModel({ url, selected, hidden, faded, isolated, wireframe, onSelect, onMetrics }: { url: string; selected?: string; hidden: Set<string>; faded: Set<string>; isolated: boolean; wireframe: boolean; onSelect: (id: string) => void; onMetrics: (metrics: Omit<ModelMetrics, 'loadMs'>) => void }) {
  const { scene } = useGLTF(url)
  const prepared = useMemo(() => {
    const copy = scene.clone(true)
    const box = new Box3().setFromObject(copy)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = 3.3 / Math.max(size.x, size.y, size.z, 0.001)
    copy.position.copy(center).multiplyScalar(-scale)
    copy.scale.setScalar(scale)
    const structures: StructureRecord[] = []
    const materialIds = new Set<string>()
    let index = 0
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const sourceId = object.userData.conceptId || object.userData.sourceId || object.userData.elementId || object.name
      const id = `${sourceId || 'structure'}:${index}`
      object.userData.evaluationId = id
      const geometry = object.geometry
      const vertices = geometry.attributes.position?.count ?? 0
      const triangles = geometry.index ? geometry.index.count / 3 : vertices / 3
      structures.push({ id, name: object.userData.label || cleanName(object, index), parent: object.parent?.name || undefined, vertices, triangles: Math.round(triangles) })
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
      const materials = sourceMaterials.map((material) => { materialIds.add(material.uuid); return material.clone() })
      object.material = Array.isArray(object.material) ? materials : materials[0]
      index += 1
    })
    return { scene: copy, metrics: { meshes: structures.length, triangles: structures.reduce((sum, item) => sum + item.triangles, 0), vertices: structures.reduce((sum, item) => sum + item.vertices, 0), materials: materialIds.size, structures } }
  }, [scene])

  useEffect(() => onMetrics(prepared.metrics), [onMetrics, prepared.metrics])

  useEffect(() => {
    prepared.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const id = object.userData.evaluationId as string
      const visible = !hidden.has(id) && (!isolated || !selected || id === selected)
      object.visible = visible
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        if (!(material instanceof MeshStandardMaterial)) return
        material.wireframe = wireframe
        material.transparent = faded.has(id)
        material.opacity = faded.has(id) ? 0.22 : 1
        material.depthWrite = !faded.has(id)
        material.emissive.set(id === selected ? '#5522aa' : '#000000')
        material.emissiveIntensity = id === selected ? 0.22 : 0
        material.needsUpdate = true
      })
    })
  }, [faded, hidden, isolated, prepared.scene, selected, wireframe])

  useEffect(() => () => prepared.scene.traverse((object) => { if (object instanceof Mesh) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose()) }), [prepared.scene])

  function select(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    const id = event.object.userData.evaluationId as string | undefined
    if (id) onSelect(id)
  }
  return <primitive object={prepared.scene} onClick={select} />
}

function Loader() {
  return <Html center><div className="eval-loader"><LoaderCircle className="spin" /><span>Reading geometry</span></div></Html>
}

export function ModelViewport({ url, title, onMetrics, selectedStructure: selectedStructureId, onSelectedStructure }: { url: string; title: string; onMetrics: (metrics: ModelMetrics) => void; selectedStructure?: string; onSelectedStructure?: (id?: string) => void }) {
  const [internalSelected, setInternalSelected] = useState<string>()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [faded, setFaded] = useState<Set<string>>(new Set())
  const [isolated, setIsolated] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [metrics, setMetrics] = useState<ModelMetrics>()
  const [startedAt] = useState(() => performance.now())
  const selected = selectedStructureId ?? internalSelected
  const select = (id?: string) => { setInternalSelected(id); onSelectedStructure?.(id) }
  const reportMetrics = useMemo(() => (next: Omit<ModelMetrics, 'loadMs'>) => { const measured = { ...next, loadMs: Math.round(performance.now() - startedAt) }; setMetrics(measured); onMetrics(measured) }, [onMetrics, startedAt])
  const selectedRecord = metrics?.structures.find((item) => item.id === selected)

  function toggle(setter: (value: Set<string>) => void, current: Set<string>) {
    if (!selected) return
    const next = new Set(current)
    if (next.has(selected)) next.delete(selected); else next.add(selected)
    setter(next)
  }

  return <section className="eval-viewer-card">
    <header><div><span>Live specimen</span><h2>{title}</h2></div><div className="eval-viewer-flags"><b>{metrics?.meshes ?? 0} meshes</b><b>{metrics ? metrics.triangles.toLocaleString() : '0'} tris</b></div></header>
    <div className="eval-canvas">
      <Canvas camera={{ position: [0, 0, 4.8], fov: 42 }} gl={{ antialias: true }} dpr={[1, 1.7]}>
        <color attach="background" args={['#080a12']} />
        <ambientLight intensity={1.25} />
        <hemisphereLight args={['#f5f0ff', '#101427', 1.5]} />
        <directionalLight position={[4, 5, 5]} intensity={2.1} color="#ffffff" />
        <directionalLight position={[-4, -2, 2]} intensity={1.2} color="#9c72ff" />
        <ViewerBoundary><Suspense fallback={<Loader />}><LoadedModel key={url} url={url} selected={selected} hidden={hidden} faded={faded} isolated={isolated} wireframe={wireframe} onSelect={select} onMetrics={reportMetrics} /></Suspense></ViewerBoundary>
        <OrbitControls makeDefault enableDamping minDistance={1.2} maxDistance={9} />
      </Canvas>
      <div className="eval-canvas-hint"><ScanSearch />Click a named mesh to inspect it</div>
    </div>
    <div className="eval-actions">
      <button disabled={!selected} onClick={() => toggle(setHidden, hidden)}>{selected && hidden.has(selected) ? <Eye /> : <EyeOff />} {selected && hidden.has(selected) ? 'Show' : 'Hide'}</button>
      <button disabled={!selected} onClick={() => toggle(setFaded, faded)}><Focus />{selected && faded.has(selected) ? 'Solid' : 'Fade'}</button>
      <button disabled={!selected} className={isolated ? 'active' : ''} onClick={() => setIsolated((value) => !value)}><ScanSearch />Isolate</button>
      <button className={wireframe ? 'active' : ''} onClick={() => setWireframe((value) => !value)}>Wireframe</button>
      <button onClick={() => { select(undefined); setHidden(new Set()); setFaded(new Set()); setIsolated(false); setWireframe(false) }}><RotateCcw />Reset</button>
    </div>
    <footer><span>{selectedRecord ? selectedRecord.name : 'No structure selected'}</span>{selectedRecord && <small>{selectedRecord.vertices.toLocaleString()} vertices · {selectedRecord.triangles.toLocaleString()} triangles</small>}</footer>
  </section>
}
