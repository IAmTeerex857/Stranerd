export type LabActivityCatalogItem = { id: string; modelId: string; title: string; description: string; checkpointCount: number }

export const labActivityCatalog: LabActivityCatalogItem[] = [
  { id: 'heart-flow', modelId: 'heart', title: 'Examine left ventricular pressure generation', description: 'Locate the left ventricle and relate its muscular wall to systemic circulation.', checkpointCount: 5 },
  { id: 'brain-regions', modelId: 'brain', title: 'Inspect the corpus callosum', description: 'Relate the corpus callosum’s position to communication between cerebral hemispheres.', checkpointCount: 5 },
  { id: 'lung-airways', modelId: 'lungs', title: 'Trace the trachea into the left main bronchus', description: 'Follow the conducting airway from the cartilage-supported trachea into the left main bronchus.', checkpointCount: 5 },
  { id: 'urinary-pathway', modelId: 'kidney', title: 'Inspect the left kidney and urinary outflow', description: 'Relate the left kidney’s filtration role to urine transport through the ureter.', checkpointCount: 5 },
  { id: 'eye-optics', modelId: 'eye', title: 'Inspect refraction at the left cornea', description: 'Relate the left cornea’s position and transparency to ocular refraction and retinal input.', checkpointCount: 5 },
  { id: 'liver-biliary', modelId: 'liver', title: 'Inspect gallbladder bile storage', description: 'Relate the gallbladder’s position beneath the liver to bile storage and delivery to the duodenum.', checkpointCount: 5 },
  { id: 'pancreas-pathway', modelId: 'digestive-system', title: 'Expose the pancreatic pathway', description: 'Reveal the pancreas and relate its secretions to the duodenum.', checkpointCount: 5 },
  { id: 'neural-pathways', modelId: 'nervous-system', title: 'Inspect spinal cord white matter', description: 'Relate spinal cord white matter to ascending sensory and descending motor pathways.', checkpointCount: 5 },
  { id: 'skin-regions', modelId: 'skin', title: 'Map the left anterior forearm surface', description: 'Use the left anterior forearm region to connect cutaneous surface anatomy with epidermal and dermal function.', checkpointCount: 5 },
  { id: 'whole-body-systems', modelId: 'anatomy', title: 'Inspect the left femur in whole-body context', description: 'Relate the left femur’s position between hip and knee to load transmission through the thigh.', checkpointCount: 5 },
]
