export type Rectangle = { left: number; top: number; right: number; bottom: number; width: number; height: number }

export function cameraViewOffset(canvas: Rectangle, occluders: Rectangle[]) {
  let left = 0
  let top = 0
  let right = 0
  let bottom = 0

  for (const panel of occluders) {
    const overlapLeft = Math.max(canvas.left, panel.left)
    const overlapTop = Math.max(canvas.top, panel.top)
    const overlapRight = Math.min(canvas.right, panel.right)
    const overlapBottom = Math.min(canvas.bottom, panel.bottom)
    const overlapWidth = overlapRight - overlapLeft
    const overlapHeight = overlapBottom - overlapTop
    if (overlapWidth <= 0 || overlapHeight <= 0) continue

    if (overlapHeight >= canvas.height * 0.45) {
      if (overlapLeft <= canvas.left + 1) left = Math.max(left, overlapWidth)
      if (overlapRight >= canvas.right - 1) right = Math.max(right, overlapWidth)
    }
    if (overlapWidth >= canvas.width * 0.45) {
      if (overlapTop <= canvas.top + 1) top = Math.max(top, overlapHeight)
      if (overlapBottom >= canvas.bottom - 1) bottom = Math.max(bottom, overlapHeight)
    }
  }

  const usableWidth = Math.max(1, canvas.width - left - right)
  const usableHeight = Math.max(1, canvas.height - top - bottom)
  const usableCenterX = left + usableWidth / 2
  const usableCenterY = top + usableHeight / 2
  return {
    x: Math.round(canvas.width / 2 - usableCenterX),
    y: Math.round(canvas.height / 2 - usableCenterY),
  }
}
