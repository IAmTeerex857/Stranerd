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

Exact ownership, generation terms, model releases, and commercial license rights must still be confirmed and documented before commercial launch.
