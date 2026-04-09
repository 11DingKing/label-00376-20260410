/**
 * 笔迹切割模块
 * 实现 Prompt 4.2 节的笔迹切割算法
 */
import { isStrokePointHitByEraser, getAABB, aabbIntersect, uid } from './geometry.js'

const LOG_PREFIX = '[StrokeSplitter]'

/**
 * 检查点是否被橡皮擦擦到
 */
function checkHit(p, eraserCapsules, eraserSize, strokeWidth) {
  for (const cap of eraserCapsules) {
    if (isStrokePointHitByEraser(p, cap.p1, cap.p2, eraserSize, strokeWidth)) return true
  }
  return false
}

/**
 * 二分查找精确交点
 */
function findIntersection(pStart, pEnd, eraserCapsules, eraserSize, strokeWidth) {
  let left = { ...pStart }
  let right = { ...pEnd }
  let mid = { 
    x: 0, 
    y: 0, 
    pressure: ((pStart.pressure ?? 0.5) + (pEnd.pressure ?? 0.5)) / 2 
  }
  
  // 迭代 8 次足够精确
  for (let k = 0; k < 8; k++) {
    mid = { 
      x: (left.x + right.x) / 2, 
      y: (left.y + right.y) / 2,
      pressure: ((pStart.pressure ?? 0.5) + (pEnd.pressure ?? 0.5)) / 2
    }
    const hit = checkHit(mid, eraserCapsules, eraserSize, strokeWidth)
    if (hit) right = { ...mid }
    else left = { ...mid }
  }
  return mid
}

/**
 * 根据模板创建新笔画
 */
function createStroke(points, template) {
  return {
    id: uid(),
    points: points.map(p => ({ ...p })),
    color: template.color,
    width: template.width,
    timestamp: template.timestamp,
  }
}

/**
 * 根据橡皮擦路径切割单条笔画
 * @param {Object} stroke - 笔画对象
 * @param {Array} eraserPoints - 橡皮擦路径点
 * @param {number} eraserSize - 橡皮擦大小
 * @returns {Array} 切割后的笔画数组
 */
export function splitStrokeByEraser(stroke, eraserPoints, eraserSize) {
  // 参数校验
  if (!stroke || !stroke.points) {
    console.warn(`${LOG_PREFIX} Invalid stroke`)
    return []
  }
  
  if (!eraserPoints || eraserPoints.length === 0) {
    return [stroke]
  }
  
  if (eraserSize <= 0) {
    console.warn(`${LOG_PREFIX} Invalid eraser size: ${eraserSize}`)
    return [stroke]
  }

  const points = stroke.points
  const strokeWidth = stroke.width || 4
  
  if (points.length < 1) return []
  
  // 单点笔画：直接检查是否被擦除
  if (points.length === 1) {
    const p = points[0]
    for (const ep of eraserPoints) {
      const dx = p.x - ep.x
      const dy = p.y - ep.y
      const combinedRadius = (eraserSize + strokeWidth) / 2
      if (dx * dx + dy * dy <= combinedRadius * combinedRadius) {
        return [] // 被擦除
      }
    }
    return [stroke]
  }

  // 构建橡皮擦胶囊体集合
  const eraserCapsules = []
  if (eraserPoints.length === 1) {
    // 单点橡皮擦：创建零长度胶囊（圆形）
    eraserCapsules.push({
      p1: eraserPoints[0],
      p2: eraserPoints[0],
      radius: eraserSize / 2,
    })
  } else {
    for (let i = 0; i < eraserPoints.length - 1; i++) {
      eraserCapsules.push({
        p1: eraserPoints[i],
        p2: eraserPoints[i + 1],
        radius: eraserSize / 2,
      })
    }
  }

  // AABB 快速排除
  const eraserAABB = getAABB(eraserPoints)
  if (!eraserAABB) return [stroke]
  
  const strokeAABB = getAABB(points)
  const combinedPadding = (eraserSize + strokeWidth) / 2
  if (!strokeAABB || !aabbIntersect(strokeAABB, eraserAABB, combinedPadding)) {
    return [stroke]
  }

  // 标记每个点的命中状态
  const hitFlags = points.map(p => checkHit(p, eraserCapsules, eraserSize, strokeWidth))
  
  // 如果所有点都被擦除
  if (hitFlags.every(h => h)) {
    return []
  }
  
  // 如果没有点被擦除
  if (hitFlags.every(h => !h)) {
    return [stroke]
  }

  // 切割笔画
  const newStrokes = []
  let currentSegment = []
  let wasHit = hitFlags[0]

  for (let i = 0; i < points.length; i++) {
    const isHit = hitFlags[i]
    
    if (!isHit) {
      // 当前点未被擦除
      if (wasHit && i > 0) {
        // 从擦除区域出来，找交点作为新段起点
        const intersection = findIntersection(points[i], points[i - 1], eraserCapsules, eraserSize, strokeWidth)
        currentSegment.push(intersection)
      }
      currentSegment.push(points[i])
    } else {
      // 当前点被擦除
      if (!wasHit && currentSegment.length > 0) {
        // 进入擦除区域，找交点作为当前段终点
        if (i > 0) {
          const intersection = findIntersection(points[i - 1], points[i], eraserCapsules, eraserSize, strokeWidth)
          currentSegment.push(intersection)
        }
        // 保存当前段
        if (currentSegment.length >= 1) {
          newStrokes.push(createStroke(currentSegment, stroke))
        }
        currentSegment = []
      }
    }
    wasHit = isHit
  }

  // 处理最后一段
  if (currentSegment.length >= 1) {
    newStrokes.push(createStroke(currentSegment, stroke))
  }

  return newStrokes
}

/**
 * 对所有笔画执行橡皮擦切割
 * @param {Array} strokes - 笔画数组
 * @param {Array} eraserPath - 橡皮擦路径
 * @param {number} eraserSize - 橡皮擦大小
 * @returns {Array} 切割后的笔画数组
 */
export function recognizeRemainingObjects(strokes, eraserPath, eraserSize) {
  if (!strokes || strokes.length === 0) {
    return []
  }
  
  if (!eraserPath || eraserPath.length < 1) {
    return strokes
  }

  const result = []
  for (const s of strokes) {
    try {
      const split = splitStrokeByEraser(s, eraserPath, eraserSize)
      result.push(...split)
    } catch (err) {
      console.error(`${LOG_PREFIX} Error splitting stroke ${s.id}:`, err)
      result.push(s) // 出错时保留原笔画
    }
  }
  
  return result
}
