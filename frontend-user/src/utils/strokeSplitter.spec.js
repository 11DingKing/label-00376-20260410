import { describe, it, expect } from 'vitest'
import { splitStrokeByEraser, recognizeRemainingObjects } from './strokeSplitter.js'

function stroke(id, points, color = '#000', width = 4) {
  return { id, points, color, width, timestamp: Date.now() }
}

describe('strokeSplitter', () => {
  describe('splitStrokeByEraser', () => {
    it('returns original stroke when eraser path has fewer than 2 points', () => {
      const s = stroke('a', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ])
      expect(splitStrokeByEraser(s, [], 20)).toEqual([s])
      expect(splitStrokeByEraser(s, [{ x: 50, y: 50 }], 20)).toEqual([s])
    })

    it('returns original stroke when single point stroke is not hit by eraser', () => {
      const s = stroke('a', [{ x: 0, y: 0 }])
      const eraser = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ]
      expect(splitStrokeByEraser(s, eraser, 20)).toEqual([s])
    })

    it('returns empty when single point stroke is hit by eraser', () => {
      const s = stroke('a', [{ x: 0, y: 0 }])
      const eraser = [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
      ]
      expect(splitStrokeByEraser(s, eraser, 20)).toEqual([])
    })

    it('returns empty array for empty stroke', () => {
      const s = stroke('a', [])
      const eraser = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]
      expect(splitStrokeByEraser(s, eraser, 20)).toEqual([])
    })

    it('returns original stroke when AABB does not intersect eraser', () => {
      const s = stroke('a', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ])
      const eraser = [
        { x: 200, y: 200 },
        { x: 300, y: 300 },
      ]
      expect(splitStrokeByEraser(s, eraser, 20)).toEqual([s])
    })

    it('splits stroke when eraser crosses it', () => {
      const s = stroke('a', [
        { x: 0, y: 50 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
        { x: 150, y: 50 },
      ])
      const eraser = [
        { x: 50, y: 0 },
        { x: 50, y: 100 },
      ]
      const result = splitStrokeByEraser(s, eraser, 30)
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.every((r) => r.color === s.color && r.width === s.width)).toBe(true)
    })

    it('preserves stroke properties after split', () => {
      const s = stroke('a', [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ], '#ff0000', 8)
      const eraser = [
        { x: 50, y: -20 },
        { x: 50, y: 20 },
      ]
      const result = splitStrokeByEraser(s, eraser, 10)
      for (const r of result) {
        expect(r.color).toBe('#ff0000')
        expect(r.width).toBe(8)
        expect(r.id).not.toBe(s.id)
      }
    })

    it('returns empty when entire stroke is erased', () => {
      const s = stroke('a', [
        { x: 50, y: 50 },
        { x: 51, y: 50 },
      ])
      const eraser = [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ]
      const result = splitStrokeByEraser(s, eraser, 50)
      expect(result.length).toBe(0)
    })

    it('handles eraser that misses stroke', () => {
      const s = stroke('a', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ])
      const eraser = [
        { x: 50, y: 100 },
        { x: 50, y: 200 },
      ]
      const result = splitStrokeByEraser(s, eraser, 10)
      expect(result).toHaveLength(1)
      expect(result[0].points).toEqual(s.points)
    })
  })


  describe('recognizeRemainingObjects', () => {
    it('returns strokes unchanged when eraser path has fewer than 2 points', () => {
      const strokes = [
        stroke('a', [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ]),
      ]
      expect(recognizeRemainingObjects(strokes, [], 20)).toEqual(strokes)
      expect(recognizeRemainingObjects(strokes, [{ x: 50, y: 50 }], 20)).toEqual(strokes)
    })

    it('processes multiple strokes', () => {
      const strokes = [
        stroke('a', [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ]),
        stroke('b', [
          { x: 0, y: 100 },
          { x: 50, y: 100 },
        ]),
      ]
      const eraser = [
        { x: 25, y: -10 },
        { x: 25, y: 110 },
      ]
      const result = recognizeRemainingObjects(strokes, eraser, 30)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('handles empty strokes array', () => {
      const result = recognizeRemainingObjects([], [{ x: 0, y: 0 }, { x: 10, y: 10 }], 20)
      expect(result).toEqual([])
    })

    it('preserves unaffected strokes', () => {
      const strokes = [
        stroke('a', [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
        stroke('b', [{ x: 500, y: 500 }, { x: 510, y: 500 }]),
      ]
      const eraser = [
        { x: 5, y: -10 },
        { x: 5, y: 10 },
      ]
      const result = recognizeRemainingObjects(strokes, eraser, 5)
      const bStroke = result.find(s => s.points[0].x === 500)
      expect(bStroke).toBeDefined()
      expect(bStroke.points).toEqual(strokes[1].points)
    })

    it('handles eraser crossing stroke once', () => {
      const s = stroke('a', [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 150, y: 0 },
        { x: 200, y: 0 },
      ])
      const eraser = [
        { x: 100, y: -50 },
        { x: 100, y: 50 },
      ]
      const result = recognizeRemainingObjects([s], eraser, 40)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })
  })
})
