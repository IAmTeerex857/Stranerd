import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Vector2, Vector3, type Material } from 'three'
import { useThree } from '@react-three/fiber'
import { anatomyNodeId, createMeshSelection, normalizeStructureName } from '../data/anatomyGraph'
import type { AnatomySystemId, Hotspot, Settings } from '../types'

function structureName(object: Object3D, root: Object3D) {
  let current: Object3D | null = object
  while (current && current !== root) {
    const name = current.name.trim()
    if (name && !/^(rootnode|scene|mesh|node)([_.-]?\d+)?$/i.test(name)) return normalizeStructureName(name)
    current = current.parent
  }
  return 'Anatomical structure'
}

type Props = {
  url: string
  systemId: AnatomySystemId
  selectedIds: string[]
  settings: Settings
  onSelect: (hotspot: Hotspot, multi: boolean) => void
}

function anatomyColor(name: string, systemId: AnatomySystemId) {
  const value = name.toLowerCase()
  if (systemId === 'skin') return /hair|eyebrow|eyelash/.test(value) ? '#5b4035' : '#d9a58f'
  if (systemId === 'nervous') {
    if (/eye|eyeball|cornea|iris|lens|retina/.test(value)) return /iris/.test(value) ? '#6fa4b9' : /lens|cornea/.test(value) ? '#b9dce5' : '#e8ddd3'
    if (/optic|nerve|tract|fibre|funicul|plexus/.test(value)) return '#edc75f'
    if (/cerebell/.test(value)) return '#c98272'
    if (/brainstem|midbrain|pons|medulla/.test(value)) return '#c88f6c'
    if (/frontal/.test(value)) return '#d47c72'
    if (/parietal/.test(value)) return '#c98b67'
    if (/temporal/.test(value)) return '#a9798e'
    if (/occipital/.test(value)) return '#8d78a8'
    return '#d19a83'
  }
  if (systemId === 'organs') {
    if (/lung|pleura/.test(value)) return '#d9919a'
    if (/bronch|trachea|larynx/.test(value)) return '#c6d4d7'
    if (/kidney|renal/.test(value)) return '#a95458'
    if (/ureter|urethra|bladder/.test(value)) return '#d8b56f'
    if (/liver|hepatic/.test(value)) return '#8f4c43'
    if (/gallbladder|bile/.test(value)) return '#77a65a'
    if (/pancreas/.test(value)) return '#d7a56b'
    if (/stomach/.test(value)) return '#ca7f79'
    if (/colon|intestin|duodenum|jejunum|ileum|cecum|appendix/.test(value)) return '#c98e75'
    if (/oesophagus|esophagus|pharynx|mouth/.test(value)) return '#b86d6c'
    return '#bd776d'
  }
  if (/vein|vena cava|coronary sinus/.test(value)) return '#4f83d1'
  if (/artery|aorta|pulmonary trunk/.test(value)) return '#d75a61'
  if (/valve|leaflet/.test(value)) return '#e8d8b8'
  if (/atrium/.test(value)) return '#b94f68'
  if (/ventricle|papillary|heart/.test(value)) return '#c85f58'
  return '#d07a72'
}

export function SegmentedSpecimenModel({ url, systemId, selectedIds, settings, onSelect }: Props) {
  const { scene } = useGLTF(url)
  const { camera, gl, raycaster } = useThree()
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const box = new Box3().setFromObject(root)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = 3.15 / Math.max(size.x, size.y, size.z, 0.001)
    root.position.copy(center).multiplyScalar(-scale)
    root.scale.setScalar(scale)
    const meshes: { mesh: Mesh; rawName: string; nodeId: string; base: Material | Material[]; selected: Material | Material[] }[] = []

    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const rawName = structureName(object, root)
      const source = Array.isArray(object.material) ? object.material : [object.material]
      const base = source.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial && !next.vertexColors) {
          next.color.set(anatomyColor(rawName, systemId))
          next.roughness = 0.62
          next.metalness = 0
        }
        return next
      })
      const selected = base.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial) {
          next.color.set('#e26bd6')
          next.emissive.set('#5b174f')
          next.emissiveIntensity = 0.8
        }
        return next
      })
      object.material = Array.isArray(object.material) ? base : base[0]
      meshes.push({ mesh: object, rawName, nodeId: anatomyNodeId(systemId, rawName), base: object.material, selected: Array.isArray(object.material) ? selected : selected[0] })
    })
    root.updateMatrixWorld(true)
    const proxies = meshes.map((entry) => {
      const proxy = new Mesh(entry.mesh.geometry, new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }))
      proxy.matrixAutoUpdate = false
      proxy.matrix.copy(entry.mesh.matrixWorld)
      proxy.name = `hit:${entry.rawName}`
      return { proxy, rawName: entry.rawName }
    })
    return { root, meshes, proxies }
  }, [scene, systemId])

  useEffect(() => {
    const selected = new Set(selectedIds)
    prepared.meshes.forEach((entry) => {
      entry.mesh.material = selected.has(entry.nodeId) ? entry.selected : entry.base
      entry.mesh.visible = !settings.isolate || selected.size === 0 || selected.has(entry.nodeId)
      const materials = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material]
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial) {
          material.wireframe = settings.wireframe
          material.needsUpdate = true
        }
      })
      entry.mesh.renderOrder = 0
    })
  }, [prepared, selectedIds, settings.isolate, settings.wireframe])

  useEffect(() => () => {
    prepared.meshes.forEach((entry) => {
      const materials = [entry.base, entry.selected].flatMap((material) => Array.isArray(material) ? material : [material])
      materials.forEach((material) => material.dispose())
    })
    prepared.proxies.forEach(({ proxy }) => (proxy.material as Material).dispose())
  }, [prepared])

  useEffect(() => {
    let start = new Vector2()
    const pointerDown = (event: PointerEvent) => { start = new Vector2(event.clientX, event.clientY) }
    const pointerUp = (event: PointerEvent) => {
      if (start.distanceTo(new Vector2(event.clientX, event.clientY)) > 5) return
      const bounds = gl.domElement.getBoundingClientRect()
      const pointer = new Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(prepared.proxies.map((entry) => entry.proxy), false)[0]
      const selected = hit && prepared.proxies.find((entry) => entry.proxy === hit.object)
      if (selected) onSelect(createMeshSelection(systemId, selected.rawName), event.shiftKey)
    }
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointerup', pointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointerup', pointerUp)
    }
  }, [camera, gl, onSelect, prepared, raycaster, systemId])

  return <group>
    <primitive object={prepared.root} />
    {prepared.proxies.map(({ proxy }) => <primitive key={proxy.uuid} object={proxy} />)}
  </group>
}
