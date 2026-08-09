# Stranerd Post-Launch Plan

## Product Direction

Stranerd should become a focused visual learning environment built around three primary spaces:

1. **Explore** - inspect and manipulate anatomy models.
2. **Library** - access models, default assessments, flashcard decks, and learning progress.
3. **Lab** - complete guided dissection activities manually or with a conversational Voice Agent.

Remove Systems and Notes from the main navigation. Existing locally stored notes should not be deleted during the navigation change.

The public landing page remains dark for now. The application and account surfaces support System, Light, and Dark themes.

---

## Phase 1: Application Themes

**Status (8 August 2026):** Implemented locally. Build, lint, and the current 83-test suite pass; desktop/mobile visual review and deployment remain pending.

### Theme Behavior

- Follow the device theme by default.
- Add an in-app `System / Light / Dark` control.
- Persist an explicit user preference locally.
- Use the same preference across `/app` and `/account`.
- Keep the landing page permanently dark.
- Avoid a flash of the wrong theme during startup.

### Light Theme Direction

- Page background: white.
- Primary text: Slate 900.
- Muted surfaces: Slate 100.
- Borders: Slate 200.
- Medical/navigation actions: sky or clinical blue.
- AI and Voice Agent states: restrained violet.
- Success: green.
- Hints and warnings: amber.
- Destructive actions: red.
- No colored edge rules.
- Use flat cards with borders and restrained shadows.
- Use a pale blue-gray 3D canvas instead of pure white so transparent anatomy remains legible.
- Adjust model lights, labels, controls, and selected-material contrast for both themes.

### Scope

- Sidebar and mobile navigation.
- Top bar and model controls.
- 3D viewer and dissection dock.
- Library, assessments, flashcards, and Lab.
- Mentor and future Voice Agent.
- Account, payments, dialogs, and empty/error states.

### Acceptance Criteria

- Every existing workflow remains functional in all three theme modes.
- Models remain readable on desktop and mobile.
- Theme preference survives refresh and navigation.
- System theme changes update Stranerd when no explicit preference is selected.
- Build, lint, tests, and visual regression checks pass.

---

## Phase 2: Navigation and Information Architecture

**Status (8 August 2026):** Implemented locally. Navigation now exposes Explore, Library, and Lab; notes remain preserved in local storage. Library includes models, verified assessments, default flashcards, favorites, filters, and available progress data. Lab includes the complete guided catalog and manual dissection mode. Recently studied history remains deferred because the current state has no study timestamps. Build, lint, and 83 tests pass; desktop/mobile visual review and deployment remain pending.

### Explore

- Full 3D anatomy viewer.
- Model and specimen switching.
- Structure selection and anchored labels.
- Rotate, labels, layers, focus, wireframe, and dissection controls where available.
- Compact text Mentor or Voice Agent entry point.

### Library

Library becomes the learning-content home, containing:

- Anatomy model catalog.
- Default model assessments.
- Default flashcard decks.
- AI-generated flashcard decks.
- Assessment and flashcard progress.
- Favorites and recently studied content.

Library filters should include content type, model/system, progress, and favorites.

### Lab

- Guided dissection catalog.
- Manual guided mode.
- Voice-guided mode.
- Active objective, progress, and model actions.
- Knowledge checks inside a lab remain separate from full model assessments.

### Removed Navigation

- Remove Systems from the main navigation.
- Remove Notes from the main navigation.
- Preserve existing stored note data until a migration or replacement is explicitly approved.

---

## Phase 3: Account Redesign

**Status (8 August 2026):** Implemented locally around real account and device data. Account now shows profile, credit buckets, accurate subscription states, credit and payment activity, assessment and flashcard progress, favorite models, legacy saved structures, full theme controls, reduced motion, and Voice privacy behavior. Build, lint, and 83 tests pass; desktop/mobile visual review and deployment remain pending.

Use the supplied screenshots as visual inspiration, not as a requirement to add unrelated features.

### Real Account Content

- Profile and sign-out.
- Credit balance by bucket.
- Subscription status and cancellation.
- Recent credit/payment activity.
- Assessment progress.
- Flashcard progress.
- Favorite models and saved structures.
- Theme preference.
- Accessibility and audio preferences.

Do not add planner, friends, streaks, Pomodoro, or detailed analytics until those systems exist.

---

## Phase 4: Default Flashcards

**Status (8 August 2026):** Implemented locally. Every anatomy model has a deterministic free foundations deck with reviewed structure, function, and fact cards. Supported cards use strict existing-model hotspot diagrams with a text-only fallback; no geometry or anatomy identifiers are generated. Study mode supports tap-to-flip, drag-to-rotate with a movement threshold, one active canvas, Previous, Next, Shuffle, keyboard controls, reduced motion, Again/Hard/Good/Easy grading, and progress shown in Library and Account. Signed-in progress now merges with cloud records. A reproducible manifest covers 15 segmented assets and 3,069 structure IDs. Build, lint, and 83 tests pass; desktop/mobile visual review and deployment remain pending.

### Meaning of Default Decks

Default decks are deterministic, verified decks bundled with Stranerd, similar to the current default assessments. They do not cost credits.

Cards are generated during product development from trusted model data, then reviewed and shipped as application content. They are not generated live by AI for each user.

### Default Card Sources

- Structure names and descriptions.
- Model facts.
- Structure-function relationships.
- Spatial relationships.
- Guided dissection objectives.
- Existing anatomy graph and hotspot identifiers.

### Card Types

1. **Identify the structure**
   - Front: 3D model with the target highlighted.
   - Back: structure name, location, function, and concise context.

2. **Structure to function**
   - Front: structure name and 3D context.
   - Back: function and important relationships.

3. **Function to structure**
   - Front: function or anatomical description.
   - Back: named structure highlighted in 3D.

4. **Spatial relationship**
   - Front: relationship question.
   - Back: related structures highlighted or isolated.

5. **Dissection recall**
   - Front: partially hidden or isolated anatomy.
   - Back: target structure and steps used to reveal it.

### Card Interaction

- Tap or click to flip.
- Dragging rotates the 3D model without flipping the card.
- Use a movement threshold to distinguish a tap from a drag.
- Render a live 3D canvas only for the active card to protect mobile performance.
- Provide Previous, Next, Shuffle, and deck progress.
- Add `Again / Hard / Good / Easy` grading.
- Support keyboard controls and reduced motion.
- Persist progress locally first, then sync signed-in progress in a later iteration.

### 3D Diagram Strategy

3D flashcards should not generate new model geometry. A diagram is a validated view into an existing Stranerd model.

Each diagram configuration can contain:

- `modelId`
- `variantId`
- `selectedStructureIds`
- `visibleLayerIds`
- `hiddenStructureIds`
- `transparentStructureIds`
- `isolate`
- camera position or named camera preset

This keeps diagrams accurate, fast, and consistent with Explore and Lab.

---

## Phase 5: AI-Generated Flashcard Decks

**Status (8 August 2026):** Implemented locally with a fixed launch price of 5 credits for 12 cards. Creators choose private or public visibility. Public deck metadata is discoverable to signed-in users, while content remains locked until another user pays Stranerd 5 credits once; creators are never charged to study their own decks and receive no payout. Generation uses protected server credentials, atomic reservations, strict anatomy allowlists, diagram-to-text fallback, private content RLS, and local study progress. Build, lint, and 81 tests pass. The full migration chain applies cleanly after a local database reset; private/public RLS, activation, one-time charging, creator balance isolation, and concurrent unlock behavior have been verified against local Postgres. Remote migration push, desktop/mobile visual review, and deployment remain pending.

### User Flow

1. User opens a model in Library.
2. User selects `Generate new deck`.
3. Show the fixed cost of 5 credits for 12 cards before generation.
4. User chooses optional settings:
   - Difficulty.
   - Structures, functions, relationships, or mixed focus.
   - Include 3D cards where supported.
5. Server reserves the configured credits atomically.
6. AI returns structured JSON card definitions.
7. Server validates every card and every referenced anatomy identifier.
8. Invalid output fails the operation and refunds the reservation.
9. Valid deck is saved and opened in Library.

### Will Generated Decks Have Diagrams?

Yes, where the requested concepts map to existing Stranerd models and known structure identifiers.

The AI may choose from existing validated structures and diagram states. It must never invent mesh IDs or new anatomy geometry.

If a generated concept cannot be mapped confidently to a known structure, the card must gracefully fall back to a complete text-only card. A missing or unsupported 3D diagram must never reject the card or fail the deck. The system should prefer fewer accurate 3D cards over fabricated diagrams while still delivering the requested deck.

### Validation Rules

- Only known model, variant, layer, and structure IDs are accepted.
- Card fronts and backs must be non-empty and length-limited.
- Duplicate cards are rejected.
- Every claim must remain grounded in supplied anatomy data or established scientific knowledge.
- A valid diagram configuration must load before it is attached to a card. If it does not load, remove the diagram configuration and preserve the card as text-only.
- Deck validity depends on the learning content, not on 3D diagram availability.
- Failed or invalid generations have zero net credit cost.

### Launch Pricing

- Generate one 12-card deck: 5 credits.
- Unlock another creator's public deck: 5 credits paid once to Stranerd.
- Creators study their own private or public decks without an unlock charge.
- There is no creator payout or revenue share.

---

## Phase 6: Conversational Voice Agent

**Status (9 August 2026):** Implemented locally with OpenAI Realtime over WebRTC at 10 credits per five-minute session. Microphone permission occurs before charging; permanent credentials stay server-only; captions are ephemeral; sessions expose listening, speaking, muted, error, countdown, and end controls. Explore, active Labs, and assessments send bounded current context without answer keys. Lab completion remains deterministic and learner-controlled; Voice does not execute arbitrary viewer actions. The database enforces fixed-price reservations and records issued sessions. No deployment has been performed.

### Recommended Provider

Use the **OpenAI Realtime API over WebRTC** for the first implementation.

Reasons:

- Low-latency speech-to-speech conversation.
- Natural interruption and turn-taking.
- One realtime session can receive the same anatomy context currently supplied to Mentor.
- Supports tool calls for controlled viewer and Lab actions.
- WebRTC is suitable for browser audio and avoids routing the full audio stream through the Stranerd server.
- The server can issue short-lived session credentials so the permanent API key is never exposed to the browser.

If the current Azure OpenAI account supports a compatible realtime deployment in the required region, Azure Realtime can be evaluated before launch. Otherwise, use OpenAI Realtime for voice while retaining Azure OpenAI for existing text features.

### Why Not Browser Speech APIs Alone?

Browser speech recognition and speech synthesis are inconsistent across devices and do not provide a complete conversational agent. They can be a fallback for accessibility, but should not be the primary implementation.

### Session Flow

1. User chooses `Voice` instead of `Text` for Mentor or Lab guidance.
2. Stranerd requests microphone permission.
3. Browser requests a short-lived realtime session credential from a protected server endpoint.
4. Browser establishes a WebRTC session directly with the realtime provider.
5. Stranerd sends controlled session context:
   - Active model and variant.
   - Selected structures.
   - Moved, hidden, faded, and isolated structures.
   - Current Lab activity and objective.
   - Recent model actions.
   - Relevant verified model facts.
6. User speaks naturally.
7. Agent replies through audio and optionally displays a transcript.
8. Tool calls can request approved application actions.
9. Stranerd validates every tool call before modifying the viewer or Lab state.
10. Session ends when the user closes Voice mode, reaches a time limit, loses connection, or runs out of voice allowance.

### Voice Mentor Capabilities

- Explain the selected structure.
- Answer questions about moved or hidden anatomy.
- Compare structures and systems.
- Ask the learner recall questions.
- Correct spoken explanations.
- Replay or summarize an explanation.
- Switch back to the text transcript at any time.

### Voice-Guided Lab Capabilities

- Tell the learner how to locate a target structure.
- Detect relevant selection and dissection events.
- Confirm whether an objective was completed.
- Ask the learner to explain function or relationships.
- Correct misconceptions.
- Advance to the next objective only through validated Lab state.

Example:

1. Agent says, "Hide the stomach to expose the structure posterior to it."
2. User hides the stomach.
3. Stranerd reports the action to the agent.
4. Agent asks, "Which structure is now visible?"
5. User answers, "The pancreas."
6. Agent confirms and asks for its function.

### Voice UI

- `Text / Voice` mode switch.
- Voice mode collapses the full right sidebar into a compact dock.
- The dock shows listening, thinking, speaking, muted, disconnected, and error states.
- Controls: mute, end session, interrupt, replay, captions, and reopen transcript.
- Keep captions/transcript available for accessibility and recovery.
- Never make voice the only way to complete a Lab.

### Agent Tool Boundaries

The agent may request only allowlisted tools, such as:

- `get_active_model_context`
- `get_recent_dissection_actions`
- `highlight_structure`
- `select_structure`
- `set_lab_objective`
- `advance_lab_step`
- `read_assessment_question`

The browser must not execute arbitrary instructions from the model. Every tool input is validated against known model and activity data.

### Voice Pricing

Realtime audio costs more than text actions. Do not charge one credit unpredictably per conversational turn.

Preferred options:

- Charge a clear number of credits per fixed session block, such as five minutes.
- Or provide voice minutes through a separate allowance for Plus subscribers.

The interface must show the allowance or session cost before microphone activation and warn before a paid session extension.

### Voice Safety and Privacy

- Permanent provider credentials remain server-only.
- Do not store raw audio by default.
- Clearly indicate when the microphone is active.
- Let users delete transcripts if transcripts are persisted.
- Keep medical-education disclaimers in system instructions.
- The agent must not provide diagnosis, treatment, or patient-specific advice.

---

## Phase 7: Audio Assessments

**Status (9 August 2026):** Implemented locally through the shared Voice dock. The agent receives only the current question and options, can read them aloud, and exact spoken A-D or option-text answers are applied without exposing correctness before submission. Spoken next/previous navigation, captions, replay through conversation, and all manual assessment controls remain available. No deployment has been performed.

After Voice Mentor and voice-guided Labs are stable:

- Read questions and options aloud.
- Accept spoken answers such as `A`, `left ventricle`, or a full explanation.
- Confirm what answer was heard before submission when recognition confidence is low.
- Preserve the current delayed-grading assessment behavior.
- Keep manual controls available.
- Allow replay, pause, captions, and question navigation.

---

## Delivery Order

1. Implement System, Light, and Dark themes.
2. Validate every current screen and 3D model in both themes.
3. Simplify navigation to Explore, Library, and Lab.
4. Redesign Library and Lab information architecture.
5. Redesign Account around real functionality.
6. Implement default flashcard decks with 3D cards.
7. Persist and display flashcard progress.
8. Implement paid AI deck generation with validated diagram references.
9. Build compact Voice Mentor with realtime speech.
10. Add voice-guided Lab tools and objective handling.
11. Add audio assessments.
12. Run complete desktop, mobile, accessibility, billing, credit, and 3D regression testing.

---

## Decisions Still Required

- No unresolved product decisions remain in this plan. Deployment timing and final production review remain intentionally separate.

---

## Engineering Guardrails

- Do not replace the current application with shadcn/Tailwind solely for theme support.
- Use semantic CSS variables and existing component boundaries.
- Preserve 3D viewer performance and mobile touch behavior.
- Keep paid actions server-priced and credit-protected.
- Never expose permanent AI, voice, payment, email, or Supabase service keys.
- Keep default learning content available without AI credits.
- Validate all AI-generated structured data against trusted anatomy identifiers.
- Ship each phase behind local review and full regression checks before deployment.
