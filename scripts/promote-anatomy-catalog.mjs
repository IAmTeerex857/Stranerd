import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = `${root}/assets/source-models/evaluation/derived`
const outputRoot = `${root}/public/models/catalog`
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const files = [
  'bodyparts3d-respiratory.glb',
  'open3dmodel-axillary-nerve.glb',
  'open3dmodel-brachial-plexus-and-branches.glb',
  'open3dmodel-colored-skull-base.glb',
  'open3dmodel-exploded-skull.glb',
  'open3dmodel-hand-and-wrist-bones-and-cartilages.glb',
  'open3dmodel-hand-and-wrist-joints.glb',
  'open3dmodel-hand.glb',
  'open3dmodel-inguinal-and-femoral-canal-hernia-surgery.glb',
  'open3dmodel-inguinal-canal.glb',
  'open3dmodel-inguinal-ligament.glb',
  'open3dmodel-insertions-and-origins.glb',
  'open3dmodel-lower-limb.glb',
  'open3dmodel-median-nerve.glb',
  'open3dmodel-muscles-thorax-abdomen.glb',
  'open3dmodel-musculocutaneous-nerve.glb',
  'open3dmodel-overview-colored-skull.glb',
  'open3dmodel-overview-skull.glb',
  'open3dmodel-pelvicfloor.glb',
  'open3dmodel-radial-nerve.glb',
  'open3dmodel-rotator-cuff.glb',
  'open3dmodel-shoulder-and-pectoral-girdle-joints.glb',
  'open3dmodel-ulnar-nerve.glb',
  'open3dmodel-upper-limb-arm-muscles.glb',
  'open3dmodel-upper-limb-axio-appendicular-muscles.glb',
  'open3dmodel-upper-limb-forearm-anterior-compartment-muscles.glb',
  'open3dmodel-upper-limb-scapulohumeral-muscles.glb',
  'open3dmodel-upper-limb.glb',
  'open3dmodel-zone-ankle.glb',
  'open3dmodel-zone-elbow.glb',
  'open3dmodel-zone-hip.glb',
  'open3dmodel-zone-knee.glb',
  'open3dmodel-zone-shoulder.glb',
  'openanatomy-abdomen.glb',
  'openanatomy-brain.glb',
  'openanatomy-head-neck.glb',
  'openanatomy-inner-ear.glb',
  'openanatomy-knee.glb',
  'openanatomy-liver.glb',
  'openanatomy-thorax.glb',
  'z-anatomy-body-regions.glb',
  'z-anatomy-joints.glb',
  'z-anatomy-lymphoid-organs.glb',
]

await mkdir(outputRoot, { recursive: true })
const assets = []
for (const file of files) {
  const source = `${sourceRoot}/${file}`
  const output = `${outputRoot}/${file}`
  if (file.startsWith('z-anatomy-')) {
    const document = await io.read(source)
    await document.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
    await io.write(output, document)
  } else await copyFile(source, output)
  const data = await readFile(output)
  assets.push({ file: `/models/catalog/${file}`, bytes: (await stat(output)).size, sha256: createHash('sha256').update(data).digest('hex') })
}

await writeFile(`${outputRoot}/manifest.json`, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), assets }, null, 2)}\n`)
console.log(`Promoted ${assets.length} production anatomy assets (${assets.reduce((total, asset) => total + asset.bytes, 0).toLocaleString()} bytes).`)
