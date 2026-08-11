import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Mesh, MeshStandardMaterial, Object3D, Plane, Vector3, type Material } from 'three'
import { anatomyNodeId, createMeshSelection } from '../data/anatomyGraph'
import type { AnatomyLayer, Hotspot, Settings } from '../types'
import { anatomyMovementId, type DissectionSnapshot } from '../data/dissection'
import { DissectionStructureLabel } from './DissectionStructureLabel'

type Props = {
  layers: AnatomyLayer[]
  visibleLayerIds: string[]
  selectedIds: string[]
  settings: Settings
  onSelect: (hotspot: Hotspot, multi: boolean) => void
  dissection?: DissectionSnapshot
  onStructures?: (structures: Hotspot[]) => void
  onMoveStart?: () => void
  onMove?: (nodeId: string, offset: [number, number, number]) => void
  onMoveEnd?: (nodeId: string) => void
  touchMoveEnabled?: boolean
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

function BodyLayer({ layer, visible, interactive, selectedIds, settings, onSelect, dissection, onStructures, onMoveStart, onMove, onMoveEnd, touchMoveEnabled }: Omit<Props, 'layers' | 'visibleLayerIds' | 'onStructures'> & { layer: AnatomyLayer; visible: boolean; interactive: boolean; onStructures: (layerId: string, structures: Hotspot[]) => void }) {
  const { scene } = useGLTF(layer.file)
  const { camera, controls, invalidate } = useThree()
  const drag = useRef<{ nodeId: string; movementId: string; mesh: Mesh; plane: Plane; startPoint: Vector3; startOffset: Vector3; startClient: [number, number]; pointerId: number; moved: boolean } | undefined>(undefined)
  const suppressClick = useRef(false)
  const controlsRef = useRef<{ enabled: boolean } | null>(null)
  useEffect(() => {
    controlsRef.current = controls && 'enabled' in controls ? controls as unknown as { enabled: boolean } : null
  }, [controls])
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const baseMaterials = new Map<Material, Material>()
    const selectedMaterials = new Map<Material, Material>()
    const transparentMaterials = new Map<Material, Material>()
    const selectedTransparentMaterials = new Map<Material, Material>()
    const meshes: { mesh: Mesh; nodeId: string; movementId: string; rawName: string; originalPosition: Vector3; baseMaterial: Material | Material[] }[] = []
    const movementCounts = new Map<string, number>()

    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const rawName = structureName(object, root)
      const originals = Array.isArray(object.material) ? object.material : [object.material]
      const bases = originals.map((material) => {
        let base = baseMaterials.get(material)
        if (!base) {
          base = cloneMaterial(material, layer.color)
          baseMaterials.set(material, base)
          const selected = base.clone()
          if (selected instanceof MeshStandardMaterial) {
            selected.emissive.set('#ff4fdd')
            selected.emissiveIntensity = 1.5
          }
          selectedMaterials.set(base, selected)
          const transparent = base.clone()
          if (transparent instanceof MeshStandardMaterial) {
            transparent.opacity = 0.14
            transparent.transparent = true
            transparent.depthWrite = false
          }
          transparentMaterials.set(base, transparent)
          const selectedTransparent = selected.clone()
          if (selectedTransparent instanceof MeshStandardMaterial) {
            selectedTransparent.opacity = 0.45
            selectedTransparent.transparent = true
            selectedTransparent.depthWrite = false
          }
          selectedTransparentMaterials.set(base, selectedTransparent)
        }
        return base
      })
      object.material = Array.isArray(object.material) ? bases : bases[0]
      const nodeId = anatomyNodeId(layer.id, rawName)
      const movementIndex = movementCounts.get(nodeId) ?? 0
      movementCounts.set(nodeId, movementIndex + 1)
      meshes.push({ mesh: object, nodeId, movementId: anatomyMovementId(nodeId, String(movementIndex)), rawName, originalPosition: object.position.clone(), baseMaterial: object.material })
    })

    const structures = [...new Map(meshes.map((entry) => {
      const selection = createMeshSelection(layer.id, entry.rawName)
      return [selection.id, selection]
    })).values()]
    const labelMeshes = [...new Map(meshes
      .sort((left, right) => {
        left.mesh.geometry.computeBoundingBox()
        right.mesh.geometry.computeBoundingBox()
        const leftSize = left.mesh.geometry.boundingBox?.getSize(new Vector3()).lengthSq() ?? 0
        const rightSize = right.mesh.geometry.boundingBox?.getSize(new Vector3()).lengthSq() ?? 0
        return rightSize - leftSize
      })
      .map((entry) => [entry.nodeId, entry])).values()]
    return { root, meshes, structures, labelMeshes, baseMaterials: [...baseMaterials.values()], selectedMaterials, transparentMaterials, selectedTransparentMaterials }
  }, [layer.color, layer.id, scene])

  useEffect(() => {
    onStructures(layer.id, prepared.structures)
  }, [layer.id, onStructures, prepared.structures])

  useEffect(() => {
    const selected = new Set(selectedIds)
    const hidden = new Set(dissection?.hiddenIds ?? [])
    const transparent = new Set(dissection?.transparentIds ?? [])
    const isolate = settings.isolate || Boolean(dissection?.isolate)
    prepared.meshes.forEach(({ mesh, nodeId, movementId, originalPosition, baseMaterial }) => {
      const bases = Array.isArray(baseMaterial) ? baseMaterial : [baseMaterial]
      const materials = bases.map((material) => selected.has(nodeId)
        ? transparent.has(nodeId) ? prepared.selectedTransparentMaterials.get(material) ?? material : prepared.selectedMaterials.get(material) ?? material
        : transparent.has(nodeId) ? prepared.transparentMaterials.get(material) ?? material : material)
      mesh.material = Array.isArray(baseMaterial) ? materials : materials[0]
      const offset = dissection?.offsets[movementId] ?? dissection?.offsets[nodeId] ?? [0, 0, 0]
      mesh.position.copy(originalPosition).add(new Vector3(...offset))
      mesh.visible = !hidden.has(nodeId) && (!isolate || selected.size === 0 || selected.has(nodeId))
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial) {
          material.wireframe = settings.wireframe
          material.needsUpdate = true
        }
      })
    })
    prepared.root.updateMatrixWorld(true)
    invalidate()
  }, [dissection, invalidate, layer.id, prepared, selectedIds, settings.isolate, settings.wireframe])

  useEffect(() => () => {
    prepared.baseMaterials.forEach((material) => material.dispose())
    prepared.selectedMaterials.forEach((material) => material.dispose())
    prepared.transparentMaterials.forEach((material) => material.dispose())
    prepared.selectedTransparentMaterials.forEach((material) => material.dispose())
  }, [prepared])

  function pointerDown(event: ThreeEvent<PointerEvent>) {
    if (!dissection || !interactive || !(event.object instanceof Mesh)) return
    if (event.nativeEvent.pointerType === 'touch' && !touchMoveEnabled) return
    const rawName = structureName(event.object, prepared.root)
    const nodeId = anatomyNodeId(layer.id, rawName)
    const entry = prepared.meshes.find((candidate) => candidate.mesh === event.object)
    if (!entry) return
    drag.current = {
      nodeId,
      movementId: entry.movementId,
      mesh: entry.mesh,
      plane: new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), event.point),
      startPoint: event.point.clone(),
      startOffset: new Vector3(...(dissection?.offsets[entry.movementId] ?? dissection?.offsets[entry.nodeId] ?? [0, 0, 0])),
      startClient: [event.nativeEvent.clientX, event.nativeEvent.clientY],
      pointerId: event.pointerId,
      moved: false,
    }
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
    event.stopPropagation()
  }

  function pointerMove(event: ThreeEvent<PointerEvent>) {
    const active = drag.current
    if (!active || Math.hypot(event.nativeEvent.clientX - active.startClient[0], event.nativeEvent.clientY - active.startClient[1]) <= 5) return
    if (!active.moved) {
      active.moved = true
      onMoveStart?.()
      if (controlsRef.current) controlsRef.current.enabled = false
    }
    const target = event.ray.intersectPlane(active.plane, new Vector3())
    const parent = active.mesh.parent
    if (!target || !parent) return
    const localStart = parent.worldToLocal(active.startPoint.clone())
    const localTarget = parent.worldToLocal(target.clone())
    const offset = active.startOffset.clone().add(localTarget.sub(localStart))
    onMove?.(active.movementId, [offset.x, offset.y, offset.z])
    event.stopPropagation()
  }

  function pointerUp(event: ThreeEvent<PointerEvent>) {
    if (drag.current?.moved) {
      suppressClick.current = true
      onMoveEnd?.(drag.current.nodeId)
    }
    if (drag.current) (event.target as HTMLElement).releasePointerCapture?.(drag.current.pointerId)
    drag.current = undefined
    if (controlsRef.current) controlsRef.current.enabled = true
  }

  return <group>
    <primitive
      object={prepared.root}
      visible={visible}
      onClick={interactive ? (event: { object: Object3D; stopPropagation: () => void; nativeEvent: MouseEvent }) => {
        event.stopPropagation()
        if (suppressClick.current) {
          suppressClick.current = false
          return
        }
        onSelect(createMeshSelection(layer.id, structureName(event.object, prepared.root)), event.nativeEvent.shiftKey)
      } : undefined}
      onPointerDown={interactive ? pointerDown : undefined}
      onPointerMove={interactive ? pointerMove : undefined}
      onPointerUp={interactive ? pointerUp : undefined}
      onPointerOver={interactive ? (event: { stopPropagation: () => void }) => { event.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={interactive ? () => { document.body.style.cursor = '' } : undefined}
    />
    {prepared.labelMeshes
      .filter((entry) => selectedIds.includes(entry.nodeId) && !dissection?.hiddenIds.includes(entry.nodeId))
      .map((entry) => <DissectionStructureLabel key={entry.nodeId} mesh={entry.mesh} label={createMeshSelection(layer.id, entry.rawName).label} />)}
  </group>
}

export function ProgressiveBodyModel({ layers, visibleLayerIds, selectedIds, settings, onSelect, dissection, onStructures, onMoveStart, onMove, onMoveEnd, touchMoveEnabled }: Props) {
  const visibleCount = visibleLayerIds.length
  const structuresByLayer = useRef(new Map<string, Hotspot[]>())
  const reportStructures = useCallback((layerId: string, structures: Hotspot[]) => {
    structuresByLayer.current.set(layerId, structures)
    const merged = [...new Map([...structuresByLayer.current.values()].flat().map((structure) => [structure.id, structure])).values()]
    onStructures?.(merged)
  }, [onStructures])
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
          dissection={dissection}
          onStructures={reportStructures}
          onMoveStart={onMoveStart}
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          touchMoveEnabled={touchMoveEnabled}
        />
        return layer.defaultVisible ? bodyLayer : <Suspense key={layer.id} fallback={null}>{bodyLayer}</Suspense>
      })}
    </group>
  )
}
