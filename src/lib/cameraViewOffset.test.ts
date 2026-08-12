import { describe, expect, it } from 'vitest'
import { cameraViewOffset, type Rectangle } from './cameraViewOffset'
import { reservedInsets, safePadding } from './canvasInsets'

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

  it('reserves persistent chrome that is too short to be measured', () => {
    // A 42px tool rail centred on a 700px edge never covers 45% of it, so only the reserved
    // table keeps the specimen clear of it.
    const railOnly = cameraViewOffset(canvas, [rect(100, 375, 64, 42)])
    expect(railOnly).toEqual({ x: 0, y: 0 })
    // usable 840x580 inside 1000x700 -> centre moves 16px left and 4px up
    expect(cameraViewOffset(canvas, [rect(100, 375, 64, 42)], { top: 56, left: 64, right: 96, bottom: 64 })).toEqual({ x: 16, y: 4 })
  })

  it('takes the larger of the reserved and measured inset on the same side', () => {
    const reserved = { top: 0, left: 0, right: 96, bottom: 0 }
    // The open 300px dock exceeds the 96px reserved rail, so the dock wins.
    expect(cameraViewOffset(canvas, [rect(800, 50, 300, 700)], reserved)).toEqual({ x: 150, y: 0 })
  })

  it('reserves inset floating docks together with their edge gap', () => {
    expect(cameraViewOffset(canvas, [rect(792, 70, 288, 660)])).toEqual({ x: 154, y: 0 })
    expect(cameraViewOffset(canvas, [rect(116, 534, 968, 196)])).toEqual({ x: 0, y: 108 })
  })

  it('ignores large panels floating away from every canvas edge', () => {
    expect(cameraViewOffset(canvas, [rect(350, 180, 500, 440)])).toEqual({ x: 0, y: 0 })
  })
})

describe('reserved insets', () => {
  it('collapses side chrome below the tablet breakpoint', () => {
    expect(reservedInsets(1440)).toEqual({ top: 56, left: 64, right: 96, bottom: 64 })
    expect(reservedInsets(900)).toEqual({ top: 52, left: 0, right: 0, bottom: 72 })
    expect(reservedInsets(390)).toEqual({ top: 48, left: 0, right: 0, bottom: 76 })
  })

  it('adds the caption band only while captions are visible', () => {
    expect(reservedInsets(1440, true).bottom).toBe(64 + 72)
    expect(reservedInsets(390, true).bottom).toBe(76 + 88)
  })

  it('widens safe padding on smaller screens', () => {
    expect(safePadding(1440)).toBeCloseTo(0.1)
    expect(safePadding(900)).toBeCloseTo(0.12)
    expect(safePadding(390)).toBeCloseTo(0.14)
  })
})
