import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const modelsDir = path.join(root, 'public/models')
const bodySystems = new Map(['skin', 'muscular', 'skeleton', 'cardiovascular', 'nervous', 'organs'].map((id) => [`body/${id}.glb`, id]))
const specimenSystems = { heart: 'cardiovascular', brain: 'nervous', lungs: 'organs', kidney: 'organs', eye: 'nervous', liver: 'organs', 'nervous-system': 'nervous', skin: 'skin', 'digestive-system': 'organs' }
const normalizeStructureName = (value) => value
  .replace(/(?:[._ -]?\d+)?[._ -]?instance$/i, '')
  .replace(/_\d+$/i, '')
  .replace(/\s+/g, ' ')
  .trim()
const slug = (value) => normalizeStructureName(value).toLowerCase().replace(/\.l$/i, '-left').replace(/\.r$/i, '-right').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const genericName = /^(rootnode|scene|mesh|node)([_.-]?\d+)?$/i

function structureName(node) {
  const extras = node.getExtras() ?? {}
  if (typeof extras.label === 'string' && extras.label.trim()) return normalizeStructureName(extras.label)
  let current = node
  while (current) {
    const name = current.getName().trim()
    if (name && !genericName.test(name)) return normalizeStructureName(name)
    current = current.getParentNode()
  }
  return ''
}

async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const result = []
  for (const entry of entries) entry.isDirectory() ? result.push(...await files(path.join(directory, entry.name), `${prefix}${entry.name}/`)) : result.push(`${prefix}${entry.name}`)
  return result
}

const candidates = (await files(modelsDir)).filter((file) => bodySystems.has(file) || file.endsWith('-segmented.glb'))
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const assets = []
for (const file of candidates.sort()) {
  const document = await io.read(path.join(modelsDir, file))
  const systemId = bodySystems.get(file) ?? specimenSystems[file.replace(/-segmented\.glb$/, '')]
  if (!systemId) continue
  const ids = new Set()
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue
    const extras = node.getExtras() ?? {}
    const label = structureName(node)
    if (!label) continue
    const id = typeof extras.ontologyid === 'string' && extras.ontologyid.trim() ? extras.ontologyid.trim() : `anatomy:${systemId}:${slug(label)}`
    ids.add(id)
  }
  assets.push({ file: `/models/${file}`, systemId, structureIds: [...ids].sort() })
}
await writeFile(path.join(root, 'src/data/anatomyAssetManifest.json'), `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), assets }, null, 2)}\n`)
console.log(`Wrote ${assets.length} assets with ${assets.reduce((total, asset) => total + asset.structureIds.length, 0)} structure IDs.`)
