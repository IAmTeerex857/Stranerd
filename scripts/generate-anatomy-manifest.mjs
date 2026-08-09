import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const modelsDir = path.join(root, 'public/models')
const bodySystems = new Map(['skin', 'muscular', 'skeleton', 'cardiovascular', 'nervous', 'organs'].map((id) => [`body/${id}.glb`, id]))
const specimenSystems = { heart: 'cardiovascular', brain: 'nervous', lungs: 'organs', kidney: 'organs', eye: 'nervous', liver: 'organs', 'nervous-system': 'nervous', skin: 'skin', 'digestive-system': 'organs' }
const normalize = (value) => value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const slug = (value) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

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
    const label = typeof extras.label === 'string' && extras.label.trim() ? extras.label : node.getName()
    if (!label || /^(rootnode|scene|mesh|node)([_.-]?\d+)?$/i.test(label)) continue
    const id = typeof extras.ontologyid === 'string' && extras.ontologyid.trim() ? extras.ontologyid.trim() : `anatomy:${systemId}:${slug(label.replace(/_\d+$/, ''))}`
    ids.add(id)
  }
  assets.push({ file: `/models/${file}`, systemId, structureIds: [...ids].sort() })
}
await writeFile(path.join(root, 'src/data/anatomyAssetManifest.json'), `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), assets }, null, 2)}\n`)
console.log(`Wrote ${assets.length} assets with ${assets.reduce((total, asset) => total + asset.structureIds.length, 0)} structure IDs.`)
