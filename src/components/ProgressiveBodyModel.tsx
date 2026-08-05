import { Suspense, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Mesh, MeshStandardMaterial, Object3D, type Material } from 'three'
import { anatomyNodeId, createMeshSelection } from '../data/anatomyGraph'
import type { AnatomyLayer, Hotspot, Settings } from '../types'

type Props = {
  layers: AnatomyLayer[]
  visibleLayerIds: string[]
  selectedIds: string[]
  settings: Settings
  onSelect: (hotspot: Hotspot, multi: boolean) => void
}

function structureName(object: Object3D, root: Object3D) {
  const candidates: string[] = []
  let current: Object3D | null = object
  while (current && current !== root) {
    const name = current.name.trim()
    if (name && !/^(rootnode|scene|mesh|node)([_.-]?\d+)?$/i.test(name)) candidates.push(name)
    current = current.parent
  }
  if (candidates.length > 1 && new RegExp(`^${candidates[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d+$`).test(candidates[0])) return candidates[1]
  return candidates[0]?.replace(/_\d+$/, '') || 'Anatomical structure'
}

function cloneMaterial(material: Material, color: string) {
  const next = material.clone()
  if (next instanceof MeshStandardMaterial && !next.vertexColors) next.color.set(color)
  return next
}

function BodyLayer({ layer, visible, interactive, selectedIds, settings, onSelect }: Omit<Props, 'layers' | 'visibleLayerIds'> & { layer: AnatomyLayer; visible: boolean; interactive: boolean }) {
  const { scene } = useGLTF(layer.file)
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const baseMaterials = new Map<Material, Material>()
    const selectedMaterials = new Map<Material, Material>()
    const meshes: { mesh: Mesh; nodeId: string; baseMaterial: Material | Material[] }[] = []

    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const rawName = structureName(object, root)
      const originals = Array.isArray(object.material) ? object.material : [object.material]
      const bases = originals.map((material) => {
        let base = baseMaterials.get(material)
        if (!base) {
          base = cloneMaterial(material, layer.color)
          baseMaterials.set(material, base)
          const selected = cloneMaterial(base, '#e26bd6')
          if (selected instanceof MeshStandardMaterial) {
            selected.emissive.set('#5b174f')
            selected.emissiveIntensity = 0.8
          }
          selectedMaterials.set(base, selected)
        }
        return base
      })
      object.material = Array.isArray(object.material) ? bases : bases[0]
      meshes.push({ mesh: object, nodeId: anatomyNodeId(layer.id, rawName), baseMaterial: object.material })
    })

    return { root, meshes, baseMaterials: [...baseMaterials.values()], selectedMaterials }
  }, [layer.color, layer.id, scene])

  useEffect(() => {
    const selected = new Set(selectedIds)
    prepared.meshes.forEach(({ mesh, nodeId, baseMaterial }) => {
      const bases = Array.isArray(baseMaterial) ? baseMaterial : [baseMaterial]
      const materials = bases.map((material) => selected.has(nodeId) ? prepared.selectedMaterials.get(material) ?? material : material)
      mesh.material = Array.isArray(baseMaterial) ? materials : materials[0]
      mesh.visible = !settings.isolate || selected.size === 0 || selected.has(nodeId)
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial) {
          material.wireframe = settings.wireframe
          material.needsUpdate = true
        }
      })
    })
  }, [prepared, selectedIds, settings.isolate, settings.wireframe])

  useEffect(() => () => {
    prepared.baseMaterials.forEach((material) => material.dispose())
    prepared.selectedMaterials.forEach((material) => material.dispose())
  }, [prepared])

  return (
    <primitive
      object={prepared.root}
      visible={visible}
      onClick={interactive ? (event: { object: Object3D; stopPropagation: () => void; nativeEvent: MouseEvent }) => {
        event.stopPropagation()
        onSelect(createMeshSelection(layer.id, structureName(event.object, prepared.root)), event.nativeEvent.shiftKey)
      } : undefined}
      onPointerOver={interactive ? (event: { stopPropagation: () => void }) => { event.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={interactive ? () => { document.body.style.cursor = '' } : undefined}
    />
  )
}

export function ProgressiveBodyModel({ layers, visibleLayerIds, selectedIds, settings, onSelect }: Props) {
  const visibleCount = visibleLayerIds.length
  return (
    <group position={[0, -1.62, 0]} scale={1.8}>
      {layers.map((layer) => {
        const bodyLayer = <BodyLayer
          key={layer.id}
          layer={layer}
          visible={visibleLayerIds.includes(layer.id)}
          interactive={visibleLayerIds.includes(layer.id) && (layer.id !== 'skin' || visibleCount === 1)}
          selectedIds={selectedIds}
          settings={settings}
          onSelect={onSelect}
        />
        return layer.defaultVisible ? bodyLayer : <Suspense key={layer.id} fallback={null}>{bodyLayer}</Suspense>
      })}
    </group>
  )
}
