import { Suspense, useEffect, useMemo, useState } from 'react'
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
  mobileFit?: number
  cameraZ?: number
  autoRotate?: boolean
  rotation?: [number, number, number]
}

function useMobileViewport() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

export function LandingSpecimen({ url, label, className = '', fit, mobileFit, cameraZ = 5.6, autoRotate = true, rotation }: LandingSpecimenProps) {
  const mobile = useMobileViewport()
  return <div className={`landing-specimen-canvas ${className}`} aria-label={label}>
    <Canvas frameloop={autoRotate ? 'always' : 'demand'} dpr={[1, 2]} camera={{ position: [0, 0.05, cameraZ], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 5, 6]} intensity={3.4} color="#f8fbff" />
      <directionalLight position={[-4, 1, -3]} intensity={1.8} color="#e26bd6" />
      <Suspense fallback={<Loader />}><SpecimenModel url={url} fit={mobile && mobileFit ? mobileFit : fit} rotation={rotation} /></Suspense>
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

function LayeredBodyModel() {
  const skeleton = useGLTF('/models/body/skeleton.glb').scene
  const cardiovascular = useGLTF('/models/body/cardiovascular.glb').scene
  const nervous = useGLTF('/models/body/nervous.glb').scene
  const transform = useMemo(() => {
    const box = new Box3()
    ;[skeleton, cardiovascular, nervous].forEach((scene) => box.expandByObject(scene))
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = 4.6 / Math.max(size.x, size.y, size.z, 0.001)
    return { position: center.multiplyScalar(-scale), scale }
  }, [cardiovascular, nervous, skeleton])

  return <group position={transform.position} scale={transform.scale}>
    <BodyLayer url="/models/body/skeleton.glb" color="#e9dfc2" opacity={0.88} />
    <BodyLayer url="/models/body/cardiovascular.glb" color="#d74f63" opacity={0.96} />
    <BodyLayer url="/models/body/nervous.glb" color="#f2c261" opacity={0.96} />
  </group>
}

export function LandingLayeredBody() {
  return <div className="landing-specimen-canvas layered-body-canvas" aria-label="Rotating layered human anatomy showing skeleton, cardiovascular, and nervous systems">
    <Canvas frameloop="always" dpr={[1, 2]} camera={{ position: [0, 0.05, 6.6], fov: 40 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <ambientLight intensity={1.8} />
      <directionalLight position={[4, 5, 6]} intensity={3} color="#ffffff" />
      <directionalLight position={[-4, 1, -3]} intensity={1.4} color="#4db6ff" />
      <Suspense fallback={<Loader />}>
        <LayeredBodyModel />
      </Suspense>
      <OrbitControls makeDefault autoRotate autoRotateSpeed={0.62} enablePan={false} enableZoom={false} enableDamping />
    </Canvas>
  </div>
}

useGLTF.preload('/models/heart-realistic.glb')
useGLTF.preload('/models/brain-realistic.glb')
useGLTF.preload('/models/lungs-realistic.glb')
useGLTF.preload('/models/eye-realistic.glb')
useGLTF.preload('/models/digestive-system-segmented.glb')
useGLTF.preload('/models/body/skeleton.glb')
useGLTF.preload('/models/body/cardiovascular.glb')
useGLTF.preload('/models/body/nervous.glb')
