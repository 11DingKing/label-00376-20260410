/**
 * Web Worker：在后台线程执行笔迹切割，避免阻塞 UI
 * 符合 Prompt 5.4 节要求
 */

// Worker 内部实现切割逻辑（避免模块导入问题）

function distToSegmentSquared(p, a, b) {
  const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
  if (l2 === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  return (p.x - projection.x) ** 2 + (p.y - projection.y) ** 2
}

function isStrokePointHitByEraser(point, lineStart, lineEnd, eraserSize, strokeWidth) {
  const combinedRadius = (eraserSize + strokeWidth) / 2
  return distToSegmentSquared(point, lineStart, lineEnd) <= combinedRadius * combinedRadius
}

function uid() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function getAABB(points) {
  if (!points || points.length === 0) return null
  let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y
  for (let i = 1; i < points.length; i++) {
    minX = Math.min(minX, points[i].x)
    minY = Math.min(minY, points[i].y)
    maxX = Math.max(maxX, points[i].x)
    maxY = Math.max(maxY, points[i].y)
  }
  return { minX, minY, maxX, maxY }
}

function aabbIntersect(a, b, padding = 0) {
  return !(a.maxX + padding < b.minX || b.maxX + padding < a.minX ||
           a.maxY + padding < b.minY || b.maxY + padding < a.minY)
}

function checkHit(p, eraserCapsules, eraserSize, strokeWidth) {
  for (const cap of eraserCapsules) {
    if (isStrokePointHitByEraser(p, cap.p1, cap.p2, eraserSize, strokeWidth)) return true
  }
  return false
}

function findIntersection(pStart, pEnd, eraserCapsules, eraserSize, strokeWidth) {
  let left = { ...pStart }
  let right = { ...pEnd }
  let mid = { x: 0, y: 0, pressure: ((pStart.pressure ?? 0.5) + (pEnd.pressure ?? 0.5)) / 2 }
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

function createStroke(points, template) {
  return {
    id: uid(),
    points: points.map(p => ({ ...p })),
    color: template.color,
    width: template.width,
    timestamp: template.timestamp,
  }
}

function splitStrokeByEraser(stroke, eraserPoints, eraserSize) {
  const points = stroke.points
  const strokeWidth = stroke.width
  
  if (!points || points.length < 1) return []
  
  // 单点笔画
  if (points.length === 1) {
    const p = points[0]
    for (const ep of eraserPoints) {
      const dx = p.x - ep.x
      const dy = p.y - ep.y
      const combinedRadius = (eraserSize + strokeWidth) / 2
      if (dx * dx + dy * dy <= combinedRadius * combinedRadius) {
        return []
      }
    }
    return [stroke]
  }

  // 构建橡皮擦胶囊
  const eraserCapsules = []
  if (eraserPoints.length === 1) {
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

  // 标记每个点是否被擦除
  const hitFlags = points.map(p => checkHit(p, eraserCapsules, eraserSize, strokeWidth))
  
  // 如果所有点都被擦除，返回空
  if (hitFlags.every(h => h)) return []
  
  // 如果没有点被擦除，返回原笔画
  if (hitFlags.every(h => !h)) return [stroke]

  // 切割笔画
  const newStrokes = []
  let currentSegment = []
  let wasHit = hitFlags[0]

  for (let i = 0; i < points.length; i++) {
    const isHit = hitFlags[i]
    
    if (!isHit) {
      if (wasHit && i > 0) {
        const intersection = findIntersection(points[i], points[i - 1], eraserCapsules, eraserSize, strokeWidth)
        currentSegment.push(intersection)
      }
      currentSegment.push(points[i])
    } else {
      if (!wasHit && currentSegment.length > 0) {
        if (i > 0) {
          const intersection = findIntersection(points[i - 1], points[i], eraserCapsules, eraserSize, strokeWidth)
          currentSegment.push(intersection)
        }
        if (currentSegment.length >= 1) {
          newStrokes.push(createStroke(currentSegment, stroke))
        }
        currentSegment = []
      }
    }
    wasHit = isHit
  }

  if (currentSegment.length >= 1) {
    newStrokes.push(createStroke(currentSegment, stroke))
  }

  return newStrokes
}

function recognizeRemainingObjects(strokes, eraserPath, eraserSize) {
  if (!eraserPath || eraserPath.length < 1) return strokes

  const result = []
  for (const s of strokes) {
    const split = splitStrokeByEraser(s, eraserPath, eraserSize)
    result.push(...split)
  }
  return result
}

// Worker 消息处理
self.onmessage = (e) => {
  if (e.data.type !== 'split') return
  
  try {
    const { strokes, eraserPath, eraserSize, affectedIds } = e.data
    console.log(`[Worker] Processing ${strokes.length} strokes`)
    
    const result = recognizeRemainingObjects(strokes, eraserPath, eraserSize)
    
    console.log(`[Worker] Split complete: ${strokes.length} -> ${result.length}`)
    
    self.postMessage({ 
      type: 'splitResult', 
      strokes: result,
      affectedIds: affectedIds 
    })
  } catch (err) {
    console.error('[Worker] Error:', err)
    self.postMessage({ 
      type: 'splitResult', 
      strokes: e.data.strokes,
      affectedIds: e.data.affectedIds 
    })
  }
}
