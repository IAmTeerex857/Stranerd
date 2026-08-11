# Stranerd Anatomy Improvement and Dissect Mode Plan

Last updated: 5 August 2026

## Purpose

This document captures the agreed plan for improving Stranerd's anatomical models and then implementing a virtual dissection experience. It is intended as the handoff reference after conversation compaction.

## Current Product State

Stranerd currently supports:

- A progressively loaded whole-body Human Anatomy atlas with separate system layers.
- Exact mesh selection on segmented interactive specimens.
- Realistic textured primary specimens for eight anatomy subjects.
- Preserved alternate visual specimens.
- Twenty contextual multiple-choice and true-or-false questions per model.
- Azure OpenAI mentor responses grounded to the selected structure and model.
- Labels that are hidden by default and can be enabled with a Labels control.
- Smaller marker anchors and manually calibrated visible landmarks on realistic fused models.
- Realistic, Interactive, and Other specimen ordering.
- A streamlined catalog without a duplicate standalone Intestine subject; intestinal anatomy is part of Digestive System.
- An Activities workspace combining four-option A-D quizzes and model-scoped dissection labs.
- Free Dissect Mode for every segmented specimen and the layered Human Anatomy atlas.
- Automatic navigation collapse while activities are open.
- Undoable manual structure dragging across segmented specimens and Human Anatomy.

## Current Limitation

The realistic primary specimens are generated Tripo GLBs. Each is generally one fused mesh with one texture and no stable anatomical submeshes. They look realistic but cannot provide exact part-level selection.

The interactive specimens contain named, separate anatomical meshes and support exact clicking, highlighting, isolation, and structured mentor context. However, they are visually less realistic.

The long-term goal is to remove this tradeoff by creating one specimen per subject that is simultaneously:

- Anatomically segmented
- Visually realistic
- Reliably named and ontology-linked
- Lightweight enough for desktop and mobile browsers
- Suitable for clicking, hiding, isolating, exploding, and guided dissection

## Core Strategy

Do not attempt to use automatic splitting of fused Tripo surfaces as the main anatomy pipeline. Instead:

```text
Accurate segmented anatomical source
        +
Realistic PBR materials and visual treatment
        +
Web optimization and stable metadata
        =
Stranerd production interactive specimen
```

The accurate segmented geometry must be the source of truth. Realism should be added to it without destroying its mesh boundaries or identifiers.

## Candidate Source Roles

### HuBMAP Human Reference Atlas

Primary candidate for major organs:

- Heart
- Lungs
- Kidneys
- Liver
- Pancreas
- Intestines
- Abdominal and reproductive organs
- Selected skin and body-reference models

Strengths:

- Browser-ready GLB assets
- Segmented structures
- Male and female reference organs
- Expert-reviewed geometry
- UBERON, FMA, and related ontology identifiers
- Shared anatomical reference-space concepts

Expected role: first-choice source for replacing major organ specimens.

### Open Anatomy Project

Primary candidate for detailed regional anatomy:

- Brain
- Head and neck
- Liver
- Abdomen
- Inner ear
- Knee and other regional atlases

Strengths:

- Imaging-derived regional atlases
- Detailed structure hierarchies
- CT and MRI context in some packages
- Stronger regional detail than many whole-body atlases

Expected role: detailed brain and regional supplement, with additional conversion work.

### BodyParts3D / Anatomography

Primary candidate for broad whole-body coverage:

- Skeleton
- Muscles
- Blood vessels
- Nerves
- Whole-body relationships
- Missing structures not supplied by organ-focused libraries

Strengths:

- Thousands of separate anatomical structures
- Stable FMA identifiers
- Broad coverage
- Related to the source ecosystem behind the current whole-body atlas

Limitations:

- Visually basic geometry and materials
- Requires significant visual treatment and web optimization

Expected role: whole-body foundation and gap filler.

### NIH 3D

Use selectively for specialist gaps:

- Detailed eye anatomy
- Specialized brain anatomy
- Surgical or pathological structures
- Individual clinical structures missing from the other sources

Limitations:

- Quality and segmentation vary per asset
- Naming and orientation are inconsistent
- No single coherent atlas

Expected role: item-by-item specialist source only.

## Proposed Source Matrix

| Stranerd subject | First choice | Secondary source |
| --- | --- | --- |
| Heart | HuBMAP | BodyParts3D |
| Brain | Open Anatomy | BodyParts3D |
| Lungs | HuBMAP | BodyParts3D |
| Kidney | HuBMAP | Open Anatomy |
| Eye | NIH 3D | BodyParts3D |
| Liver | HuBMAP | Open Anatomy |
| Skin | HuBMAP | Current cross-section visual |
| Digestive System | HuBMAP organ assembly | Open Anatomy abdomen |
| Nervous System | BodyParts3D | Open Anatomy brain |
| Skeleton | BodyParts3D | NIH specialist models |

This matrix is provisional. Each candidate must pass technical and visual evaluation before adoption.

## Candidate Evaluation Process

For every model candidate, record:

1. Number of separately selectable structures
2. Structure names and ontology identifiers
3. Anatomical completeness and accuracy
4. Polygon and vertex counts
5. Materials and textures
6. Scale, orientation, and coordinate system
7. Whether related structures share a reference space
8. Desktop and mobile load time
9. GPU memory, draw calls, and interaction performance
10. Missing, duplicated, or malformed structures
11. Ease of conversion to optimized GLB
12. Suitability for hide, isolate, transparency, and manual dissection

Each candidate should be compared with:

- Current realistic primary specimen
- Current segmented interactive specimen
- Corresponding structure in Human Anatomy

## Standard Stranerd Asset Format

Every accepted model should produce:

```text
public/models/<subject>/<subject>-desktop.glb
public/models/<subject>/<subject>-mobile.glb
public/models/<subject>/<subject>-structures.json
```

The metadata should separate stable educational identity from raw mesh names:

```json
{
  "schemaVersion": 1,
  "subject": "heart",
  "source": "HuBMAP",
  "structures": [
    {
      "id": "UBERON:0000948",
      "name": "Heart",
      "meshName": "heart",
      "children": ["FMA:7097", "FMA:7101"],
      "aliases": ["Cor"],
      "system": "cardiovascular"
    }
  ]
}
```

Requirements:

- Stable IDs must not depend on display names.
- Mesh names must map exactly to stable IDs.
- Relationships should include parent, child, adjacent, supplied-by, drains-to, and other useful educational links where available.
- Source and transformation provenance should be retained.
- Desktop and mobile assets must use the same IDs and hierarchy.

## Visual Improvement Pipeline

Segmented source models may look clinical or plain. Improve them without merging structures:

1. Validate topology, normals, scale, and transforms.
2. Preserve one selectable node or primitive per anatomical concept.
3. Apply smooth normals where anatomically appropriate.
4. Create a consistent anatomical color system.
5. Add PBR materials with controlled roughness and subtle subsurface appearance.
6. Add normal, roughness, and color textures where useful.
7. Avoid textures that imply structures not present in geometry.
8. Build desktop and mobile levels of detail.
9. Compress geometry with Meshopt.
10. Compress textures with WebP or KTX2 where supported.
11. Reduce draw calls without merging selectable structures.
12. Test with Stranerd's lighting in dark and light themes.

Target outcome: the segmented specimen itself becomes the realistic production specimen, eliminating the need for separate Realistic and Interactive versions.

## Initial Model Pilot

Start with a HuBMAP heart candidate.

Compare it with:

- Current realistic heart
- Current segmented heart
- Heart structures in Human Anatomy

Success criteria:

- Better segmentation of chambers, valves, vessels, and coronary structures
- Stable FMA or UBERON identifiers
- Visually credible materials after treatment
- Correct selection, highlighting, hiding, and isolation
- Approximately 3 MB or less for the desktop asset where practical
- A smaller mobile asset with acceptable detail
- Smooth interaction on representative mobile hardware
- No loss of structure identity after optimization

After the heart pilot:

1. Open Anatomy brain
2. HuBMAP kidney
3. HuBMAP lungs
4. HuBMAP liver
5. HuBMAP/Open Anatomy digestive assembly
6. Eye specialist source
7. BodyParts3D nervous system and skeleton improvements
8. Skin and regional surface models

## Whole-Body Human Anatomy Improvements

The current Human Anatomy model is highly clickable because it contains thousands of separately named mesh nodes. It should evolve into a system-level virtual dissection table.

Required structure controls:

- Select a structure
- Multi-select structures
- Hide selected
- Show selected
- Isolate selected
- Make selected transparent
- Make surrounding anatomy transparent
- Reset visibility
- Search and focus
- Navigate parent/child hierarchy
- Switch systems and layers
- Track action history for undo and redo

## Dissect Mode Vision

Dissect Mode should allow students to take systems apart spatially and conceptually.

### Core Controls

- Hide
- Show
- Isolate
- Transparency
- Reset
- Undo and redo
- Step through layers
- Search structures
- System hierarchy browser
- Guided sequence mode

## First Dissect Mode Pilot

Implement Digestive System first.

Proposed hierarchy:

```text
Digestive System
  - Esophagus
  - Stomach
  - Liver
  - Gallbladder
  - Pancreas
  - Duodenum
  - Small intestine
  - Colon
```

Pilot features:

1. Hierarchical structure list
2. Click-to-select
3. Hide and show
4. Isolate
5. Transparency
6. Manual structure dragging
7. Reset and undo
8. Mentor response to each action
9. Guided dissection sequence
10. Quiz after completing the sequence

Example student flow:

1. Open Digestive System.
2. Hide or move the stomach.
3. Reveal the pancreas.
4. Isolate the duodenum.
5. Follow bile and pancreatic secretions into the small intestine.
6. Answer a sequence-based question.

## AI Mentor Integration for Dissection

Every dissection action should create structured context:

```json
{
  "mode": "dissection",
  "action": "isolated",
  "system": "Digestive System",
  "structureId": "UBERON:0001264",
  "structure": "Pancreas",
  "visibleNeighbors": ["Stomach", "Duodenum", "Liver"],
  "hiddenStructures": ["Stomach"]
}
```

The mentor can then explain spatial and functional relationships, for example:

```text
You isolated the pancreas. Its head lies within the curve of the duodenum, allowing pancreatic secretions to enter the small intestine through the pancreatic duct.
```

The mentor may guide the next interaction:

- Hide the stomach to expose the pancreas.
- Isolate the duodenum.
- Trace where bile enters.
- Compare the positions of the pancreas and liver.

The mentor should explain and guide, but deterministic completion rules should decide whether a guided dissection step is complete.

## Guided Dissection Data Model

A sequence can be represented as:

```json
{
  "id": "digestive-pancreas-pathway",
  "title": "Expose the pancreatic pathway",
  "steps": [
    {
      "action": "hide",
      "targetIds": ["stomach"],
      "prompt": "Hide the stomach to reveal structures behind it."
    },
    {
      "action": "isolate",
      "targetIds": ["pancreas"],
      "prompt": "Isolate the pancreas."
    },
    {
      "action": "select",
      "targetIds": ["duodenum"],
      "prompt": "Select the structure receiving pancreatic secretions."
    }
  ]
}
```

The correctness layer compares stable IDs and action types. AI explains the outcome but does not decide correctness.

## UX Principles

- Keep the realistic model visually clean.
- Labels are off by default and available through a Labels toggle.
- Selected anatomy remains visibly highlighted.
- Dissection controls appear only in Dissect Mode.
- Preserve Explore mode as a simpler experience.
- Maintain mobile usability and avoid showing too many controls simultaneously.
- Provide obvious Reset and Undo controls.
- Do not let hidden structures become impossible to recover.
- Use hierarchy and search for dense systems.
- Keep mentor responses concise, formatted as paragraphs or bullets without raw Markdown markers.

## Performance Targets

- Load only the active subject or system.
- Use progressive loading for whole-body systems.
- Keep initial subject payload near or below 3 MB where practical.
- Provide lower-detail mobile assets.
- Keep labels and metadata outside GLBs where possible.
- Use on-demand render loops except during animation.
- Limit concurrent model downloads.
- Avoid per-frame traversal of full scenes.
- Preserve exact mesh IDs across optimization.
- Profile triangles, draw calls, GPU memory, and selection latency.

## Implementation Phases

### Phase 1: Source Evaluation

- Download HuBMAP heart candidates.
- Inspect segmentation and IDs.
- Compare against current models.
- Select one candidate for conversion.

### Phase 2: Production Asset Pipeline

- Completed for the HuBMAP heart pilot on 5 August 2026.
- `scripts/import-hubmap-heart.mjs` pins and validates the official source.
- Generated metadata separates stable IDs from source mesh names.
- Four structure-aware PBR materials preserve selectable boundaries.
- Desktop and mobile GLBs retain the same 18 IDs and 14 mesh mappings.
- Automated tests enforce hierarchy, identity parity, and file budgets.
- The generated HuBMAP heart was rejected as a production replacement during visual evaluation. The previous heart remains the default; future candidates must preserve great-vessel/coronary coverage and visibly improve quality.

### Phase 3: Subject Rollout

- Heart
- Brain
- Lungs
- Kidney
- Liver
- Digestive System
- Eye: realistic specimen remains primary; improved 34-mesh optical specimen is the interactive/dissection variant
- Nervous System
- Skeleton
- Skin

### Phase 4: Dissect Mode Foundation

- Visibility, selection, and transparency state implemented for the Digestive pilot.
- Searchable grouped structure browser implemented from runtime mesh identity.
- Hide/show, isolate, reset, and bounded undo implemented.
- Undoable manual structure dragging implemented.
- External ontology-backed hierarchy metadata remains pending.
- Structured mentor action context remains pending.

### Phase 5: Digestive Dissection Pilot

- Guided stomach-pancreas-duodenum sequence implemented with stable-ID action rules.
- Structured action context and concise mentor explanations implemented.
- Session completion tracking and step feedback implemented.
- Post-dissection pancreatic pathway quiz implemented.
- Persisted completion and external ontology-backed hierarchy remain pending.

### Phase 6: System Expansion

- Free Dissect Mode implemented for Heart, Brain, Lungs, Kidney, Eye, Liver, Digestive System, Nervous System, Skin, and Human Anatomy.
- Human Anatomy supports dissection across progressively loaded aligned system layers.
- One launchable activity is registered for every anatomy model.
- Guided deterministic assessment currently remains specific to the pancreatic pathway; additional guided sequences remain future work.
- Activities now include session-seeded quizzes with exactly four A-D options.

## Immediate Next Task After Compaction

Phase 1 heart source evaluation completed on 5 August 2026:

1. Selected the HuBMAP HRA female heart v1.3 as the pipeline pilot.
2. Recorded its 14 meshes, hierarchy, UBERON/FMA IDs, material, geometry, size, and provenance.
3. Added an isolated comparison workspace at `/?test=heart-candidate`.
4. Compared it with the current realistic and segmented hearts.
5. Recorded the decision and gaps in `heart-source-evaluation.md`.

The realistic Eye is the primary specimen, while the improved segmented Eye remains its interactive/dissection variant. Every anatomy activity combines targeted structure selection, educational A-D questions, anatomical explanations, and meaningful model manipulation. Named structures can be dragged with Undo/Reset support, including Human Anatomy. New quizzes are requested from Azure/OpenAI only after question 20 and must pass strict validation. Immediate next task: evaluate cross-model dragging and educational progression, then add ontology-backed manifests and persisted activity completion. Keep the HuBMAP heart isolated as a pipeline reference rather than a production model.

## Existing Related Documentation

- `../research/wolfram-strategy.md`: Wolfram computation, assessment, anatomy, and System Modeler strategy
- `asset-inventory.md`: Current model sources, optimization, and segmented specimen inventory
- `../../README.md`: Current application operation and deployment notes
