# General Learning — Complete Design System & Page Specification

> **Purpose**: This document is a comprehensive blueprint for recreating the `generallearning.com` homepage with your own content. It captures every section, component, design token, animation, and interaction pattern found on the site.

---

## Content and Voice Guidelines

These rules apply to all copy, labels, and text content when building from this spec:

1. **No em dashes.** Do not use em dashes ( — ) anywhere in the copy. Use commas, periods, colons, or restructure the sentence instead.
2. **No emojis.** Do not use emojis anywhere on the site. Not in headings, body copy, labels, buttons, or metadata. The colored inline dots used in the thesis section are rendered as styled `<span>` elements (CSS circles), not emoji characters.
3. **Follow General Learning's structure exactly.** Match the section order, layout patterns, scroll behaviors, and component hierarchy as documented below. Do not add, remove, or reorder sections unless explicitly decided otherwise.
4. **Keep the voice natural.** Write in your own voice. The tone should feel confident and clear, not corporate or stiff.

---

## Table of Contents

1. [Global Design Tokens](#1-global-design-tokens)
2. [Technology Stack](#2-technology-stack)
3. [Page Architecture Overview](#3-page-architecture-overview)
4. [Header / Navigation](#4-header--navigation)
5. [Section 1 — Hero (Full-Screen with Canvas Animation)](#5-section-1--hero)
6. [Section 2 — Scroll-Reveal Preface](#6-section-2--scroll-reveal-preface)
7. [Section 3 — Interactive Timeline](#7-section-3--interactive-timeline)
8. [Section 4 — Thesis / Manifesto (Scroll-Driven Paragraphs)](#8-section-4--thesis--manifesto)
9. [Section 5 — Brand Cards (Product Showcase)](#9-section-5--brand-cards)
10. [Section 6 — Outcomes / Data Charts](#10-section-6--outcomes--data-charts)
11. [Section 7 — Video Testimonials Carousel](#11-section-7--video-testimonials-carousel)
12. [Section 8 — Team Photo Collage](#12-section-8--team-photo-collage)
13. [Section 9 — Job Listings / Careers](#13-section-9--job-listings--careers)
14. [Section 10 — Footer](#14-section-10--footer)
15. [Animation & Scroll Behavior Specification](#15-animation--scroll-behavior-specification)
16. [Responsive Breakpoints](#16-responsive-breakpoints)
17. [Accessibility Notes](#17-accessibility-notes)
18. [SEO & Meta Tags](#18-seo--meta-tags)
19. [Asset Inventory](#19-asset-inventory)

---

## 1. Global Design Tokens

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `--background` | `#000000` (pure black) | Page background |
| `--foreground` | `oklch(0.985 0 0)` ≈ `#FAFAFA` | Primary text color |
| `--muted-foreground` | `~rgba(255,255,255,0.55)` | Secondary/subdued text |
| `--border` | `rgba(255,255,255,0.15)` | Card borders, dividers |
| `--muted` | `~rgba(255,255,255,0.08)` | Hover card backgrounds |
| `text-white/80` | `rgba(255,255,255,0.80)` | Nav link default state |
| `text-white/60` | `rgba(255,255,255,0.60)` | Body copy in timeline |
| `text-white/50` | `rgba(255,255,255,0.50)` | Subheadings/labels in timeline |
| `text-white/45` | `rgba(255,255,255,0.45)` | "Key events" label |
| `text-white/40` | `rgba(255,255,255,0.40)` | Timeline event list items |
| `text-white/55` | `rgba(255,255,255,0.55)` | Testimonial attribution |
| `text-white/30` | `rgba(255,255,255,0.30)` | CTA button border |
| `text-neutral-50` | `#FAFAFA` | Hero heading, testimonial quotes |

### Accent Colors (Thesis Dots)

| Color | OKLCH / Hex | Represents |
|---|---|---|
| Green | `#4ADE80` | Biology / academic gains |
| Blue | `#38BDF8` | Environment / societies |
| Purple | `#A78BFA` | AI |
| Pink | `#F472B6` | Society |

### Brand-Specific Colors

| Brand | Primary Color | Card Background |
|---|---|---|
| OnePrep | `rgb(107, 221, 255)` — cyan | `rgb(28, 36, 38)` — dark teal-gray |
| RevisionDojo | `rgb(166, 132, 255)` — purple | `rgb(30, 28, 42)` — dark purple-gray |
| MathsGenie | `rgb(62, 205, 190)` — teal | `rgb(23, 40, 36)` — dark green-gray |

### Y Combinator Badge

- Background: `#FF6600`
- Font: Helvetica, Arial, sans-serif
- Weight: Bold
- Text: White
- Size in nav: `h-2.5 w-2.5 rounded-[2px] text-[7px]`
- Size in footer: `h-5 w-5 rounded-[3px] text-sm`

---

### Typography

| Element | Font Family | Weight | Size (Desktop) | Size (Mobile) | Tracking |
|---|---|---|---|---|---|
| **Primary Sans** | DM Sans (variable) | 400–700 | — | — | — |
| **Mono** | Geist Mono (variable) | — | — | — | — |
| **Serif (accent)** | Instrument Serif (variable) | — | — | — | — |
| **System stack** | `font-sans` fallback | — | — | — | — |
| Hero `<h1>` | DM Sans | 400 (normal) | `text-7xl` (72px) | `text-4xl` (36px) | `-0.055em` (very tight) |
| Section headings `<h2>` | DM Sans | 500 (medium) | `text-5xl` (48px) | `text-3xl` (30px) | `tracking-tighter` (-0.05em) |
| Timeline era `<h1>` | DM Sans | 500 | `text-4xl` (36px) | `text-3xl` (30px) | `tracking-tighter` |
| Thesis paragraphs | DM Sans | 500 | `text-4xl` (36px) | `text-2xl` (24px) | `tracking-tighter` |
| Scroll-reveal preface | DM Sans | 500 | `text-4xl` (36px) | `text-xl` (20px) | `tracking-tighter` |
| Card descriptions | DM Sans | 500 | `text-[27px]` | `text-[17px]` | `tracking-tight` |
| Stat numbers | DM Sans | 500 | `text-6xl` (60px) | `text-2xl` (24px) | `tracking-tighter`, `tabular-nums` |
| Nav links | DM Sans | 400 | `text-sm` (14px) | `text-3xl` (30px, mobile menu) | — |
| Body copy | DM Sans | 400–500 | `text-lg` (18px) | `text-base` (16px) | — |
| Chart labels | `var(--font-mono)` | 400 | `10px` | `10px` | — |
| Chart values | `var(--font-mono)` | 400 | `10px` | `10px` | — |
| Footer headings | DM Sans | 500 | `text-sm` (14px) | `text-sm` | `uppercase tracking-wider` |
| Footer links | DM Sans | 500 | — | — | — |

### Line Heights

| Context | Value |
|---|---|
| Hero heading | `leading-[1.02]` |
| Section headings | `leading-[1.15]` |
| Body/descriptions | `leading-snug` (~1.375) or `leading-relaxed` (~1.625) |
| Stat numbers | `leading-none` (1) |
| Tight text | `leading-tight` (~1.25) |

---

### Spacing System

| Token | Value | Usage |
|---|---|---|
| Page horizontal padding | `px-8` (32px) | Mobile |
| Page horizontal padding | `sm:px-12` (48px) | Tablet |
| Page horizontal padding | `lg:px-16` (64px) | Desktop |
| Max content width | `max-w-7xl` (80rem / 1280px) | All sections |
| Max outer width | `max-w-[96rem]` (1536px) | Timeline overlay text |
| Section vertical padding | `pt-12 pb-12` / `md:pt-16 md:pb-16` | Between sections |
| Card internal padding | `p-4` → `p-5` → `p-6` → `p-8` | Uses container queries (`@container`) |
| Gap between brand cards | `gap-20` / `md:gap-32` | Vertical separation |
| Gap in thesis paragraphs | `gap-7` / `md:gap-10` | Between manifesto paragraphs |

---

### Border Radius

| Element | Radius |
|---|---|
| CTA button (hero) | `rounded-full` |
| Video thumbnails | `rounded-3xl` (24px) |
| Job cards | `rounded-2xl` (16px) |
| Mobile menu toggle | `rounded-full` |
| YC badge (nav) | `rounded-[2px]` |
| YC badge (footer) | `rounded-[3px]` |
| Thesis dots | `rounded-full` |

---

### Shadows

| Element | Shadow Value |
|---|---|
| Team photos (polaroid) | `shadow-[0_28px_56px_-10px_rgba(0,0,0,0.72),0_14px_28px_-6px_rgba(0,0,0,0.55)]` |
| Video play button | `shadow-lg` |

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js** (App Router with React Server Components) |
| Styling | **Tailwind CSS** (v4-style with custom theme) |
| Animations | **CSS scroll-driven animations** + JS (IntersectionObserver / scroll listeners) |
| Canvas Effects | **Custom WebGL/Canvas** (halftone brain image, particle fields) |
| Video Hosting | **Cloudflare Stream** |
| Image Optimization | Next.js `<Image>` with `srcSet` |
| Deployment | **Cloudflare** (indicated by `cdn-cgi` paths) |
| Fonts | Self-hosted woff2 (DM Sans, Geist, Geist Mono, Instrument Serif) |
| Container Queries | `@container` for responsive card internals |

---

## 3. Page Architecture Overview

The page is a **single continuous scroll** with multiple full-screen and oversized sections. The narrative flow is:

```
┌─────────────────────────────────────────┐
│  HEADER (fixed, transparent → gradient) │  ← always on top, z-40
├─────────────────────────────────────────┤
│  HERO (100vh, canvas animation)         │  ← full viewport, centered headline
├─────────────────────────────────────────┤
│  PREFACE (200vh scroll section)         │  ← word-by-word reveal on scroll
├─────────────────────────────────────────┤
│  TIMELINE (4 × 100vh sections)          │  ← era cards with sticky sidebars
│    Pre-20th century                     │
│    20th century                         │
│    2000–2022                            │
│    2022–now                             │
├─────────────────────────────────────────┤
│  SPACER (48vh)                          │  ← breathing room
├─────────────────────────────────────────┤
│  THESIS (445vh scroll section)          │  ← 4 paragraphs, scroll-reveal text
│  + brain halftone canvas animation      │
├─────────────────────────────────────────┤
│  BRAND CARDS (3 products)               │  ← alternating 2-col grid
├─────────────────────────────────────────┤
│  OUTCOMES CHARTS (3 chart sections)     │  ← SVG charts + text descriptions
├─────────────────────────────────────────┤
│  VIDEO TESTIMONIALS (horizontal scroll) │  ← snap carousel, infinite loop
├─────────────────────────────────────────┤
│  TEAM PHOTOS (polaroid collage)         │  ← overlapping, randomly rotated
├─────────────────────────────────────────┤
│  CAREERS / JOB LISTINGS                 │  ← 2-col card grid
├─────────────────────────────────────────┤
│  FOOTER (full-width wordmark + canvas)  │  ← 3-col links + giant logo + canvas
└─────────────────────────────────────────┘
```

---

## 4. Header / Navigation

### Structure
- **Position**: `fixed`, `top-0`, `z-40`, full-width
- **Background**: Transparent by default, with a gradient overlay that fades in on scroll:
  ```css
  background-image: linear-gradient(
    to top,
    rgb(0 0 0 / 0) 0%,
    rgb(0 0 0 / 0.55) 40%,
    rgb(0 0 0 / 0.97) 65%,
    rgb(0 0 0) 82%
  );
  ```
  - Starts with `opacity-0`, transitions to `opacity-1` on scroll

### Layout
- **Container**: `max-w-7xl`, centered, flex row, `justify-between`
- **Padding**: `px-4 py-4` → `sm:px-12 sm:py-6` → `lg:px-16`
- **Left**: Logo (SVG wordmark, `h-8 w-auto`) + Y Combinator badge below
- **Right (desktop `sm+`)**: Horizontal link row — `Home | Upcoming Events | Careers | Contact`
- **Right (mobile)**: Hamburger toggle → fullscreen overlay menu

### Nav Links
- Color: `text-white/80`
- Hover: `hover:text-white`
- Height: `min-h-11` (44px touch target)
- Padding: `px-3`
- Transition: `ease-linear`, `150ms`

### Mobile Menu
- Fullscreen overlay: `fixed inset-0`, `backdrop-blur-xl`, `bg-black/95`
- Font: `text-3xl font-medium tracking-tight`
- Entrance: `translate-y` + `scale` + `opacity` transition
- Initial state: `pointer-events-none -translate-y-2 scale-[0.98] opacity-0`

### Hamburger Button
- `w-12`, `aspect-square`, `rounded-full`
- Border: `border-white/15`
- Background: `bg-black/40`
- Three horizontal lines (`h-px w-4`), animating to X on open

---

## 5. Section 1 — Hero

### Dimensions
- `h-screen max-h-[1040px] min-h-[800px]`
- Content area positioned at top `44vh`

### Layout
- Centered text block
- Heading + CTA button stacked

### Heading
```
"Accelerating Humanity's Rate of Learning."
```
- `max-w-5xl text-center text-balance`
- Size: `text-4xl` → `sm:text-5xl` → `md:text-6xl` → `lg:text-7xl`
- Weight: `font-normal` (400)
- Tracking: `tracking-[-0.055em]`
- Line height: `leading-[1.02]`
- Color: `text-neutral-50`
- Initial opacity: `1` (fades out on scroll)

### CTA Button
```
"Get in touch"
```
- `inline-flex items-center justify-center rounded-full`
- Border: `border border-white/30`
- Padding: `px-7 py-3`
- Font: `text-sm font-medium tracking-wide text-white`
- Hover: `hover:border-white/60 hover:bg-white/10`
- Spacing: `mt-6` / `sm:mt-8` from heading

### Background
- **Canvas animation** (particle field / abstract visualization)
- Positioned behind text, full section
- Sticky canvas with scroll-driven transforms
- Gradient mask fading bottom: `mask-image: linear-gradient(to top, #000 0%, #000 46%, transparent 100%)`

---

## 6. Section 2 — Scroll-Reveal Preface

### Dimensions
- Height: `200vh` (scroll section for the reveal animation)
- Sticky inner: `h-screen`

### Content
```
"1 in 4 people on Earth is a student. Education shapes how people think,
work, vote, build, and lead. Yet learners have been underserved for most
of history."
```

### Scroll-Reveal Mechanism
- Each word is wrapped in a `<span class="scroll-reveal-word">`
- Each word has CSS custom properties:
  - `--reveal-start`: scroll % where word begins appearing
  - `--reveal-end`: scroll % where word is fully visible
- Words start dim/transparent and become full opacity as user scrolls
- CSS variable-driven: `scroll-reveal--cover` class on the paragraph

### Layout
- Sticky container at `top-0`
- Content pushed down via spacer: `height: 58vh`
- Text centered: `max-w-4xl text-center text-balance`
- Size: `text-xl` → `sm:text-2xl` → `md:text-3xl` → `lg:text-4xl`
- Weight: `font-medium`
- Tracking: `tracking-tighter`
- Leading: `leading-tight`

---

## 7. Section 3 — Interactive Timeline

### Overview
Four full-screen (`min-height: 100vh`) eras scrolled through sequentially:

1. **Pre-20th century** — "Knowledge concentrated in elites"
2. **20th century** — "The Flynn effect"
3. **2000–2022** — "The open internet"
4. **2022–now** — "Post-ChatGPT"

### Layout (Two-Column, Fixed Overlay)
- **Left column** (main text): `max-w-xl` → `md:max-w-2xl`
  - Subtitle (era descriptor): `text-base font-medium text-white/50`
  - Era title: `text-3xl font-medium tracking-tighter text-neutral-50 sm:text-4xl`
  - Description: `text-base leading-relaxed text-white/60 sm:text-lg`
- **Right column** (key events): `w-64`, hidden on mobile, `md:block`
  - Label: `text-sm font-medium text-white/45` — "Key events"
  - Timeline list with vertical line indicator
  - Each item: year (`w-11 text-sm font-medium tabular-nums`) + event name (`text-base leading-snug`)
  - Vertical line: `w-0.5 bg-white/15` on left

### Transition Behavior
- All four eras are absolutely positioned and swap via opacity transitions
- `transition-opacity ease-in-out`, `transition-duration: 400ms`
- Active era: `opacity-100`, `position: relative`
- Inactive eras: `opacity-0`, `pointer-events-none`, `position: absolute`

### Canvas Background
- Sticky canvas visualization behind the text
- Dimensions: `height: 56vh`, translated via `transform: translate3d(0, 44vh, 0)`
- Horizontal mask: `mask-image: linear-gradient(to right, transparent, black 14%, black 86%, transparent)`
- Container: `max-w-6xl`, centered

---

## 8. Section 4 — Thesis / Manifesto

### Dimensions
- Height: `445vh` (extremely tall scroll section)
- Sticky container: `h-screen`

### Content (4 Paragraphs, Revealed Sequentially)

1. > "Human intelligence is not fixed by **🟢 biology.**"
2. > "It is shaped by **🔵 environment** and the systems we learn from."
3. > "With **🟣 AI** and thoughtful design, we accelerate learning outcomes and instructor productivity in parallel."
4. > "And for the first time, that advantage can reach all of **🩷 society.**"

### Visual Treatment
- Each key word has a colored dot (`rounded-full`, `size-[0.82em]`) inline before it
- Dots are:
  - Biology: `#4ADE80` (green)
  - Environment: `#38BDF8` (blue)
  - AI: `#A78BFA` (purple)
  - Society: `#F472B6` (pink)

### Scroll-Reveal (Same as Preface)
- Each word has `--reveal-start` and `--reveal-end` percentages
- Progressive reveal as user scrolls through the 445vh section
- Each paragraph has a `--thesis-appear-start` and `--thesis-appear-end` for staggered entry

### Layout
- `max-w-7xl`, left-aligned text
- Paragraphs stacked with `gap-7` / `md:gap-10`
- Text: `text-2xl` → `sm:text-3xl` → `md:text-4xl`
- Weight: `font-medium`, Tracking: `tracking-tighter`, Leading: `leading-tight`

### Background: Brain Halftone Canvas
- Three layered `<canvas>` elements
- Halftone/stipple effect of a brain illustration
- Positioned behind the text, full height
- Appears to animate with scroll position

---

## 9. Section 5 — Brand Cards

### Section Header
```
"Advancing learner outcomes in the world's most prominent curriculums"
```
- `text-3xl` → `sm:text-4xl` → `lg:text-5xl`
- `font-medium tracking-tighter text-balance text-center`
- Padding: `pt-12 md:pt-16`, centered in `max-w-7xl`

### Card Layout
- **3 cards** stacked vertically, `gap-20` / `md:gap-32`
- Each card: `<a>` tag (entire card is clickable, opens in new tab)
- Desktop: `grid-cols-2` (image + content side by side)
- Mobile: `grid-cols-1` (stacked)
- Alternating layout: cards 1 & 3 have image on left, card 2 has image on right

### Card Anatomy

#### Image Half
- Background: `<canvas>` (animated particle/noise effect unique per brand)
- Centered logo (SVG): `w-72` → `sm:w-[360px]`
- Min height: `min-h-48` → `sm:min-h-56` → `md:min-h-64`
- Transition on hover: `duration-200`

#### Content Half
- Colored background per brand (see Brand-Specific Colors above)
- Same min height constraints

**Content Structure:**
1. **Description paragraph**: Brand name in accent color + description text
   - Uses container queries for responsive sizing
   - `text-[17px]` → `@sm:text-[19px]` → `@md:text-[22px]` → `@lg:text-[27px]`
   - `font-medium leading-snug tracking-tight text-foreground/85`

2. **Stats section** (left side):
   - 3 stat blocks stacked vertically
   - Number: `text-2xl` → scaling up to `text-6xl` via container queries
   - Unit suffix (M, pts, h, min, %): `opacity-60`
   - Label: `text-sm font-medium text-muted-foreground`
   - Font feature: `tabular-nums` for aligned digits

3. **Curricula supported** (right side):
   - Label: `text-sm font-medium text-muted-foreground`
   - List: curriculum names in large text, `text-lg` → up to `text-5xl`
   - Right-aligned on desktop

#### Hover Effects
- Card: `hover:bg-muted/80` transition
- External link arrow icon (top-right): `opacity-0` → `group-hover:opacity-100`
  - Arrow: `↗` SVG, `28×28px`, white, `duration-200`

---

## 10. Section 6 — Outcomes / Data Charts

### Section Header
```
"Better outcomes across students, exams, and classrooms"
```
- Same styling as brand cards header

### Chart Sections (3 total)

Each chart section is a **2-column grid** (`md:grid-cols-2`):
- One column: SVG chart
- Other column: Text explanation
- Alternating left/right placement
- Min/max height: `min-h-[40rem] max-h-[64rem]`

#### Chart 1: Grouped Bar Chart
- **Title**: "Mean IB subject score by group, before vs. after..."
- 4 grouped bars (Language, Humanities, Sciences, Mathematics)
- Colors: gray (before) at `fill-opacity="0.35"`, green `#4ade80` (after)
- Gain annotations in green above bars
- Legend: Before (gray square) / After (green square)
- **Animations**: `chart-grow-y` (bars grow upward), `chart-rise` (labels float in)

#### Chart 2: Line Chart
- **Title**: "Self-reported SAT total score by starting band..."
- 5 data points across score bands (600–1600)
- Two lines: gray (before), green (after)
- Circles at each data point
- Gain values annotated above after-points
- **Animations**: `chart-draw` (line draws itself, using `pathLength="1"`)

#### Chart 3: Horizontal Bar Chart
- **Title**: "Mean self-reported weekly hours saved by task..."
- 4 horizontal bars (Test builder, Coursework grading, Lesson planning, Homework setting)
- Green bars with hour values to the right
- **Animations**: `chart-grow-x` (bars extend rightward)

### Chart Styling
- Font: `var(--font-mono)` for all numbers/labels
- Axis lines: `stroke-opacity="0.15"` (gridlines), `0.35` (axis)
- All SVGs: `viewBox` with `preserveAspectRatio="xMidYMid meet"`, `w-full`
- `role="img"` with descriptive `aria-label`

### Text Explanation Column
- Heading: `text-2xl` → `sm:text-3xl` → `lg:text-4xl`, `font-medium tracking-tighter`
- Body paragraphs: `text-base` → `sm:text-lg` → `md:text-xl`
- Key numbers highlighted: `font-semibold text-[#4ade80]`
- Padding: `px-8 py-12` → responsive

---

## 11. Section 7 — Video Testimonials Carousel

### Section Header
```
"Stories from our users"
```
- Centered, same heading style

### Carousel
- **Type**: Horizontal scroll, CSS `snap-x snap-mandatory`
- **No visible scrollbar**: `[scrollbar-width:none]` + webkit override
- Full viewport width: `w-screen max-w-none`
- Padding: `pl/pr-[calc(50%-min(38vw,520px))]` — centers the active card

### Card Dimensions
- Width: `w-[clamp(280px, 76vw, 1100px)]`
- `flex-none snap-center`

### Card Structure
1. **Video Thumbnail**: `aspect-[21/10]`, `rounded-3xl`, `bg-black`
   - Thumbnail image: `object-cover`, lazy loaded from Cloudflare Stream
   - Click to open video (modal/inline player)
   - YouTube link button: bottom-right, `rounded-full bg-black/80`, `h-14 w-14`
   - Play icon: `h-8 w-8 text-white` SVG triangle
   - Hover: `scale-110` on YouTube button, slight opacity change on thumbnail

2. **Quote**: Below thumbnail
   - `text-lg` → `sm:text-2xl`, `font-medium leading-snug tracking-tighter`
   - Color: `text-neutral-50`
   - Curly quotes: `"..."` wrapped around text

3. **Attribution**: Name + school/affiliation
   - `text-base text-white/55` → `sm:text-lg`

### Active/Inactive State
- Active (centered): `opacity-100`
- Inactive (sides): `opacity-50`
- Transition: `duration-500 ease-out`

### Infinite Loop
- Cards are duplicated 3x for seamless infinite scrolling effect
- 6 unique testimonials × 3 loops

---

## 12. Section 8 — Team Photo Collage

### Section Header
```
"The team behind General Learning"
```
- Centered heading, same style

### Description
```
"We're a team of builders, researchers, and educators..."
```
- `max-w-lg text-center text-base text-muted-foreground`

### Photo Collage
- **Polaroid style**: Square photos with white border (`bg-white p-1`)
- Size: `size-36` → `sm:size-42` → `md:size-48` (144px → 168px → 192px)
- **18+ photos** in a horizontal row, overlapping
- Overlap: `-ml-4` → `sm:-ml-6` → `md:-ml-8`
- Heavy shadow: `shadow-[0_28px_56px_-10px_rgba(0,0,0,0.72),0_14px_28px_-6px_rgba(0,0,0,0.55)]`

### Random Rotation & Scale
Each photo has unique random `transform`:
- Rotation: ranges from about `-8deg` to `+9deg`
- Scale: ranges from about `0.91` to `1.06`
- Z-index: cycles `0, 1, 2` (creating overlap depth)

### Scrolling
- The collage extends beyond viewport width
- Two rows of photos, each auto-scrolling in opposite directions
- `overflow-hidden` on container

---

## 13. Section 9 — Job Listings / Careers

### Section Anchor
- `id="jobs"`, `scroll-mt-24` (offset for fixed header)

### Layout
- `max-w-3xl` centered
- **2-column grid** on `sm:`, **1-column** on mobile
- `gap-3`

### Job Card
- `<a>` tag linking to Tally form
- `rounded-2xl border border-border bg-background/60 p-5`
- Hover: `hover:border-foreground/25 hover:bg-muted/40`
- **Arrow icon** (↗): top-right, `size-5`, `text-muted-foreground`
  - Hover transform: `-translate-y-0.5 translate-x-0.5`

### Job Card Content
- **Title**: `text-lg font-medium leading-snug tracking-tight text-foreground`
- **Description**: `text-sm leading-relaxed text-muted-foreground sm:text-base`

### "Got another idea?" Card
- Dashed border: `border-dashed border-border`
- Centered text, same height
- Contains "Contact us" underlined link:
  - `underline decoration-muted-foreground/50 underline-offset-4`
  - Hover: `hover:decoration-foreground`

### Current Listings (5 + 1 open card)
1. Fullstack developer / Design Engineer
2. Mobile React Native Engineer
3. RevisionDojo UI/UX, Illustration & Motion Design Internship
4. Shortform Video Editor
5. Marketing associate - growth
6. "Got another idea?" (open application)

---

## 14. Section 10 — Footer

### Layout
- `max-w-7xl` centered, `overflow-x-clip`
- Padding: `pt-12 pb-4` → `md:pt-16 md:pb-6`

### Link Columns (3-column grid on `lg:`)

| Column 1: Brands | Column 2: Company | Column 3: Follow Us |
|---|---|---|
| RevisionDojo | Careers | LinkedIn |
| OnePrep | Events | Instagram |
| MathsGenie | Partnerships inquiry | |

### Column Headings
- `text-sm font-medium uppercase tracking-wider text-muted-foreground`

### Links
- `font-medium text-foreground/80`
- Hover: `hover:text-foreground`

### Giant Wordmark
- Full-width SVG logo (`general-learning-wordmark.svg`)
- `w-full h-auto`
- Very large — spans entire content width
- Clickable link back to home

### YC Badge (centered)
- Same as nav but larger

### Copyright
- `text-sm text-muted-foreground`
- `"© 2026 General Learning"`
- Right-aligned on `sm:`, centered on mobile

### Background Canvas
- Canvas animation behind the footer
- Height: `460px`, negative margin overlap with content above (`-mt-64`)
- Same horizontal mask as timeline: `mask-image: linear-gradient(to right, transparent, black 14%, black 86%, transparent)`
- Gradient overlay on top: `linear-gradient(to top, transparent 0%, var(--background) 15%, var(--background) 100%)`

---

## 15. Animation & Scroll Behavior Specification

### Global Transition Defaults
- Duration: `150ms` for most UI elements (nav, buttons)
- Duration: `200ms` for card hovers
- Duration: `400ms` for section transitions (timeline eras, thesis paragraphs)
- Duration: `500ms` for testimonial card opacity
- Easing: `ease-linear` for nav/buttons, `ease-in-out` for content transitions, `ease-out` for testimonials

### Scroll-Driven Animations

#### Word-by-Word Reveal (`scroll-reveal--cover`)
- Used in: **Preface** and **Thesis** sections
- Each word has CSS custom properties for scroll position
- Words transition from dim/transparent to full visibility
- Driven by scroll position within the tall section
- Each word uses `--reveal-start` and `--reveal-end` as scroll percentages

#### Timeline Era Transitions
- Driven by scroll position through 4 × 100vh sections
- Background color of the fixed overlay transitions between eras
- Canvas visualization transforms on scroll

#### Thesis Paragraph Staggering
- Each paragraph has `--thesis-appear-start` / `--thesis-appear-end`
- Paragraphs fade in as user scrolls into their designated range
- Brain halftone canvas scales/transforms with scroll

### Chart Animations (Triggered on Viewport Entry)

| Animation | Description | Used By |
|---|---|---|
| `chart-grow-y` | Bar height grows from 0 to full | Grouped bar chart |
| `chart-grow-x` | Bar width grows from 0 to full | Horizontal bar chart |
| `chart-draw` | SVG path stroke draws using `pathLength="1"` | Line chart |
| `chart-rise` | Labels/values float upward into position | All charts |

### Canvas Animations
- Multiple `<canvas>` elements used throughout
- **Hero**: Particle field / abstract visualization
- **Timeline**: Animated horizontal visualization
- **Thesis**: Brain halftone with stipple/dot effect
- **Footer**: Abstract visualization

### Brand Card Entry Animation
- `brand-card-entry` class — appears to trigger entry animation
- Uses `--gl-i` custom property for stagger index

### Team Photo Scroll
- Continuous marquee effect (two rows, opposite directions)
- Photos slightly overlap

---

## 16. Responsive Breakpoints

| Breakpoint | Width | Key Changes |
|---|---|---|
| Default (mobile) | `<640px` | Single column, hamburger menu, smaller text |
| `sm` | `≥640px` | Tablet adjustments, nav links visible |
| `md` | `≥768px` | Two-column layouts, timeline sidebar visible |
| `lg` | `≥1024px` | Full desktop layout, larger text |
| Container queries | `@3xs`, `@xs`, `@2xs`, `@sm`, `@md`, `@lg` | Card-internal responsive sizing |

### Key Mobile Differences
- Navigation: Hamburger → fullscreen overlay
- Timeline: Left column only (key events sidebar hidden)
- Brand cards: Stacked single column
- Chart sections: Stacked (chart above text)
- Video carousel: Narrower cards
- Team photos: Smaller polaroids, less overlap

---

## 17. Accessibility Notes

- `aria-label` on all sections and interactive elements
- `sr-only` class for visually hidden headings (e.g., thesis section `<h2>`)
- `aria-hidden="true"` on decorative elements (canvases, gradients, dots)
- `role="img"` + descriptive `aria-label` on SVG charts
- `tabindex="-1"` on mobile menu links (removed from tab order when closed)
- Color contrast: Text is at minimum `white/50` on black (may need audit)
- `prefers-reduced-motion`: Consider disabling scroll-driven animations

---

## 18. SEO & Meta Tags

```html
<title>General Learning</title>
<meta name="description" content="Accelerating Humanity's Rate of Learning." />
<meta property="og:title" content="General Learning" />
<meta property="og:description" content="Accelerating Humanity's Rate of Learning." />
<meta property="og:image" content="/images/general-learning-og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="General Learning" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="General Learning" />
<meta name="twitter:description" content="Accelerating Humanity's Rate of Learning." />
<meta name="twitter:image" content="/images/general-learning-og-image.jpg" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon-96x96.png" sizes="96x96" type="image/png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
```

---

## 19. Asset Inventory

### SVG Logos
| File | Usage |
|---|---|
| `/images/general-learning-wordmark-2.svg` | Nav logo (small) |
| `/images/general-learning-wordmark.svg` | Footer logo (full-width) |
| `/images/oneprep-logomark.svg` | OnePrep brand card |
| `/images/revisiondojo-logomark.svg` | RevisionDojo brand card |
| `/images/mathsgenie-logomark.svg` | MathsGenie brand card |

### Team Photos
| Pattern | Count |
|---|---|
| `/images/team/team-photo-01.jpg` through `team-photo-18.jpg` | 18 photos |
| Served via Next.js Image optimization (`/_next/image?url=...`) | Multiple sizes |

### Video Thumbnails (Cloudflare Stream)
| Video ID | Person |
|---|---|
| `29716205c0e901a20b4d9e3c8a85d402` | Erik |
| `7a94f316a5ca0cf88db25b13639891bf` | Harrish |
| `a81aa538a661f635f3b3717983655828` | Beverly |
| `37669f1c94ccbe683c63df8998bd9209` | Anna Venin |
| `2fbf914f891b361cea9fffd7ef4c20e9` | Rex |
| `cb5ab03f053de5edcab92bea2a27c3e4` | Saule Cicenaite |

### Fonts (Self-Hosted woff2)
| File Hash | Font |
|---|---|
| `5c285b27cdda1fe8` | DM Sans (variant 1) |
| `797e433ab948586e` | DM Sans (variant 2) |
| `7ebf22b5a21034f8` | Geist Mono |
| `caa3a2e1cccd8315` | Geist |

### OG Image
| File | Size |
|---|---|
| `/images/general-learning-og-image.jpg` | 1200×630 |

---

## Quick Reference: Content Placeholders

When building your version, replace these content blocks:

| Section | What to Replace |
|---|---|
| **Hero** | Main tagline, CTA link |
| **Preface** | The scroll-reveal paragraph |
| **Timeline** | 4 eras with titles, descriptions, and 3 key events each |
| **Thesis** | 4 manifesto paragraphs with colored accent words |
| **Brand Cards** | 3 products with logos, descriptions, stats, and curricula |
| **Charts** | 3 SVG data visualizations with matching text |
| **Testimonials** | 6 video testimonials with thumbnails, quotes, names |
| **Team Photos** | 18+ team member photos |
| **Job Listings** | 5 job postings with titles and descriptions |
| **Footer** | Links, brand names, social links, copyright |
| **SEO** | Title, description, OG image |
| **Logos** | Nav wordmark, footer wordmark, favicon set |
