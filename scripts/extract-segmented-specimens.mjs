import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt, prune } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import { fileURLToPath } from 'node:url'

const specimens = [
  { id: 'heart', source: 'cardiovascular', roots: ['Heart.g', 'Ascending aorta', 'Pulmonary trunk', 'Arteries of heart.g', 'Cardiac veins.g', 'Superior vena cava', 'Inferior vena cava (thoracic part)'] },
  { id: 'brain', source: 'nervous', roots: ['Brain.g'] },
  { id: 'lungs', source: 'organs', roots: ['Respiratory system.g'] },
  { id: 'kidney', source: 'organs', roots: ['Urinary system.g'] },
  { id: 'eye', source: 'nervous', roots: ['Eye.g', 'Optic nerve (II).r', 'Optic nerve (II).l'] },
  { id: 'intestine', source: 'organs', roots: ['Small intestine.g', 'Large intestine.g'] },
  { id: 'liver', source: 'organs', roots: ['Liver', 'Gallbladder', 'Extrahepatic bile ducts.g', 'Pancreas'] },
  { id: 'nervous-system', source: 'nervous', roots: ['Central nervous system.g', 'Peripheral nervous system.g'] },
  { id: 'skin', source: 'skin', roots: ['RootNode'] },
  { id: 'digestive-system', source: 'organs', roots: ['Digestive system.g'] },
]

await MeshoptDecoder.ready
await MeshoptEncoder.ready

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

for (const specimen of specimens) {
  const input = fileURLToPath(new URL(`../public/models/body/${specimen.source}.glb`, import.meta.url))
  const output = fileURLToPath(new URL(`../public/models/${specimen.id}-segmented.glb`, import.meta.url))
  const document = await io.read(input)
  const nodes = new Map(document.getRoot().listNodes().map((node) => [node.getName(), node]))

  if (specimen.id === 'heart') {
    for (const [groupName, meshName] of [['Superior vena cava', 'Superior vena cava'], ['Inferior vena cava (thoracic part)', 'Inferior vena cava (thoracic part)']]) {
      const group = nodes.get(groupName)
      for (const child of group.listChildren()) if (child.getMesh()?.getName() !== meshName) group.removeChild(child)
    }
  }

  const selected = specimen.roots.map((name) => nodes.get(name))
  if (selected.some((node) => !node)) throw new Error(`${specimen.id}: one or more roots were not found.`)

  const keep = new Set()
  function keepDescendants(node) {
    keep.add(node)
    node.listChildren().forEach(keepDescendants)
  }
  for (const node of selected) {
    keepDescendants(node)
    for (let parent = node.getParentNode(); parent; parent = parent.getParentNode()) keep.add(parent)
  }
  for (const node of document.getRoot().listNodes()) {
    for (const child of [...node.listChildren()]) if (!keep.has(child)) node.removeChild(child)
  }

  await document.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  await io.write(output, document)
  const meshCount = document.getRoot().listNodes().filter((node) => node.getMesh()).length
  console.log(`${specimen.id}: ${meshCount} selectable meshes -> ${output}`)
}
