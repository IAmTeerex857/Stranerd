# Asset notes

The supplied models are user-generated assets created with GPT Image and Tripo, per the user's statement. Original source assets remain unchanged in `Images 3D/`. Web-ready derivatives were generated with glTF Transform 4.4.2 and live in `public/models/`.

## Deployed derivatives

| Subject | Optimized outputs |
| --- | --- |
| Heart | `heart.glb`, `heart-v2.glb`, `heart-v3.glb` |
| Brain | `brain.glb`, `brain-v2.glb`, `brain-v3.glb`, `brain-v4.glb`, `brain-v5.glb` |
| Lungs | `lungs.glb`, `lungs-v2.glb`, `lungs-v3.glb` |
| Kidney | `kidney.glb`, `kidney-v2.glb` |
| Eye | `eye.glb`, `eye-v2.glb` |
| Intestine | `intestine.glb`, `intestine-v2.glb` |
| Liver | `liver.glb`, `liver-v2.glb` |
| Nervous System | `nervous-system.glb`, `nervous-system-v2.glb`, `nervous-system-v3.glb` |
| Skin | `skin.glb`, `skin-v2.glb` |
| Human Anatomy | `anatomy.glb` |
| Digestive System | `digestive-system.glb` |
| Arduino | `arduino.glb`, `arduino-v2.glb` |
| Electronics Project | `electronics-project.glb` |

The 29 derivatives use Meshopt geometry compression, quantized attributes, WebP textures capped at 2048px, and model-specific simplification ratios. `public/models/` is 54 MB on disk; specimens load on demand rather than as one bundle.

The generated Tripo files contain single generic meshes rather than named anatomical or component submeshes. Demo grading therefore uses authored hotspot IDs and coordinate overlays. Markers do not imply mesh segmentation. Future structure isolation should use reviewed, segmented models with descriptive mesh names.

## Segmented whole-body demo

The Human Anatomy entry additionally uses six aligned, Meshopt-compressed GLB layers in `public/models/body/`: skin, muscular, skeleton, cardiovascular, nervous, and organs. Together they contain 2,884 named scene nodes and 2,011 direct mesh nodes. The app loads only skeleton and organs initially; other systems load when requested and remain aligned in one coordinate space.

Each mesh selection is normalized into a stable Stranerd identifier using `anatomy:<system>:<structure>`. Structure metadata, condition associations, graph version, and source records live separately in `src/data/anatomyGraph.ts`, allowing geometry to evolve without changing lesson or chat identifiers.

## Segmented interactive specimens

Every anatomy subject now defaults to a compact segmented specimen with exact named-mesh selection. The original 29 high-detail visual files remain available as alternate specimens.

| Subject | Segmented file | Selectable meshes |
| --- | --- | ---: |
| Heart | `heart-segmented.glb` | 33 |
| Brain | `brain-segmented.glb` | 250 |
| Lungs | `lungs-segmented.glb` | 36 |
| Kidney / urinary | `kidney-segmented.glb` | 8 |
| Eye | `eye-segmented.glb` | 34 |
| Intestine | `intestine-segmented.glb` | 10 |
| Liver and biliary | `liver-segmented.glb` | 14 |
| Nervous system | `nervous-system-segmented.glb` | 542 |
| Skin regions | `skin-segmented.glb` | 254 |
| Digestive system | `digestive-system-segmented.glb` | 45 |

The reproducible extraction pipeline is `scripts/extract-segmented-specimens.mjs`. It preserves the aligned atlas hierarchy, prunes unrelated structures, and applies Meshopt compression.

## Realistic primary specimens

Eight anatomy subjects include optimized textured primary specimens derived from the supplied Tripo GLBs. Each loads before its corresponding exact-mesh interactive specimen, followed by preserved alternate visuals:

- `heart-realistic.glb`
- `brain-realistic.glb`
- `lungs-realistic.glb`
- `kidney-realistic.glb`
- `eye-realistic.glb`
- `liver-realistic.glb`
- `skin-realistic.glb`
- `digestive-system-realistic.glb`

These realistic models remain fused meshes, so they use authored coordinate markers. Interactive specimens retain exact named-mesh selection.

Exact ownership, generation terms, model releases, and commercial license rights must still be confirmed and documented before commercial launch.
