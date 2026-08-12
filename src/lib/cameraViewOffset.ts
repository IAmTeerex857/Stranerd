import { unionInsets, type CanvasInsets } from './canvasInsets'

export type Rectangle = { left: number; top: number; right: number; bottom: number; width: number; height: number }

const NO_INSETS: CanvasInsets = { top: 0, left: 0, right: 0, bottom: 0 }
const EDGE_SNAP_DISTANCE = 32

/**
 * Insets implied by panels that actually overlap the canvas right now.
 *
 * A panel only reserves a side when it is attached to that edge and covers most of it, so a
 * small floating control does not drag the specimen across the screen. Persistent chrome that
 * is too short to pass this test is supplied separately from the design system's inset table.
 */
export function measuredInsets(canvas: Rectangle, occluders: Rectangle[]): CanvasInsets {
  const insets = { ...NO_INSETS }
  for (const panel of occluders) {
    const overlapLeft = Math.max(canvas.left, panel.left)
    const overlapTop = Math.max(canvas.top, panel.top)
    const overlapRight = Math.min(canvas.right, panel.right)
    const overlapBottom = Math.min(canvas.bottom, panel.bottom)
    const overlapWidth = overlapRight - overlapLeft
    const overlapHeight = overlapBottom - overlapTop
    if (overlapWidth <= 0 || overlapHeight <= 0) continue

    if (overlapHeight >= canvas.height * 0.45) {
      if (overlapLeft <= canvas.left + EDGE_SNAP_DISTANCE) insets.left = Math.max(insets.left, overlapRight - canvas.left)
      if (overlapRight >= canvas.right - EDGE_SNAP_DISTANCE) insets.right = Math.max(insets.right, canvas.right - overlapLeft)
    }
    if (overlapWidth >= canvas.width * 0.45) {
      if (overlapTop <= canvas.top + EDGE_SNAP_DISTANCE) insets.top = Math.max(insets.top, overlapBottom - canvas.top)
      if (overlapBottom >= canvas.bottom - EDGE_SNAP_DISTANCE) insets.bottom = Math.max(insets.bottom, canvas.bottom - overlapTop)
    }
  }
  return insets
}

/** Pixel offset that moves the projected centre from the canvas centre to the usable-rect centre. */
export function offsetForInsets(canvas: Pick<Rectangle, 'width' | 'height'>, insets: CanvasInsets) {
  const usableWidth = Math.max(1, canvas.width - insets.left - insets.right)
  const usableHeight = Math.max(1, canvas.height - insets.top - insets.bottom)
  const usableCenterX = insets.left + usableWidth / 2
  const usableCenterY = insets.top + usableHeight / 2
  return {
    x: Math.round(canvas.width / 2 - usableCenterX),
    y: Math.round(canvas.height / 2 - usableCenterY),
  }
}

/**
 * Combine the design system's reserved chrome with whatever panels are currently open, and
 * return the view offset that re-centres the specimen against the usable rect. Centering is
 * applied through the camera, never by translating the model.
 */
export function cameraViewOffset(canvas: Rectangle, occluders: Rectangle[], reserved: CanvasInsets = NO_INSETS) {
  return offsetForInsets(canvas, unionInsets(measuredInsets(canvas, occluders), reserved))
}
