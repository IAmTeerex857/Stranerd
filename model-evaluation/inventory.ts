export type SourceStatus = 'ready' | 'sample-needed' | 'metadata-only'

export type ModelSource = {
  id: string
  name: string
  role: string
  coverage: string[]
  formats: string
  structure: string
  metadata: string
  quality: string
  attribution: string
  status: SourceStatus
  url: string
  risks: string[]
  recommendation: { verdict: 'prioritize' | 'evaluate' | 'partner access'; bestFor: string; nextStep: string }
}

export const sources: ModelSource[] = [
  {
    id: 'stranerd', name: 'Stranerd current', role: 'Production baseline', status: 'ready',
    coverage: ['Whole body', 'Heart', 'Brain', 'Lungs', 'Kidney', 'Eye', 'Liver', 'Nervous system', 'Skin', 'Digestive system'],
    formats: 'Optimized GLB with Meshopt and embedded WebP where available',
    structure: 'Realistic specimens plus named segmented variants',
    metadata: 'Authored labels, hotspots, systems, facts and learning context',
    quality: 'Web-ready baseline already deployed across desktop and mobile',
    attribution: 'Internal inventory and existing source records', url: '/app', risks: ['Some structures are approximate', 'Coverage varies by specimen'],
    recommendation: { verdict: 'evaluate', bestFor: 'Product interaction and performance baseline', nextStep: 'Compare every candidate against the current equivalent before replacement.' },
  },
  {
    id: 'bodyparts3d', name: 'BodyParts3D', role: 'Canonical whole-body foundation', status: 'sample-needed',
    coverage: ['Whole body', 'Skeleton', 'Muscles', 'Vessels', 'Nerves', 'Organs'], formats: 'OBJ plus TSV metadata',
    structure: '2,234 separate anatomical elements', metadata: 'FMA IDs, preferred names, IS-A and PART-OF relationships',
    quality: 'Broad but visually dated; already heavily polygon-reduced', attribution: 'CC BY 4.0; prescribed BodyParts3D credit',
    url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html', risks: ['Older mesh release', 'Adult male only', 'Requires GLB conversion and system bundles'],
    recommendation: { verdict: 'prioritize', bestFor: 'Canonical whole-body coverage and FMA-backed structure identity', nextStep: 'Use as the semantic backbone, then replace visuals selectively with stronger geometry.' },
  },
  {
    id: 'openanatomy', name: 'OpenAnatomy', role: 'Imaging-grounded regional detail', status: 'sample-needed',
    coverage: ['Brain', 'Liver', 'Abdomen', 'Head and neck', 'Inner ear', 'Knee', 'Thorax'], formats: 'VTK, NRRD and JSON manifests',
    structure: 'Separate surfaces backed by authoritative voxel labels', metadata: 'Names, IDs, label values, colours and display hierarchy',
    quality: 'CT/MRI-derived regional atlases; display meshes need optimization', attribution: '3D Slicer License Part B notices',
    url: 'https://www.openanatomy.org/', risks: ['Mostly single-patient atlases', 'Research-oriented formats', 'No complete formal ontology'],
    recommendation: { verdict: 'prioritize', bestFor: 'CT/MRI-grounded regional anatomy and cross-sectional learning', nextStep: 'Complete and evaluate the liver, brain, knee and inner-ear atlases as specialist modules.' },
  },
  {
    id: 'open3dmodel', name: 'Open3DModel', role: 'Efficient regional teaching models', status: 'sample-needed',
    coverage: ['Skeleton', 'Skull', 'Upper limb', 'Hand', 'Lower limb', 'Trunk muscles', 'Male pelvis'], formats: 'GLB, OBJ and Blender',
    structure: 'Named selectable meshes and parent groups', metadata: 'English labels and basic grouping',
    quality: 'Retopologized, textured, compressed and already browser-tested', attribution: 'Mostly CC BY-SA 4.0; asset-specific credits',
    url: 'https://anatomytool.org/open3dmodel', risks: ['Audit muscle texture licenses', 'No complete organ atlas', 'No stable ontology IDs'],
    recommendation: { verdict: 'prioritize', bestFor: 'Skeleton, skull, limbs, joints and pelvic teaching', nextStep: 'Adopt cleared GLBs where they outperform current models and map names to the canonical ontology.' },
  },
  {
    id: 'z-anatomy', name: 'Z-Anatomy', role: 'Presentation-ready broad anatomy', status: 'sample-needed',
    coverage: ['Whole body', 'Skeletal', 'Muscular', 'Nervous', 'Cardiovascular', 'Visceral'], formats: 'Blender, FBX and Unity',
    structure: 'System collections with broad object separation', metadata: 'Names, definitions and multilingual labels',
    quality: 'Visually developed but historically memory-heavy', attribution: 'Core CC BY-SA 4.0; source-level audit required',
    url: 'https://github.com/LluisV/Z-Anatomy', risks: ['Some references are noncommercial', 'Requires major optimization', 'Uncertain stable IDs'],
    recommendation: { verdict: 'evaluate', bestFor: 'Broad structure coverage and specialist systems such as lymphatics', nextStep: 'Use only source-cleared structures; benchmark and simplify before considering production.' },
  },
  {
    id: 'anatomyzone', name: 'AnatomyZone', role: 'Instruction and lesson sequencing', status: 'metadata-only',
    coverage: ['Neuroanatomy', 'Head', 'Neck', 'Upper limb', 'Lower limb', 'Back', 'Thorax', 'Abdomen and pelvis'], formats: 'Publicly documented as video and transcripts',
    structure: 'Rendered tutorials show isolation; raw scene structure is unknown', metadata: 'Strong region, system and structure taxonomy',
    quality: 'Clear educational presentation; raw mesh quality unverified', attribution: 'Private commercial agreement required',
    url: 'https://anatomyzone.com/', risks: ['Raw formats not public', 'Model deliverables need confirmation', 'Best treated as instructional content today'],
    recommendation: { verdict: 'partner access', bestFor: 'Explanations, lesson sequencing and assessment authoring', nextStep: 'Request a content/API package; do not treat public tutorial media as a geometry source.' },
  },
  {
    id: 'alensiaxr', name: 'AlensiaXR', role: 'Premium visual and neuroanatomy library', status: 'sample-needed',
    coverage: ['Whole body', 'Male anatomy', 'Female anatomy', '15 systems', 'Neural pathways', 'Brainstem', 'Spinal cord'], formats: 'Proprietary XR and Windows platform; raw format pending',
    structure: '7,000+ separately addressable structures and custom groups', metadata: 'Labels and instructional organization; ontology unknown',
    quality: 'Medical-illustration quality designed for life-sized XR', attribution: 'Private agreement including upstream CWRU rights',
    url: 'https://www.alensiaxr.com/anatomical-library', risks: ['Raw export rights and format must be explicit', 'Web/mobile budgets unknown', 'Ontology and versioning unknown'],
    recommendation: { verdict: 'partner access', bestFor: 'Premium male/female full-body and advanced neuroanatomy', nextStep: 'Request a representative raw GLB/FBX package plus hierarchy, web rights and technical budgets.' },
  },
  {
    id: 'wolfram', name: 'Wolfram', role: 'Correctness and normalization layer', status: 'metadata-only',
    coverage: ['Anatomical entities', 'Relationships', 'Scientific computation', 'Engineering simulations'], formats: 'Wolfram entities, graphics primitives and computed metadata',
    structure: 'Named entities and retrievable substructures, subject to pilot confirmation', metadata: 'Identifiers, relationships, centroids, bounds and scientific properties',
    quality: 'Best used to validate and enrich delivery assets rather than serve every page view', attribution: 'Commercial export and redistribution terms pending',
    url: 'https://reference.wolfram.com/language/ref/entity/AnatomicalStructure.html', risks: ['Geometry redistribution requires written rights', 'Average-adult limitations', 'Do not couple product schema to one vendor'],
    recommendation: { verdict: 'partner access', bestFor: 'Scientific correctness, normalized metadata and deterministic simulation', nextStep: 'Run a licensed heart pilot and negotiate explicit rights for exported geometry and cached metadata.' },
  },
]

export const organGroups = ['All coverage', ...Array.from(new Set(sources.flatMap((source) => source.coverage))).sort()]
