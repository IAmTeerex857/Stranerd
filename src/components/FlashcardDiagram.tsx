import { Component, Suspense, useEffect, useMemo, type ErrorInfo, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Mesh, Vector3, type Material } from 'three'
import { Box, LoaderCircle } from 'lucide-react'
import { resolveFlashcardDiagram } from '../lib/flashcardDiagram'
import type { FlashcardDiagram as Diagram } from '../types'
import { useTheme } from '../theme-context'

class DiagramBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('Flashcard diagram unavailable', error.message, info.componentStack) }
  render() {
    if (this.state.failed) return <div className="flashcard-diagram-fallback"><Box size={22} /><span>3D view unavailable</span></div>
    return this.props.children
  }
}

function LoadingDiagram() {
  return <Html center><div className="flashcard-diagram-loading"><LoaderCircle className="spin" size={18} />Loading model</div></Html>
}

function DiagramModel({ url, selected }: { url: string; selected: { id: string; position: [number, number, number] }[] }) {
  const { scene } = useGLTF(url)
  const invalidate = useThree((state) => state.invalidate)
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const box = new Box3().setFromObject(root)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = 3.05 / Math.max(size.x, size.y, size.z, 0.001)
    root.position.copy(center).multiplyScalar(-scale)
    root.scale.setScalar(scale)
    const materials: Material[] = []
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const copies = (Array.isArray(object.material) ? object.material : [object.material]).map((material) => {
        const copy = material.clone()
        materials.push(copy)
        return copy
      })
      object.material = Array.isArray(object.material) ? copies : copies[0]
    })
    return { root, materials }
  }, [scene])

  useEffect(() => {
    invalidate()
    return () => prepared.materials.forEach((material) => material.dispose())
  }, [invalidate, prepared])

  return <group><primitive object={prepared.root} />{selected.map((hotspot) => <group key={hotspot.id} position={hotspot.position}><mesh><sphereGeometry args={[0.065, 18, 18]} /><meshBasicMaterial color="#e26bd6" toneMapped={false} /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.11, 0.008, 8, 40]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh></group>)}</group>
}

export function FlashcardDiagram({ diagram }: { diagram: Diagram }) {
  const resolved = resolveFlashcardDiagram(diagram)
  const { resolvedTheme } = useTheme()
  if (!resolved) return <div className="flashcard-diagram-fallback"><Box size={22} /><span>Text-only card</span></div>
  const light = resolvedTheme === 'light'
  return <DiagramBoundary><div className="flashcard-diagram" aria-label="Rotatable anatomy model with the target highlighted">
    <Canvas frameloop="demand" resize={{ offsetSize: true }} dpr={[1, 1.25]} camera={{ position: [0, 0.1, 4.8], fov: 42 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}>
      <ambientLight intensity={light ? 1.15 : 1.5} />
      <hemisphereLight args={light ? ['#ffffff', '#9aadc0', 1.1] : ['#dff3ff', '#1a1020', 1.35]} />
      <directionalLight position={[3, 4, 5]} intensity={light ? 1.7 : 2.1} color={light ? '#ffffff' : '#dff3ff'} />
      <directionalLight position={[-4, -2, -3]} intensity={0.8} color={light ? '#b6a1d9' : '#e26bd6'} />
      <Suspense fallback={<LoadingDiagram />}><DiagramModel url={`/models/${resolved.variant.file}`} selected={resolved.selected} /></Suspense>
      <OrbitControls makeDefault enablePan={false} enableZoom={false} enableDamping />
    </Canvas>
    <span>Drag to rotate · tap to reveal</span>
  </div></DiagramBoundary>
}
