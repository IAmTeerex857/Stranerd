import type { CanonicalCamera } from '../types'

const DEGREES = Math.PI / 180

/**
 * Convert a canonical orbit entry into a camera position in model space.
 *
 * Specimens are normalized so their bounding-box center sits at the origin, so the orbit
 * target is always [0, 0, 0]. Azimuth rotates around the vertical axis with 0 looking from
 * anterior (+Z); elevation lifts the camera above the horizontal plane.
 */
export function canonicalCameraPosition({ azimuth, elevation, distance }: Pick<CanonicalCamera, 'azimuth' | 'elevation' | 'distance'>): [number, number, number] {
  const az = azimuth * DEGREES
  const el = elevation * DEGREES
  const horizontal = distance * Math.cos(el)
  return [horizontal * Math.sin(az), distance * Math.sin(el), horizontal * Math.cos(az)]
}

/** Specimens are normalized so their largest dimension is 3.15 world units. */
export const NORMALIZED_EXTENT = 3.15

/**
 * Distance needed to fit the whole specimen inside a rect of this aspect, at this vertical
 * field of view, keeping `padding` of the smaller dimension clear for labels and overlays.
 *
 * The authored distances in the canonical table fit a landscape rect. A portrait canvas has a
 * much narrower horizontal field, so the specimen overflows sideways unless the camera pulls
 * back — which is what crops the model on phones. Callers take the larger of the authored
 * distance and this one, so desktop keeps its teaching framing and narrow screens widen.
 */
export function fitDistance(aspect: number, fov = 42, padding = 0.1, extent = NORMALIZED_EXTENT) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const radius = extent / 2
  const halfFov = (fov / 2) * DEGREES
  const vertical = radius / Math.tan(halfFov)
  const horizontal = radius / (Math.tan(halfFov) * safeAspect)
  return Math.max(vertical, horizontal) / Math.max(0.1, 1 - padding)
}

/** Framing for a canvas of this aspect: never closer than the authored teaching distance. */
export function framedDistance(camera: CanonicalCamera, aspect: number, padding = 0.1, fov = 42) {
  return Math.max(camera.distance, fitDistance(aspect, fov, padding))
}

/**
 * Distance limits for the active selection. Focusing a structure clamps to 1.4x the
 * selection radius with a floor of 0.6, so a small structure can fill the frame without
 * letting the camera enter the mesh. Falls back to the subject clamp when nothing is focused.
 */
export function focusDistanceClamp(camera: CanonicalCamera, selectionRadius?: number) {
  if (selectionRadius === undefined || !Number.isFinite(selectionRadius) || selectionRadius <= 0) {
    return { minDistance: camera.minDistance, maxDistance: camera.maxDistance }
  }
  return { minDistance: Math.max(0.6, selectionRadius * 1.4), maxDistance: camera.maxDistance }
}
