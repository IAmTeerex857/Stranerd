export type CanvasInsets = { top: number; left: number; right: number; bottom: number }

/**
 * Reserved chrome around the specimen canvas, per the design system's usable-canvas table.
 *
 * These cover the *persistent* chrome only — the title block, tool rail, assistant rail and
 * specimen bar are always present at a given breakpoint, and several of them are too short to
 * be detected reliably by measuring overlap (the tool rail is vertically centred and only a
 * few buttons tall). Transient panels such as the dissection dock and an open Mentor rail are
 * measured from the DOM instead and unioned with these values.
 *
 * Below 768 the chrome collapses to sheets that sit outside the canvas, so the side insets
 * fall to zero and only the vertical bands remain.
 */
const BREAKPOINTS: { minWidth: number; insets: CanvasInsets; captions: number; safePadding: number }[] = [
  { minWidth: 1600, insets: { top: 56, left: 64, right: 96, bottom: 64 }, captions: 72, safePadding: 0.1 },
  { minWidth: 1200, insets: { top: 56, left: 64, right: 96, bottom: 64 }, captions: 72, safePadding: 0.1 },
  { minWidth: 768, insets: { top: 52, left: 0, right: 0, bottom: 72 }, captions: 80, safePadding: 0.12 },
  { minWidth: 0, insets: { top: 48, left: 0, right: 0, bottom: 76 }, captions: 88, safePadding: 0.14 },
]

function breakpointFor(viewportWidth: number) {
  return BREAKPOINTS.find((entry) => viewportWidth >= entry.minWidth) ?? BREAKPOINTS[BREAKPOINTS.length - 1]
}

/** Persistent chrome reserved at this viewport width, plus the caption band when Voice is showing captions. */
export function reservedInsets(viewportWidth: number, captionsVisible = false): CanvasInsets {
  const entry = breakpointFor(viewportWidth)
  return { ...entry.insets, bottom: entry.insets.bottom + (captionsVisible ? entry.captions : 0) }
}

/** Fraction of the usable rect kept clear around the specimen so labels and leaders are not clipped. */
export function safePadding(viewportWidth: number) {
  return breakpointFor(viewportWidth).safePadding
}

export function unionInsets(a: CanvasInsets, b: CanvasInsets): CanvasInsets {
  return {
    top: Math.max(a.top, b.top),
    left: Math.max(a.left, b.left),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  }
}
