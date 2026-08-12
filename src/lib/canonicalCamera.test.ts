import { describe, expect, it } from 'vitest'
import { canonicalCameraPosition, fitDistance, focusDistanceClamp, framedDistance } from './canonicalCamera'
import { models } from '../data/models'
import type { CanonicalCamera } from '../types'

const camera = (overrides: Partial<CanonicalCamera> = {}): CanonicalCamera => ({
  azimuth: 0, elevation: 0, distance: 4.5, minDistance: 1.5, maxDistance: 7, view: 'test', ...overrides,
})

describe('canonicalCameraPosition', () => {
  it('places a zero orbit directly anterior on +Z', () => {
    const [x, y, z] = canonicalCameraPosition(camera({ distance: 4.8 }))
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(0, 6)
    expect(z).toBeCloseTo(4.8, 6)
  })

  it('preserves the authored distance from the origin at any orbit', () => {
    const entry = camera({ azimuth: -75, elevation: 8, distance: 4.6 })
    const [x, y, z] = canonicalCameraPosition(entry)
    expect(Math.hypot(x, y, z)).toBeCloseTo(4.6, 6)
  })

  it('lifts the camera for positive elevation and swings it for negative azimuth', () => {
    const [x, y] = canonicalCameraPosition(camera({ azimuth: -20, elevation: 6, distance: 4 }))
    expect(y).toBeGreaterThan(0)
    expect(x).toBeLessThan(0)
  })
})

describe('focusDistanceClamp', () => {
  it('falls back to the subject clamp when nothing is focused', () => {
    expect(focusDistanceClamp(camera())).toEqual({ minDistance: 1.5, maxDistance: 7 })
  })

  it('clamps a focused structure to 1.4x its radius', () => {
    expect(focusDistanceClamp(camera(), 1).minDistance).toBeCloseTo(1.4, 6)
  })

  it('applies the 0.6 floor to very small structures', () => {
    expect(focusDistanceClamp(camera(), 0.05).minDistance).toBeCloseTo(0.6, 6)
  })

  it('ignores a non-finite or non-positive radius', () => {
    expect(focusDistanceClamp(camera(), 0)).toEqual({ minDistance: 1.5, maxDistance: 7 })
    expect(focusDistanceClamp(camera(), Number.NaN)).toEqual({ minDistance: 1.5, maxDistance: 7 })
  })
})

describe('fitDistance', () => {
  it('matches the authored landscape distances at a wide aspect', () => {
    // The table was authored for a landscape rect; a 16:9 fit should land near 4.5.
    expect(fitDistance(16 / 9)).toBeCloseTo(4.56, 1)
  })

  it('pulls back further as the canvas gets narrower', () => {
    const landscape = fitDistance(16 / 9)
    const square = fitDistance(1)
    const portrait = fitDistance(390 / 700, 42, 0.14)
    expect(square).toBeGreaterThanOrEqual(landscape)
    expect(portrait).toBeGreaterThan(square)
  })

  it('keeps a phone-shaped canvas from cropping the specimen', () => {
    // 390x700 at 14% padding needs roughly 8.5 units, not the authored 4.5.
    expect(fitDistance(390 / 700, 42, 0.14)).toBeGreaterThan(8)
  })

  it('survives a degenerate aspect', () => {
    expect(Number.isFinite(fitDistance(0))).toBe(true)
    expect(Number.isFinite(fitDistance(Number.NaN))).toBe(true)
  })
})

describe('framedDistance', () => {
  it('keeps the authored teaching distance on a wide canvas', () => {
    const entry = camera({ distance: 4.5 })
    expect(framedDistance(entry, 16 / 9)).toBeCloseTo(4.56, 1)
    expect(framedDistance(camera({ distance: 6.3 }), 16 / 9)).toBeCloseTo(6.3, 6)
  })

  it('never frames closer than the authored distance', () => {
    const entry = camera({ distance: 5.4 })
    expect(framedDistance(entry, 3)).toBeGreaterThanOrEqual(5.4)
  })
})

describe('canonical camera table', () => {
  it('covers every subject with a usable clamp around its authored distance', () => {
    expect(models).toHaveLength(10)
    for (const model of models) {
      expect(model.camera, `${model.id} is missing a canonical camera`).toBeDefined()
      expect(model.camera.minDistance).toBeGreaterThan(0)
      expect(model.camera.minDistance).toBeLessThan(model.camera.distance)
      expect(model.camera.maxDistance).toBeGreaterThan(model.camera.distance)
      expect(model.camera.view.length).toBeGreaterThan(0)
    }
  })
})
