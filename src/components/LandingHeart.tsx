import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'

type ModelProps = {
  url: string
  fit?: number
  rotation?: [number, number, number]
}

function SpecimenModel({ url, fit = 2.8, rotation = [0.04, -0.35, -0.04] }: ModelProps) {
  const { scene } = useGLTF(url)
  const invalidate = useThree((state) => state.invalidate)
  const model = useMemo(() => {
    const copy = scene.clone(true)
    const box = new Box3().setFromObject(copy)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = fit / Math.max(size.x, size.y, size.z, 0.001)
    copy.position.copy(center).multiplyScalar(-scale)
    copy.scale.setScalar(scale)
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
    })
    return copy
  }, [fit, scene])

  useEffect(() => {
    invalidate()
  }, [invalidate, model])

  return <primitive object={model} rotation={rotation} />
}

function Loader() {
  return <Html center><span className="landing-model-loader">Preparing specimen</span></Html>
}

type LandingSpecimenProps = {
  url: string
  label: string
  className?: string
  fit?: number
  cameraZ?: number
  autoRotate?: boolean
  rotation?: [number, number, number]
}

export function LandingSpecimen({ url, label, className = '', fit, cameraZ = 5.6, autoRotate = true, rotation }: LandingSpecimenProps) {
  return <div className={`landing-specimen-canvas ${className}`} aria-label={label}>
    <Canvas frameloop={autoRotate ? 'always' : 'demand'} dpr={[1, 1.35]} camera={{ position: [0, 0.05, cameraZ], fov: 38 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 5, 6]} intensity={3.4} color="#f8fbff" />
      <directionalLight position={[-4, 1, -3]} intensity={1.8} color="#e26bd6" />
      <Suspense fallback={<Loader />}><SpecimenModel url={url} fit={fit} rotation={rotation} /></Suspense>
      <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={0.65} enablePan={false} enableZoom={false} enableDamping minPolarAngle={0.7} maxPolarAngle={2.35} />
    </Canvas>
  </div>
}

export function LandingHeart() {
  return <LandingSpecimen url="/models/heart-realistic.glb" label="Rotating three-dimensional heart specimen" className="landing-heart-canvas" fit={2.65} cameraZ={5.9} />
}

function BodyLayer({ url, color, opacity = 1 }: { url: string; color: string; opacity?: number }) {
  const { scene } = useGLTF(url)
  const layer = useMemo(() => {
    const copy = scene.clone(true)
    copy.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const source = Array.isArray(object.material) ? object.material : [object.material]
      const materials = source.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial && !next.vertexColors) next.color.set(color)
        next.transparent = opacity < 1
        next.opacity = opacity
        next.depthWrite = opacity >= 1
        return next
      })
      object.material = Array.isArray(object.material) ? materials : materials[0]
    })
    return copy
  }, [color, opacity, scene])
  return <primitive object={layer} />
}

export function LandingLayeredBody() {
  return <div className="landing-specimen-canvas layered-body-canvas" aria-label="Rotating layered human anatomy showing skeleton, cardiovascular, and nervous systems">
    <Canvas frameloop="always" dpr={[1, 1.25]} camera={{ position: [0, 0.15, 6.6], fov: 40 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.8} />
      <directionalLight position={[4, 5, 6]} intensity={3} color="#ffffff" />
      <directionalLight position={[-4, 1, -3]} intensity={1.4} color="#4db6ff" />
      <Suspense fallback={<Loader />}>
        <group position={[0, -1.58, 0]} scale={1.7}>
          <BodyLayer url="/models/body/skeleton.glb" color="#e9dfc2" opacity={0.78} />
          <BodyLayer url="/models/body/cardiovascular.glb" color="#d74f63" opacity={0.9} />
          <BodyLayer url="/models/body/nervous.glb" color="#f2c261" opacity={0.9} />
        </group>
      </Suspense>
      <OrbitControls makeDefault autoRotate autoRotateSpeed={0.62} enablePan={false} enableZoom={false} enableDamping />
    </Canvas>
  </div>
}

useGLTF.preload('/models/heart-realistic.glb')
useGLTF.preload('/models/brain-realistic.glb')
useGLTF.preload('/models/lungs-realistic.glb')
useGLTF.preload('/models/digestive-system-segmented.glb')
useGLTF.preload('/models/body/skeleton.glb')
useGLTF.preload('/models/body/cardiovascular.glb')
useGLTF.preload('/models/body/nervous.glb')
