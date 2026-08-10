# Stranerd Anatomy Lab

A clean-room anatomy and engineering learning demo. Real-time 3D exploration is paired with deterministic activity evaluation; the AI mentor explains engine results but never determines correctness.

The library contains 12 subjects. Anatomy subjects provide realistic primary specimens alongside exact-mesh interactive variants and preserved visual alternatives. Human Anatomy provides a progressively loaded six-system atlas. Digestive System includes intestinal anatomy rather than exposing a duplicate standalone Intestine subject.

The Activities workspace combines quick quizzes and model-scoped dissection labs. Every quiz has four A-D options. After question 20, students may restart the same set or request a new 20-question set from the configured Azure/OpenAI integration; invalid or unavailable AI output falls back safely to local generation. Every anatomy model, including the layered Human Anatomy atlas, supports Dissect Mode with search, hide/show, transparency, isolation, manual structure dragging, reset, and undo. Guided activities combine targeted structure identification, model manipulation, A-D knowledge checks, and educational feedback. Digestive System additionally includes the pancreatic-pathway completion quiz.

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

`npm start` serves the API and a built `dist/` directory on `http://localhost:8787`. The mentor supports standard OpenAI credentials or Azure OpenAI through `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and `AZURE_OPENAI_DEPLOYMENT`. Azure Voice and input transcription use `gpt-realtime-2.1` by default; either deployment can be overridden with `AZURE_OPENAI_REALTIME_DEPLOYMENT` or `AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT`.

## Deploy

Import the repository into Vercel as a Vite project. The frontend builds to `dist/`, and `api/mentor.ts` deploys the mentor endpoint as a serverless function. Add `OPENAI_API_KEY` and, optionally, `OPENAI_MODEL` to the Vercel project environment; without a key, the authored offline explanations remain available.

## Assets

Optimized GLBs and their source mapping are documented in `ASSETS.md`. Models load only when selected, and missing or invalid specimens produce a usable viewer fallback.

This demo is for anatomy education and is not medical advice or a diagnostic tool.
