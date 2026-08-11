# HuBMAP Heart Source Evaluation

Evaluation date: 5 August 2026

## Recommendation

Use the HuBMAP HRA female heart v1.3 as the Phase 2 pipeline pilot, but do not replace Stranerd's production heart. It passes ontology, licensing, size, transform, exact-selection, and material requirements. It does not include great vessels or coronary anatomy and was rejected during product evaluation as a visual downgrade.

The candidate is available for isolated review at `/?test=heart-candidate`.

## Candidate

- Object: 3D Reference Organ for Heart, Female v1.3
- HuBMAP ID: `HBM449.SHRV.225`
- Source: Visible Human Dataset through the HuBMAP Human Reference Atlas
- License: Creative Commons Attribution 4.0 International
- GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/heart-female/v1.3/assets/3d-vh-f-heart.glb
- Crosswalk: https://cdn.humanatlas.io/digital-objects/ref-organ/heart-female/v1.3/assets/crosswalk.csv
- Pinned metadata: https://raw.githubusercontent.com/hubmapconsortium/hra-kg/v2.5/digital-objects/ref-organ/heart-female/v1.3/raw/metadata.yaml
- Downloaded GLB SHA-256: `98f66e46b149bfc3836592d9404c50290e21d302ec55c98813435e2d9847b1d9`

The male v1.3 equivalent is 4,071,772 bytes and exceeds the pilot's approximate 3 MB desktop target before further optimization. The 1,745,560-byte female model is therefore the preferred first candidate.

## Technical Inspection

| Measure | HuBMAP female v1.3 | Current realistic | Current segmented |
| --- | ---: | ---: | ---: |
| File size | 1,745,560 B | 438,660 B | 521,408 B |
| Scene nodes | 18 | 1 | 58 |
| Selectable mesh nodes | 14 | 1 fused mesh | 33 |
| Vertices | 43,560 | 3,451 | 47,645 |
| Triangles | 85,914 | 5,036 | 88,176 |
| Materials | 1 | 1 | 1 |
| Textures | 0 | 1 | 0 |
| Stable ontology IDs | Embedded UBERON/FMA | None | None embedded |

All HuBMAP nodes use identity local transforms. Mesh nodes include `label`, `ontologyid`, `representation_of`, source-spatial-entity, and node-type extras. The hierarchy separates chambers, valves, and papillary muscles. The GLB uses one untextured red PBR material with metallic 0 and roughness approximately 0.249.

## Coverage

The 14 renderable structures are:

- Interventricular septum
- Left and right atria
- Left and right ventricles
- Aortic, pulmonary, mitral, and tricuspid valves
- Five named papillary muscle structures

The candidate is stronger than the current segmented heart for stable identity and high-level chamber and valve organization. The current segmented heart has broader visible coverage with 33 meshes, including aorta, venae cavae, pulmonary trunk, coronary arteries, cardiac veins, and finer valve leaflets. The current realistic model has the best authored surface appearance but only one fused mesh and no exact anatomical IDs.

## Gaps And Risks

- No aorta, venae cavae, pulmonary vessels, coronary arteries, cardiac veins, or full external myocardium are supplied as selectable structures.
- A single shared material makes adjacent structures difficult to distinguish.
- The source is a reference organ rather than a complete cardiovascular assembly.
- Browser rendering and mobile interaction still need visual testing on representative physical devices.
- The metadata's stated DOI did not resolve during source verification; attribution should use the official HRA object, HuBMAP ID, citation, and pinned repository metadata.
- `UBERON:0004151` for the non-renderable cardiac-chamber group is added to Stranerd metadata; it is not present in the candidate's per-model crosswalk.

## Decision Against Success Criteria

| Criterion | Result |
| --- | --- |
| Chambers, valves, and papillary structures | Pass |
| Great vessels and coronary structures | Fail |
| Stable FMA or UBERON identifiers | Pass |
| Credible materials | Needs Phase 2 treatment |
| Selection, highlighting, and isolation | Pass in isolated test view |
| Desktop asset near or below 3 MB | Pass |
| Smaller mobile asset | Not produced yet |
| Mobile performance | Not measured yet |
| Identity preserved after optimization | Not tested yet |

## Phase 2 Entry Work

Completed on 5 August 2026:

1. Added a reproducible importer that validates mesh names against the crosswalk and emits Stranerd metadata.
2. Assigned separate chamber, valve, septum, and papillary PBR materials without merging meshes.
3. Produced a 574,752-byte desktop GLB and a 402,044-byte mobile GLB while preserving all embedded ontology extras.
4. Added automated checks for unique IDs, hierarchy, mesh mappings, desktop/mobile parity, and file budgets.

Remaining before production replacement:

1. Visually review both generated variants on desktop and representative mobile hardware.
2. Evaluate an HRA/BodyParts3D assembly for vessels and coronary anatomy.
3. Decide whether the external myocardium and vessels should be one assembled specimen or coordinated layers.
