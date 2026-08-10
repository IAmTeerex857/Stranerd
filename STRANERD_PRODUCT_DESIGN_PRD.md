# Stranerd Full-App Product Design PRD/FRD

**Audience:** Claude Design, product design, product management, engineering, and QA
**Status:** Design handoff
**Product:** Stranerd anatomy learning platform
**Scope:** Responsive redesign of the complete public and authenticated product, including a cross-app voice agent

## 1. Purpose

Design Stranerd as one coherent anatomy learning product rather than a collection of separate model, assessment, flashcard, AI, billing, and account interfaces. The result must make complex 3D learning feel approachable while preserving depth for university-level study.

This document defines product behavior and required states. Designers may improve hierarchy, navigation, information architecture, interaction patterns, and visual language, but should not remove required functionality or obscure AI costs.

## 2. Product Summary

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

## 3. Product Goals

1. Make the next useful learning action obvious on every screen.
2. Make model manipulation, dissection, testing, and recall feel like one continuous learning loop.
3. Let learners operate the application naturally by touch, pointer, keyboard, or voice.
4. Keep 3D anatomy central without allowing controls or side panels to overwhelm it.
5. Communicate progress, AI cost, system status, and consequences before important actions.
6. Deliver a polished experience across desktop, tablet, and mobile.
7. Meet WCAG 2.2 AA expectations for non-canvas UI and provide meaningful alternatives for canvas actions.

## 4. Non-Goals

- Diagnosis, treatment, or patient-specific medical guidance
- Replacing deterministic grading or Lab validation with AI judgment
- Arbitrary AI clicking based on screen coordinates
- Voice-agent permission modes
- A user-facing voice-agent action-history screen
- Voice controls on marketing, authentication, billing, account, or legal pages

## 5. Users

### Primary

- University anatomy and health-science students
- Learners preparing for practical and written anatomy examinations
- Visual learners who benefit from spatial exploration

### Secondary

- Instructors demonstrating anatomical relationships
- Independent learners revising foundational anatomy
- Learners who need hands-free or voice-assisted interaction

## 6. Experience Principles

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

## 7. Information Architecture

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

### Account

- `/account`: Profile, learning summary, preferences, credits, plan, billing, and activity

### Deep-link requirements

Design must accommodate links that open a model, workspace area, assessment, deck, card side, or Voice context directly. The UI should clearly orient the learner after deep linking.

## 8. Global Navigation

### Desktop

- Persistent product navigation for Explore, Library, and Lab
- Model/subject access without losing the current workspace context
- Current model and current task visible in hierarchy or breadcrumb
- Account and credit balance accessible without dominating the workspace
- Contextual agent entry available throughout supported learning screens

### Mobile

- Compact top bar for current context and essential actions
- Reachable Explore, Library, and Lab navigation
- Model/subject selection through a drawer or equivalent focused pattern
- Voice Agent entry that does not cover primary controls or conflict with safe areas
- Panels should become sheets or full-screen task views when necessary

## 9. Complete Screen Requirements

### 9.1 Landing Page

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

### 9.2 Pricing

Plans:

- Free: NGN 0 and 20 one-time signup credits
- Plus: NGN 2,500 monthly and 500 credits per billing cycle
- PAYG: NGN 500 for 100 non-expiring credits

Requirements:

- Clearly compare core free learning and paid AI usage
- Explain credit order: free, subscription, purchased
- Explain renewal, expiration, cancellation, and PAYG behavior
- Support signed-in, signed-out, loading, checkout, failure, and current-plan states

### 9.3 Authentication

- Google authentication only
- Sign-in and sign-up framing
- Safe return to the learner's intended destination
- Loading, callback, configuration error, and authentication failure states
- Reassurance about account purpose without unnecessary form fields

### 9.4 Account

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

### 9.5 Workspace Home and Model Selection

- Orient first-time and returning learners
- Show available anatomy subjects and useful resume actions
- Current subjects include Heart, Brain, Lungs, Kidney, Eye, Liver, Nervous System, Skin, Human Anatomy, and Digestive System
- Distinguish realistic, segmented, and alternate specimens where applicable
- Clearly indicate loading, unavailable, incomplete, or unsupported model capabilities

### 9.6 Explore

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

### 9.7 Dissect Mode

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

### 9.8 Lab

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

### 9.9 Library

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
- Generate, unlock, and report actions with explicit costs
- Empty, loading, unavailable, and failure states

### 9.10 Flashcards

Requirements:

- Deck title, source, progress, card number, previous, next, and shuffle
- Question and answer sides
- Stable interactive 3D model on applicable cards
- Dragging the model must not flip the card
- Reveal answer and return-to-question actions
- Keyboard and touch support
- Again, Hard, Good, and Easy review grades
- Clear card transition without disorientation
- Text-only fallback when no model is available
- Voice commands for reveal, flip, navigation, shuffle, grading, and model interaction

### 9.11 Practice Tests

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

### 9.12 Text Mentor

- Contextual to current model, selected structure, Lab, or assessment
- Suggested prompts and free-form input
- Current credit balance and one-credit action disclosure
- Sending, streaming/typing, success, error, timeout, sign-in, and insufficient-credit states
- Conversation remains secondary to the learning task

## 10. Cross-App Voice Agent

### 10.1 Availability

Voice Agent should be consistently available on supported learning screens:

- Explore and Dissect
- Active Labs
- Flashcards
- Practice tests
- Other future authenticated learning activities

It should not appear on landing, pricing, login, callback, billing, account, legal, or 404 screens.

### 10.2 Entry and Active Session

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

### 10.3 Agent Context

The agent should understand only the bounded context needed for the current task:

- Current route and workspace area
- Model and specimen variant
- Selected structure(s)
- Visible layers and viewer state
- Recent relevant model actions
- Current Lab objective and deterministic progress
- Current flashcard and visible side
- Current assessment question, options, selection, and submission state
- Available action tools

Assessment answer keys must not be included before submission.

### 10.4 Allowlisted Actions

The software must perform actions through named application functions, never arbitrary screen-coordinate clicks.

Global and navigation actions:

- Explain what actions are available on the current screen
- Navigate supported workspace areas
- Open a model, deck, test, or Lab
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

### 10.5 Agent Feedback and Safety

- Visually highlight the intended target before or while acting when practical
- Announce what changed in concise language
- If a structure name is ambiguous, ask one clarifying question
- If an action is unavailable, explain why and suggest valid alternatives
- Confirm destructive resets, paid AI actions, and graded submissions
- Do not confirm routine reversible navigation or selection
- Keep manual controls synchronized with voice actions
- Never claim success unless the application action reports success
- Do not diagnose, prescribe, or provide patient-specific medical advice

Permission modes and a user-facing action history are explicitly out of scope.

## 11. Credits and Voice Continuation

- Initial Voice block: five minutes for 10 credits
- At approximately 30 seconds remaining, the system attempts to reserve the next block
- If at least 10 credits are available, add five minutes without dropping the realtime conversation
- Repeat while sufficient credits remain
- If credits are insufficient, preserve the current session until its paid deadline and provide a clear message
- A transient renewal failure should retry without prematurely ending paid time
- Ending manually stops future renewals
- Every successful extension updates the visible balance and timer

## 12. Shared States

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

## 13. Responsive Requirements

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

## 14. Accessibility Requirements

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

## 15. Visual Direction

The design team should establish a distinctive, credible educational identity rather than a generic SaaS dashboard.

Retain or reinterpret:

- Clinical blue for primary learning/navigation actions
- Restrained violet for Mentor and Voice
- Green for success, amber for warning/hints, and red for destructive/error
- High-quality light and dark workspace themes
- A more expressive editorial marketing system
- Clear separation between anatomy content, deterministic system feedback, and AI output

The final system should consolidate duplicate CSS generations into documented tokens for typography, spacing, radius, elevation, color, motion, and canvas overlays.

## 16. Design Deliverables

Claude Design and the product team should provide:

1. Revised sitemap and navigation model
2. End-to-end user flows for first visit, exploration, Lab, flashcards, practice test, Voice, checkout, and account
3. Desktop, tablet, and mobile wireframes
4. High-fidelity screens for every route and workspace mode
5. Full Voice Agent entry, active, renewal, insufficient-credit, and error flows
6. Canvas toolbar and dissection interaction specification
7. Component library and design tokens
8. Light, dark, reduced-motion, loading, empty, error, and disabled states
9. Clickable prototype for core learning and Voice flows
10. Accessibility annotations
11. Responsive behavior and handoff annotations
12. Content/copy recommendations where labels are unclear

## 17. Acceptance Criteria

The design is ready for engineering when:

- Every route and primary feature in this document has a designed state
- A learner can move from model exploration to Lab, flashcards, and assessment without losing orientation
- All canvas and dissection actions have discoverable manual controls
- Voice can invoke each allowlisted action through visible synchronized UI
- Paid, destructive, and graded actions have appropriate confirmation
- Voice can continue across five-minute blocks without an interaction reset
- Mobile layouts preserve access to the canvas, learning task, and agent controls
- Empty, loading, error, unauthenticated, and insufficient-credit states are specified
- Accessibility and reduced-motion behavior are annotated
- Design tokens and reusable components are implementation-ready

## 18. Open Product Decisions for Design Review

- Whether workspace navigation should remain three top-level areas or use a learning-path structure
- Whether the Voice dock should minimize to a floating control or attach to a persistent assistant rail on desktop
- How personal decks, community decks, and generated assessments should be grouped in Library
- How much learning progress belongs in the workspace versus Account
- Whether the whole-body layer controls need a distinct interaction pattern from segmented-organ dissection
- The best visual preview/confirmation pattern for agent-targeted anatomy actions

These decisions may be explored in design, but proposed changes must preserve all functional requirements above.
