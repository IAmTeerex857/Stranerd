# Stranerd Interactive Demo — Build Specification

**Audience for this doc:** Claude Design (for the visual/UX pass) then Claude Code (to build it).
**Goal:** A clearly-real, clickable desktop web demo proving Stranerd's core thesis — *we simulate the actual component, a deterministic engine computes ground truth, and an AI mentor teaches on top.* Three modules: **Circuits, Anatomy (Skeleton), Fourier Series.**

This is a DEMO, not the product. Prioritize "obviously real and impressive on a laptop screen" over completeness. Desktop only for now (min width 1280px).

---

## 0. The one principle that must not be violated

Stranerd's entire pitch is **"a correctness engine computes truth; AI only teaches."** The demo must visibly embody this. Concretely:

- Whether an answer/action is right or wrong is decided by **deterministic code** (a solver, a coordinate check, a math comparison) — **never** by asking the AI "is this correct?"
- The AI's job is *explaining, mentoring, encouraging, and reacting* to what the engine already determined.
- In the UI, make this legible: when the engine evaluates, show the computed result (voltage, correct/incorrect structure, error value) as a fact, then let the mentor talk about it.

If you ever find yourself routing correctness through the language model, stop — that breaks the product's reason to exist.

---

## 1. Layout — IDE-style three-pane shell

A single-page app that looks like a focused IDE / pro tool. Three vertical panes:

```
┌────────────┬─────────────────────────────┬──────────────────┐
│  LEFT       │        CENTER                │     RIGHT         │
│  (nav +     │   (the live visual /         │  (AI mentor       │
│  module     │    simulation canvas —       │   chat + task     │
│  list +     │    the hero of the screen)   │   panel)          │
│  task list) │                              │                   │
│  ~240px     │   flexible, fills space      │   ~360px          │
└────────────┴─────────────────────────────┴──────────────────┘
```

- **Left pane (~240px):** Stranerd wordmark/diamond at top. Module switcher (Circuits / Skeleton / Fourier). Below it, the list of baked-in tasks for the active module with completion ticks. A thin "powered by a real engine" status line.
- **Center pane (hero, fills remaining width):** The interactive simulation for the active module. This is where the wow lives. Big, uncluttered, dark canvas.
- **Right pane (~360px):** The AI mentor. A chat transcript (mentor + student turns), the current task prompt pinned at top, an input box at the bottom. When the engine evaluates an action, a compact "result chip" appears in the transcript (e.g. `ENGINE: node B = 4.2V ✓`) immediately before the mentor's explanation, making the engine-vs-AI split visible.

Top bar across all panes: module title, a "Run / Evaluate" primary button (cyan), and a subtle "Demo" tag.

Resizable panes are nice-to-have, not required. Fixed widths are fine for the demo.

---

## 2. Visual design system

**Use the attached `Design.md` as the source of truth for all color, type, spacing, and motion.** Summary of what to carry over:

- **Background:** `#0A0C0F` near-black with the signature top-right cyan radial glow. Panels use translucent white surfaces (`rgba(255,255,255,.035)` fill, `rgba(255,255,255,.10)` borders), no drop shadows — depth via translucency.
- **Accent:** electric cyan `#4DB6FF` for primary actions, highlights, the brand diamond. Semantic colors: green `#5FD08A` = correct/success, red `#FF7A7A` = error/wrong, amber `#F2C261` = warning, magenta `#E26BD6` = the AI mentor's voice/avatar accent.
- **Type:** Space Grotesk (display/headings/numbers), IBM Plex Sans (body/UI), JetBrains Mono (the "eyebrow" kickers, code, the engine result chips, footers). Use the eyebrow treatment (mono, uppercase, wide tracking, cyan, leading rule) for section labels like "CIRCUITS" / "CORRECTNESS ENGINE".
- **Cards:** 16px radius generic, 12px for chat rows, 999px for chips/tags.
- **Motion:** the `rise` entrance (550ms, `cubic-bezier(.2,.7,.2,1)`, 16px up, 80ms stagger) for panels/elements appearing. Respect `prefers-reduced-motion`.
- **Engine result chips:** mono, pill-shaped, bordered. Green tint when correct, red when wrong, cyan when neutral/informational. This is a signature element — it's the visible proof of the correctness engine.

The whole thing should feel like a precise instrument, not a kiddie ed-app: dark, calm, technical, confident.

---

## 3. The AI mentor — integration (IMPORTANT, read carefully)

This is a standalone hosted web app using the **OpenAI API**. Abstract ALL model calls behind a single async function, e.g. `async function askMentor(messages, context)`, so the provider can be swapped in one place if ever needed.

**Architecture (non-negotiable for security):**
The frontend must NEVER contain the API key. `askMentor` in the browser calls a tiny backend proxy route (`POST /api/mentor`); that proxy reads `OPENAI_API_KEY` from a server env var and forwards the request to OpenAI. Flow: `browser → /api/mentor → OpenAI`. Build this minimal proxy (Node/Express or a serverless function) as part of the deliverable. An OpenAI key placed in client-side code can be scraped and abused within hours — keep it server-side only.

**OpenAI specifics:**
- Endpoint: `https://api.openai.com/v1/chat/completions`
- Auth: header `Authorization: Bearer ${OPENAI_API_KEY}`
- Model: `gpt-4o` (or `gpt-4o-mini` for cheaper/faster demo responses — both fine for a mentor).
- Request shape: `{ model, messages: [{role, content}], max_tokens, temperature }`. Note `messages` uses OpenAI's role format (`system` / `user` / `assistant`) — the system prompt is the first message with `role: "system"`.
- Response shape: read `data.choices[0].message.content`.
- Wrap in try/catch; on any failure fall through to the offline canned explanation (below).

**Mentor behavior:**
- It receives: the current module, the current task, the engine's latest computed result, and the student's recent actions/messages. It does NOT decide correctness — it's *told* the result by the engine and explains it.
- System prompt should make it a warm, precise subject expert ("a patient professor of [anatomy/circuits/signals]"), grounded only in the task context it's given. Keep it from inventing facts: instruct it to explain the engine's result and the concept, not to adjudicate.
- Tasks are baked in (see §5) — the mentor does NOT generate questions. It guides, hints, and explains.
- Stream or show a typing indicator for responsiveness.

Have a graceful offline fallback: if the model call fails, the mentor shows a short pre-written explanation tied to the task so the demo never dies on stage.

---

## 4. The three modules

### Module 1 — Circuits (the correctness-engine hero)

**Why it's first:** It's the cleanest proof that real deterministic computation underlies the experience.

- **Visual (center):** A clean schematic canvas. For the demo, support a small fixed set of components: DC voltage source, resistors, wires, nodes, a switch, an LED/bulb. Student can connect/adjust a constrained circuit (don't build a full freeform editor — pre-place most of it and let them complete or fix it). Show current flow as an animated indication and node voltages as live labels.
- **Engine:** Write a small **nodal-analysis solver** in plain JS/TS (build the conductance matrix, solve G·v = i with a linear solver; `mathjs` is available for the matrix solve). This computes real node voltages and branch currents. **Do not embed CircuitJS1 — it's GPL and unsafe for a commercial product;** a compact custom solver is both license-clean and the literal embodiment of your "correctness engine." Keep components to R, V-source, switch, ideal diode/LED approximation — enough for the tasks below.
- **Baked-in tasks (examples):**
  1. "Complete the circuit so the bulb lights." (Engine checks: is there a closed loop delivering current > threshold to the bulb?)
  2. "Fix the short circuit." (A node is shorted; engine detects abnormal current; student reroutes; engine re-evaluates.)
  3. "Set the resistor so current through the LED is ~20mA." (Engine computes actual current; correct within tolerance → green chip.)
- **Engine→mentor handoff:** On "Evaluate," solver returns node voltages + pass/fail. UI shows a result chip (`ENGINE: I(LED) = 19.7mA ✓`). Mentor then explains *why* it works or what's wrong.

### Module 2 — Anatomy / Skeleton (the visual-fidelity hero)

**Why:** Maximum "wow" on screen; proves component-level (not lab) simulation for medicine.

- **Visual (center):** A 3D human skeleton rendered with **React Three Fiber + drei** (Three.js). Orbit controls (rotate/zoom/pan). Individual bones are **separately selectable meshes** — clicking a bone highlights it (cyan emissive) and shows its label.
- **Assets & licensing (use a properly-licensed model — this matters commercially):**
  - **Z-Anatomy** — open-source, Creative Commons, and critically its meshes carry anatomical names, which is what enables deterministic "select the correct structure" grading. Export the skeleton subset to `.glb`. Best fit for the product direction.
  - Alternatives for the demo: Artec 3D "Human skeleton HD" (CC BY 4.0, attribution required) or a CC BY 4.0 game-ready skeleton (e.g. GreyFrogGames on itch.io). **Whatever is used, record the license + attribution in an `ASSETS.md`** and show attribution in the UI footer. Avoid anything non-commercial or unlicensed.
  - Requirement: meshes must have descriptive names (e.g. `femur_left`, `humerus_right`). If a chosen model lacks named meshes, name them in Blender first.
- **Engine (deterministic grading):** Correctness = "did the student click/isolate the named structure the task asked for?" This is a pure string/ID match against the mesh name, plus optionally a spatial check. No AI involved in grading.
- **Baked-in tasks (examples):**
  1. "Identify and select the femur." (Engine: clicked mesh name === target → green chip.)
  2. "Isolate the bones of the forearm (radius and ulna)." (Engine checks the selected set matches the target set.)
  3. "The patient has a fractured clavicle — select it." (Same mechanism, clinical framing.)
- **Engine→mentor handoff:** On selection, engine confirms match; result chip (`ENGINE: selected = femur_left ✓`); mentor explains the bone's role, common injuries, what's nearby.

### Module 3 — Fourier Series (the breadth hero, cheapest to build)

**Why:** Pure deterministic math, visually beautiful, proves the platform spans STEM not just one vertical. Lowest asset cost — you build it entirely.

- **Visual (center):** A live plot. Show a target waveform (square, sawtooth, triangle) and the Fourier approximation overlaid. A slider for "number of terms (N)." As N increases, the approximation visibly converges onto the target — the classic, mesmerizing reconstruction. Optionally show rotating epicycles (the spinning-circles visualization) as a stretch goal — it's a huge wow but optional. Use a lightweight plotting approach (canvas, or `d3`/`plotly` which are available).
- **Engine:** Real Fourier series computation in JS — compute the partial sum coefficients for the chosen waveform and evaluate. All deterministic math.
- **Baked-in tasks (examples):**
  1. "Add terms until the square-wave approximation error drops below 5%." (Engine computes RMS error between approximation and target; when < threshold → green chip.)
  2. "What's the minimum N to resolve this feature?" (Engine evaluates against the criterion.)
  3. "Match this mystery waveform by choosing the right base function + N." (Engine compares.)
- **Engine→mentor handoff:** Engine reports the computed error/criterion; result chip (`ENGINE: RMS error = 4.1% ✓`); mentor explains Gibbs phenomenon, why more terms help, the intuition.

---

## 5. Tasks & content (baked in)

- All tasks are **hand-authored and hard-coded** per module (a `tasks.ts` per module with: prompt text, success criterion function, hint text, and a fallback mentor explanation). The AI does not generate tasks — this keeps the demo reliable and on-message.
- Each task has: a title, a one-line prompt, a deterministic `evaluate(state) → {pass, detail}` function (THIS is the engine), 1–2 progressive hints, and a short canned explanation for offline fallback.
- Completion: ticking through a module's 2–3 tasks marks it done in the left pane. A subtle "module complete" state is enough — no heavy gamification for the demo.

---

## 6. Tech stack (recommended)

- **React + Vite + TypeScript.**
- **React Three Fiber + drei** for the skeleton; **Three.js** under it.
- **mathjs** for the circuit linear solve; plain TS for Fourier; **d3** or canvas for plotting.
- Styling: plain CSS / CSS modules using the `Design.md` tokens as CSS custom properties. (Tailwind optional, but the design system is defined as CSS vars, so vanilla is fine.)
- **Mentor proxy:** a minimal Node/Express (or serverless) `/api/mentor` route that holds `OPENAI_API_KEY` server-side and forwards to OpenAI's `/v1/chat/completions`. Frontend never sees the key.
- No browser localStorage needed; keep all state in React state/memory.

---

## 7. Build order (suggested for Claude Code)

1. App shell: three-pane IDE layout + design tokens + module switcher. Static, no logic.
2. Mentor abstraction (`askMentor`) + the `/api/mentor` proxy to OpenAI + offline fallback + the result-chip UI pattern.
3. Fourier module end to end (cheapest; proves the engine→chip→mentor loop).
4. Circuits module (nodal solver + constrained editor + tasks).
5. Skeleton module (R3F scene, load licensed `.glb`, selectable named meshes, tasks).
6. Polish: entrance animations, empty/complete states, attribution footer, the "powered by a real engine" framing made visible.

Ship each module working before starting the next.

---

## 8. Definition of done (demo bar = "clearly real and clickable")

- All three modules load and are interactable on a 1280px+ desktop screen.
- In each, a student action is evaluated by **deterministic code**, a result chip shows the computed fact, and the AI mentor explains it.
- The engine-vs-AI split is visible to a viewer who doesn't know the architecture.
- The design matches `Design.md` and feels like a precise, premium instrument.
- All 3D/asset licenses are documented in `ASSETS.md` with attribution shown in-app.
- Mentor works via the `/api/mentor` proxy once `OPENAI_API_KEY` is set on the server; the frontend contains no key. Offline fallback keeps the demo alive if the API call fails.

---

## Appendix — Asset/library notes (verified June 2026)

- **Circuits:** Build a custom nodal-analysis solver. CircuitJS1 exists and is excellent but is **GPL** — fine to learn from, do not embed in a commercial product. `simple-circuit-engine` (npm, Three.js-based, educational) exists if a prebuilt option is wanted, but a custom solver is recommended for license cleanliness and as direct proof of the correctness-engine thesis.
- **Anatomy:** **Z-Anatomy** (open source, CC, named anatomical meshes) is the best fit. Artec 3D "Human skeleton HD" is CC BY 4.0. A CC BY 4.0 game-ready skeleton is available on itch.io. Confirm the exact license at download time and record it. Render with React Three Fiber + drei.
- **Fourier:** No external assets; compute and plot yourself (canvas or d3/plotly). Epicycle visualization is an optional stretch wow.
- **Mentor:** OpenAI `gpt-4o` (or `gpt-4o-mini`), endpoint `https://api.openai.com/v1/chat/completions`, auth `Authorization: Bearer <OPENAI_API_KEY>`. Read the reply from `choices[0].message.content`. The key lives on the backend proxy in an env var — never in frontend code.
