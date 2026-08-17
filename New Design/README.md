# Handoff: Stranerd Learning Workspace (Desktop + Mobile)

## Overview
Stranerd is an anatomy-focused study app. This bundle covers the full learner
workspace in two form factors — a desktop app shell and a mobile app — plus the
account/pricing surface and a living design-system reference. Core surfaces:
Explore (3D specimen viewer + Dissect), Learn catalog, Flashcards (3D flip),
Practice test, Notes, Lab (guided dissection runner), a shared Mentor rail
(text + voice), and a credit/billing system.

## About the Design Files
The files in this bundle are **design references authored in HTML** — prototypes
that show the intended look, layout, and behavior. They are **not** production
code to lift verbatim. They render through a small in-house component runtime
(`support.js`, the `*.dc.html` "Design Component" format); do not treat that
runtime as a target dependency.

The task is to **recreate these designs in the target codebase** — the existing
React app at `IAmTeerex857/Stranerd` (see `## Source codebase` below) using its
established components, styling, and data. Where a repo file already backs a
screen (mapped below), extend it rather than starting fresh.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, and
interaction states are all specified. Recreate pixel-close using the codebase's
component library. All tokens are listed under `## Design Tokens`.

## Source codebase
- Repo: `IAmTeerex857/Stranerd`, branch `main`
- The project's `github.md` holds the current screen→file map and last sync
  commit. Key files: `src/App.tsx` (shell, screen state, credit costs),
  `src/components/AnatomyViewer.tsx` (Explore/Lab canvas), `src/components/MentorPanel.tsx`,
  `src/components/WorkspaceViews.tsx`, `src/components/CreditModal.tsx`,
  `src/data/models.ts`, `src/lib/billing.ts`, `src/shadcn.css`.

## Screens / Views

### Desktop — `Stranerd Workspace.dc.html`
Fixed **264px sidebar** (logo, Explore/Learn/Lab nav, scrollable Subjects list,
account link footer) + main column with a **60px sticky topbar** (breadcrumb,
460px-max search field, credit-balance pill, theme toggle). Screens swap in the
main column:
- **Explore** — full-bleed specimen canvas. Left vertical **tool rail** (Rotate,
  Reset camera, Labels, Wireframe, Reference layers, divider, Dissect). Each tool
  button is 42×42, radius 10; active tool uses `--primary` fill + white icon,
  others transparent with `--fg-2` icon. **Hover tooltips** are provided via the
  `.tip` / `data-tip` pattern (see Interactions). Dissect opens a right-side dock
  (288px) listing structures with hide/fade/isolate.
- **Learn** — catalog; filter pills under the search; single centered column;
  Flashcard vs Practice-test tabs; Practice shown as horizontal assessment cards.
- **Flashcards** — 380px card, 3D flip (`rotateY(180deg)`, .6s cubic-bezier),
  reveal + self-grade, hint for 1 credit.
- **Practice test** — question stepper, submit, corrections (2 credits).
- **Notes** — long-form reading with a selection toolbar.
- **Lab** — activity catalog → runner: centered segmented specimen, a `Dissect`
  pill, step prompts, knowledge checks.
- **Mentor rail** — shared right rail, text + voice-orb tabs; replies cost 1 credit.

### Mobile — `Stranerd Mobile.dc.html`
Single-column app with bottom tab nav (Learn/Explore/Lab), a **Mentor FAB**
(bottom-right, 56×56, gradient), and bottom sheets for Mentor and Dissect.
- **Explore** — specimen canvas with top overlay (subject pill + mode pill),
  horizontal specimen chips, and a right-edge **canvas tool rail** (40×40 buttons):
  Rotate, Reset camera, Labels, Wireframe, Layers, **divider, Dissect**. Dissect
  now lives *inside* the rail (it was previously a separate floating button) and
  opens the Dissect bottom sheet.
- **Lab runner** — top 44% specimen canvas (`overflow:hidden`) + scrollable step
  content below. Tools are a **floating FAB** at top-right (42×42, radius 12):
  tapping toggles an icon between a "sliders" glyph and an ✕, and expands a
  labeled menu (Rotate, Reset camera, Labels, Wireframe, Layers, divider,
  Dissect). The menu is rendered in the *positioned outer runner container* (not
  the clipped canvas) so it can overflow downward and stay fully tappable — do
  the equivalent in React (portal or a container that isn't `overflow:hidden`).
- **Flashcards / Practice / Notes** — mobile equivalents of the desktop modes.

### Account & Pricing — `Stranerd Account and Pricing.dc.html`
Profile, plan, and billing. Subscription modal + pay-as-you-go modal (quantity
stepper + live total) that confirm before checkout. Shared **out-of-credits
modal** ("Add credits to continue", Required/Available rows, Buy 100 credits +
View options, "no credits were charged") — backed by `src/components/CreditModal.tsx`.

### Design System — `Stranerd Design System.dc.html`
Living reference for tokens, components, and the credit-cost table. Use as the
canonical source of truth when a value is ambiguous.

## Interactions & Behavior
- **Desktop tooltips**: element gets `class="tip" data-tip="Rotate"`. CSS:
  `.tip{position:relative}` and `.tip::after{content:attr(data-tip);position:absolute;left:calc(100% + 9px);top:50%;transform:translateY(-50%) scale(.96);background:var(--fg);color:var(--bg);font-size:11px;font-weight:600;padding:5px 9px;border-radius:7px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s ease,transform .12s ease;box-shadow:var(--shadow-pop)}`
  and `.tip:hover::after{opacity:1;transform:translateY(-50%) scale(1)}`. In
  React, use the codebase's Tooltip primitive instead of this raw pattern.
- **Mobile Lab tools FAB**: tap toggles `labToolsOpen`; icon swaps sliders ↔ ✕;
  menu animates in (`@keyframes rise`: translateY(10px)→0, opacity 0→1). Dissect
  row sets the dissect sheet open and closes the tools menu.
- **Flashcard flip**: `.6s cubic-bezier(.4,0,.2,1)` on `transform`, preserve-3d.
- **Theme**: light/dark via `[data-theme]` on the root, toggle in topbar, persisted
  to `localStorage`.
- **Credit gating**: paid actions check balance; if short, open the out-of-credits
  modal. Costs: Mentor reply 1, assessment hint 1, corrections 2, new
  assessment/deck 5, Voice five-minute session 10.
- Canvas supports pan/zoom (mobile: pinch/drag); Reset camera returns transform to
  origin/scale 1.

## State Management
- `theme` (light/dark, persisted), current `screen`/`tab`, active subject/specimen.
- `balance` (credits) + `creditPrompt` (which gated action triggered the modal).
- Explore: `dissect` (dock/sheet open).
- Lab: `labId`, `labStep`, `labChoice`, `labChecked`, `labDissect`, and (mobile)
  `labToolsOpen` for the tools FAB.
- Flashcards: `fcIndex`, `fcRevealed`, `fcHint`. Practice: `prIndex`, `prSel`,
  `prSubmitted`, `prCorrections`, `prHint`.
- Mobile also: `drawerOpen`, `mentorOpen`, `dissectOpen`, `navOpen`, `cx` (canvas
  transform {x,y,s}).

## Design Tokens
CSS variables (light → dark). Map these to the codebase's token layer / `shadcn.css`.

**Light**
- bg `#F4F7FC`, card `#FFFFFF`, card-2 `#FBFCFE`, muted `#EDF1F8`, muted-2 `#F4F7FC`
- border `#E4E9F2`, border-strong `#D5DDEA`
- fg `#0E1526`, fg-2 `#3A4457`, muted-fg `#5C6880`
- primary `#2E64F0`, primary-hover `#2352DA`, primary-fg `#FFFFFF`, primary-subtle `#EAF0FE`, primary-border `#CBDAFB`
- ai `#6D3BE8`, ai-hover `#5A2CCB`, ai-subtle `#F2ECFE`, ai-border `#E1D3FB`
- success `#0E9F6E` / subtle `#E7F7F0`; warning `#C77706` / subtle `#FCF3E4`; danger `#DC2626` / subtle `#FDECEC`
- shadow-card `0 1px 2px rgba(14,21,38,.06)`; shadow-pop `0 16px 40px -16px rgba(14,21,38,.28)`

**Dark**
- bg `#0A0D13`, card `#12161F`, card-2 `#0F131B`, muted `#171C27`, muted-2 `#131822`
- border `#242B39`, border-strong `#313A4B`
- fg `#F2F5FA`, fg-2 `#C4CDDC`, muted-fg `#93A0B4`
- primary `#5B8CFF`, primary-hover `#79A2FF`, primary-fg `#0A1223`, primary-subtle `#152140`, primary-border `#2B3D66`
- ai `#9A79FF`, ai-hover `#B198FF`, ai-subtle `#201A3A`, ai-border `#392E62`
- success `#34D399` / subtle `#0F2A21`; warning `#FBBF24` / subtle `#2E2410`; danger `#F87171` / subtle `#361B1B`
- shadow-card `0 1px 2px rgba(0,0,0,.45)`; shadow-pop `0 18px 44px -18px rgba(0,0,0,.72)`

**Typography** — UI/body: **Inter** (400–700). Display/headings: **DM Sans** (600,
negative letter-spacing ~-0.02 to -0.03em). Numerics/labels/kickers: **IBM Plex
Mono** (uppercase, letter-spacing ~0.06–0.1em). Body antialiased.

**Radii** — buttons/tool tiles 9–12px, cards/panels 14–16px, pills 999px, small
icon boxes 8px.

**Spacing** — 264px sidebar, 60px topbar, 56px mobile Mentor FAB, 44px mobile
touch targets minimum, 288px Dissect docks.

## Assets
No raster assets — all icons are inline SVG (Lucide-style stroke paths,
stroke-width ~1.7–1.9). Specimen visuals are CSS radial-gradient placeholders
standing in for the real 3D model from `AnatomyViewer.tsx` — swap in the actual
viewer. Fonts load from Google Fonts.

## Files
- `Stranerd Workspace.dc.html` — desktop app (all desktop screens)
- `Stranerd Mobile.dc.html` — mobile app (all mobile screens)
- `Stranerd Account and Pricing.dc.html` — account + billing + credit modal
- `Stranerd Design System.dc.html` — tokens/components reference
- `support.js` — the prototype runtime (reference only; not a build dependency)

Open any `.dc.html` in a browser to view the live prototype.
