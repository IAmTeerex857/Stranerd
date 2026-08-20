import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune } from '@gltf-transform/functions'
import draco3d from 'draco3d'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { VTKLoader } from 'three/examples/jsm/loaders/VTKLoader.js'

const run = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = `${root}/assets/source-models/evaluation`
const outputRoot = `${sourceRoot}/derived`
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

const downloads = [
  ['open3dmodel/overview-skeleton.glb', 'https://caskanatomy.info/open3dviewer/3dmodels/overview-skeleton/overview-skeleton.glb'],
  ['open3dmodel/pelvicfloor.glb', 'https://caskanatomy.info/open3dviewer/3dmodels/pelvicfloor/pelvicfloor.glb'],
  ['openanatomy-liver/atlasStructure.json', 'https://www.openanatomy.org/atlases/nac/liver-2014-02-20/atlasStructure.json'],
  ...liverStructuresForDownload(),
  ['bodyparts3d-heart/partof_parts_list_e.txt', 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20130619/partof_parts_list_e.txt'],
  ['bodyparts3d-heart/partof_inclusion_relation_list.txt', 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20130619/partof_inclusion_relation_list.txt'],
  ['bodyparts3d-heart/partof_element_parts.txt', 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20130619/partof_element_parts.txt'],
  ['bodyparts3d-heart/partof_BP3D_4.0_obj_99.zip', 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20130619/partof_BP3D_4.0_obj_99.zip'],
  ['z-anatomy/LymphoidOrgans100.fbx', 'https://raw.githubusercontent.com/LluisV/Z-Anatomy/PC-Version/Resources/Models/FBX/LymphoidOrgans100.fbx'],
]

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
const sourceIo = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
})

function liverStructuresForDownload() {
  return [
    'Model_18_LiverSegment_I.vtk', 'Model_15_LiverSegment_IVa.vtk', 'Model_33_LiverSegment_VIII.vtk',
    'Model_3_MainPortalVein.vtk', 'Model_4_LeftHepaticVein_and_Branches.vtk', 'Model_40_Gallbladder.vtk',
  ].map((file) => [`openanatomy-liver/${file}`, `https://www.openanatomy.org/atlases/nac/liver-2014-02-20/models/${file}`])
}

async function downloadSources() {
  for (const [relativePath, url] of downloads) {
    const output = `${sourceRoot}/${relativePath}`
    await mkdir(output.slice(0, output.lastIndexOf('/')), { recursive: true })
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Unable to download ${url}: HTTP ${response.status}.`)
    const data = Buffer.from(await response.arrayBuffer())
    await writeFile(output, data)
    console.log(`Downloaded ${relativePath} (${data.length.toLocaleString()} bytes)`)
  }
}

async function verifyPinnedSources() {
  const bodyPartsArchive = await readFile(`${sourceRoot}/bodyparts3d-heart/partof_BP3D_4.0_obj_99.zip`)
  const hash = createHash('sha256').update(bodyPartsArchive).digest('hex')
  if (hash !== '9fbc713fffeee924a5a657d9813d84d7eb957bded63adb854931dd5e3eb61c97') throw new Error(`BodyParts3D archive hash changed: ${hash}`)
}

function addGeometry(document, buffer, scene, input) {
  const position = document.createAccessor(`${input.name} positions`).setType('VEC3').setArray(input.position).setBuffer(buffer)
  const normal = document.createAccessor(`${input.name} normals`).setType('VEC3').setArray(input.normal).setBuffer(buffer)
  const primitive = document.createPrimitive().setAttribute('POSITION', position).setAttribute('NORMAL', normal)
  if (input.index) primitive.setIndices(document.createAccessor(`${input.name} indices`).setType('SCALAR').setArray(input.index).setBuffer(buffer))
  primitive.setMaterial(input.material)
  const mesh = document.createMesh(input.name).addPrimitive(primitive)
  const node = document.createNode(input.name).setMesh(mesh).setExtras(input.extras ?? {})
  input.parent ? input.parent.addChild(node) : scene.addChild(node)
  return node
}

function transformedAttribute(attribute, normal = false) {
  const result = new Float32Array(attribute.count * 3)
  for (let index = 0; index < attribute.count; index += 1) {
    const x = attribute.getX(index)
    const y = attribute.getY(index)
    const z = attribute.getZ(index)
    const scale = normal ? 1 : 0.001
    result[index * 3] = x * scale
    result[index * 3 + 1] = z * scale
    result[index * 3 + 2] = -y * scale
  }
  return result
}

function copiedAttribute(attribute) {
  const result = new Float32Array(attribute.count * 3)
  for (let index = 0; index < attribute.count; index += 1) {
    result[index * 3] = attribute.getX(index)
    result[index * 3 + 1] = attribute.getY(index)
    result[index * 3 + 2] = attribute.getZ(index)
  }
  return result
}

async function optimizeAndWrite(document, output, compress = true) {
  await document.transform(dedup(), prune(), ...(compress ? [meshopt({ encoder: MeshoptEncoder, level: 'medium' })] : []))
  await io.write(output, document)
  return (await stat(output)).size
}

async function convertOpen3DModel(inputName, outputName) {
  const document = await sourceIo.read(`${sourceRoot}/open3dmodel/${inputName}`)
  document.getRoot().listExtensionsUsed().find((extension) => extension.extensionName === 'KHR_draco_mesh_compression')?.dispose()
  for (const node of document.getRoot().listNodes()) {
    if (!node.getMesh()) continue
    node.setExtras({ ...node.getExtras(), source: 'Open3DModel', sourceName: node.getName() })
  }
  const output = `${outputRoot}/${outputName}`
  const bytes = await optimizeAndWrite(document, output)
  return { bytes, structures: document.getRoot().listNodes().filter((node) => node.getMesh()).length }
}

const liverStructures = [
  { id: 'LiverSegment_I', label: 'Liver Segment I', labelValue: 18, file: 'Model_18_LiverSegment_I.vtk', group: 'Liver segments', color: [0.8, 0.8, 0.2, 1] },
  { id: 'LiverSegment_IVa', label: 'Liver Segment IVa', labelValue: 15, file: 'Model_15_LiverSegment_IVa.vtk', group: 'Liver segments', color: [0.5, 0.2, 0.8, 1] },
  { id: 'LiverSegment_VIII', label: 'Liver Segment VIII', labelValue: 33, file: 'Model_33_LiverSegment_VIII.vtk', group: 'Liver segments', color: [0.8, 0.5, 0.2, 1] },
  { id: 'MainPortalVein', label: 'Main portal vein', labelValue: 3, file: 'Model_3_MainPortalVein.vtk', group: 'Vessels', color: [0.63, 0.63, 0.63, 1] },
  { id: 'LeftHepaticVein_and_Branches', label: 'Left hepatic vein', labelValue: 4, file: 'Model_4_LeftHepaticVein_and_Branches.vtk', group: 'Vessels', color: [0.4, 0.7, 1, 1] },
  { id: 'Gallbladder', label: 'Gallbladder', labelValue: 40, file: 'Model_40_Gallbladder.vtk', group: 'Other organs', color: [0.21, 0.39, 0.21, 1] },
]

async function buildOpenAnatomyLiver() {
  const sourceDirectory = `${sourceRoot}/openanatomy-liver`
  const document = new Document()
  const buffer = document.createBuffer()
  const scene = document.createScene('SPL Liver Atlas evaluation subset')
  const groups = new Map()
  for (const structure of liverStructures) {
    let parent = groups.get(structure.group)
    if (!parent) {
      parent = document.createNode(structure.group)
      groups.set(structure.group, parent)
      scene.addChild(parent)
    }
    const file = await readFile(`${sourceDirectory}/${structure.file}`)
    const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
    const geometry = new VTKLoader().parse(arrayBuffer)
    const material = document.createMaterial(structure.label).setBaseColorFactor(structure.color).setRoughnessFactor(0.65).setMetallicFactor(0)
    addGeometry(document, buffer, scene, {
      name: structure.label,
      position: transformedAttribute(geometry.attributes.position),
      normal: transformedAttribute(geometry.attributes.normal, true),
      index: geometry.index?.array,
      material,
      parent,
      extras: { sourceId: structure.id, labelValue: structure.labelValue, sourceFile: structure.file, authoritativeGeometry: false },
    })
  }
  const output = `${outputRoot}/openanatomy-liver-subset.glb`
  const bytes = await optimizeAndWrite(document, output)
  const metadata = {
    schemaVersion: 1,
    subject: 'liver',
    completeness: '6 of 23 atlas structures',
    source: {
      name: 'SPL Liver Atlas, Open Anatomy Project',
      authors: 'Marianna Jakab, Sonia Pujol, Kitt Shaffer, Ron Kikinis',
      url: 'https://www.openanatomy.org/atlas-pages/atlas-spl-liver.html',
      manifest: 'https://www.openanatomy.org/atlases/nac/liver-2014-02-20/atlasStructure.json',
      license: '3D Slicer License Part B',
      attribution: 'SPL Liver Atlas, Open Anatomy Project; Surgical Planning Laboratory, Brigham and Women’s Hospital/Harvard Medical School, and Boston Medical Center.',
    },
    transforms: { sourceCoordinates: 'medical RAS millimetres', targetCoordinates: 'glTF Y-up metres', mapping: '(x,y,z) -> (0.001x,0.001z,-0.001y)' },
    structures: liverStructures.map(({ color, group, ...structure }) => ({ ...structure, group, color })),
  }
  await writeFile(`${outputRoot}/openanatomy-liver-subset.json`, `${JSON.stringify(metadata, null, 2)}\n`)
  return { bytes, structures: liverStructures.length }
}

function parseRows(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/)
  const keys = header.split('\t')
  return lines.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [keys[index], value])))
}

function parseObjHeader(text) {
  const value = (label) => text.match(new RegExp(`^# ${label}\\s*:\\s*(.+)$`, 'm'))?.[1]?.trim()
  return { fileId: value('File ID'), representationId: value('Representation ID'), conceptId: value('Concept ID'), name: value('English name') }
}

const heartColors = [
  [0.76, 0.15, 0.18, 1], [0.55, 0.08, 0.12, 1], [0.9, 0.62, 0.47, 1], [0.75, 0.34, 0.27, 1],
  [0.88, 0.74, 0.57, 1], [0.66, 0.18, 0.3, 1], [0.93, 0.54, 0.2, 1], [0.48, 0.12, 0.18, 1],
]

async function buildBodyPartsHeart() {
  const sourceDirectory = `${sourceRoot}/bodyparts3d-heart`
  const parts = parseRows(await readFile(`${sourceDirectory}/partof_parts_list_e.txt`, 'utf8'))
  const elementParts = parseRows(await readFile(`${sourceDirectory}/partof_element_parts.txt`, 'utf8'))
  const heartElements = [...new Set(elementParts.filter((row) => row['concept id'] === 'FMA7088').map((row) => row['element file id']))]
  const extractedDirectory = `${sourceDirectory}/extracted`
  await mkdir(extractedDirectory, { recursive: true })
  const archive = `${sourceDirectory}/partof_BP3D_4.0_obj_99.zip`
  await run('unzip', ['-jo', archive, ...heartElements.map((id) => `partof_BP3D_4.0_obj_99/${id}.obj`), '-d', extractedDirectory])

  const document = new Document()
  const buffer = document.createBuffer()
  const scene = document.createScene('BodyParts3D heart evaluation subset')
  const rootNode = document.createNode('Heart · FMA:7088').setExtras({ conceptId: 'FMA7088', representationId: 'BP9305', source: 'BodyParts3D' })
  scene.addChild(rootNode)
  const concepts = new Map()
  const structures = []

  for (const elementId of heartElements) {
    const text = await readFile(`${extractedDirectory}/${elementId}.obj`, 'utf8')
    const header = parseObjHeader(text)
    if (!header.conceptId || !header.name) throw new Error(`${elementId}: incomplete BodyParts3D OBJ header.`)
    let concept = concepts.get(header.conceptId)
    if (!concept) {
      const part = parts.find((row) => row['concept id'] === header.conceptId)
      concept = document.createNode(`${header.name} · ${header.conceptId}`).setExtras({ conceptId: header.conceptId, representationId: header.representationId ?? part?.['representation id'], label: header.name })
      rootNode.addChild(concept)
      concepts.set(header.conceptId, concept)
      structures.push({ id: header.conceptId, representationId: header.representationId ?? part?.['representation id'], name: header.name, elements: [] })
    }
    const group = new OBJLoader().parse(text)
    const sourceMesh = group.children.find((child) => child.isMesh)
    if (!sourceMesh) throw new Error(`${elementId}: no mesh found.`)
    const geometry = sourceMesh.geometry
    const color = heartColors[structures.findIndex((entry) => entry.id === header.conceptId) % heartColors.length]
    const material = document.createMaterial(header.name).setBaseColorFactor(color).setRoughnessFactor(0.58).setMetallicFactor(0)
    addGeometry(document, buffer, scene, {
      name: `${header.name} · ${elementId}`,
      position: transformedAttribute(geometry.attributes.position),
      normal: transformedAttribute(geometry.attributes.normal, true),
      index: geometry.index?.array,
      material,
      parent: concept,
      extras: { elementId, conceptId: header.conceptId, representationId: header.representationId, label: header.name },
    })
    structures.find((entry) => entry.id === header.conceptId).elements.push(elementId)
  }

  const output = `${outputRoot}/bodyparts3d-heart.glb`
  const bytes = await optimizeAndWrite(document, output)
  const metadata = {
    schemaVersion: 1,
    subject: 'heart',
    source: {
      name: 'BodyParts3D',
      version: '4.0',
      url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html',
      license: 'CC Attribution-ShareAlike 2.1 Japan embedded in source archive; current archive page states CC BY 4.0',
      attribution: 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',
    },
    transforms: { sourceCoordinates: 'BodyParts3D millimetres', targetCoordinates: 'glTF Y-up metres', mapping: '(x,y,z) -> (0.001x,0.001z,-0.001y)' },
    assembly: { id: 'FMA7088', representationId: 'BP9305', name: 'heart' },
    structures,
  }
  await writeFile(`${outputRoot}/bodyparts3d-heart.json`, `${JSON.stringify(metadata, null, 2)}\n`)
  return { bytes, concepts: concepts.size, elements: heartElements.length }
}

async function buildZAnatomyLymphoid() {
  const sourceFile = `${sourceRoot}/z-anatomy/LymphoidOrgans100.fbx`
  const file = await readFile(sourceFile)
  const arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
  const source = new FBXLoader().parse(arrayBuffer, '')
  source.updateMatrixWorld(true)
  const document = new Document()
  const buffer = document.createBuffer()
  const scene = document.createScene('Z-Anatomy lymphoid organs evaluation sample')
  const rootNode = document.createNode('Lymphoid organs').setExtras({ source: 'Z-Anatomy', sourceFile: 'LymphoidOrgans100.fbx' })
  scene.addChild(rootNode)
  const structures = []
  let meshIndex = 0
  source.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position || object.name.startsWith('Cross_Section_') || object.name.endsWith('j')) return
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    const label = (object.name || `Structure ${meshIndex + 1}`).replace(/[_]+/g, ' ').replace(/j$/, '').trim()
    const color = heartColors[meshIndex % heartColors.length]
    const material = document.createMaterial(label).setBaseColorFactor(color).setRoughnessFactor(0.62).setMetallicFactor(0)
    addGeometry(document, buffer, scene, {
      name: label,
      position: copiedAttribute(geometry.attributes.position),
      normal: copiedAttribute(geometry.attributes.normal),
      index: geometry.index?.array,
      material,
      parent: rootNode,
      extras: { sourceName: object.name, label, source: 'Z-Anatomy' },
    })
    structures.push({ id: object.name || `mesh-${meshIndex + 1}`, name: label })
    meshIndex += 1
  })
  const output = `${outputRoot}/z-anatomy-lymphoid-organs.glb`
  const bytes = await optimizeAndWrite(document, output, false)
  const metadata = {
    schemaVersion: 1,
    subject: 'lymphoid organs',
    source: {
      name: 'Z-Anatomy',
      url: 'https://github.com/LluisV/Z-Anatomy',
      sourceFile: 'Resources/Models/FBX/LymphoidOrgans100.fbx',
      license: 'CC BY-SA 4.0',
      attribution: 'BodyParts3D and Z-Anatomy contributors; see the official Z-Anatomy license and attribution records.',
    },
    transforms: { sourceTransformsBaked: true, normalized: false },
    structures,
  }
  await writeFile(`${outputRoot}/z-anatomy-lymphoid-organs.json`, `${JSON.stringify(metadata, null, 2)}\n`)
  return { bytes, structures: structures.length }
}

await mkdir(outputRoot, { recursive: true })
if (process.argv.includes('--download')) await downloadSources()
await verifyPinnedSources()
const only = process.argv.find((argument) => argument.startsWith('--only='))?.slice('--only='.length)
const results = {}
if (!only || only === 'open3dmodel') {
  results.open3DSkeleton = await convertOpen3DModel('overview-skeleton.glb', 'open3dmodel-skeleton.glb')
  results.open3DPelvis = await convertOpen3DModel('pelvicfloor.glb', 'open3dmodel-pelvicfloor.glb')
}
if (!only || only === 'openanatomy') results.openAnatomy = await buildOpenAnatomyLiver()
if (!only || only === 'bodyparts3d') results.bodyParts3D = await buildBodyPartsHeart()
if (!only || only === 'z-anatomy') results.zAnatomy = await buildZAnatomyLymphoid()
console.log('Generated local evaluation assets:', results)
