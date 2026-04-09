/**
 * 生成唯一 ID
 * @returns {string}
 */
export function uid() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 计算点 p 到线段 ab 的最短距离平方
 * @param {import('@/types/index.js').Point} p
 * @param {import('@/types/index.js').Point} a
 * @param {import('@/types/index.js').Point} b
 * @returns {number}
 */
export function distToSegmentSquared(p, a, b) {
  const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
  if (l2 === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  return (p.x - projection.x) ** 2 + (p.y - projection.y) ** 2
}

/**
 * 判断点是否在粗线/橡皮擦胶囊体范围内
 * @param {import('@/types/index.js').Point} point
 * @param {import('@/types/index.js').Point} lineStart
 * @param {import('@/types/index.js').Point} lineEnd
 * @param {number} thickness
 * @returns {boolean}
 */
export function isPointInCapsule(point, lineStart, lineEnd, thickness) {
  const radius = thickness / 2
  return distToSegmentSquared(point, lineStart, lineEnd) <= radius * radius
}

/**
 * 判断笔画点是否被橡皮擦擦到（考虑笔画宽度 + 橡皮擦宽度）
 * @param {import('@/types/index.js').Point} point
 * @param {import('@/types/index.js').Point} lineStart
 * @param {import('@/types/index.js').Point} lineEnd
 * @param {number} eraserSize
 * @param {number} strokeWidth
 * @returns {boolean}
 */
export function isStrokePointHitByEraser(point, lineStart, lineEnd, eraserSize, strokeWidth) {
  const combinedRadius = (eraserSize + strokeWidth) / 2
  return distToSegmentSquared(point, lineStart, lineEnd) <= combinedRadius * combinedRadius
}

/**
 * 两点距离平方（避免开方）
 * @param {import('@/types/index.js').Point} a
 * @param {import('@/types/index.js').Point} b
 * @returns {number}
 */
export function distSq(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}


/**
 * 路径降采样：若相邻点距离 < minDist，丢弃后一个点
 * @param {import('@/types/index.js').Point[]} points
 * @param {number} [minDist=2]
 * @returns {import('@/types/index.js').Point[]}
 */
export function downsamplePoints(points, minDist = 2) {
  if (points.length <= 1) return points
  const result = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (distSq(points[i], result[result.length - 1]) >= minDist * minDist) {
      result.push(points[i])
    }
  }
  return result
}

/**
 * 计算点集的 AABB 包围盒
 * @param {import('@/types/index.js').Point[]} points
 * @returns {import('@/types/index.js').AABB|null}
 */
export function getAABB(points) {
  if (points.length === 0) return null
  let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y
  for (let i = 1; i < points.length; i++) {
    minX = Math.min(minX, points[i].x)
    minY = Math.min(minY, points[i].y)
    maxX = Math.max(maxX, points[i].x)
    maxY = Math.max(maxY, points[i].y)
  }
  return { minX, minY, maxX, maxY }
}

/**
 * 两个 AABB 是否相交
 * @param {import('@/types/index.js').AABB} a
 * @param {import('@/types/index.js').AABB} b
 * @param {number} [padding=0]
 * @returns {boolean}
 */
export function aabbIntersect(a, b, padding = 0) {
  return !(a.maxX + padding < b.minX || b.maxX + padding < a.minX ||
           a.maxY + padding < b.minY || b.maxY + padding < a.minY)
}
