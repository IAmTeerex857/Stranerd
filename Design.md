Here's the complete design spec for this deck — colors, type, spacing, components, and animation — pulled straight from the file so you can reuse it anywhere.

## 🎨 Colors

/\* Backgrounds \*/  
\--bg:        \#0A0C0F;   /\* near-black, cool — main slide bg \*/  
\--bg-alt:    \#0C1019;   /\* deep indigo-black — section dividers \*/

/\* Text \*/  
\--ink:    \#EBEFF4;      /\* primary text \*/  
\--muted:  \#93A0AD;      /\* secondary / body \*/  
\--faint:  \#5A6675;      /\* footers, captions, watermarks \*/

/\* Lines & surfaces (translucent white over dark) \*/  
\--line:       rgba(255,255,255,.10);   /\* card borders \*/  
\--line-soft:  rgba(255,255,255,.06);   /\* inner dividers \*/  
\--surface:    rgba(255,255,255,.035);  /\* card fill \*/  
\--surface-2:  rgba(255,255,255,.06);   /\* raised fill \*/

/\* Accent — electric cyan-blue (primary brand) \*/  
\--accent:      \#4DB6FF;  
\--accent-dim:  rgba(77,182,255,.14);   /\* tinted fills \*/  
\--accent-line: rgba(77,182,255,.40);   /\* highlighted borders \*/

/\* Secondary / semantic \*/  
\--magenta: \#E26BD6;   /\* diagram secondary, "AI" speaker \*/  
\--green:   \#5FD08A;   /\* success / good prompt \*/  
\--amber:   \#F2C261;   /\* warning \*/  
\--red:     \#FF7A7A;   /\* error / bad prompt \*/

Accent alternatives (offered in the Tweaks panel): \#4DB6FF cyan · \#F2C261 amber · \#A98BFF violet · \#5FD08A green.

Background treatment — every slide carries a soft radial glow in the top-right:

background:  
  radial-gradient(1200px 800px at 82% \-8%, rgba(77,182,255,.07), transparent 60%),  
  \#0A0C0F;

Section dividers flip it to bottom-left over the darker bg:

background:  
  radial-gradient(1000px 700px at 18% 110%, rgba(77,182,255,.10), transparent 55%),  
  \#0C1019;

## ✍️ Typography

Three Google Fonts:

| Role | Font | Weights | Used for |
| ----- | ----- | ----- | ----- |
| Display | Space Grotesk | 400/500/600/700 | Headings, big numbers, titles |
| Body | IBM Plex Sans | 300/400/500/600 | Paragraphs, card text, labels |
| Mono | JetBrains Mono | 400/500/600 | Prompts, code, eyebrows, footers |

\--font-display: 'Space Grotesk', system-ui, sans-serif;  
\--font-body:    'IBM Plex Sans', system-ui, sans-serif;  
\--font-mono:    'JetBrains Mono', ui-monospace, monospace;

Import:

\<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700\&family=IBM+Plex+Sans:wght@300;400;500;600\&family=JetBrains+Mono:wght@400;500;600\&display=swap" rel="stylesheet"\>

Type scale (designed at 1920×1080):

\--type-display:  116px;  /\* cover / section titles \*/  
\--type-title:     64px;  /\* slide H2 \*/  
\--type-subtitle:  40px;  /\* takeaways, card H3 \*/  
\--type-body:      30px;  /\* paragraphs \*/  
\--type-small:     24px;  /\* card body, captions \*/  
\--type-mono:      23px;  /\* prompt cards \*/  
\--type-micro:     22px;  /\* eyebrows, tags \*/

Heading rules: font-weight: 600, line-height: 1.04, letter-spacing: \-.015em. Body runs line-height: 1.45–1.5; lead paragraphs use font-weight: 300.

The "eyebrow" kicker (signature element) — mono, uppercased, wide tracking, cyan, with a short leading rule:

.eyebrow {  
  font-family: var(--font-mono);  
  font-size: 22px;  
  letter-spacing: .22em;  
  text-transform: uppercase;  
  color: \#4DB6FF;  
}  
.eyebrow::before {  
  content: ""; width: 30px; height: 2px;  
  background: \#4DB6FF; margin-right: 14px;  
}

## 📐 Spacing & shape

\--pad-x: 112px;        /\* slide left/right padding \*/  
\--pad-top: 96px;  
\--pad-bottom: 84px;  
\--gap-title: 44px;  
\--gap-item: 26px;

* Card radius: 16px (generic cards), 14px (prompt/code cards), 12px (chat rows), 999px (chips/tags)  
* Card style: 1px solid rgba(255,255,255,.10) border \+ rgba(255,255,255,.035) fill — no drop shadows, everything reads via translucency on dark  
* Accent diamond (brand mark / bullets): a 7–9px square rotated 45°  
* Layout: CSS grid with gap, content columns capped at max-width in ch units for readable measure

## 🎬 Animation

A single entrance pattern — content rises and fades in, staggered in 4 tiers. The visible end-state is the base style; it animates *from* hidden, gated on the active slide \+ motion preference (so print/PDF/reduced-motion show content normally):

@media (prefers-reduced-motion: no-preference) {  
  \[data-deck-active\] .anim  { animation: rise .55s cubic-bezier(.2,.7,.2,1) both; }  
  \[data-deck-active\] .anim2 { animation: rise .55s cubic-bezier(.2,.7,.2,1) .08s both; }  
  \[data-deck-active\] .anim3 { animation: rise .55s cubic-bezier(.2,.7,.2,1) .16s both; }  
  \[data-deck-active\] .anim4 { animation: rise .55s cubic-bezier(.2,.7,.2,1) .24s both; }

  @keyframes rise {  
    from { opacity: 0; transform: translateY(16px); }  
    to   { opacity: 1; transform: none; }  
  }  
}  
@media print {  
  .anim,.anim2,.anim3,.anim4 { animation: none \!important; opacity: 1 \!important; transform: none \!important; }  
}

* Duration: 550ms · Easing: cubic-bezier(.2,.7,.2,1) (gentle decelerate) · Stagger: 80ms per tier · Travel: 16px upward  
* Apply .anim / .anim2 / .anim3 / .anim4 to elements in the order you want them to cascade.

## 🧩 Signature components

* Prompt cards — mono text in a bordered card with a header strip; a pill tag labels it (.bad red-tinted "Weak", .good cyan-tinted "Strong"); inside the prompt, spans color-code the parts: cyan \= role/instruction, magenta \= key parameter, muted \= constraint.  
* Chips — mono, pill-shaped, 1px border, used for example phrases.  
* Page footer — mono 15px, uppercase, wide tracking, faint; brand mark (diamond \+ "Spotflow") left, section name right.

