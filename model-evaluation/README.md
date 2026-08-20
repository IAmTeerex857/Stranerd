# Model Evaluation Lab

This is a development-only workspace for qualifying anatomy assets before they enter Stranerd. It is intentionally separate from the production entry point and is not included by `npm run build`.

## Run

```bash
npm run assets:evaluation:download
npm run dev:web
```

Open `http://127.0.0.1:5173/model-evaluation/`.

`assets:evaluation:download` downloads pinned public samples into the ignored `assets/source-models/evaluation/` directory and creates evaluation GLBs. After the first download, use `npm run assets:evaluation` to regenerate derivatives without network requests.

## Included Samples

- Open3DModel complete skeleton and male pelvic floor: official GLBs, CC BY-SA 4.0, with asset-specific attribution shown in the lab.
- OpenAnatomy SPL Liver Atlas: six VTK structures converted into one GLB while preserving structure IDs, label-map values, shared coordinates and source colors. The source atlas uses 3D Slicer License Part B.
- BodyParts3D heart: 83 atomic OBJ meshes grouped into 40 FMA concepts. The generated metadata preserves FMA IDs, BodyParts3D representation IDs and element IDs.
- Z-Anatomy lymphoid organs: 223 structures converted from the official FBX system bundle under CC BY-SA 4.0.

AlensiaXR and AnatomyZone do not expose public raw model downloads. Wolfram anatomy geometry requires licensed programmatic access and explicit redistribution terms. Their source records remain in the lab so partner-provided samples can be added later.

## Isolation

- Raw and generated evaluation assets stay under `assets/source-models/`, which is ignored by Git.
- No evaluation files are placed in `public/`.
- The lab is not linked from the production application.
- The production Vite build continues to use only the root `index.html` entry.
