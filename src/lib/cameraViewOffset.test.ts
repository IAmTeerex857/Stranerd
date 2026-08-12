import { describe, expect, it } from 'vitest'
import { cameraViewOffset, type Rectangle } from './cameraViewOffset'

const rect = (left: number, top: number, width: number, height: number): Rectangle => ({ left, top, width, height, right: left + width, bottom: top + height })

describe('camera view offset', () => {
  const canvas = rect(100, 50, 1000, 700)

  it('does not shift for non-overlapping panels', () => {
    expect(cameraViewOffset(canvas, [rect(1100, 50, 420, 700)])).toEqual({ x: 0, y: 0 })
  })

  it('shifts away from a right overlay', () => {
    expect(cameraViewOffset(canvas, [rect(800, 50, 300, 700)])).toEqual({ x: 150, y: 0 })
  })

  it('shifts away from a bottom sheet', () => {
    expect(cameraViewOffset(canvas, [rect(100, 500, 1000, 250)])).toEqual({ x: 0, y: 125 })
  })

  it('combines edge-attached overlays', () => {
    expect(cameraViewOffset(canvas, [rect(850, 50, 250, 700), rect(100, 550, 1000, 200)])).toEqual({ x: 125, y: 100 })
  })
})
