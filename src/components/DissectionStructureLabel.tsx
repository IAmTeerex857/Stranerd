import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Group, Mesh, Vector3 } from 'three'

export function DissectionStructureLabel({ mesh, label }: { mesh: Mesh; label: string }) {
  const anchor = useRef<Group>(null)
  const center = useRef(new Vector3())

  useFrame(() => {
    const group = anchor.current
    if (!group?.parent) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    mesh.geometry.boundingBox?.getCenter(center.current)
    mesh.localToWorld(center.current)
    group.position.copy(group.parent.worldToLocal(center.current))
  })

  return <group ref={anchor}>
    <Html center distanceFactor={7} zIndexRange={[12, 1]}>
      <span className="dissection-structure-label">{label}</span>
    </Html>
  </group>
}
