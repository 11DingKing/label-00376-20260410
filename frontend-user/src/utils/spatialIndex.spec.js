import { describe, it, expect, beforeEach } from 'vitest'
import { SpatialIndex } from './spatialIndex.js'

function stroke(id, points) {
  return { id, points, color: '#000', width: 4, timestamp: Date.now() }
}

describe('SpatialIndex', () => {
  let index

  beforeEach(() => {
    index = new SpatialIndex()
  })

  it('addStroke and getStrokeIdsInEraserPath', () => {
    const s = stroke('a', [
      { x: 25, y: 25 },
      { x: 75, y: 75 },
    ])
    index.addStroke(s)
    const ids = index.getStrokeIdsInEraserPath(
      [
        { x: 50, y: 50 },
        { x: 60, y: 60 },
      ],
      20
    )
    expect(ids.has('a')).toBe(true)
  })

  it('getStrokeIdsInEraserPath returns empty when no strokes', () => {
    const ids = index.getStrokeIdsInEraserPath(
      [
        { x: 50, y: 50 },
        { x: 60, y: 60 },
      ],
      20
    )
    expect(ids.size).toBe(0)
  })

  it('removeStroke removes from index', () => {
    const s = stroke('a', [
      { x: 25, y: 25 },
      { x: 75, y: 75 },
    ])
    index.addStroke(s)
    index.removeStroke('a')
    const ids = index.getStrokeIdsInEraserPath(
      [
        { x: 50, y: 50 },
        { x: 60, y: 60 },
      ],
      20
    )
    expect(ids.has('a')).toBe(false)
  })

  it('clear removes all', () => {
    index.addStroke(stroke('a', [{ x: 10, y: 10 }, { x: 20, y: 20 }]))
    index.clear()
    const ids = index.getStrokeIdsInEraserPath([{ x: 15, y: 15 }, { x: 16, y: 16 }], 10)
    expect(ids.size).toBe(0)
  })

  it('rebuild replaces index', () => {
    index.addStroke(stroke('old', [{ x: 0, y: 0 }, { x: 1, y: 1 }]))
    const newStrokes = [stroke('new', [{ x: 50, y: 50 }, { x: 51, y: 51 }])]
    index.rebuild(newStrokes)
    const ids = index.getStrokeIdsInEraserPath([{ x: 50, y: 50 }, { x: 51, y: 51 }], 5)
    expect(ids.has('new')).toBe(true)
    expect(ids.has('old')).toBe(false)
  })

  it('handles stroke with empty points', () => {
    const s = stroke('empty', [])
    index.addStroke(s)
    expect(index.strokeAABBs.has('empty')).toBe(false)
  })

  it('handles multiple strokes in same cell', () => {
    index.addStroke(stroke('a', [{ x: 10, y: 10 }, { x: 20, y: 20 }]))
    index.addStroke(stroke('b', [{ x: 15, y: 15 }, { x: 25, y: 25 }]))
    const ids = index.getStrokeIdsInEraserPath([{ x: 15, y: 15 }], 5)
    expect(ids.has('a')).toBe(true)
    expect(ids.has('b')).toBe(true)
  })

  it('removeStroke handles non-existent id', () => {
    index.removeStroke('nonexistent')
    expect(index.strokeAABBs.size).toBe(0)
  })

  it('handles strokes spanning multiple cells', () => {
    const s = stroke('large', [{ x: 0, y: 0 }, { x: 200, y: 200 }])
    index.addStroke(s)
    const ids1 = index.getStrokeIdsInEraserPath([{ x: 25, y: 25 }], 10)
    const ids2 = index.getStrokeIdsInEraserPath([{ x: 175, y: 175 }], 10)
    expect(ids1.has('large')).toBe(true)
    expect(ids2.has('large')).toBe(true)
  })
})
