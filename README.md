# Stranerd Anatomy Lab

An anatomy learning platform, live at https://learn.stranerd.com. Real-time 3D exploration is paired with deterministic activity evaluation; the AI mentor explains engine results but never determines correctness.

The library contains 10 anatomy subjects: Heart, Brain, Lungs, Kidney, Eye, Liver, Nervous System, Skin, Human Anatomy, and Digestive System. Each provides a realistic primary specimen alongside exact-mesh interactive variants and preserved visual alternatives. Human Anatomy provides a progressively loaded six-system atlas. Digestive System includes intestinal anatomy rather than exposing a duplicate standalone Intestine subject.

The workspace has three areas. Explore is free model inspection and dissection. Library holds flashcard decks and 20-question practice tests. Lab holds guided anatomy activities.

Every practice-test question has four A-D options. After question 20, students may restart the same set or request a new 20-question set from the configured Azure/OpenAI integration; invalid or unavailable AI output falls back safely to local generation. Every anatomy model, including the layered Human Anatomy atlas, supports Dissect Mode with search, hide/show, transparency, isolation, manual structure dragging, reset, and undo. Guided activities combine targeted structure identification, model manipulation, A-D knowledge checks, and educational feedback. Digestive System additionally includes the pancreatic-pathway completion quiz.

Flashcard decks pair recall prompts with interactive 3D diagrams and four-grade review, and learners may generate their own decks or unlock community decks. A text Mentor and a realtime Voice Agent are available on learning screens.

Accounts use Google sign-in through Supabase. AI features cost credits, tracked in a reserve-then-finalize ledger that refunds automatically when a provider request fails. Regional billing uses Spotflow for NGN and Bachs for USD-card subscriptions and USD-card or stablecoin credit packs.

## Run

Requires Node 24. Copy `.env.example` to `.env` and optionally set `OPENAI_API_KEY`.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Express on port 8787. Without an API key or network access, the server returns the authored offline mentor explanation.

```bash
npm run lint
npm test
npm run build
npm start
```

`npm start` serves the API and a built `dist/` directory on `http://localhost:8787`. The mentor supports standard OpenAI credentials or Azure OpenAI through `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and `AZURE_OPENAI_DEPLOYMENT`. Azure Voice and input transcription use `gpt-realtime-2.1` by default; either deployment can be overridden with `AZURE_OPENAI_REALTIME_DEPLOYMENT` or `AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT`.

## Deploy

Import the repository into Vercel as a Vite project. The frontend builds to `dist/`, and each file under `api/` deploys as a serverless function — mentor, quiz, flashcard generation and unlock, realtime voice session and extension, billing checkout, status and cancel, provider webhooks, and the welcome email. Add `OPENAI_API_KEY` and, optionally, `OPENAI_MODEL` to the Vercel project environment; without a key, the authored offline explanations remain available. Supabase, Spotflow, and Bachs credentials are required for accounts, credits, and regional billing.

Design documentation for the in-progress redesign is in `docs/product/product-design-prd.md`, which is the authoritative description of intended product behavior.

## Assets

Optimized GLBs and their source mapping are documented in `docs/assets/asset-inventory.md`. Models load only when selected, and missing or invalid specimens produce a usable viewer fallback.

This demo is for anatomy education and is not medical advice or a diagnostic tool.
