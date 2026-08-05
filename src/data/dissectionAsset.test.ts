import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { describe, expect, it } from 'vitest'

describe('Digestive Dissect Mode asset', () => {
  it('contains the principal pilot structures as separate meshes', async () => {
    await MeshoptDecoder.ready
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
    const document = await io.read('public/models/digestive-system-segmented.glb')
    const meshNames = document.getRoot().listNodes().filter((node) => node.getMesh()).map((node) => {
      let named = node
      while (named.getParentNode() && !named.getName()) named = named.getParentNode()!
      return named.getName()
    })

    expect(meshNames).toHaveLength(45)
    expect(meshNames).toEqual(expect.arrayContaining(['Oesophagus', 'Stomach', 'Liver', 'Gallbladder', 'Pancreas', 'Duodenum', 'Jejunum', 'Ascending colon', 'Descending colon', 'Transverse colon']))
  })
})
