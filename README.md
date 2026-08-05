# Stranerd Anatomy Lab

A clean-room anatomy and engineering learning demo. Real-time 3D exploration is paired with deterministic lesson evaluation; the AI mentor explains engine results but never determines correctness.

The library contains 12 subjects. Eight anatomy subjects default to realistic textured primary specimens, followed by exact-mesh interactive specimens and preserved visual alternatives. Human Anatomy provides a progressively loaded six-system atlas. Digestive System includes intestinal anatomy rather than exposing a duplicate standalone Intestine subject. Each model has 20 contextual multiple-choice and true-or-false questions. Variant choices, favorites, bookmarks, notes, settings, and quiz completion are stored locally.

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

`npm start` serves the API and a built `dist/` directory on `http://localhost:8787`. The mentor supports standard OpenAI credentials or Azure OpenAI through `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and `AZURE_OPENAI_DEPLOYMENT`.

## Deploy

Import the repository into Vercel as a Vite project. The frontend builds to `dist/`, and `api/mentor.ts` deploys the mentor endpoint as a serverless function. Add `OPENAI_API_KEY` and, optionally, `OPENAI_MODEL` to the Vercel project environment; without a key, the authored offline explanations remain available.

## Assets

Optimized GLBs and their source mapping are documented in `ASSETS.md`. Models load only when selected, and missing or invalid specimens produce a usable viewer fallback.

This demo is for anatomy education and is not medical advice or a diagnostic tool.
