# Stranerd Anatomy Lab

A clean-room anatomy and engineering learning demo. Real-time 3D exploration is paired with deterministic lesson evaluation; the AI mentor explains engine results but never determines correctness.

The library contains 13 subjects and 29 optimized, on-demand GLB specimens. Variant choices, model favorites, browsable hotspot bookmarks, notes, settings, and activity completion are stored locally with safe migration from earlier state. Every subject has authored hotspot-identification tasks evaluated by exact marker-ID sets plus one multiple-choice knowledge check graded against an authored answer index. AI explains these already-decided results; it does not grade them.

The Engineering view is an accurate board/component-identification preview for the Arduino and Electronics Project specimens. It does not claim to simulate circuits or perform nodal analysis.

## Run

Requires Node 24. Copy `.env.example` to `.env` and optionally set `OPENAI_API_KEY`.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/mentor` to Express on port 8787. Without an API key or network access, the server returns the authored offline mentor explanation.

```bash
npm run lint
npm test
npm run build
npm start
```

`npm start` serves the API and a built `dist/` directory on `http://localhost:8787`.

## Deploy

Import the repository into Vercel as a Vite project. The frontend builds to `dist/`, and `api/mentor.ts` deploys the mentor endpoint as a serverless function. Add `OPENAI_API_KEY` and, optionally, `OPENAI_MODEL` to the Vercel project environment; without a key, the authored offline explanations remain available.

## Assets

Optimized GLBs and their source mapping are documented in `ASSETS.md`. Models load only when selected, and missing or invalid specimens produce a usable viewer fallback.

This demo is for anatomy education and is not medical advice or a diagnostic tool.
