# Stranerd Full-App Product Design PRD/FRD

**Audience:** Claude Design, product design, product management, engineering, and QA
**Status:** Design handoff
**Product:** Stranerd anatomy learning platform — live at https://learn.stranerd.com
**Scope:** Responsive redesign of the complete public and authenticated product, including a cross-app voice agent

**How to read this document.** Sections 2 through 5 explain why this redesign exists, who it is for, what to fix first, and how success will be judged — start there. Sections 6 through 19 are the functional requirements, which describe a product that mostly already exists. Sections 20 through 21 constrain the visual and technical approach; Section 21 in particular will save significant effort, because the component layer is already built. Sections 22 through 24 define deliverables, acceptance, and the decisions still open. The appendices provide real product content to design against.

Three decisions listed at the end of Section 24 block parts of this work and should be resolved before design begins.

## 1. Purpose

Design Stranerd as one coherent anatomy learning product rather than a collection of separate model, assessment, flashcard, AI, billing, and account interfaces. The result must make complex 3D learning feel approachable while preserving depth for university-level study.

This document defines product behavior and required states. Designers may improve hierarchy, navigation, information architecture, interaction patterns, and visual language, but should not remove required functionality or obscure AI costs.

## 2. Current State and Why We Are Redesigning

**Live product:** https://learn.stranerd.com

This is a redesign of a product that is already built, deployed, and taking payments. It is not a greenfield concept. Before designing anything, spend time in the live application.

**Sections 6 through 19 describe target behavior, not current behavior.** Much of what they specify does not exist yet or exists only partly. This section is the authoritative account of what is actually built, and it separates three different things that are easy to confuse:

- **Works today** — shipped and functioning; design is presenting it better
- **Built but incomplete or broken** — partly implemented, and the requirement elsewhere in this document describes the intended end state rather than reality
- **Does not exist** — no implementation at all

### What works today

- Ten anatomy subjects: Heart, Brain, Lungs, Kidney, Eye, Liver, Nervous System, Skin, Human Anatomy (a layered six-system atlas), and Digestive System. Specimen variants per subject range from one to seven
- Explore with structure selection, variant switching, labels, wireframe, reference layers, auto-rotate, and favorites
- Dissect Mode with hide, show, fade, isolate, drag-to-move, search, grouped structure list, undo, and reset
- Ten guided Labs with deterministic step validation
- Flashcard decks with interactive 3D diagrams, card navigation, and shuffle
- Twenty-question practice tests with deterministic grading, plus paid AI hints, corrections, and freshly generated sets
- Text Mentor
- Realtime Voice with spoken responses, live captions, and continuation across five-minute paid blocks
- Google authentication, a credit ledger, subscription and pay-as-you-go billing, and an account area

The credit system, billing, and data security are production-grade and are not in scope for redesign.

### What is built but incomplete or broken

Design should treat the corresponding requirements as descriptions of the intended end state. Engineering work is needed regardless of design.

1. **Voice cannot operate the application.** The entire allowlisted action set in Section 14.4 is aspirational. Voice today can speak, listen, caption, and receive context about what the learner is looking at, but it has no mechanism to act — there is no tool or function-call handling in the realtime session at all. The single exception is the practice test, where spoken input can select an option A-D, match option text, and move to the next or previous question. Nothing else in Section 14.4 — canvas, dissection, flashcards, Labs, navigation, Notes — is wired up. This is the largest gap between this document and the product.

2. **Flashcard grading is implemented.** Again repeats the current card without marking it reviewed; Hard, Good, and Easy save the attempt and advance when another card is available. Progress is stored locally and synchronized through idempotent review events for signed-in learners.

3. **AI deck generation is implemented at 15 cards.** The server, client, and database now enforce the same size. Legacy 12-card decks remain readable, while all newly generated decks contain exactly 15 cards.

### What is failing today

These problems are observed directly in the shipped implementation. They are the reason this redesign exists, and they are the highest-value things for design to solve.

1. **The specimen is not optically centered.** Each model is centered on its geometric bounding box and viewed from a fixed camera position, while the viewer's title block, tool row, dissection dock, layer dock, and specimen bar are absolutely positioned *over* the same canvas. The anatomy is centered in the DOM element while a significant portion of that element is covered by chrome, so the specimen reads as pushed down and to one side. Nothing recomputes framing when a panel opens or the window resizes. This is the single most visible flaw in the product and the origin of the invariants in Section 13.6.

2. **The visual system has drifted across five generations.** The application loads 9,978 lines of hand-written CSS from five stylesheets, all imported globally, with the same selectors defined in more than one file and later imports silently overriding earlier ones. Light mode was retrofitted rather than designed in. There is no single source of truth for color, spacing, radius, elevation, or motion.

3. **The component migration is half-finished.** The product moved to shadcn/ui but stopped partway. Roughly 102 shadcn component usages coexist with 25 raw `<button>` elements and 11 raw form controls, concentrated in the viewer and dissection dock. Visually similar controls are built two different ways. See Section 21.

4. **The flashcard 3D canvas destabilizes on flip.** Because the card flip is a CSS 3D transform and the 3D canvas lives inside the flipping element, the canvas has repeatedly resized, shifted, or remounted when learners flip between question and answer. This has been fixed more than once and remains fragile.

5. **Asset weight is unbudgeted.** The product ships 95MB of 3D models across 53 files, on top of a 262KB gzipped 3D engine. Weight is very unevenly distributed: eleven specimens are under 500KB, while eighteen exceed 2MB and the largest are close to 8MB. The whole-body atlas is 26MB across its layers. Nothing in the current experience acknowledges download cost, and pricing in naira implies an audience frequently on mobile data.

### What does not exist

- **Notes.** Nothing in Section 13.12 is implemented. There is no note-taking, annotation, or capture of any kind anywhere in the product, and every insight a learner has is lost when they navigate away. The data type exists in the codebase but nothing reads or writes it.
- **Voice control of the application**, as described above.
- **Scheduled spaced repetition.** The implemented grading behavior repeats Again immediately and advances Hard, Good, and Easy; it does not schedule future due dates.

### What we do not yet know

**This section must be completed by the product team before design begins.** No user research is captured in this document, and design should not invent it. The following are needed:

- The top three complaints or confusions reported by current learners
- Where learners abandon the product, both on first visit and in a study session
- What paid learners do differently from free learners
- Which of the ten subjects actually get used, and how often
- Whether Notes (Section 13.12) responds to a real, expressed learner need or is an assumption

Until these are answered, treat every priority in Section 4 as provisional and grounded in engineering observation rather than learner evidence.

## 3. Learner Scenarios

Design against these situations rather than against the requirement lists alone. Each is written from the product as it exists today.

### Scenario A — Forty minutes before a practical

A second-year medical student has a spot-identification practical tomorrow morning and forty minutes tonight. She needs to drill heart valve and vessel identification repeatedly, know which structures she keeps getting wrong, and stop without losing her place. She does not want to read; she wants to be tested.

Today she opens the app to whatever model she last viewed, navigates to Library, finds the Heart deck, and flips cards. Nothing tells her which structures she has been failing, nothing resumes where she stopped, and nothing routes her from a missed card back to the same structure on the 3D model.

### Scenario B — Arriving from a shared link

A first-year student taps a classmate's link on a phone, on mobile data, between lectures. He has never heard of Stranerd, has no account, and will decide in under a minute whether this is worth anything. He needs to touch a real 3D specimen almost immediately, understand that core learning is free, and see what costs credits before he is asked to sign in.

Today he waits on a multi-megabyte model download with little indication of progress or payoff, on a layout where the specimen may be partly hidden behind chrome.

### Scenario C — Studying with hands busy

A learner is revising while commuting or while their hands are occupied. She wants to ask the Voice mentor to show the pancreas, hide the stomach in front of it, and quiz her on what she sees — and she wants to see the interface actually respond so she can trust it and glance down to confirm.

Today Voice works and continues across paid blocks, but the visible interface must stay perfectly synchronized with what the agent does, and the dock must never cover the anatomy or the answer controls it is asking her about.

## 4. Redesign Priorities

Not everything in this document carries equal weight. Design effort should follow this order. Requirements outside P0 remain requirements; they are simply sequenced later.

**P0 — the reasons this redesign exists**

1. The design token and component foundation (Sections 20 and 21). Everything else depends on it, and the current five-stylesheet situation blocks all other work.
2. Explore, the canvas framing invariants, and viewer chrome placement (Section 13.6). The most visible flaw and the most-used screen.
3. Dissect Mode controls and their relationship to the canvas (Section 13.7).
4. The Library-to-flashcard study loop, including flip stability (Sections 13.9 and 13.10).

Note that priorities 4 onward include work that is not merely visual. Flashcard grading and deck generation are implemented, while remaining behavior should still be verified as part of design sequencing rather than assumed.

**P1 — high value, dependent on P0**

5. Practice tests (Section 13.11)
6. Voice presentation and action design across all learning screens (Section 14). The dock exists; the actions do not
7. Mobile layouts for every P0 screen (Section 17)
8. Notes (Section 13.12) — high scope and, per Section 2, not yet validated. Design the smallest version that satisfies the learner need before designing the full requirement list.

**P2 — refinement of areas that currently function**

9. Landing and pricing (Sections 13.1 and 13.2)
10. Account (Section 13.4)
11. Workspace home and model selection (Section 13.5)
12. Authentication and legal (Section 13.3)

## 5. Success Measures

Completeness is not success. Section 23 defines when the design is *finished*; this section defines when it is *good*. The product team should capture a baseline for each of these before the redesign ships, and the design should be evaluated against them afterward.

**Learning experience**

- Time from application open to first structure selected, on desktop and on mobile
- Proportion of started flashcard sessions that reach the end of the deck
- Proportion of started practice tests that reach submission
- Task success rate for the five core tasks in moderated testing with at least five students: find a named structure, isolate it, complete a Lab step, review a deck, and complete a practice test

**Canvas quality**

- The projected center of the specimen sits within 5 percent of the usable viewport's center across desktop, tablet, and mobile, in every panel configuration, verified by visual regression
- No layout configuration clips the specimen at its default framing

**Commercial**

- Guest-to-signup conversion among visitors who reach the workspace
- Free-to-paid conversion
- Proportion of Voice sessions that continue past the first five-minute block

**Quality bars**

- WCAG 2.2 AA audit passes for all non-canvas interface
- A single documented token source replaces the current five stylesheets
- First interactive specimen within a defined time on a mid-range Android device over 3G, per Section 18

## 6. Product Summary

Stranerd combines:

- Interactive 3D anatomy models
- Free exploration and dissection tools
- Guided anatomy Labs
- Practice tests and deterministic grading
- 3D flashcards
- Text AI Mentor
- Realtime Voice Agent
- Learning progress and saved state
- Subscription and pay-as-you-go AI credits

Core anatomy learning remains usable without AI. AI is an enhancement with an explicit credit cost.

## 7. Product Goals

1. Make the next useful learning action obvious on every screen.
2. Make model manipulation, dissection, testing, and recall feel like one continuous learning loop.
3. Let learners operate the application naturally by touch, pointer, keyboard, or voice.
4. Keep 3D anatomy central without allowing controls or side panels to overwhelm it.
5. Communicate progress, AI cost, system status, and consequences before important actions.
6. Deliver a polished experience across desktop, tablet, and mobile.
7. Meet WCAG 2.2 AA expectations for non-canvas UI and provide meaningful alternatives for canvas actions.

## 8. Non-Goals

- Diagnosis, treatment, or patient-specific medical guidance
- Replacing deterministic grading or Lab validation with AI judgment
- Arbitrary AI clicking based on screen coordinates
- Voice-agent permission modes
- A user-facing voice-agent action-history screen
- Voice controls on marketing, authentication, billing, account, or legal pages

## 9. Users

### Primary

- University anatomy and health-science students
- Learners preparing for practical and written anatomy examinations
- Visual learners who benefit from spatial exploration

### Secondary

- Instructors demonstrating anatomical relationships
- Independent learners revising foundational anatomy
- Learners who need hands-free or voice-assisted interaction

## 10. Experience Principles

### Anatomy first

The selected structure, specimen, and learning objective should remain visually dominant. UI chrome must support rather than compete with the anatomy.

### Active learning over passive viewing

Every area should naturally lead toward observation, manipulation, recall, explanation, and assessment.

### Context must persist

Selected model, structure, activity, card, question, and agent context should remain understandable when panels open, layouts collapse, or devices change.

### AI must be explicit

Show what an AI action will do and its credit cost before charging. Failures must not silently consume credits.

### Manual controls remain available

Voice may accelerate tasks but must never become the only way to complete them.

## 11. Information Architecture

### Public routes

- `/`: Landing page
- `/pricing`: Plans and credit packs
- `/login`: Google sign-in and sign-up
- `/auth/callback`: Authentication progress/result
- `/billing/success`: Payment confirmation
- `/billing/cancelled`: Cancelled checkout
- `/legal/privacy`: Privacy policy
- `/legal/terms`: Terms of service
- `/legal/refunds`: Refund policy
- Unknown route: 404

### Authenticated and guest learning workspace

- `/app`: Main learning product
- Explore: model inspection and free dissection
- Library: flashcards and practice tests
- Lab: guided anatomy activities
- Notes: searchable study notes linked to anatomy and learning activities

### Account

- `/account`: Profile, learning summary, preferences, credits, plan, billing, and activity

### Deep-link requirements

Design must accommodate links that open a model, structure, workspace area, assessment, deck, card side, note, or Voice context directly. The UI should clearly orient the learner after deep linking.

## 12. Global Navigation

### Desktop

- Persistent product navigation for Explore, Library, Lab, and Notes
- Model/subject access without losing the current workspace context
- Current model and current task visible in hierarchy or breadcrumb
- Account and credit balance accessible without dominating the workspace
- Contextual agent entry available throughout supported learning screens

### Mobile

- Compact top bar for current context and essential actions
- Reachable Explore, Library, Lab, and Notes navigation
- Model/subject selection through a drawer or equivalent focused pattern
- Voice Agent entry that does not cover primary controls or conflict with safe areas
- Panels should become sheets or full-screen task views when necessary

## 13. Complete Screen Requirements

### 13.1 Landing Page

Required content:

- Brand proposition and primary CTA
- Live or representative 3D anatomy demonstration
- Product learning loop
- Explore and dissection explanation
- Labs, assessments, flashcards, Text Mentor, and Voice Agent
- Anatomy subject catalog
- Pricing summary
- Trust, privacy, and AI-credit transparency
- FAQ and final CTA
- Responsive public header, mobile navigation, and footer

The landing experience may be visually expressive, but performance and legibility take priority over decorative 3D.

### 13.2 Pricing

Plans:

- Free: NGN 0 and 20 one-time signup credits
- Plus: NGN 2,500 monthly and 500 credits per billing cycle
- PAYG: NGN 500 for 100 non-expiring credits

Requirements:

- Clearly compare core free learning and paid AI usage
- Explain credit order: free, subscription, purchased
- Explain renewal, expiration, cancellation, and PAYG behavior
- Support signed-in, signed-out, loading, checkout, failure, and current-plan states

**Blocking product decision.** As currently priced, Plus and PAYG both cost exactly NGN 5 per credit, so the subscription offers no unit-price advantage over buying packs. There is no favorable comparison for design to present and no layout that solves this. Pricing must be resolved before this screen is designed — see Section 24.

### 13.3 Authentication

- Google authentication only
- Sign-in and sign-up framing
- Safe return to the learner's intended destination
- Loading, callback, configuration error, and authentication failure states
- Reassurance about account purpose without unnecessary form fields

### 13.4 Account

Required sections:

- Profile and sign out
- Learning summary and progress
- Favorite models and relevant saved learning items
- Credit balance split into free, subscription, and purchased buckets
- Current plan and renewal/cancellation state
- Subscribe, cancel, and buy-credit actions
- Credit transactions and payment history
- Theme and reduced-motion preferences
- Voice privacy disclosure
- Account deletion request

### 13.5 Workspace Home and Model Selection

- Orient first-time and returning learners
- Show available anatomy subjects and useful resume actions
- Current subjects include Heart, Brain, Lungs, Kidney, Eye, Liver, Nervous System, Skin, Human Anatomy, and Digestive System
- Distinguish realistic, segmented, and alternate specimens where applicable
- Clearly indicate loading, unavailable, incomplete, or unsupported model capabilities

### 13.6 Explore

Required anatomy-canvas capabilities:

- Rotate, zoom, and inspect
- Select one or multiple structures where supported
- Switch model variants/specimens
- Search structures
- Show structure name and concise educational context
- Favorite model
- Reset camera
- Toggle labels
- Toggle wireframe
- Toggle reference layers
- Toggle auto-rotation
- Whole-body system/layer visibility
- Theme-aware model presentation
- Reduced-motion behavior

Design all controls for default, hover, focus, active, disabled, loading, unsupported, and error states. Avoid unexplained icon-only controls.

Canvas framing is a product invariant:

- The specimen begins optically centered within the usable canvas, not merely the full DOM container
- Opening, closing, resizing, or docking navigation, Mentor, Voice, structure details, Notes, and tool panels must recompute the usable viewport and preserve optical centering
- Browser resize, device rotation, breakpoint changes, full-screen mode, and mobile keyboard changes must not leave the specimen clipped or shifted
- Switching models or variants fits the complete specimen to a consistent safe area while respecting model-specific scale
- Selecting, isolating, hiding, fading, or moving a structure must not accidentally alter the camera
- Agent-driven camera movement must end with the requested target centered and fully visible, with suitable padding for labels and overlays
- Loading and model replacement must not flash the specimen at an incorrect scale or position
- Canvas overlays and toolbars must reserve space so they do not cover the anatomical focus

**Usable canvas.** Define the usable canvas as the canvas area minus every region reserved by persistent chrome: the title block, the tool row, the specimen bar, the dissection dock, the layer dock, the Voice dock, and any open Notes or Mentor panel. Optical centering is measured against this rect, never against the full canvas element. Design must specify the reserved inset on each breakpoint so engineering can compute it.

**Canonical camera — design must produce this.** Each of the ten subjects needs a documented default camera: position, target, zoom, and orientation, chosen so the whole specimen fits the usable canvas with consistent padding and presents its most legible teaching view. "Reset camera" restores exactly that state. This table does not exist yet and is a required deliverable (Section 22, Phase 1, item 4), not an existing reference. It should also resolve the differing framings described in Section 21.

**Centering tolerance.** The projected center of the specimen's bounding box must remain within 5 percent of the usable viewport's smaller dimension from that viewport's center, verified by visual regression on desktop, tablet, and mobile in every panel configuration. Design may propose a different tolerance with rationale, but a number must be fixed before implementation.

### 13.7 Dissect Mode

Required tools:

- Select and multi-select
- Hide and show
- Show all
- Fade or make transparent
- Isolate
- Move structures
- Touch-specific move mode
- Search and grouped structure list
- Undo
- Reset
- Visible indication of selected, hidden, transparent, isolated, or moved structures

Destructive or broad reset actions require confirmation. Undo must remain easy to access after model changes.

### 13.8 Lab

Each guided Lab combines model actions and knowledge checks.

Requirements:

- Current activity, objective, step, and progress
- Clear instruction tied to the canvas
- Required action and completion feedback
- Immediate educational explanation
- Multiple-choice knowledge checks
- Manual and Voice-guided completion
- Recovery when the learner manipulates the wrong structure
- Clear distinction between AI guidance and deterministic objective validation
- Resume, completion, and next-learning-action states

### 13.9 Library

Content areas:

- Flashcard sets
- Practice tests
- Personal AI-generated decks
- Community decks

Requirements:

- Search
- Model/subject filter
- Progress filter
- Not started, in progress, and complete states
- Progress and resume information
- Generate, unlock, and report actions with explicit costs — **generation and unlock are currently broken and unreachable** (Section 2); design these as new flows rather than as refinements of an existing experience
- Empty, loading, unavailable, and failure states

### 13.10 Flashcards

Requirements:

- Deck title, source, progress, card number, previous, next, and shuffle
- Question and answer sides
- Stable interactive 3D model on applicable cards
- Card models remain optically centered and retain identical camera framing through repeated question/answer flips
- Flipping must not remount, resize, zoom, rotate, translate, or progressively shift the 3D canvas
- Navigating to another card resets that card to its canonical centered framing
- Returning to a previously seen card resets it to canonical framing rather than restoring the learner's earlier rotation, so that a card looks identical every time it is drilled. Design may argue for preserving rotation instead, but the behavior must be decided and documented here rather than left open
- Dragging the model must not flip the card
- Reveal answer and return-to-question actions
- Keyboard and touch support
- Again, Hard, Good, and Easy review grades. Again saves the attempt and repeats the question; Hard, Good, and Easy save the attempt and advance to the next card when available
- Clear card transition without disorientation
- Text-only fallback when no model is available
- Voice commands for reveal, flip, navigation, shuffle, grading, and model interaction

### 13.11 Practice Tests

Requirements:

- Question, A-D options, current selection, question number, and progress
- Previous/next and question navigator
- Unanswered-state visibility
- Submission only after required questions are answered
- Confirmation before final graded submission
- Score, pass-oriented feedback, answer review, and detailed corrections
- Paid hint, correction, and new-assessment actions with visible costs
- Voice selection such as “choose option B” must visibly update the same manual UI
- AI must not expose or infer answer keys before submission

### 13.12 Notes

Notes are a first-class learning workspace, not an account-history list.

**Scope warning.** Nothing in Notes is built today, and no learner has been observed asking for it (Section 2). This is the largest and least-validated feature in this document. Design the smallest version that serves a real captured need first, validate it, and treat the full list below as the eventual target rather than the first deliverable. The requirements are ordered roughly by how essential they are.

Requirements:

- Create a blank note from Notes or a contextual note from a model, structure, Lab step, flashcard, or submitted practice-test question
- Automatically attach useful source context such as model, structure, activity, deck/card, question, and creation time without inserting answer keys from unsubmitted tests
- Rich but restrained editing: title, plain text, headings, lists, emphasis, and links
- Search note title and body
- Filter by anatomy subject, structure, source type, and recently updated
- Sort by recently updated, recently created, and title
- Pin, rename, duplicate, archive, restore, and permanently delete
- Confirm permanent deletion and support undo for reversible archive actions
- Show backlinks from a note to its source and from supported learning contexts to related notes
- Allow a learner to open a note beside the canvas on desktop and as a sheet or focused editor on mobile
- Autosave with explicit saving, saved, offline, conflict, and failed states
- Preserve drafts during navigation and accidental closure
- Support local notes for guests and secure cross-device synchronization for signed-in users, with a clear sign-in/sync explanation
- Export an individual note or selected notes in a portable text-based format
- Notes must never obscure the canvas target; opening the Notes panel must trigger correct canvas recentering

### 13.13 Text Mentor

- Contextual to current model, selected structure, Lab, or assessment
- Suggested prompts and free-form input
- Current credit balance and one-credit action disclosure
- Sending, streaming/typing, success, error, timeout, sign-in, and insufficient-credit states
- Conversation remains secondary to the learning task

## 14. Cross-App Voice Agent

### 14.1 Availability

Voice Agent should be consistently available on supported learning screens:

- Explore and Dissect
- Active Labs
- Flashcards
- Practice tests
- Notes
- Other future authenticated learning activities

It should not appear on landing, pricing, login, callback, billing, account, legal, or 404 screens.

### 14.2 Entry and Active Session

Before activation, communicate:

- Microphone use
- 10 credits per five-minute block
- Automatic continuation for another five minutes when at least 10 credits remain
- Captions and ephemeral transcript behavior

Active dock requirements:

- Connecting, listening, thinking, speaking, muted, reconnecting, ended, and error states
- Remaining paid time
- Current context
- Ephemeral captions
- Mute, interrupt, replay-last-response, captions, and end controls
- Clear renewal or insufficient-credit message
- Minimized and expanded presentations
- No obstruction of primary model or answer controls

### 14.3 Agent Context

The agent should understand only the bounded context needed for the current task:

- Current route and workspace area
- Model and specimen variant
- Selected structure(s)
- Visible layers and viewer state
- Recent relevant model actions
- Current Lab objective and deterministic progress
- Current flashcard and visible side
- Current assessment question, options, selection, and submission state
- Current note, cursor/selection context, linked learning source, and unsaved state when Notes is active
- Available action tools

Assessment answer keys must not be included before submission.

### 14.4 Allowlisted Actions

The software must perform actions through named application functions, never arbitrary screen-coordinate clicks.

> **Not implemented.** Voice currently has no ability to act on the application beyond practice-test option selection and question navigation. Everything below is target behavior requiring engineering work, not a description of the product. See Section 2.

Global and navigation actions:

- Explain what actions are available on the current screen
- Navigate supported workspace areas
- Open a model, deck, test, or Lab
- Open Notes or a specific related note
- Go back, next, or previous
- Undo and redo where the underlying feature supports them

Canvas actions:

- Zoom in or out
- Rotate left, right, up, or down
- Pan where supported
- Reset camera
- Focus on a named structure
- Select or deselect a named structure
- Toggle labels, wireframe, reference layers, or auto-rotate
- Change specimen variant
- Center the complete model or selected structure in the usable viewport
- Fit the model or selection without clipping labels, toolbars, captions, or the Voice dock

Dissection actions:

- Hide, show, fade, isolate, or move named structures
- Show all structures
- Change visible systems/layers
- Undo or reset dissection

Flashcard actions:

- Reveal answer or show question
- Flip card
- Next, previous, or shuffle
- Apply Again, Hard, Good, or Easy
- Manipulate the card's 3D model

Practice-test actions:

- Select option A-D or matching option text
- Change an answer
- Next or previous question
- Request a hint with explicit cost confirmation
- Submit only after explicit confirmation
- Read post-submission corrections

Lab actions:

- Perform the same allowlisted viewer/dissection actions
- Read the objective and explain the next step
- Advance only when deterministic application validation succeeds

Notes actions:

- Create a note from the current model, selected structure, Lab step, flashcard, or submitted practice-test question
- Dictate a title or note body
- Insert, replace, append, or format selected note text
- Read back the current note or a concise summary
- Search and open notes by title, anatomy subject, structure, or source
- Link the current note to the active learning context
- Pin, rename, duplicate, archive, restore, or export a note
- Ask for confirmation before permanently deleting a note
- Never include an unsubmitted practice-test answer key in a note

### 14.5 Agent Feedback and Safety

- Visually highlight the intended target before or while acting when practical
- Announce what changed in concise language
- If a structure name is ambiguous, ask one clarifying question
- If an action is unavailable, explain why and suggest valid alternatives
- Confirm destructive resets, paid AI actions, and graded submissions
- Do not confirm routine reversible navigation or selection
- Keep manual controls synchronized with voice actions
- Keep the visible Notes editor synchronized with dictated or agent-edited content and preserve the learner's cursor where practical
- Never claim success unless the application action reports success
- Do not diagnose, prescribe, or provide patient-specific medical advice

Permission modes and a user-facing action history are explicitly out of scope.

## 15. Credits and Voice Continuation

- Initial Voice block: five minutes for 10 credits
- At approximately 30 seconds remaining, the system attempts to reserve the next block
- If at least 10 credits are available, add five minutes without dropping the realtime conversation
- Repeat while sufficient credits remain
- If credits are insufficient, preserve the current session until its paid deadline and provide a clear message
- A transient renewal failure should retry without prematurely ending paid time
- Ending manually stops future renewals
- Every successful extension updates the visible balance and timer

## 16. Shared States

Every major screen or component must define:

- Initial/loading
- Empty
- Ready
- Hover/focus/pressed/selected
- Disabled/unsupported
- Success
- Recoverable error
- Offline or connection loss where relevant
- Authentication required
- Insufficient credits
- Reduced motion
- Light and dark themes where applicable

Use skeletons for structural loading, concise inline notices for recoverable issues, and dialogs only when user attention or confirmation is required.

## 17. Responsive Requirements

Design at minimum for:

- Mobile: 320-767px
- Tablet: 768-1199px
- Desktop: 1200px and above
- Large desktop: canvas expansion without excessively wide reading text

Requirements:

- Touch targets at least 44 by 44 CSS pixels
- Respect notches and safe areas
- Avoid hover-only disclosure
- Keep canvas gestures separate from page scrolling
- Preserve readable captions and questions while the keyboard is open
- Support portrait and landscape model use
- Prevent fixed agent UI from obscuring assessment or model controls
- Recalculate the usable canvas center whenever a responsive panel, Notes editor, keyboard, caption area, or Voice dock changes size

## 18. Performance Budget

Performance is a design constraint here, not an engineering afterthought. Prices are set in naira, so a substantial share of learners will arrive on mid-range Android devices over mobile data, and the core content is multi-megabyte 3D geometry.

Current weight:

- 3D engine bundle: 977KB raw, 262KB gzipped, loaded before any specimen renders
- Individual specimens vary enormously: of 53 model files, eleven are under 500KB — the smallest is 80KB — while eighteen exceed 2MB and the largest approach 8MB
- Whole-body atlas: 26MB across its six layers, the heaviest single experience
- Full model library: 95MB

That spread is itself a design opportunity. A learner choosing between a 300KB specimen and a 7MB one is making a meaningful decision on a metered connection, and nothing currently tells them so.

Budgets to design against, on a mid-range Android device over a 3G connection:

- Something meaningful and branded is on screen within 2 seconds
- The learner can interact with a specimen within 8 seconds of choosing it
- No screen blocks on a download without showing progress and an accurate expectation of size or time

Design requirements:

- Specify what the learner sees during model download: real progress, not an indefinite spinner, and where practical a low-resolution or partial specimen that becomes interactive early
- Specify a useful action the learner can take while a model loads, so waiting is not dead time
- Disclose download size before a large specimen is fetched on a metered connection, and offer a way to proceed deliberately
- Specify the behavior when a model fails to load, loads partially, or is unavailable
- Treat the whole-body atlas as a distinct case: its layers load progressively and the learner should be able to begin with one system rather than waiting for all six
- Design the model catalog so weight is visible in the browse experience rather than discovered after selection
- Landing-page 3D must not delay the primary call to action

## 19. Accessibility Requirements

- WCAG 2.2 AA contrast and focus visibility
- Semantic heading and landmark hierarchy
- Skip-to-content support
- Keyboard access to all non-spatial controls
- Textual structure list as an alternative entry point to canvas selection
- Accessible names and state announcements for viewer tools
- Captions for all Voice responses
- Reduced-motion mode that removes nonessential transitions and auto-rotation
- Do not rely on color alone for anatomy or grading state
- Focus trapping and restoration for dialogs and sheets
- Announce agent-performed UI changes through appropriate live regions without excessive chatter

## 20. Visual Direction

The design team should establish a distinctive, credible educational identity rather than a generic SaaS dashboard.

Retain or reinterpret:

- Clinical blue for primary learning/navigation actions
- Restrained violet for Mentor and Voice
- Green for success, amber for warning/hints, and red for destructive/error
- High-quality light and dark workspace themes
- A more expressive editorial marketing system
- Clear separation between anatomy content, deterministic system feedback, and AI output

The final system should consolidate duplicate CSS generations into documented tokens for typography, spacing, radius, elevation, color, motion, and canvas overlays.

## 21. Implementation Constraints

Design should work with the existing technical foundation rather than around it. These constraints are not negotiable within this redesign, and two of them significantly reduce the work required.

### The component layer is already shadcn/ui

The front end is built on shadcn/ui, and this materially changes what the component-library deliverable means.

- Style preset `radix-nova`, base color `neutral`, CSS variables enabled, configured in `components.json`
- Built on Radix UI primitives, styled with Tailwind CSS v4, using `class-variance-authority` for variants and `lucide` for icons
- Seventeen components are already vendored into the codebase: avatar, badge, button, card, dialog, dropdown-menu, input, progress, scroll-area, select, separator, sheet, skeleton, switch, tabs, textarea, and tooltip
- Every screen in the product already imports from this layer — roughly 102 usages across 17 files

**What this means for design.** Do not design a component library from first principles. The deliverable is a *token layer and a documented set of overrides* on top of shadcn: the color, typography, spacing, radius, elevation, and motion variables that `shadcn.css` exposes, plus per-component variant specifications where Stranerd needs something the default preset does not provide. Any proposed component that has no shadcn or Radix equivalent should be called out explicitly with a rationale, because it becomes bespoke code to build and maintain.

**The migration is incomplete, and finishing it is in scope.** Twenty-five raw `<button>` elements and eleven raw form controls remain outside the component layer, concentrated in the viewer chrome and the dissection dock, where ten raw buttons sit in a single component. The result is that visually similar controls are built two different ways. Design should specify the dissection dock, viewer tool row, and layer dock in terms of the shadcn component set so this can be unified rather than re-diverged.

**Five stylesheets must collapse to one source of truth.** The application currently loads `shadcn.css`, `styles.css`, `landing.css`, `app.css`, and `design-system.css` globally, totalling 9,978 lines, with the same selectors defined in multiple files and resolved by import order. The token system in Section 20 replaces this. Assume nothing in the existing CSS is authoritative.

### The canvas is WebGL with HTML chrome

The 3D viewer is Three.js via React Three Fiber. Everything drawn inside the canvas is WebGL and cannot be styled with CSS; every control, label, panel, and dock around or over it is ordinary HTML positioned above the canvas. Specify canvas chrome as HTML components with real layout, and specify in-canvas presentation — highlight colors, selection treatment, label leader lines, material states for hidden, faded, and isolated structures — as separate rendering guidance with explicit color values for both themes.

This split is also why Section 13.6 matters: because the chrome is HTML layered over the canvas, it is entirely possible for it to cover the anatomy, and only the design can define the reserved space that prevents it.

### Canvas guardrails

The 3D viewer is the most fragile part of the product and the easiest to break with a reasonable-sounding design decision. These constraints protect it. Each names a specific failure, and design should raise any requirement that conflicts with one rather than leaving it to be discovered in implementation.

**Centering must be solved in layout, never by moving the model.** Specimens are normalized on load, but not identically, and design should be aware there are three separate transforms rather than one:

- The main viewer and segmented specimens scale each model so its largest dimension is 3.15 world units and translate its bounding-box center to the origin
- Flashcard diagrams use the same approach with a different constant, 3.05, so a specimen is framed slightly differently on a card than in Explore
- The whole-body atlas does not bounding-box normalize at all; it applies a fixed group transform, so its framing is independent of the other two

Sixty-three hand-authored structure-marker positions across the ten subjects are expressed as coordinates in the main viewer's space, and learners' saved dissection state stores drag offsets in it too. Changing any normalization — a scale constant or a centering translation — to compensate for chrome would silently pull markers off their structures and corrupt saved sessions, and because the three paths differ, a fix applied to one would not transfer to the others. Achieve optical centering by sizing the canvas element to the usable area or by applying a camera view offset. Both leave authored coordinates untouched.

Design should also decide whether the three framings *should* differ. A specimen that looks different on a flashcard than in Explore may be a deliberate choice or may be an inconsistency worth removing; the canonical camera table in Section 22 is the place to settle it.

**Zoom limits currently conflict with the agent's focus actions.** The viewer clamps camera distance between 2.2 and 8 units for every subject. The allowlisted "focus on a named structure" and "fit the model or selection" actions in Section 14.4 cannot be satisfied within that clamp — 2.2 units is too far away to fill the frame with a small structure inside a 3.15-unit specimen. Design should specify intended framing for a focused structure so the clamp can be made dynamic per subject and per selection.

**Do not design views with several live 3D previews at once.** Each canvas holds its own WebGL context and browsers permit only a limited number simultaneously, commonly eight to sixteen. Past that limit the browser discards the oldest context and those canvases go blank. A deck grid, model catalog, or card carousel showing many specimens must use static images, with live 3D reserved for the focused item.

**Panel transitions must not resize the canvas on every frame.** The main canvas has no resize debouncing configured, so a panel that animates its width by changing layout forces a canvas resize each frame of the animation — expensive on the mid-range mobile hardware described in Section 18. Specify panel transitions that animate with a CSS transform and resize the canvas once on completion, or that resize once rather than continuously.

**The canvas renders on demand.** It draws a frame only when something changes, unless auto-rotate is enabled. Any design implying continuous motion — ambient drift, parallax, pulsing selection highlights, animated label leaders — forces continuous rendering with a real battery and thermal cost. Continuous motion is allowed, but call it out explicitly so it is a decision rather than a side effect.

**In-canvas colors must be delivered as explicit values, and they carry meaning.** WebGL cannot read CSS custom properties, so no token or variable reaches the specimen surface; canvas color direction must be given as literal hex values. More importantly, structure materials are currently chosen to be anatomically plausible — skin, cerebellum, sclera, retina, optic nerve and many others each have their own tuned color. A purely aesthetic palette applied to tissue will make specimens read as anatomically wrong to students. Treat in-canvas color as anatomical illustration, and confine brand expression to the surrounding chrome.

**The flashcard 3D diagram must stay mounted through a flip.** The diagram currently sits inside the element that rotates, which is why flipping has repeatedly disturbed it. Any flip treatment that changes DOM structure around the canvas destroys and recreates its WebGL context, producing a visible flash. Prefer a treatment that keeps the canvas in a stable container outside the rotating or transitioning element, such as cross-fading the text faces while the specimen stays put.

**Reduced motion already suppresses auto-rotation**, and must continue to.

### Platform

React 19 and Vite, deployed on Vercel, with Supabase for authentication and data, and Google as the only identity provider. Routing is client-side over a small set of public routes plus the `/app` workspace. Note that `/app` is not gated: guests reach the full workspace and can explore, dissect, and study without an account, with sign-in required only for AI features that spend credits. Design should treat the guest workspace as a first-class state rather than an interstitial. There is no server-rendered HTML, so first paint is gated on the JavaScript bundle — another reason Section 18 matters.

## 22. Design Deliverables

Claude Design and the product team should provide the following, sequenced in three phases. Each phase should be reviewed before the next begins, so that foundation decisions are settled before they are applied across every screen.

### Phase 1 — Foundation

1. **Design tokens**: typography, spacing, radius, elevation, color, motion, and canvas-overlay scales, expressed as the CSS variable layer that shadcn consumes (see Section 21), for both light and dark themes
2. **Component specification**: the shadcn component set with Stranerd variants and states, plus an explicit list of any component that has no shadcn or Radix equivalent
3. **Revised sitemap and navigation model**, resolving the open questions in Section 24
4. **Canvas framing specification**: the usable-canvas inset at each breakpoint, reserved chrome regions, the canonical camera table for all ten subjects, camera transition behavior, and the centering tolerance

### Phase 2 — Core learning experience

5. Desktop, tablet, and mobile wireframes for the P0 screens in Section 4
6. High-fidelity screens for Explore, Dissect Mode, Library, and Flashcards, in both themes
7. Canvas toolbar and dissection interaction specification, including in-canvas rendering guidance for selected, hidden, faded, isolated, and moved structures
8. Loading, empty, error, disabled, unauthenticated, insufficient-credit, and reduced-motion states for those screens
9. End-to-end user flows for first visit, exploration, Lab, flashcards, and practice test
10. Model loading and download-disclosure experience per Section 18

### Phase 3 — Full product

11. High-fidelity screens for every remaining route and workspace mode
12. Full Voice Agent entry, active, renewal, insufficient-credit, and error flows
13. Notes, scoped per Section 4 before being designed in full
14. Checkout and account flows, following the pricing decision in Section 24
15. Clickable prototype for core learning and Voice flows
16. Accessibility annotations
17. Responsive behavior and handoff annotations
18. Content and copy recommendations where labels are unclear, including the terminology in Appendix B

## 23. Acceptance Criteria

These criteria establish that the design is *complete*. They do not establish that it is *good* — Section 5 defines that, and both bars must be met.

The design is ready for engineering when:

- Every route and primary feature in this document has a designed state
- A learner can move from model exploration to Lab, flashcards, and practice tests without losing orientation
- The canonical camera table covers all ten subjects and the usable-canvas inset is specified at every breakpoint
- Design tokens map onto the existing shadcn variable layer, and every specified component is either an existing shadcn component, a documented variant of one, or an explicitly justified addition
- No screen in the design violates a canvas guardrail in Section 21, and any requirement that conflicts with one has been raised and resolved rather than left for implementation
- A learner can create, find, edit, link, sync, export, archive, and recover Notes across supported learning contexts
- All canvas and dissection actions have discoverable manual controls
- Every model and flashcard specimen remains optically centered through repeated flips, panel changes, resizes, navigation, and responsive layout changes
- Agent focus and zoom actions finish with the requested structure centered, visible, and unobstructed
- Voice can invoke each allowlisted action through visible synchronized UI
- Voice can create and manage Notes while keeping the visible editor and saved state synchronized
- Paid, destructive, and graded actions have appropriate confirmation
- Voice can continue across five-minute blocks without an interaction reset
- Mobile layouts preserve access to the canvas, learning task, and agent controls
- Empty, loading, error, unauthenticated, and insufficient-credit states are specified
- Accessibility and reduced-motion behavior are annotated
- Design tokens and reusable components are implementation-ready

## 24. Open Product Decisions for Design Review

- Whether workspace navigation should remain three top-level areas or use a learning-path structure
- Whether the Voice dock should minimize to a floating control or attach to a persistent assistant rail on desktop
- How personal decks, community decks, and generated assessments should be grouped in Library
- How much learning progress belongs in the workspace versus Account
- Whether Notes should be a permanent top-level workspace destination or a globally available contextual panel with a dedicated index
- Whether the whole-body layer controls need a distinct interaction pattern from segmented-organ dissection
- The best visual preview/confirmation pattern for agent-targeted anatomy actions

These decisions may be explored in design, but proposed changes must preserve all functional requirements above.

### Decisions that block design and must be resolved by the product team first

- **Pricing.** Plus and PAYG are currently the same NGN 5 per credit, leaving the subscription with no unit-price advantage. Either differentiate the subscription — a lower per-credit rate, included credits that would otherwise cost more, or non-credit benefits — or accept the parity and decide what the subscription is actually selling. The pricing screen cannot be designed until this is settled.
- **Learner evidence.** The research gaps listed at the end of Section 2, which determine whether the Section 4 priorities are correct.
- **Notes scope.** Whether Notes addresses an expressed learner need, and if so the smallest version that does. Section 13.12 currently specifies a large feature that no learner has been observed asking for.

## Appendix A: Real Content

Design with this content rather than placeholder text. These are the actual strings the product renders, and several of them are longer or more awkward than lorem ipsum will suggest.

### Real practice-test questions

> **Where does portal blood carrying absorbed nutrients travel before systemic distribution?**
> A. Directly to the lungs · B. First to the liver · C. First to the kidneys · D. Directly to the left ventricle

> **Which major division most directly refines movement timing and motor adaptation?**
> A. Frontal lobe · B. Temporal lobe · C. Cerebellum · D. Optic chiasm

Generated questions always have exactly four options. Option text is drawn from anatomical structure names, so options range from one word ("Lens") to several ("Toward the CNS from sensory receptors"). Explanations run to roughly 25 words: *"The hepatic portal circulation routes nutrient-rich gastrointestinal blood through the liver first."*

A practice test is 20 questions, so the question navigator must handle 20 items with answered, unanswered, and current states.

### Real structure and content strings

Structure names come from the 3D model geometry and include long Latin and compound terms. Scientific names appear beneath model names: Cor, Encephalon, Pulmones, Ren, Oculus, Hepar, Cutis, Corpus humanum, Systema nervosum, Systema digestorium.

Lab step prompts are imperative and specific: *"Select and hide the stomach to expose structures behind it."* · *"Select the structure that receives pancreatic secretions."*

Structure explanations run 15 to 30 words: *"The optic nerve carries visual signals from retinal ganglion cells toward central visual pathways."*

Clinical condition labels attach to structures: Myocardial infarction, Chronic kidney disease, Osteoarthritis, with summaries such as *"Progressive kidney damage reduces filtration and disrupts fluid and electrolyte balance."*

All ten Lab titles: Trace cardiac flow · Connect the cerebral hemispheres · Follow the conducting airway · Trace the urinary pathway · Follow the optical pathway · Explore bile storage and flow · Expose the pancreatic pathway · Study central neural pathways · Relate skin layers to function · Investigate the femur

### Real quantities

| Thing | Real value |
| --- | --- |
| Anatomy subjects | 10 |
| Guided Labs | 10 |
| Specimen variants per subject | 1 to 7 — Human Anatomy has one, Brain has seven |
| Whole-body atlas layers | 6 (skin, muscular, skeleton, cardiovascular, nervous, organs) |
| Model files | 53, from 80KB to nearly 8MB |
| Questions per practice test | 20, always four options |
| Cards in an AI-generated deck | 15 |
| Grades per flashcard | 4 (Again, Hard, Good, Easy) |
| Structures in a dissection list | dozens, grouped by region |

Design against a variant count of one through seven. The specimen switcher must work when there is nothing to switch to, and must not become unusable at seven.

### Real credit costs and balances

| Action | Credits |
| --- | --- |
| Text Mentor reply | 1 |
| Practice-test hint | 1 |
| Detailed corrections | 2 |
| New 20-question set | 5 |
| Generate a 15-card deck | 5 |
| Unlock a community deck | 5 |
| Voice, per five minutes | 10 |

Signup grants 20 free credits. Balances are held in three buckets — free, subscription, purchased — and spent in that order, so the account and credit interfaces must show three numbers, not one.

## Appendix B: Glossary

The product currently uses several names for the same thing. These are the canonical terms; design should use them consistently in all interface copy and flag any remaining drift.

| Use | Not | Meaning |
| --- | --- | --- |
| Practice test | Assessment, quiz | The 20-question deterministically graded test |
| Mentor | Text Mentor, AI Mentor | The text-based AI assistant |
| Voice | Voice Agent, Voice Mentor | The realtime spoken assistant |
| Lab | Guided activity, dissection activity | A guided multi-step anatomy activity |
| Explore | Workspace, viewer | The free model inspection area |
| Specimen variant | Model variant, version | An alternative mesh for the same subject |
| Structure | Hotspot, part | A named anatomical element in a model |
| Subject | Model, organ | One of the ten anatomy topics |
| Dissect Mode | Dissection | The tool mode for hiding, fading, isolating, and moving structures |
| Credits | Tokens, balance | The unit of paid AI usage |
