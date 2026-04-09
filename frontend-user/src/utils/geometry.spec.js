import { describe, it, expect } from 'vitest'
import {
  uid,
  distToSegmentSquared,
  isPointInCapsule,
  isStrokePointHitByEraser,
  distSq,
  downsamplePoints,
  getAABB,
  aabbIntersect,
} from './geometry.js'

describe('geometry', () => {
  describe('uid', () => {
    it('returns unique strings', () => {
      const a = uid()
      const b = uid()
      expect(a).toBeTypeOf('string')
      expect(b).toBeTypeOf('string')
      expect(a).not.toBe(b)
      expect(a.startsWith('s_')).toBe(true)
    })

    it('generates many unique ids', () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(uid())
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('distToSegmentSquared', () => {
    it('returns distance to point when segment has zero length', () => {
      const p = { x: 1, y: 1 }
      const a = { x: 0, y: 0 }
      const b = { x: 0, y: 0 }
      expect(distToSegmentSquared(p, a, b)).toBe(2)
    })

    it('returns perpendicular distance to segment', () => {
      const p = { x: 0, y: 0 }
      const a = { x: -1, y: 1 }
      const b = { x: 1, y: 1 }
      expect(distToSegmentSquared(p, a, b)).toBe(1)
    })

    it('clamps to segment endpoints when projection outside', () => {
      const p = { x: -2, y: 0 }
      const a = { x: 0, y: 0 }
      const b = { x: 2, y: 0 }
      expect(distToSegmentSquared(p, a, b)).toBe(4)
    })

    it('returns 0 when point is on segment', () => {
      const p = { x: 1, y: 0 }
      const a = { x: 0, y: 0 }
      const b = { x: 2, y: 0 }
      expect(distToSegmentSquared(p, a, b)).toBe(0)
    })

    it('handles vertical segment', () => {
      const p = { x: 0, y: 1 }
      const a = { x: 0, y: 0 }
      const b = { x: 0, y: 2 }
      expect(distToSegmentSquared(p, a, b)).toBe(0)
    })
  })

  describe('isPointInCapsule', () => {
    it('returns true when point on segment within thickness', () => {
      const p = { x: 1, y: 1 }
      const a = { x: 0, y: 0 }
      const b = { x: 2, y: 2 }
      expect(isPointInCapsule(p, a, b, 4)).toBe(true)
    })

    it('returns false when point too far from segment', () => {
      const p = { x: 10, y: 10 }
      const a = { x: 0, y: 0 }
      const b = { x: 2, y: 0 }
      expect(isPointInCapsule(p, a, b, 2)).toBe(false)
    })

    it('returns true at segment endpoint within radius', () => {
      const p = { x: 0, y: 1 }
      const a = { x: 0, y: 0 }
      const b = { x: 10, y: 0 }
      expect(isPointInCapsule(p, a, b, 4)).toBe(true)
    })

    it('returns false just outside capsule', () => {
      const p = { x: 0, y: 3 }
      const a = { x: 0, y: 0 }
      const b = { x: 10, y: 0 }
      expect(isPointInCapsule(p, a, b, 4)).toBe(false)
    })
  })

  describe('distSq', () => {
    it('returns squared distance between two points', () => {
      expect(distSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25)
    })

    it('returns 0 for same point', () => {
      expect(distSq({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0)
    })

    it('handles negative coordinates', () => {
      expect(distSq({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(25)
    })
  })


  describe('downsamplePoints', () => {
    it('keeps first and last when all within minDist', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]
      const out = downsamplePoints(pts, 2)
      expect(out).toHaveLength(2)
      expect(out[0]).toEqual(pts[0])
      expect(out[1]).toEqual(pts[2])
    })

    it('returns single point unchanged', () => {
      const pts = [{ x: 0, y: 0 }]
      expect(downsamplePoints(pts)).toEqual(pts)
    })

    it('returns empty array unchanged', () => {
      expect(downsamplePoints([])).toEqual([])
    })

    it('keeps points that are far apart', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]
      const out = downsamplePoints(pts, 2)
      expect(out).toHaveLength(3)
    })

    it('uses default minDist of 2', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 3, y: 0 },
      ]
      const out = downsamplePoints(pts)
      expect(out).toHaveLength(2)
    })
  })

  describe('getAABB', () => {
    it('returns null for empty array', () => {
      expect(getAABB([])).toBeNull()
    })

    it('returns bbox for points', () => {
      const pts = [
        { x: 1, y: 2 },
        { x: -1, y: 5 },
        { x: 3, y: 0 },
      ]
      const box = getAABB(pts)
      expect(box.minX).toBe(-1)
      expect(box.minY).toBe(0)
      expect(box.maxX).toBe(3)
      expect(box.maxY).toBe(5)
    })

    it('handles single point', () => {
      const pts = [{ x: 5, y: 10 }]
      const box = getAABB(pts)
      expect(box.minX).toBe(5)
      expect(box.maxX).toBe(5)
      expect(box.minY).toBe(10)
      expect(box.maxY).toBe(10)
    })
  })

  describe('aabbIntersect', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    const b = { minX: 5, minY: 5, maxX: 15, maxY: 15 }

    it('returns true when overlapping', () => {
      expect(aabbIntersect(a, b)).toBe(true)
    })

    it('returns false when disjoint', () => {
      const c = { minX: 20, minY: 20, maxX: 30, maxY: 30 }
      expect(aabbIntersect(a, c)).toBe(false)
    })

    it('respects padding', () => {
      const c = { minX: 11, minY: 11, maxX: 12, maxY: 12 }
      expect(aabbIntersect(a, c)).toBe(false)
      expect(aabbIntersect(a, c, 2)).toBe(true)
    })

    it('returns true when touching edges', () => {
      const c = { minX: 10, minY: 0, maxX: 20, maxY: 10 }
      expect(aabbIntersect(a, c)).toBe(true)
    })

    it('returns true when one contains other', () => {
      const inner = { minX: 2, minY: 2, maxX: 8, maxY: 8 }
      expect(aabbIntersect(a, inner)).toBe(true)
    })
  })

  describe('isStrokePointHitByEraser', () => {
    it('returns true when point is within combined radius', () => {
      const point = { x: 5, y: 5 }
      const lineStart = { x: 0, y: 0 }
      const lineEnd = { x: 10, y: 0 }
      // 橡皮擦大小 10，笔画宽度 4，组合半径 = (10 + 4) / 2 = 7
      // 点到线段距离 = 5，小于 7
      expect(isStrokePointHitByEraser(point, lineStart, lineEnd, 10, 4)).toBe(true)
    })

    it('returns false when point is outside combined radius', () => {
      const point = { x: 5, y: 10 }
      const lineStart = { x: 0, y: 0 }
      const lineEnd = { x: 10, y: 0 }
      // 点到线段距离 = 10，大于组合半径 7
      expect(isStrokePointHitByEraser(point, lineStart, lineEnd, 10, 4)).toBe(false)
    })

    it('considers stroke width in collision detection', () => {
      const point = { x: 5, y: 6 }
      const lineStart = { x: 0, y: 0 }
      const lineEnd = { x: 10, y: 0 }
      // 只用橡皮擦大小 10，半径 5，点距离 6，不会碰撞
      expect(isPointInCapsule(point, lineStart, lineEnd, 10)).toBe(false)
      // 加上笔画宽度 4，组合半径 7，点距离 6，会碰撞
      expect(isStrokePointHitByEraser(point, lineStart, lineEnd, 10, 4)).toBe(true)
    })

    it('handles zero stroke width', () => {
      const point = { x: 5, y: 4 }
      const lineStart = { x: 0, y: 0 }
      const lineEnd = { x: 10, y: 0 }
      // 橡皮擦大小 10，笔画宽度 0，组合半径 = 5
      expect(isStrokePointHitByEraser(point, lineStart, lineEnd, 10, 0)).toBe(true)
    })
  })
})
