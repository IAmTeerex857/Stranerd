import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, simplify } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

const root = fileURLToPath(new URL('..', import.meta.url))
const paths = {
  source: `${root}/public/models/evaluation/heart-hubmap-female-v1.3.glb`,
  crosswalk: `${root}/scripts/sources/heart-hubmap-female-v1.3-crosswalk.csv`,
  outputDirectory: `${root}/public/models/heart`,
  desktop: `${root}/public/models/heart/heart-desktop.glb`,
  mobile: `${root}/public/models/heart/heart-mobile.glb`,
  metadata: `${root}/public/models/heart/heart-structures.json`,
}

const source = {
  name: 'HuBMAP Human Reference Atlas',
  object: '3D Reference Organ for Heart, Female v1.3',
  hubmapId: 'HBM449.SHRV.225',
  version: 'v1.3',
  created: '2024-06-15',
  license: 'CC BY 4.0',
  assetUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/heart-female/v1.3/assets/3d-vh-f-heart.glb',
  crosswalkUrl: 'https://cdn.humanatlas.io/digital-objects/ref-organ/heart-female/v1.3/assets/crosswalk.csv',
  metadataUrl: 'https://raw.githubusercontent.com/hubmapconsortium/hra-kg/v2.5/digital-objects/ref-organ/heart-female/v1.3/raw/metadata.yaml',
  sha256: '98f66e46b149bfc3836592d9404c50290e21d302ec55c98813435e2d9847b1d9',
}

const hierarchyOverrides = new Map([
  ['VH_F_cardiac_chamber', { id: 'UBERON:0004151', label: 'cardiac chamber' }],
])

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready])

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

function parseCrosswalk(text) {
  const rows = text.trim().split(/\r?\n/).slice(1).map((line) => {
    const first = line.indexOf(',')
    const second = line.indexOf(',', first + 1)
    return { nodeName: line.slice(0, first), id: line.slice(first + 1, second), label: line.slice(second + 1) }
  })
  return new Map([...rows.map((row) => [row.nodeName, row]), ...hierarchyOverrides])
}

function displayName(label) {
  const normalized = label.replace(/^heart /, '')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function mappedParent(node, crosswalk) {
  for (let parent = node.getParentNode(); parent; parent = parent.getParentNode()) {
    const entry = crosswalk.get(parent.getName())
    if (entry) return entry.id
  }
  return null
}

function buildMetadata(document, crosswalk) {
  const mappedNodes = document.getRoot().listNodes().filter((node) => crosswalk.has(node.getName()))
  const structures = mappedNodes.map((node) => {
    const entry = crosswalk.get(node.getName())
    const mesh = node.getMesh()
    const extras = node.getExtras()
    if (mesh && extras.ontologyid !== entry.id) {
      throw new Error(`${node.getName()}: GLB ontology ID ${extras.ontologyid || 'missing'} does not match ${entry.id}.`)
    }
    const parent = mappedParent(node, crosswalk)
    return {
      id: entry.id,
      name: displayName(entry.label),
      meshName: mesh ? node.getName() : null,
      parent,
      children: [],
      aliases: [],
      system: 'cardiovascular',
    }
  })

  const byId = new Map(structures.map((entry) => [entry.id, entry]))
  for (const entry of structures) if (entry.parent) byId.get(entry.parent)?.children.push(entry.id)
  const ids = structures.map((entry) => entry.id)
  if (new Set(ids).size !== ids.length) throw new Error('The source crosswalk contains duplicate stable IDs.')

  return {
    schemaVersion: 1,
    subject: 'heart',
    source,
    transforms: { normalized: false, sourceTransformsPreserved: true },
    structures,
  }
}

function applyMaterials(document) {
  const materials = {
    chamber: document.createMaterial('Cardiac chamber').setBaseColorFactor([0.55, 0.075, 0.09, 1]).setRoughnessFactor(0.48).setMetallicFactor(0),
    septum: document.createMaterial('Interventricular septum').setBaseColorFactor([0.68, 0.16, 0.14, 1]).setRoughnessFactor(0.55).setMetallicFactor(0),
    papillary: document.createMaterial('Papillary muscle').setBaseColorFactor([0.72, 0.24, 0.19, 1]).setRoughnessFactor(0.58).setMetallicFactor(0),
    valve: document.createMaterial('Heart valve').setBaseColorFactor([0.86, 0.67, 0.52, 1]).setRoughnessFactor(0.62).setMetallicFactor(0),
  }

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const name = node.getName()
    const material = name.includes('_valve') ? materials.valve
      : name.includes('papillary_muscle') ? materials.papillary
        : name.includes('septum') ? materials.septum
          : materials.chamber
    mesh.listPrimitives().forEach((primitive) => primitive.setMaterial(material))
  }
}

function modelStats(document) {
  const nodes = document.getRoot().listNodes()
  const primitives = document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives())
  return {
    meshNodes: nodes.filter((node) => node.getMesh()).length,
    vertices: primitives.reduce((count, primitive) => count + (primitive.getAttribute('POSITION')?.getCount() ?? 0), 0),
    triangles: primitives.reduce((count, primitive) => count + (primitive.getIndices()?.getCount() ?? 0) / 3, 0),
  }
}

async function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

async function downloadSources() {
  const [assetResponse, crosswalkResponse] = await Promise.all([fetch(source.assetUrl), fetch(source.crosswalkUrl)])
  if (!assetResponse.ok) throw new Error(`Unable to download GLB: HTTP ${assetResponse.status}.`)
  if (!crosswalkResponse.ok) throw new Error(`Unable to download crosswalk: HTTP ${crosswalkResponse.status}.`)
  const asset = Buffer.from(await assetResponse.arrayBuffer())
  const hash = await sha256(asset)
  if (hash !== source.sha256) throw new Error(`Source SHA-256 changed: expected ${source.sha256}, received ${hash}.`)
  await Promise.all([writeFile(paths.source, asset), writeFile(paths.crosswalk, await crosswalkResponse.text())])
}

async function validateSource() {
  const asset = await readFile(paths.source)
  const hash = await sha256(asset)
  if (hash !== source.sha256) throw new Error(`Local source SHA-256 mismatch: expected ${source.sha256}, received ${hash}.`)
  const crosswalk = parseCrosswalk(await readFile(paths.crosswalk, 'utf8'))
  const document = await io.read(paths.source)
  const metadata = buildMetadata(document, crosswalk)
  if (metadata.structures.filter((entry) => entry.meshName).length !== 14) throw new Error('Expected 14 ontology-linked mesh nodes.')
  return { crosswalk, metadata }
}

async function writeVariant(output, mobile) {
  const document = await io.read(paths.source)
  applyMaterials(document)
  if (mobile) await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 0.65, error: 0.002 }))
  await document.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  await io.write(output, document)
  return { ...modelStats(document), bytes: (await stat(output)).size }
}

async function validateOutputs(expectedMetadata) {
  const storedMetadata = JSON.parse(await readFile(paths.metadata, 'utf8'))
  const expectedIds = expectedMetadata.structures.map((entry) => entry.id).sort()
  const storedIds = storedMetadata.structures.map((entry) => entry.id).sort()
  if (JSON.stringify(expectedIds) !== JSON.stringify(storedIds)) throw new Error('Generated metadata IDs do not match the pinned source.')

  for (const path of [paths.desktop, paths.mobile]) {
    const document = await io.read(path)
    const meshNodes = new Map(document.getRoot().listNodes().filter((node) => node.getMesh()).map((node) => [node.getName(), node]))
    for (const structure of storedMetadata.structures.filter((entry) => entry.meshName)) {
      const node = meshNodes.get(structure.meshName)
      if (!node) throw new Error(`${path}: missing mesh ${structure.meshName}.`)
      if (node.getExtras().ontologyid !== structure.id) throw new Error(`${path}: ontology mismatch for ${structure.meshName}.`)
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--download')) await downloadSources()
  const { metadata } = await validateSource()

  if (!args.has('--validate-only')) {
    await mkdir(paths.outputDirectory, { recursive: true })
    const [desktop, mobile] = await Promise.all([writeVariant(paths.desktop, false), writeVariant(paths.mobile, true)])
    await writeFile(paths.metadata, `${JSON.stringify(metadata, null, 2)}\n`)
    console.log('Generated HuBMAP heart assets:', { desktop, mobile })
  }

  await validateOutputs(metadata)
  console.log('Validated 18 stable structures and 14 selectable meshes in desktop and mobile assets.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
