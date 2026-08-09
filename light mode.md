# Light Mode Design System

> Synthesized from [MathsGenie](https://mathsgenie.co.uk), [RevisionDojo](https://revisiondojo.com), and [OnePrep](https://oneprep.com)

---

## 1. Color Palette

### Core Semantic Colors

| Token                    | Value               | Usage                                      |
| ------------------------ | ------------------- | ------------------------------------------ |
| `--background`           | `#FFFFFF`           | Page background, card backgrounds          |
| `--foreground`           | `#0F172A` (Slate 900) | Primary text, headings                  |
| `--muted`                | `#F1F5F9` (Slate 100) | Muted backgrounds, input fills, empty states |
| `--muted-foreground`     | `#64748B` (Slate 500) | Secondary text, placeholders, captions   |
| `--border`               | `#E2E8F0` (Slate 200) | Card borders, dividers, separators       |
| `--subtle`               | `#E2E8F0` (Slate 200) | Subtle borders (2px), pricing card outlines |
| `--card`                 | `#FFFFFF`           | Card surfaces, modals, popovers           |
| `--card-foreground`      | `#0F172A`           | Text on card surfaces                      |

### Primary Accent — Brand Action Color

| Token                          | Value               | Usage                                  |
| ------------------------------ | ------------------- | -------------------------------------- |
| `--accent-primary`             | `#7C3AED` (Violet 600) | Focus rings, active indicators      |
| `--accent-primary-foreground`  | `#7C3AED` (Violet 600) | Accent text, underlines on highlights, progress bars |

> **Note:** All three sites use a violet/purple as their primary action color. RevisionDojo uses `bg-accent-purple-foreground` for CTAs, MathsGenie uses `bg-accent-primary-foreground`, and OnePrep uses a warm pink-red as its "Pro" accent but keeps primary actions in a blue-purple family.

### CTA / Button Colors

| Token               | Value               | Usage                                       |
| -------------------- | ------------------- | ------------------------------------------- |
| `--primary`          | `#7C3AED` (Violet 600) | Primary CTA buttons ("Get Started", "Open app") |
| `--primary-foreground` | `#FFFFFF`         | Text on primary buttons                     |
| `--secondary`        | `#F1F5F9`           | Secondary/outline buttons, muted pill buttons |
| `--secondary-foreground` | `#64748B`       | Text on secondary buttons                   |

### Accent Colors (Feature Highlights & Status)

| Token                        | Value                    | Usage                                    |
| ---------------------------- | ------------------------ | ---------------------------------------- |
| `--accent-purple`            | `#7C3AED` (Violet 600)  | Primary brand accent, hero underlines    |
| `--accent-purple-light`      | `#EDE9FE` (Violet 100)  | Announcement banners, tags               |
| `--accent-blue`              | `#0EA5E9` (Sky 500)     | Secondary feature accent, globe glow, info |
| `--accent-blue-light`        | `#E0F2FE` (Sky 100)     | Feature card backgrounds                 |
| `--accent-green`             | `#22C55E` (Green 500)   | Success states, positive testimonials    |
| `--accent-green-light`       | `#DCFCE7` (Green 100)   | Success backgrounds                      |
| `--accent-amber`             | `#F59E0B` (Amber 500)   | Awards, badges, sale banners             |
| `--accent-amber-light`       | `#FEF3C7` (Amber 100)   | Sale banner backgrounds                  |
| `--accent-pink`              | `#EC4899` (Pink 500)    | Pro plan accent, premium features        |
| `--accent-pink-foreground`   | `#EC4899` (Pink 500)    | Pro tier highlights, "Pro" badge text    |
| `--accent-red`               | `#DC2626` (Red 600)     | Destructive actions, errors              |

### Surface Tints (for Feature Sections)

| Token                   | Value                    | Usage                                   |
| ----------------------- | ------------------------ | --------------------------------------- |
| `--surface-sky`         | `#E0F2FE` (Sky 100)     | Feature card inner backgrounds (OnePrep "how it works") |
| `--surface-violet`      | `#EDE9FE` (Violet 100)  | Announcement strips (RevisionDojo)      |
| `--surface-pink-gradient` | `from pink/20 → background` | Pricing page gradient backgrounds |

---

## 2. Typography

### Font Stack

| Role         | Family                                  | Source     | Fallback           |
| ------------ | --------------------------------------- | ---------- | ------------------ |
| **Sans**     | `Inter`                                 | All three  | `system-ui, sans-serif` |
| **Title / Display** | `DM Sans` (OnePrep), `Manrope` (RevisionDojo), `Plus Jakarta Sans` (MathsGenie) | Google Fonts | `Inter, sans-serif` |
| **Mono**     | `Geist Mono` (RevisionDojo), `JetBrains Mono` | Google Fonts | `monospace` |

> **Recommendation:** Use **Inter** as the primary sans-serif and **DM Sans** (or Manrope) as the display/title font for headings. This mirrors the most polished pattern seen across all three sites.

### Type Scale

| Level      | Size (Desktop)     | Size (Mobile)    | Weight        | Line Height | Letter Spacing     | Usage               |
| ---------- | ------------------- | ---------------- | ------------- | ----------- | ------------------ | -------------------- |
| **Hero H1**    | `3.75rem` (60px)   | `1.75rem` (28px) | 600 (Semi)    | 1.1         | `-0.045em`         | Landing hero headline |
| **Section H2** | `3rem` (48px)      | `1.875rem` (30px) | 600 (Semi)   | 1.1         | `-0.05em`          | Section titles        |
| **Card H3**    | `1.5rem` (24px)    | `1.5rem` (24px)  | 500 (Medium)  | 1.0 (none)  | `-0.025em`         | Card titles, pricing  |
| **Body Large** | `1.125rem` (18px)  | `1rem` (16px)    | 400 (Regular) | 1.5 (snug)  | normal             | Hero subtext, feature descriptions |
| **Body**       | `1rem` (16px)      | `1rem` (16px)    | 400 (Regular) | 1.5         | normal             | General body text     |
| **Body Small** | `0.875rem` (14px)  | `0.875rem`       | 400–500       | 1.5         | normal             | Captions, metadata    |
| **Label / XS** | `0.75rem` (12px)   | `0.625rem` (10px) | 500 (Medium) | 1.5         | `0.025em`          | Badges, chart labels, progress captions |
| **Stat / Metric** | `2rem+` (32–44px) | `1.5rem` (24px)  | 500 (Medium)  | 1.0         | `tight`            | Dashboard numbers, pricing amounts |

### Key Typographic Patterns

- **Tight tracking on headings:** All three sites use aggressive negative letter-spacing (`-0.035em` to `-0.05em`) on display headings
- **`text-balance`** on headings: Used extensively for responsive line wrapping
- **`text-pretty`** on body text: Prevents orphans in paragraphs
- **`antialiased`** on `<body>`: All three apply `-webkit-font-smoothing: antialiased`
- **Tabular numerals** (`.tabular-nums`) for prices, scores, and stats

---

## 3. Spacing & Layout

### Spacing Scale (Base 4px)

| Token  | Value  | Usage                                    |
| ------ | ------ | ---------------------------------------- |
| `0.5`  | `2px`  | Tight gaps between inline elements       |
| `1`    | `4px`  | Icon-to-text gap, border widths          |
| `1.5`  | `6px`  | Badge padding, small gaps                |
| `2`    | `8px`  | Inline padding, tag margins              |
| `3`    | `12px` | Card inner gaps, small section padding   |
| `4`    | `16px` | Standard content padding, grid gaps      |
| `5`    | `20px` | Card padding (mobile)                    |
| `6`    | `24px` | Card padding (desktop), section padding  |
| `8`    | `32px` | Section margins, large gaps              |
| `10`   | `40px` | Section vertical padding                 |
| `12`   | `48px` | Large section spacing                    |
| `16`   | `64px` | Hero vertical padding                    |
| `20`   | `80px` | Major section breaks                     |
| `24`   | `96px` | Page-level section spacing               |
| `32`   | `128px`| Footer bottom padding                    |

### Container Widths

| Breakpoint      | Max Width     | Usage                          |
| --------------- | ------------- | ------------------------------ |
| **Content narrow** | `768px` (3xl)  | Pricing comparison, FAQ      |
| **Content default** | `896px` (4xl) | Article content, feature text |
| **Content wide**   | `1024px` (5xl) | Feature sections, testimonials |
| **Content max**    | `1192px` (MG) / `1440px` (OP) | Header nav, full-width sections |
| **Page max**       | `1600px`      | Hero backgrounds, stat globes |

### Page Padding

| Screen Size | Horizontal Padding |
| ----------- | ------------------ |
| Mobile      | `16px` (`px-4`)    |
| Tablet      | `24px` (`px-6`)    |
| Desktop     | `32px` (`px-8`)    |

---

## 4. Border Radius

| Token          | Value     | Usage                                        |
| -------------- | --------- | -------------------------------------------- |
| `--radius-sm`  | `8px`     | Small badges, checkboxes, tags               |
| `--radius-md`  | `12px`    | Input fields, small cards, buttons (xl)      |
| `--radius-lg`  | `16px`    | Cards, feature panels, content containers    |
| `--radius-xl`  | `20px`    | Pricing cards, feature cards                 |
| `--radius-2xl` | `24px`    | Major section cards, pricing tier cards       |
| `--radius-full`| `9999px`  | Pill buttons, avatars, badges, nav pills     |

> **Key pattern:** Buttons universally use `rounded-full` (pill) or `rounded-2xl`. Cards use `rounded-2xl` to `rounded-3xl`. All three sites favor generous, soft rounding.

---

## 5. Shadows & Elevation

| Level          | Value                                                    | Usage                          |
| -------------- | -------------------------------------------------------- | ------------------------------ |
| **None**       | `none`                                                   | Flat cards (border-only)       |
| **Subtle**     | `0 1px 2px rgba(0,0,0,0.05)`                            | Hover states, subtle lift      |
| **Card**       | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | Dropdown menus, popovers      |
| **Elevated**   | `0 4px 12px rgba(15,23,42,0.1)`                         | Floating elements, modals      |
| **Avatar**     | `0 0.4rem 1.35rem rgba(15,23,42,0.25)`                  | Floating avatar cards (globe)  |
| **Hero glow**  | `inset 0 0 5rem rgba(56,189,248,0.45)`                  | Decorative globe glow          |

> **Design philosophy:** All three sites are predominantly **flat design with borders** rather than shadow-heavy. Cards use `border-2 border-subtle` instead of box-shadows. Shadows are reserved for overlays and floating elements.

---

## 6. Components

### 6.1 Buttons

#### Primary (CTA)

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;           /* h-12 px-6 */
  font-size: 1.125rem;          /* text-lg */
  font-weight: 500;
  line-height: 1;
  border-radius: 9999px;        /* rounded-full */
  background: var(--primary);
  color: var(--primary-foreground);
  cursor: pointer;
  transition: all 150ms;
  border: none;
}
.btn-primary:hover {
  opacity: 0.9;
}
.btn-primary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.5);
}
```

#### Secondary / Outline

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  font-size: 1.125rem;
  font-weight: 500;
  border-radius: 9999px;
  background: var(--background);
  color: var(--muted-foreground);
  border: 2px solid rgba(15, 23, 42, 0.1);     /* ring-foreground/10 */
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 150ms;
}
.btn-secondary:hover {
  border-color: rgba(15, 23, 42, 0.15);
  color: var(--foreground);
}
```

#### Ghost / Muted

```css
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 9999px;
  background: var(--muted);
  color: var(--muted-foreground);
  border: none;
  cursor: pointer;
  transition: all 150ms;
}
.btn-ghost:hover {
  background: var(--border);
  color: var(--foreground);
}
```

#### Icon Button

```css
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 16px;          /* rounded-2xl */
  background: transparent;
  color: var(--muted-foreground);
  border: none;
  cursor: pointer;
  transition: all 150ms;
}
.btn-icon:hover {
  background: rgba(15, 23, 42, 0.1);
  color: var(--foreground);
}
.btn-icon svg {
  width: 20px;
  height: 20px;
}
```

### 6.2 Navigation Bar

```
┌────────────────────────────────────────────────────────────┐
│  [Logo]   [Find your course ▼] [Features ▼]    [🔔] [CTA] │
│                                                            │
│  Height: 56px (min-h-14)                                   │
│  Background: #FFFFFF                                       │
│  Border-bottom: 2px transparent → colored on scroll        │
│  Position: sticky top-0 z-40                               │
│  Max-width: 1192px centered                                │
└────────────────────────────────────────────────────────────┘
```

**Key patterns:**
- Logo height: `28px` mobile, `32px` desktop
- Nav links: `rounded-xl`, `px-3 py-2`, `text-sm font-medium`
- Nav link color: `foreground/70` → `foreground` on hover
- Course finder button: `bg-muted` with compass icon
- Mobile: hamburger menu button (min-w-11 min-h-11 touch target)
- CTA button in nav: solid primary, `rounded-xl`, `px-3.5 py-1.5`

### 6.3 Cards

#### Feature Card (OnePrep "How It Works")

```css
.feature-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px;          /* rounded-2xl */
  border: 2px solid var(--subtle);
  background: var(--background);
}
.feature-card__preview {
  flex: 1;
  padding: 12px 12px 0;
  background: var(--surface-sky);     /* sky-100 */
}
.feature-card__preview-inner {
  border-radius: 12px 12px 0 0;
  background: var(--background);
  padding: 16px 20px 0;
}
.feature-card__footer {
  border-top: 2px solid var(--subtle);
  padding: 20px 24px;
}
.feature-card__step-number {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.5rem;
  color: rgba(15, 23, 42, 0.2);      /* foreground/30 */
  font-weight: 400;
  letter-spacing: -0.025em;
}
.feature-card__title {
  font-family: 'DM Sans', sans-serif;
  font-size: 1.5rem;
  font-weight: 500;
  letter-spacing: -0.025em;
  color: var(--foreground);
}
```

#### Pricing Card

```css
.pricing-card {
  display: flex;
  flex-direction: column;
  border-radius: 24px;          /* rounded-3xl */
  border: 2px solid var(--border);
  background: var(--card);
  padding: 24px;
}
.pricing-card--featured {
  border: none;
  background: var(--accent-pink);
  padding: 6px;                 /* ring effect */
}
.pricing-card--featured-inner {
  border-radius: 18px;
  background: var(--card);
  padding: 20px;
  background-image: linear-gradient(
    to bottom right,
    rgba(236, 72, 153, 0.2),
    rgba(236, 72, 153, 0.4)
  );
}
```

#### Stat Card (RevisionDojo Stats Grid)

```css
.stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 20px 24px;
  background: var(--card);
  text-align: left;
}
.stat-card__icon {
  width: 32px;
  height: 32px;
  /* Colored per-stat: amber-500, sky-500, green-500, pink-500 */
}
.stat-card__value {
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: -0.025em;
  color: var(--foreground);
}
.stat-card__description {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--muted-foreground);
  margin-top: 8px;
}
```

### 6.4 Testimonial Carousel

```
┌──────────────────────────────────────────────────┐
│                                                  │
│    " [Highlighted quote in accent color]         │
│      Rest of the testimonial text... "           │
│                                                  │
│    [Avatar] [Name] [Flag]                        │
│             [School/Dream school]                │
│                                                  │
│    ● ○ ○ ○ ○    (dot indicators)                 │
└──────────────────────────────────────────────────┘
```

**Key patterns:**
- Quote text: `text-xl sm:text-2xl md:text-3xl`, `font-medium`, `text-balance`
- Highlighted phrase: accent color text + `underline decoration-[3px]` with `decoration-{color}/50`
- Quote marks: `text-[1.35em] text-foreground/65 font-bold`
- Avatar: `48px` mobile, `56px` desktop, `rounded-full`
- Flag icon: `22×16px`, `rounded-sm`, with `ring-2 ring-foreground/10`
- Dot indicators: active = `w-8 bg-accent-primary-foreground`, inactive = `w-2 bg-border`
- Carousel: CSS transform `translate3d`, `transition-transform duration-500 ease-in-out`

### 6.5 Announcement Banner

```css
.announcement-banner {
  width: 100%;
  border-bottom: 2px solid rgba(91, 33, 182, 0.1);   /* violet-800/10 */
  background: #EDE9FE;             /* violet-100 */
  color: #4C1D95;                  /* violet-900 */
  text-align: center;
  padding: 10px 12px;
  font-size: 0.875rem;
  font-weight: 500;
}
.announcement-banner a {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
  text-decoration-color: rgba(91, 33, 182, 0.6);
}
```

#### Sale Banner (OnePrep)

```css
.sale-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  overflow: hidden;
  background: #FBBF24;           /* amber-400 */
  color: #451A03;                /* amber-950 */
  padding: 0 16px;
}
```

### 6.6 Progress Bars

```css
.progress-bar {
  position: relative;
  height: 4px;
  width: 100%;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--muted);
}
.progress-bar__fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: 9999px;
  background: var(--accent-primary-foreground);
  /* Width set dynamically via style="width: X%" */
}
```

### 6.7 Badges & Tags

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.025em;
  border-radius: 8px;
  white-space: nowrap;
}
/* Variants */
.badge--primary   { background: var(--accent-purple); color: white; }
.badge--sale      { background: var(--accent-pink); color: white; }
.badge--new       { background: rgba(236, 72, 153, 0.15); color: var(--accent-pink); }
.badge--subject   { background: var(--accent-blue-light); color: var(--accent-blue); }
```

### 6.8 Pill Tab Selector (Pricing Duration)

```css
.pill-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  padding-top: 24px;
}
.pill-tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
  padding: 8px 16px;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 9999px;
  background: var(--muted);
  color: var(--muted-foreground);
  border: none;
  cursor: pointer;
  transition: all 200ms;
}
.pill-tab:hover {
  background: var(--border);
}
.pill-tab--active {
  background: var(--accent-pink);
  color: white;
}
```

### 6.9 Checkbox

```css
.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(15, 23, 42, 0.2);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 150ms;
}
.checkbox:checked,
.checkbox[data-state="checked"] {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}
```

### 6.10 University Logo Strip

```css
.logo-strip {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px 24px;
  align-items: center;
  justify-items: center;
  max-width: 384px;
  margin: 0 auto;
}
@media (min-width: 1024px) {
  .logo-strip {
    display: flex;
    justify-content: space-between;
    max-width: none;
    gap: 12px;
  }
}
.logo-strip img {
  height: 32px;
  max-width: 120px;
  object-fit: contain;
  opacity: 0.6;
  filter: grayscale(1);
  mix-blend-mode: multiply;
}
```

---

## 7. Hero Section Pattern

### Structure

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────┐ │
│ │           Decorative SVG Background                      │ │
│ │    (gradient, parallax layers, rounded-b-2xl)            │ │
│ │                                                          │ │
│ │        Your [All-in-One] Tool to                         │ │
│ │     Ace Your SAT, ACT, or AP Exams                       │ │
│ │            ~~~~~~~~~~~~                                  │ │
│ │  (SVG underline under "All-in-One" in accent color)      │ │
│ │                                                          │ │
│ │   Subheading text in muted-foreground, text-balance      │ │
│ │                                                          │ │
│ │       [██ Get Started for Free ██]                       │ │
│ │    [I'm a parent]  [I'm an educator]                     │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│          Logo Strip (universities/trust badges)              │
│                                                              │
│                 Testimonial Carousel                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Hero Key Measurements

| Property                     | Value                                      |
| ---------------------------- | ------------------------------------------ |
| Min height                   | `520px`                                    |
| Desktop height               | `clamp(480px, 60vh, 600px)`                |
| Background container         | `min(100%, 153svh)` width, `max-w-[1600px]` |
| Background corner radius     | `rounded-b-[2rem]`                         |
| Gradient overlay on top      | `bg-gradient-to-b from-background to-transparent, h-48` |
| CTA container max-width      | `384px` (`max-w-sm`)                       |
| CTA stack layout             | Primary full-width, then 2-col grid for secondary |

### Hero Underline SVG Pattern

```html
<span class="relative inline-block whitespace-nowrap">
  All-in-One
  <svg aria-hidden="true" class="pointer-events-none absolute -bottom-[0.06em] left-0 h-[0.2em] w-full overflow-visible text-accent-primary-foreground"
       preserveAspectRatio="none" viewBox="0 0 100 12">
    <path d="M 3 9 Q 50 2 97 9" fill="none" stroke="currentColor"
          stroke-linecap="round" stroke-width="5" />
  </svg>
</span>
```

---

## 8. Animations & Transitions

### Entrance Animations

| Animation              | Duration | Easing       | Usage                            |
| ---------------------- | -------- | ------------ | -------------------------------- |
| `fade-in`              | `700ms`  | `ease-out`   | Hero content reveal              |
| `slide-in-from-bottom` | `700ms`  | `ease-out`   | Hero CTA entrance, mascots       |
| `zoom-in-95`           | `700ms`  | `ease-out`   | Hero mascot entrance (scale 0.95→1) |
| `hero-layer-in`        | staggered `0/90/150/220ms` | ease-out | Parallax background layers |

### Micro-interactions

| Element                  | Property        | Duration | Easing     |
| ------------------------ | --------------- | -------- | ---------- |
| Buttons hover            | `all`           | `150ms`  | default    |
| Nav links hover          | `colors`        | `150ms`  | default    |
| Carousel slide           | `transform`     | `500ms`  | `ease-in-out` |
| Dot indicator width      | `width, background-color` | `200ms` | default |
| Dropdown chevron rotate  | `transform`     | `200ms`  | `ease-out` |
| Arrow icon on hover      | `translateX(2px)` | `200ms` | `ease-out` |
| Progress bar loading     | `spin`          | `400ms`  | `linear`   |
| NProgress bar            | `3px height`    | built-in | built-in   |

### Parallax Scrolling (Hero)

```css
/* Each layer moves at a different rate */
.hero-layer-bg        { transform: translate3d(0, calc(var(--hero-scroll) * 0.3),  0); }
.hero-layer-midground { transform: translate3d(0, calc(var(--hero-scroll) * 0.24), 0); }
.hero-layer-foreground{ transform: translate3d(0, calc(var(--hero-scroll) * 0.1),  0); }
```

---

## 9. Iconography

| Pattern                | Size      | Style          | Color               |
| ---------------------- | --------- | -------------- | -------------------- |
| Navigation icons       | `20px`    | Filled/Solid   | `muted-foreground`   |
| Feature list checks    | `20px`    | Stroke (2px)   | `accent-foreground` or `white/60` |
| Stat icons             | `32px`    | Filled/Solid   | Per-category accent  |
| Inline arrows          | `16–20px` | Stroke         | `currentColor`, `opacity-60` |
| Chevron (dropdowns)    | `16px`    | Stroke/Filled  | `muted-foreground`, `opacity-50` |

> **Icon style:** Predominantly **solid/filled** icons for navigation and features. All three sites use custom SVG icon sets (not a public icon library). Icons are `currentColor`-based for easy theming.

---

## 10. Responsive Breakpoints

| Name   | Min Width | Key Changes                                    |
| ------ | --------- | ---------------------------------------------- |
| `sm`   | `640px`   | Hero text scales up, 2-col CTA grid            |
| `md`   | `768px`   | Desktop nav visible, hamburger hidden, 2-col pricing |
| `lg`   | `1024px`  | 3-col feature grid, full logo strip, larger hero |
| `xl`   | `1280px`  | Max content width reached                      |
| `2xl`  | `1536px`  | Wider margins, more breathing room             |

---

## 11. Accessibility Patterns (from MathsGenie)

All three sites include strong accessibility foundations. MathsGenie stands out with a dedicated accessibility settings panel:

| Feature               | Options                              | Implementation               |
| --------------------- | ------------------------------------ | ----------------------------- |
| Text size             | Normal, Large, X-Large               | CSS classes `a11y-text-large`, `a11y-text-xlarge` |
| Reading font          | Toggle                               | Class `a11y-reading-font`     |
| Page tint             | Cream, Blue, Green, Rose             | Classes `a11y-tint-{color}`   |
| Text spacing          | Toggle                               | Class `a11y-text-spacing`     |
| Reduce motion         | Toggle                               | Class `a11y-reduce-motion`    |
| High contrast         | Toggle                               | Class `a11y-high-contrast`    |
| Skip to content       | `sr-only` link, visible on focus     | First child in body           |
| Focus rings           | `ring-2 ring-foreground`, offset     | Consistent on all interactive |

---

## 12. Design Principles (Extracted)

1. **Flat + Border > Shadows**: Cards use `border-2 border-subtle` universally. Shadows reserved for overlays.
2. **Generous Rounding**: Everything from `rounded-xl` to `rounded-3xl`. Pill shapes for all buttons.
3. **Semantic Color via CSS Variables**: All colors referenced via `var(--token)` — never hardcoded.
4. **Tight Headlines, Relaxed Body**: Aggressive negative tracking on headings; standard tracking on body.
5. **Progressive Disclosure**: Hero → social proof (logos) → testimonials → features → pricing.
6. **Mobile-First Responsive**: All layouts start single-column and expand.
7. **Trust Signals Throughout**: University logos, student counts, testimonial carousels, flag icons.
8. **Accent Color Highlights**: Key phrases underlined with thick colored decorations (`decoration-[3px]`).
9. **2px Borders**: Consistent `border-2` (not `border-1`) for all bordered elements across all three sites.
10. **Stacked CTA Pattern**: Primary button full-width, secondary buttons in 2-column grid below.
