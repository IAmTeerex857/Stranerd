# Asset notes

The supplied models are user-generated assets created with GPT Image and Tripo, per the user's statement. Original source assets remain unchanged in `assets/source-models/original/`, with intermediate meshes in `assets/source-models/meshed/`. Web-ready derivatives were generated with glTF Transform 4.4.2 and live in `public/models/`.

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

The anatomy derivatives use Meshopt geometry compression, quantized attributes, WebP textures capped at 2048px, and model-specific simplification ratios. Specimens load on demand rather than as one bundle.

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

## HuBMAP heart pipeline pilot

The first ontology-linked production pipeline candidate is generated from HuBMAP HRA's female heart v1.3 under CC BY 4.0:

| Output | Size | Selectable meshes | Geometry |
| --- | ---: | ---: | ---: |
| `heart/heart-desktop.glb` | 574,752 bytes | 14 | 43,560 vertices / 85,914 triangles |
| `heart/heart-mobile.glb` | 402,044 bytes | 14 | 28,707 vertices / 56,293 triangles |
| `heart/heart-structures.json` | Metadata | 14 mesh mappings | 18 stable structures |

The generated assets use four structure-aware PBR materials and retain embedded UBERON/FMA identifiers. They remain isolated evaluation assets and do not replace the current production heart because the source does not include great vessels or coronary anatomy.

Generate from the pinned local source and crosswalk:

```bash
npm run assets:heart
```

Download the official source again, reject it if its SHA-256 has changed, then generate:

```bash
npm run assets:heart:download
```

Validate existing desktop/mobile assets without rewriting them:

```bash
npm run validate:assets
```

The importer is `scripts/import-hubmap-heart.mjs`. The source-evaluation workspace at `/?test=heart-candidate` compares both generated variants with the current realistic and segmented specimens.

## Segmented Eye visual pilot

The existing `eye-segmented.glb` remains the Interactive Eye specimen and is unchanged geometrically: 34 selectable meshes, 69,145 vertices, and 113,173 triangles. Its rendering applies structure-specific materials at runtime:

- Transparent, depth-safe cornea, lens, vitreous body, chambers, and ocular segments
- Opaque sclera, iris, retina, optic nerve, zonular fibres, and lacrimal tissues
- Distinct roughness, opacity, and render ordering for optical and soft-tissue structures
- Opaque highlighted materials for reliable selected-state visibility
- Repeated-click depth cycling through overlapping ocular layers

The deterministic material map is `src/data/anatomyMaterials.ts`; regression coverage is in `src/data/anatomyMaterials.test.ts`.

## Digestive Dissect Mode foundation

The 45-mesh `digestive-system-segmented.glb` is the first Dissect Mode pilot. Entering Dissect Mode switches to that segmented variant and enables structure search, multi-selection, hide/show, isolation, transparency, manual dragging, reset, and bounded undo history. Hidden and isolated meshes are excluded from raycasting.

The deterministic state reducer, structure grouping, stable-ID guided pancreas pathway, and post-dissection question live in `src/data/dissection.ts`. Every action emits structured dissection context for concise Azure mentor explanations, with deterministic rules controlling step completion. Ontology-backed hierarchy metadata and persisted completion remain future work.

## Cross-model Activities and Dissect Mode

All segmented anatomy specimens and the progressively loaded Human Anatomy atlas now consume the same reversible dissection state. The Activities catalog in `src/data/activities.ts` provides one educational lab for each anatomy model and automatically selects its segmented specimen. Human Anatomy aggregates structures from each loaded system layer while retaining independent layer visibility. Individual named structures can be dragged manually, with movement included in Undo and Reset.

Each model receives 20 multiple-choice questions with exactly four unique A-D options. After completing question 20, students can restart or request a new AI-generated set. The server validates question count, unique option count, answer indices, and explanations before accepting AI output; local seeded generation is the offline fallback.
