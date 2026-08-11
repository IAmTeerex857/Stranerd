# Wolfram Strategy for Stranerd

Research date: 5 August 2026

## Executive Summary

Wolfram can provide Stranerd with a deterministic computation, assessment, scientific-data, and simulation layer. It should complement rather than replace Stranerd's React interface, 3D/VR experience, voice agents, or AI mentor.

The intended separation of responsibilities is:

- Stranerd presents the lesson, simulation controls, 3D or VR environment, progress, and assessment experience.
- Wolfram calculates scientifically or mathematically correct results.
- A deterministic grading layer decides correctness from those results.
- The AI mentor explains the result and adapts its teaching, but does not decide correctness.

This directly supports Stranerd's proposed dual-engine architecture: a correctness engine establishes ground truth, while an AI teaching layer communicates it.

## Recommended Architecture

```text
Student
  |
  v
Stranerd React / 3D / VR / voice interface
  |
  v
Stranerd API and lesson engine
  |
  +--> Wolfram computation or simulation
  |      - symbolic and numeric computation
  |      - System Modeler simulation
  |      - scientific entities and data
  |      - deterministic assessment
  |
  +--> Deterministic result and evidence
  |
  +--> AI mentor explanation
  |
  v
Visual, spoken, and written feedback
```

Simple and frequently used simulations should be precomputed or converted into lightweight browser models. Expensive, unusual, or high-fidelity computations can run through bounded Wolfram APIs or a dedicated simulation service. Vercel remains appropriate for the frontend and lightweight API routing, but not for persistent native System Modeler processes or long-running simulations.

## Wolfram Platform Map

| Capability | Potential Stranerd role |
| --- | --- |
| Wolfram Language | Unified symbolic and numeric correctness engine |
| System Modeler | Multidomain physical systems, virtual laboratories, fault simulations, and digital twins |
| AnatomyData and AnatomyPlot3D | Named anatomical structures, geometry, centroids, layers, clipping, and reference visualization |
| Molecule and chemical functions | Molecular structures, formulas, reactions, stoichiometry, and stereochemistry |
| BioSequence functions | DNA, RNA, protein, mutation, transcription, and sequence-alignment exercises |
| Finite Element Method | Stress, heat, fluids, acoustics, mass transport, and electromagnetic fields |
| Control Systems | Transfer functions, stability, PID design, state-space models, and robotics |
| Quantity and units | Unit-aware answers, conversion, dimensional validation, and uncertainty |
| AssessmentFunction | Typed, deterministic grading with tolerances and custom comparators |
| QuestionObject | Structured computational question authoring |
| Wolfram Knowledgebase | Scientific entities, constants, materials, species, chemicals, geography, and anatomy |
| Wolfram Notebooks | Internal lesson, simulation, and assessment authoring environment |
| Wolfram Cloud | Managed APIs, notebooks, forms, and bounded production computations |
| Web Engine / Application Server | Self-hosted or scaled Wolfram computation services |
| Compute Services | Large asynchronous simulations, parameter sweeps, FEM, and content generation |
| Wolfram|Alpha APIs | Natural-language computation and supplementary enrichment |
| Cloud or Local MCP | AI-assisted lesson authoring and controlled Wolfram tool use |
| Data, Function, and Neural Net Repositories | Candidate datasets, functions, and models after provenance and license review |
| Quezzio | Commercial Wolfram-based assessment and LMS integration option |

## System Modeler

System Modeler is an equation-based, graphical modeling environment based on Modelica. It can connect reusable physical components across electrical, mechanical, thermal, fluid, control, biological, and other domains. Acausal modeling allows authors to describe physical connections rather than manually turning every system into one-way signal flow.

### Stranerd Opportunities

- Electrical circuit construction and fault diagnosis
- Motors, generators, batteries, power electronics, and renewable-energy systems
- Mechanical assemblies, engines, rotating machinery, and vehicle systems
- Hydraulic and pneumatic equipment
- Heat transfer, refrigeration, HVAC, and battery thermal management
- Chemical-process and reactor models
- Sensors, control systems, PID tuning, robotics, and automation
- Simplified biological and biochemical dynamic systems
- Hardware-in-the-loop or digital-twin demonstrations

Example student flow:

1. A student connects a motor or circuit incorrectly in Stranerd.
2. Stranerd converts the configuration into simulation parameters or topology.
3. System Modeler calculates current, voltage, temperature, speed, and state changes.
4. The grading engine checks safety and task objectives.
5. Stranerd shows the wire heating, component failure, or incorrect motion.
6. The AI mentor explains the causal chain using the deterministic simulation result.

### Core Capabilities

- Continuous-time, discrete-event, and hybrid simulation
- Differential, algebraic, and discrete equations
- Parameter sweeps, sensitivity studies, calibration, and optimization
- Monte Carlo and reliability experiments
- Linearization and control-system analysis through Wolfram Language
- Live parameter tuning and native simulation controls
- FMI 2.0 Model Exchange and Co-Simulation import/export
- Standalone native simulation executables and a TCP simulation API
- Result export to data and presentation formats

System Modeler does not currently document an official browser-native or WebAssembly runtime. Native executables and persistent simulation sessions should run on a VM, container, Wolfram deployment product, or another suitable compute service rather than a Vercel serverless function. Selected FMUs might be converted with third-party web tooling, but that would require separate compatibility and licensing validation.

### Best Use Pattern

Use System Modeler first as an authoring and validation tool:

1. Experts build and validate a physical model.
2. Parameter sweeps generate trusted datasets and expected outcomes.
3. Stranerd consumes precomputed JSON or lightweight surrogate models for common interactions.
4. Only experiences that genuinely need live high-fidelity calculation call a simulation service.

This minimizes latency and per-student compute cost while preserving scientifically grounded consequences.

## AnatomyData and AnatomyPlot3D

`AnatomyPlot3D` renders and styles named anatomical entities. It supports separate structures, labels, transparency, clipping planes, scientific themes, tooltips, and anatomical coordinate references. Coordinates represent an average adult human male in millimeters, so this source alone does not represent demographic or pathological variation.

`AnatomyData` is more useful than a rendered plot when building reusable Stranerd assets. Relevant properties include `"Graphics3D"`, `"Graphics3DPrimitives"`, `"MeshRegion"`, `"RegionCentroid"`, and region bounds.

Potential benefits over the current demo models:

- Structures can have real entity identities rather than approximate coordinate labels.
- Centroids can improve authored hotspot placement.
- Separate geometry can support selecting, hiding, isolating, and coloring structures.
- Anatomical relationships can improve lesson and quiz generation.
- Layers and clipping can support dissection-style experiences.

Recommended content pipeline:

1. Select a reviewed anatomical entity and its required substructures.
2. Retrieve geometry and entity metadata using licensed local Wolfram tooling.
3. Export geometry to GLB or another intermediate format.
4. Export stable IDs, labels, relationships, centroids, and source provenance to JSON.
5. Optimize the mesh and textures for web and VR delivery.
6. Review the output with a qualified anatomy educator.
7. Render the final assets in React Three Fiber rather than calling Wolfram for every page view.

The free Wolfram Cloud MCP is unsuitable as a production model-delivery API. It is stateless, intended for limited use, and does not support general file upload or download. Local MCP can create files through a licensed local Wolfram installation.

Redistribution rights for Wolfram anatomical geometry must be confirmed in writing before including exported meshes in a public or commercial product.

## Subject Opportunity Map

### Mathematics

- Symbolic algebra, calculus, linear algebra, transforms, recurrences, and exact equation solving
- Interactive graphs, geometric constructions, vector fields, and phase portraits
- Arbitrary-precision numerical computation
- Probability, statistics, regression, hypothesis testing, and random processes
- Checking mathematical equivalence rather than matching answer strings
- Checking assumptions, domains, excluded values, and required answer forms separately

High-value Stranerd feature: a universal mathematics grader that accepts multiple valid forms while enforcing the actual task rubric.

### Physics

- Mechanics, collisions, orbital motion, waves, electromagnetism, and thermodynamics
- Physical constants, materials, particles, isotopes, and spectral data
- Dimensional analysis, units, significant figures, and uncertainty
- Heat, wave, acoustic, electrostatic, and fluid PDE/FEM laboratories
- System Modeler experiments combining mechanical, electrical, and thermal behavior

High-value Stranerd feature: interactive experiments where sliders change a real model and the student predicts, measures, and explains the outcome.

### Chemistry

- Interactive periodic-table and chemical-property exploration
- 2D and 3D molecule rendering
- Formula parsing, stoichiometry, reaction balancing, and substructure search
- Molecular graphs, charge, stereochemistry, and isomer exercises
- Reaction kinetics and chemical-process simulations
- Links to reviewed external chemical and protein identifiers where licensing permits

High-value Stranerd feature: grade the chemical graph, charge, formula, stereochemistry, and balance rather than relying only on typed names.

### Biology and Anatomy

- DNA and RNA transcription, translation, reverse complements, and mutation exercises
- Local and global sequence alignment and motif detection
- Gene, protein, SNP, species, and taxonomy exploration
- Layered, clipped, highlighted, and labeled anatomy
- Population, growth, survival, biochemical, and systems-biology models

Medical and anatomy material must remain educational, should not provide diagnosis, and requires expert review and clear provenance.

### Engineering

- Circuit, mechanical, thermal, hydraulic, chemical-process, and mechatronic virtual labs
- Transfer functions, state-space systems, PID tuning, Bode, Nyquist, and root-locus analysis
- Structural mechanics, heat transfer, fluid flow, acoustics, electrostatics, and mass transport
- Constrained, integer, convex, robust, and other optimization workflows
- Design-space exploration, fault diagnosis, and digital-twin demonstrations

System Modeler is particularly relevant to Stranerd's promise that students can repair or configure real systems and see the consequences of their decisions.

### Geography and Earth Science

- Maps, elevation, weather, climate, routes, earthquakes, gravity, and geomagnetism
- Planetary geography and spatial calculations
- Field-study, geology, environmental, and climate laboratories

Live data used for grading should be snapshotted and versioned so assessments remain reproducible.

## Deterministic Assessment

Wolfram's assessment framework can support:

- Numeric tolerances and significant-figure policies
- Algebraic and calculus equivalence
- Quantities and units
- Vectors and matrices
- Molecules, formulas, and reactions
- Geographic positions and other typed answers
- Custom comparators, partial credit, and structured feedback

Safety rules for production grading:

- Parse answers into held, typed structures.
- Never evaluate unrestricted student expressions.
- Allowlist functions and input forms.
- Apply time, memory, request-size, and per-user limits.
- Pin the Wolfram version, data snapshots, assumptions, precision, and random seeds.
- Check correctness, form, units, and presentation as separate rubric dimensions.
- Keep LLM feedback downstream of the deterministic score.

## AI, Voice, Language, and VR

These capabilities are complementary:

- Voice agents handle spoken interaction and accessibility.
- Multilingual models translate and adapt explanations.
- VR and 3D provide spatial practice.
- Wolfram computes ground truth and validates answers.
- The AI mentor turns validated results into personalized instruction.

Example:

1. A student in VR asks, "What happens if I increase this resistance?"
2. The voice layer transcribes the question and identifies the selected component.
3. Wolfram calculates the new circuit state.
4. Stranerd updates the visual behavior.
5. The mentor explains the result in the student's chosen language.

MCP can assist internal authors and AI agents, but students should never receive unrestricted access to a Wolfram kernel or a general evaluator.

## Production Options

### Precomputed Content

Best for low cost, offline support, predictable latency, and large student populations. Wolfram generates validated datasets, SVGs, animations, GLBs, question banks, and response surfaces during content production.

### Wolfram Cloud APIs

Best for an initial managed pilot involving bounded computations. Cloud limits, credits, latency, data access, and commercial terms must be planned.

### Wolfram Web Engine or Application Server

Potential options for self-hosted or scaled production services. These require appropriate commercial licensing, infrastructure, sandboxing, monitoring, and operational expertise.

### Dedicated System Modeler Service

Exported Linux executables or FMUs can run in a persistent container or VM behind a narrow REST or WebSocket interface. Every third-party Modelica library and external dependency must permit the intended redistribution and service use.

## Licensing and Data Constraints

- Free Wolfram Cloud MCP is for limited conversational or personal use, not unrestricted production computation.
- Free Wolfram Engine licensing is for pre-production development, not deployed commercial services.
- System Modeler, Mathematica, Wolfram Cloud, Web Engine, Application Server, and production Engine use have separate commercial terms.
- Academic and student licenses generally exclude commercial production work.
- Wolfram|Alpha API development allowances do not establish commercial production rights.
- Wolfram Knowledgebase data can change and may not be bulk-extracted, republished, or used to create a substitute database without permission.
- Anatomy geometry redistribution must be explicitly confirmed.
- Repository functions, datasets, neural models, and Modelica libraries can contain separate licenses and attribution requirements.
- AI-assisted or systematic extraction may require additional permissions under Wolfram terms.
- Educational medical content must not be presented as diagnosis or clinical decision support.

Before production adoption, Stranerd should request written terms covering SaaS use, student volume, API deployment, exported assets, simulation executables, Wolfram data, AI integration, and caching.

## Recommended Pilots

### Pilot 1: Electrical Fault-Diagnosis Lab

Build a simple circuit or motor task in which students move wires or components. Use System Modeler to establish valid behavior, fault outcomes, and safe operating ranges. Initially export a precomputed response model to Stranerd rather than running a live solver for every student.

Success criteria:

- Student actions map reliably to model parameters or topology.
- The deterministic result matches expert expectations.
- Visual consequences are understandable.
- The mentor explains the result without changing the grade.
- The experience performs acceptably on mobile devices and weak networks.

### Pilot 2: Wolfram Heart Dataset

Compare the existing heart model with Wolfram entity coverage. Test geometry quality, separable structures, centroid metadata, GLB export, optimization, and educator review. Do not publish Wolfram-derived geometry until redistribution rights are confirmed.

### Pilot 3: Universal STEM Grader

Create a narrow service for algebraic equivalence, numeric tolerances, and units. This is smaller than a full simulation platform but could immediately improve mathematics, physics, chemistry, and engineering assessments.

## Suggested Adoption Sequence

1. Use free or trial tools only for technical evaluation.
2. Pilot one deterministic grader and one precomputed engineering lab.
3. Measure educational value, latency, authoring effort, and cost.
4. Obtain licensing and redistribution terms before incorporating Wolfram data or runtime services into the commercial product.
5. Build a reusable Stranerd content schema that is independent of any single vendor.
6. Add live Wolfram computation only where it materially improves learning over cached or browser-native models.

## Key Sources

- Wolfram Language: https://www.wolfram.com/language/
- Wolfram Knowledgebase: https://www.wolfram.com/language/core-areas/knowledgebase/
- System Modeler: https://www.wolfram.com/system-modeler/
- System Modeler features: https://www.wolfram.com/system-modeler/features/
- System Modeler virtual labs: https://www.wolfram.com/system-modeler/virtual-labs/
- System modeling overview: https://reference.wolfram.com/language/guide/SystemModelingOverview.html
- AnatomyPlot3D: https://reference.wolfram.com/language/ref/AnatomyPlot3D.html
- AnatomyData: https://reference.wolfram.com/language/ref/AnatomyData.html
- Molecular computation: https://reference.wolfram.com/language/guide/MolecularStructureAndComputation.html
- Biomolecular sequences: https://reference.wolfram.com/language/guide/BiomolecularSequences.html
- Control systems: https://reference.wolfram.com/language/guide/ControlSystems.html
- Finite element method: https://reference.wolfram.com/language/FEMDocumentation/tutorial/FiniteElementOverview.html
- Units and quantities: https://reference.wolfram.com/language/guide/Units.html
- AssessmentFunction: https://reference.wolfram.com/language/ref/AssessmentFunction.html
- Questions and assessment: https://reference.wolfram.com/language/guide/QuestionsAndAssessment.html
- Wolfram Cloud MCP: https://www.wolfram.com/artificial-intelligence/mcp/cloud/
- Wolfram Local MCP: https://www.wolfram.com/artificial-intelligence/mcp/local/
- Wolfram Cloud: https://www.wolfram.com/cloud/
- Server deployment options: https://www.wolfram.com/server-deployment-options/
- Wolfram Engine licensing: https://www.wolfram.com/engine/
