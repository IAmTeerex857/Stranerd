import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Plane, Vector2, Vector3, type Material } from 'three'
import { useThree } from '@react-three/fiber'
import { anatomyNodeId, createMeshSelection, normalizeStructureName } from '../data/anatomyGraph'
import { segmentedMaterialProfile } from '../data/anatomyMaterials'
import { anatomyMovementId, type DissectionSnapshot } from '../data/dissection'
import type { AnatomySystemId, Hotspot, Settings } from '../types'
import { DissectionStructureLabel } from './DissectionStructureLabel'

function structureName(object: Object3D, root: Object3D) {
  if (typeof object.userData.label === 'string' && object.userData.label.trim()) return normalizeStructureName(object.userData.label)
  let current: Object3D | null = object
  while (current && current !== root) {
    const name = current.name.trim()
    if (name && !/^(rootnode|scene|mesh|node)([_.-]?\d+)?$/i.test(name)) return normalizeStructureName(name)
    current = current.parent
  }
  return 'Anatomical structure'
}

function structureId(object: Object3D, systemId: AnatomySystemId, name: string) {
  for (const key of ['ontologyid', 'conceptId', 'sourceId'] as const) {
    const value = object.userData[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return anatomyNodeId(systemId, name)
}

type Props = {
  url: string
  systemId: AnatomySystemId
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

export function SegmentedSpecimenModel({ url, systemId, selectedIds, settings, onSelect, dissection, onStructures, onMoveStart, onMove, onMoveEnd, touchMoveEnabled }: Props) {
  const { scene } = useGLTF(url)
  const { camera, controls, gl, invalidate, raycaster } = useThree()
  const interaction = useRef({ onSelect, onMoveStart, onMove, onMoveEnd, selectedIds, offsets: dissection?.offsets ?? {}, enabled: Boolean(dissection), touchMoveEnabled })
  useEffect(() => {
    interaction.current = { onSelect, onMoveStart, onMove, onMoveEnd, selectedIds, offsets: dissection?.offsets ?? {}, enabled: Boolean(dissection), touchMoveEnabled }
  }, [dissection, onMove, onMoveEnd, onMoveStart, onSelect, selectedIds, touchMoveEnabled])
  const prepared = useMemo(() => {
    const root = scene.clone(true)
    const box = new Box3().setFromObject(root)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = 3.15 / Math.max(size.x, size.y, size.z, 0.001)
    root.position.copy(center).multiplyScalar(-scale)
    root.scale.setScalar(scale)
    const meshes: { mesh: Mesh; rawName: string; nodeId: string; movementId: string; renderOrder: number; originalPosition: Vector3; base: Material | Material[]; selected: Material | Material[]; transparent: Material | Material[]; selectedTransparent: Material | Material[] }[] = []
    const movementCounts = new Map<string, number>()

    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const rawName = structureName(object, root)
      const profile = segmentedMaterialProfile(rawName, systemId)
      const source = Array.isArray(object.material) ? object.material : [object.material]
      const base = source.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial && !next.vertexColors) {
          next.color.set(profile.color)
          next.roughness = profile.roughness
          next.metalness = profile.metalness
          next.opacity = profile.opacity
          next.transparent = profile.opacity < 1
          next.depthWrite = profile.depthWrite
          if (profile.doubleSided) next.side = DoubleSide
        }
        return next
      })
      const selected = base.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial) {
          next.emissive.set('#ff4fdd')
          next.emissiveIntensity = 1.5
          next.opacity = 1
          next.transparent = false
          next.depthWrite = true
        }
        return next
      })
      const transparent = base.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial) {
          next.opacity = Math.min(next.opacity, 0.16)
          next.transparent = true
          next.depthWrite = false
        }
        return next
      })
      const selectedTransparent = selected.map((material) => {
        const next = material.clone()
        if (next instanceof MeshStandardMaterial) {
          next.opacity = 0.48
          next.transparent = true
          next.depthWrite = false
        }
        return next
      })
      object.material = Array.isArray(object.material) ? base : base[0]
      const nodeId = structureId(object, systemId, rawName)
      const movementIndex = movementCounts.get(nodeId) ?? 0
      movementCounts.set(nodeId, movementIndex + 1)
      meshes.push({
        mesh: object,
        rawName,
        nodeId,
        movementId: anatomyMovementId(nodeId, String(movementIndex)),
        renderOrder: profile.renderOrder,
        originalPosition: object.position.clone(),
        base: object.material,
        selected: Array.isArray(object.material) ? selected : selected[0],
        transparent: Array.isArray(object.material) ? transparent : transparent[0],
        selectedTransparent: Array.isArray(object.material) ? selectedTransparent : selectedTransparent[0],
      })
    })
    root.updateMatrixWorld(true)
    const proxies = meshes.map((entry) => {
      const proxy = new Mesh(entry.mesh.geometry, new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }))
      proxy.matrixAutoUpdate = false
      proxy.matrix.copy(entry.mesh.matrixWorld)
      proxy.name = `hit:${entry.rawName}`
      return { proxy, rawName: entry.rawName, nodeId: entry.nodeId, movementId: entry.movementId }
    })
    const structures = [...new Map(meshes.map((entry) => {
      const structure = { ...createMeshSelection(systemId, entry.rawName), id: entry.nodeId, nodeId: entry.nodeId }
      return [entry.nodeId, structure]
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
    return { root, meshes, proxies, structures, labelMeshes }
  }, [scene, systemId])

  useEffect(() => {
    onStructures?.(prepared.structures)
  }, [onStructures, prepared.structures])

  useEffect(() => {
    const selected = new Set(selectedIds)
    const hidden = new Set(dissection?.hiddenIds ?? [])
    const transparent = new Set(dissection?.transparentIds ?? [])
    const isolate = settings.isolate || Boolean(dissection?.isolate)
    prepared.meshes.forEach((entry) => {
      const isSelected = selected.has(entry.nodeId)
      const isTransparent = transparent.has(entry.nodeId)
      entry.mesh.material = isSelected
        ? isTransparent ? entry.selectedTransparent : entry.selected
        : isTransparent ? entry.transparent : entry.base
      const offset = dissection?.offsets[entry.movementId] ?? dissection?.offsets[entry.nodeId] ?? [0, 0, 0]
      entry.mesh.position.copy(entry.originalPosition).add(new Vector3(...offset))
      entry.mesh.visible = !hidden.has(entry.nodeId) && (!isolate || selected.size === 0 || isSelected)
      const materials = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material]
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial) {
          material.wireframe = settings.wireframe
          material.needsUpdate = true
        }
      })
      entry.mesh.renderOrder = isSelected ? 20 : isTransparent ? 10 : entry.renderOrder
    })
    prepared.root.updateMatrixWorld(true)
    prepared.proxies.forEach((entry) => {
      const mesh = prepared.meshes.find((candidate) => candidate.movementId === entry.movementId)?.mesh
      if (!mesh) return
      entry.proxy.matrix.copy(mesh.matrixWorld)
      entry.proxy.visible = mesh.visible
    })
    invalidate()
  }, [dissection, invalidate, prepared, selectedIds, settings.isolate, settings.wireframe])

  useEffect(() => () => {
    prepared.meshes.forEach((entry) => {
      const materials = [entry.base, entry.selected, entry.transparent, entry.selectedTransparent].flatMap((material) => Array.isArray(material) ? material : [material])
      materials.forEach((material) => material.dispose())
    })
    prepared.proxies.forEach(({ proxy }) => (proxy.material as Material).dispose())
  }, [prepared])

  useEffect(() => {
    let start = new Vector2()
    let drag: { nodeId: string; movementId: string; mesh: Mesh; plane: Plane; startPoint: Vector3; startOffset: Vector3; moved: boolean } | undefined
    const pointerPosition = (event: PointerEvent) => {
      const bounds = gl.domElement.getBoundingClientRect()
      return new Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
    }
    const pointerDown = (event: PointerEvent) => {
      start = new Vector2(event.clientX, event.clientY)
      if (!interaction.current.enabled) return
      if (event.pointerType === 'touch' && !interaction.current.touchMoveEnabled) return
      raycaster.setFromCamera(pointerPosition(event), camera)
      const hit = raycaster.intersectObjects(prepared.proxies.filter((entry) => entry.proxy.visible).map((entry) => entry.proxy), false)[0]
      const candidate = hit && prepared.proxies.find((entry) => entry.proxy === hit.object)
      const meshEntry = candidate && prepared.meshes.find((entry) => entry.movementId === candidate.movementId)
      if (!candidate || !meshEntry) return
      drag = {
        nodeId: candidate.nodeId,
        movementId: candidate.movementId,
        mesh: meshEntry.mesh,
        plane: new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), hit.point),
        startPoint: hit.point.clone(),
        startOffset: new Vector3(...(interaction.current.offsets[candidate.movementId] ?? interaction.current.offsets[candidate.nodeId] ?? [0, 0, 0])),
        moved: false,
      }
      canvas.setPointerCapture?.(event.pointerId)
      if (controls && 'enabled' in controls) controls.enabled = false
    }
    const pointerMove = (event: PointerEvent) => {
      if (!drag || start.distanceTo(new Vector2(event.clientX, event.clientY)) <= 5) return
      if (!drag.moved) {
        drag.moved = true
        interaction.current.onMoveStart?.()
      }
      raycaster.setFromCamera(pointerPosition(event), camera)
      const target = raycaster.ray.intersectPlane(drag.plane, new Vector3())
      const parent = drag.mesh.parent
      if (!target || !parent) return
      const localStart = parent.worldToLocal(drag.startPoint.clone())
      const localTarget = parent.worldToLocal(target.clone())
      const offset = drag.startOffset.clone().add(localTarget.sub(localStart))
      interaction.current.onMove?.(drag.movementId, [offset.x, offset.y, offset.z])
      event.preventDefault()
    }
    const finishDrag = (event: PointerEvent, cancelled = false) => {
      if (drag?.moved && !cancelled) interaction.current.onMoveEnd?.(drag.nodeId)
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture?.(event.pointerId)
      if (controls && 'enabled' in controls) controls.enabled = true
      const moved = drag?.moved
      drag = undefined
      return moved
    }
    const pointerUp = (event: PointerEvent) => {
      if (drag?.moved) {
        finishDrag(event)
        return
      }
      finishDrag(event)
      if (start.distanceTo(new Vector2(event.clientX, event.clientY)) > 5) return
      raycaster.setFromCamera(pointerPosition(event), camera)
      const candidates: typeof prepared.proxies = []
      for (const hit of raycaster.intersectObjects(prepared.proxies.filter((entry) => entry.proxy.visible).map((entry) => entry.proxy), false)) {
        const candidate = prepared.proxies.find((entry) => entry.proxy === hit.object)
        if (candidate && !candidates.some((entry) => entry.nodeId === candidate.nodeId)) candidates.push(candidate)
      }
      let selected = candidates[0]
      if (event.shiftKey) {
        selected = candidates.find((entry) => !interaction.current.selectedIds.includes(entry.nodeId)) ?? selected
      } else if (interaction.current.selectedIds.length === 1) {
        const currentIndex = candidates.findIndex((entry) => entry.nodeId === interaction.current.selectedIds[0])
        if (currentIndex >= 0) selected = candidates[(currentIndex + 1) % candidates.length]
      }
      if (selected) {
        const selection = createMeshSelection(systemId, selected.rawName)
        interaction.current.onSelect({ ...selection, id: selected.nodeId, nodeId: selected.nodeId }, event.shiftKey)
      }
    }
    const pointerCancel = (event: PointerEvent) => { finishDrag(event, true) }
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerCancel)
    return () => {
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerCancel)
      if (controls && 'enabled' in controls) controls.enabled = true
    }
  }, [camera, controls, gl, prepared, raycaster, systemId])

  return <group>
    <primitive object={prepared.root} />
    {prepared.proxies.map(({ proxy }) => <primitive key={proxy.uuid} object={proxy} onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()} />)}
    {prepared.labelMeshes
      .filter((entry) => selectedIds.includes(entry.nodeId) && !dissection?.hiddenIds.includes(entry.nodeId))
      .map((entry) => <DissectionStructureLabel key={entry.nodeId} mesh={entry.mesh} label={prepared.structures.find((structure) => structure.id === entry.nodeId)?.label ?? entry.rawName} />)}
  </group>
}
