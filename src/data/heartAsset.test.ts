import { readFile, stat } from 'node:fs/promises'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { describe, expect, it } from 'vitest'

type Structure = { id: string; meshName: string | null; parent: string | null; children: string[] }
type Metadata = { schemaVersion: number; subject: string; structures: Structure[] }

const metadataPath = 'public/models/heart/heart-structures.json'
const variants = ['public/models/heart/heart-desktop.glb', 'public/models/heart/heart-mobile.glb']

async function loadMetadata() {
  return JSON.parse(await readFile(metadataPath, 'utf8')) as Metadata
}

describe('HuBMAP heart production assets', () => {
  it('has a valid stable hierarchy and complete mesh mapping', async () => {
    const metadata = await loadMetadata()
    const ids = metadata.structures.map((structure) => structure.id)
    const idSet = new Set(ids)

    expect(metadata.schemaVersion).toBe(1)
    expect(metadata.subject).toBe('heart')
    expect(metadata.structures).toHaveLength(18)
    expect(metadata.structures.filter((structure) => structure.meshName)).toHaveLength(14)
    expect(idSet.size).toBe(ids.length)

    for (const structure of metadata.structures) {
      if (structure.parent) expect(idSet.has(structure.parent)).toBe(true)
      for (const child of structure.children) expect(idSet.has(child)).toBe(true)
    }
  })

  it('preserves mesh names and ontology IDs across desktop and mobile', async () => {
    await MeshoptDecoder.ready
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const metadata = await loadMetadata()
    const mapped = metadata.structures.filter((structure): structure is Structure & { meshName: string } => Boolean(structure.meshName))

    for (const path of variants) {
      const document = await io.read(path)
      const meshNodes = new Map(document.getRoot().listNodes().filter((node) => node.getMesh()).map((node) => [node.getName(), node]))
      expect(meshNodes.size).toBe(14)
      for (const structure of mapped) {
        expect(meshNodes.get(structure.meshName)?.getExtras().ontologyid).toBe(structure.id)
      }
    }
  })

  it('meets desktop and mobile file budgets', async () => {
    const [desktop, mobile] = await Promise.all(variants.map((path) => stat(path)))
    expect(desktop.size).toBeLessThanOrEqual(3_000_000)
    expect(mobile.size).toBeLessThan(desktop.size)
  })
})
