/**
 * Canvas 画板核心逻辑
 * 采用"视觉层光栅化 + 逻辑层矢量化"混合渲染架构
 */
import { ref, reactive, shallowRef } from 'vue'
import { uid, downsamplePoints, getAABB, aabbIntersect, distToSegmentSquared } from '@/utils/geometry.js'
import { SpatialIndex } from '@/utils/spatialIndex.js'
import { recognizeRemainingObjects } from '@/utils/strokeSplitter.js'

// 常量配置
const DOWNSAMPLE_MIN_DIST = 2
const MAX_HISTORY = 50
const MIN_SCALE = 0.1
const MAX_SCALE = 10
const LOG_PREFIX = '[CanvasBoard]'

// 日志工具
const logger = {
  info: (msg, ...args) => console.log(`${LOG_PREFIX} ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`${LOG_PREFIX} ${msg}`, ...args),
  error: (msg, ...args) => console.error(`${LOG_PREFIX} ${msg}`, ...args),
}

export function useCanvasBoard() {
  const canvasEl = shallowRef(null)

  const state = reactive({
    strokes: [],
    currentStroke: null,
    tool: 'pen',
    penColor: '#1a1a1a',
    penWidth: 4,
    eraserSize: 24,
    viewport: { x: 0, y: 0, scale: 1 },
    selectedIds: [],
    pressureEnabled: true,
  })

  const undoStack = reactive([])
  const redoStack = reactive([])
  const spatialIndex = new SpatialIndex()
  const isDragging = ref(false)
  const lastPoint = ref(null)
  const logicalSize = ref({ w: 0, h: 0 })
  const gestureState = ref(null)
  const activePointers = ref(new Map())
  const selectionDragStart = ref(null)
  const mousePos = ref({ x: 0, y: 0 })
  const panStartViewport = ref(null)
  const panStartScreen = ref(null)
  
  // 橡皮擦路径（非响应式，避免性能问题）
  let eraserPath = []
  // 橡皮擦脏矩形（用于局部重绘）
  let eraserDirtyRect = null

  // Web Worker 实例（用于异步切割计算）
  let strokeSplitWorker = null
  
  /**
   * 初始化 Web Worker
   */
  function initWorker() {
    if (strokeSplitWorker) return
    if (typeof Worker === 'undefined') {
      logger.warn('Web Worker not supported')
      return
    }
    
    try {
      // 创建内联 Worker
      const workerCode = `
        function distToSegmentSquared(p, a, b) {
          const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (l2 === 0) return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
          let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
          return (p.x - projection.x) ** 2 + (p.y - projection.y) ** 2;
        }
        
        function isStrokePointHitByEraser(point, lineStart, lineEnd, eraserSize, strokeWidth) {
          const combinedRadius = (eraserSize + strokeWidth) / 2;
          return distToSegmentSquared(point, lineStart, lineEnd) <= combinedRadius * combinedRadius;
        }
        
        function uid() {
          return 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        }
        
        function getAABB(points) {
          if (!points || points.length === 0) return null;
          let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
          for (let i = 1; i < points.length; i++) {
            minX = Math.min(minX, points[i].x);
            minY = Math.min(minY, points[i].y);
            maxX = Math.max(maxX, points[i].x);
            maxY = Math.max(maxY, points[i].y);
          }
          return { minX, minY, maxX, maxY };
        }
        
        function aabbIntersect(a, b, padding) {
          return !(a.maxX + padding < b.minX || b.maxX + padding < a.minX ||
                   a.maxY + padding < b.minY || b.maxY + padding < a.minY);
        }
        
        function checkHit(p, eraserCapsules, eraserSize, strokeWidth) {
          for (const cap of eraserCapsules) {
            if (isStrokePointHitByEraser(p, cap.p1, cap.p2, eraserSize, strokeWidth)) return true;
          }
          return false;
        }
        
        function findIntersection(pStart, pEnd, eraserCapsules, eraserSize, strokeWidth) {
          let left = { ...pStart };
          let right = { ...pEnd };
          let mid = { x: 0, y: 0, pressure: ((pStart.pressure || 0.5) + (pEnd.pressure || 0.5)) / 2 };
          for (let k = 0; k < 8; k++) {
            mid = { 
              x: (left.x + right.x) / 2, 
              y: (left.y + right.y) / 2,
              pressure: ((pStart.pressure || 0.5) + (pEnd.pressure || 0.5)) / 2
            };
            const hit = checkHit(mid, eraserCapsules, eraserSize, strokeWidth);
            if (hit) right = { ...mid };
            else left = { ...mid };
          }
          return mid;
        }
        
        function createStroke(points, template) {
          return {
            id: uid(),
            points: points.map(p => ({ ...p })),
            color: template.color,
            width: template.width,
            timestamp: template.timestamp,
          };
        }
        
        function splitStrokeByEraser(stroke, eraserPoints, eraserSize) {
          const points = stroke.points;
          const strokeWidth = stroke.width;
          if (!points || points.length < 1) return [];
          
          if (points.length === 1) {
            const p = points[0];
            for (const ep of eraserPoints) {
              const dx = p.x - ep.x;
              const dy = p.y - ep.y;
              const combinedRadius = (eraserSize + strokeWidth) / 2;
              if (dx * dx + dy * dy <= combinedRadius * combinedRadius) return [];
            }
            return [stroke];
          }
          
          const eraserCapsules = [];
          if (eraserPoints.length === 1) {
            eraserCapsules.push({ p1: eraserPoints[0], p2: eraserPoints[0], radius: eraserSize / 2 });
          } else {
            for (let i = 0; i < eraserPoints.length - 1; i++) {
              eraserCapsules.push({ p1: eraserPoints[i], p2: eraserPoints[i + 1], radius: eraserSize / 2 });
            }
          }
          
          const eraserAABB = getAABB(eraserPoints);
          if (!eraserAABB) return [stroke];
          const strokeAABB = getAABB(points);
          const combinedPadding = (eraserSize + strokeWidth) / 2;
          if (!strokeAABB || !aabbIntersect(strokeAABB, eraserAABB, combinedPadding)) return [stroke];
          
          const hitFlags = points.map(p => checkHit(p, eraserCapsules, eraserSize, strokeWidth));
          if (hitFlags.every(h => h)) return [];
          if (hitFlags.every(h => !h)) return [stroke];
          
          const newStrokes = [];
          let currentSegment = [];
          let wasHit = hitFlags[0];
          
          for (let i = 0; i < points.length; i++) {
            const isHit = hitFlags[i];
            if (!isHit) {
              if (wasHit && i > 0) {
                const intersection = findIntersection(points[i], points[i - 1], eraserCapsules, eraserSize, strokeWidth);
                currentSegment.push(intersection);
              }
              currentSegment.push(points[i]);
            } else {
              if (!wasHit && currentSegment.length > 0) {
                if (i > 0) {
                  const intersection = findIntersection(points[i - 1], points[i], eraserCapsules, eraserSize, strokeWidth);
                  currentSegment.push(intersection);
                }
                if (currentSegment.length >= 1) newStrokes.push(createStroke(currentSegment, stroke));
                currentSegment = [];
              }
            }
            wasHit = isHit;
          }
          if (currentSegment.length >= 1) newStrokes.push(createStroke(currentSegment, stroke));
          return newStrokes;
        }
        
        function recognizeRemainingObjects(strokes, eraserPath, eraserSize) {
          if (!eraserPath || eraserPath.length < 1) return strokes;
          const result = [];
          for (const s of strokes) {
            const split = splitStrokeByEraser(s, eraserPath, eraserSize);
            result.push(...split);
          }
          return result;
        }
        
        self.onmessage = function(e) {
          if (e.data.type !== 'split') return;
          const { strokes, eraserPath, eraserSize, affectedIds } = e.data;
          const result = recognizeRemainingObjects(strokes, eraserPath, eraserSize);
          self.postMessage({ type: 'splitResult', strokes: result, affectedIds: affectedIds });
        };
      `
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      strokeSplitWorker = new Worker(workerUrl)
      
      strokeSplitWorker.onmessage = handleWorkerMessage
      strokeSplitWorker.onerror = (err) => {
        logger.error('Worker error:', err)
        strokeSplitWorker = null
      }
      
      logger.info('Web Worker initialized')
    } catch (err) {
      logger.warn('Failed to init Worker, using sync mode:', err)
      strokeSplitWorker = null
    }
  }
  
  // 保存待处理的脏矩形（用于 Worker 返回后的局部重绘）
  let pendingDirtyRect = null
  // 标记是否有 Worker 正在处理中
  let isWorkerProcessing = false
  
  /**
   * 处理 Worker 返回的消息
   */
  function handleWorkerMessage(e) {
    if (e.data.type !== 'splitResult') return
    const { strokes: newStrokes, affectedIds } = e.data
    
    // affectedIds 是数组，转换为 Set 进行快速查找
    const affectedIdSet = new Set(affectedIds)
    
    // 保留未受影响的笔画，合并新笔画
    const unchanged = state.strokes.filter(s => !affectedIdSet.has(s.id))
    state.strokes = [...unchanged, ...newStrokes]
    spatialIndex.rebuild(state.strokes)
    
    // 使用脏矩形局部重绘（规范 5.2）
    if (pendingDirtyRect) {
      redrawDirtyRect(pendingDirtyRect)
      pendingDirtyRect = null
    } else {
      redrawAll()
    }
    
    // 标记 Worker 处理完成
    isWorkerProcessing = false
    logger.info(`Worker split complete: ${newStrokes.length} strokes`)
  }

  // 重绘节流
  let rafId = null
  let needsRedraw = false
  
  function scheduleRedraw() {
    if (needsRedraw) return
    needsRedraw = true
    rafId = requestAnimationFrame(() => {
      needsRedraw = false
      redrawAll()
    })
  }

  /**
   * 扩展脏矩形
   */
  function expandDirtyRect(x, y, radius) {
    const pad = radius + 2
    if (!eraserDirtyRect) {
      eraserDirtyRect = {
        minX: x - pad,
        minY: y - pad,
        maxX: x + pad,
        maxY: y + pad,
      }
    } else {
      eraserDirtyRect.minX = Math.min(eraserDirtyRect.minX, x - pad)
      eraserDirtyRect.minY = Math.min(eraserDirtyRect.minY, y - pad)
      eraserDirtyRect.maxX = Math.max(eraserDirtyRect.maxX, x + pad)
      eraserDirtyRect.maxY = Math.max(eraserDirtyRect.maxY, y + pad)
    }
  }

  /**
   * 视觉层橡皮擦 - 使用 destination-out 实现真实像素擦除
   * 符合规范 3.2 节要求
   */
  function renderEraserVisual(p1, p2) {
    const ctx = getCtx()
    if (!ctx) return
    
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    const { x: vx, y: vy, scale } = state.viewport
    ctx.translate(vx, vy)
    ctx.scale(scale, scale)
    
    // 使用 destination-out 混合模式实现透明擦除
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = state.eraserSize
    
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
    
    // 恢复混合模式
    ctx.globalCompositeOperation = 'source-over'
    
    // 更新脏矩形
    expandDirtyRect(p1.x, p1.y, state.eraserSize / 2)
    expandDirtyRect(p2.x, p2.y, state.eraserSize / 2)
  }

  /**
   * 视觉层橡皮擦 - 绘制单点（圆形）
   */
  function renderEraserDot(p) {
    const ctx = getCtx()
    if (!ctx) return
    
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    const { x: vx, y: vy, scale } = state.viewport
    ctx.translate(vx, vy)
    ctx.scale(scale, scale)
    
    // 使用 destination-out 混合模式实现透明擦除
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.beginPath()
    ctx.arc(p.x, p.y, state.eraserSize / 2, 0, Math.PI * 2)
    ctx.fill()
    
    // 恢复混合模式
    ctx.globalCompositeOperation = 'source-over'
    
    // 更新脏矩形
    expandDirtyRect(p.x, p.y, state.eraserSize / 2)
  }

  function getCtx() {
    const c = canvasEl.value
    return c ? c.getContext('2d') : null
  }

  function clientToCanvas(e) {
    const c = canvasEl.value
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    const screenX = e.clientX - r.left
    const screenY = e.clientY - r.top
    const { x: vx, y: vy, scale } = state.viewport
    return {
      x: (screenX - vx) / scale,
      y: (screenY - vy) / scale,
    }
  }

  // ========== 历史记录 ==========
  
  function saveHistory() {
    try {
      const snapshot = {
        strokes: JSON.parse(JSON.stringify(state.strokes)),
        timestamp: Date.now(),
      }
      undoStack.push(snapshot)
      if (undoStack.length > MAX_HISTORY) undoStack.shift()
      redoStack.length = 0
    } catch (err) {
      logger.error('Failed to save history:', err)
    }
  }

  function undo() {
    if (undoStack.length === 0) {
      logger.info('Nothing to undo')
      return false
    }
    try {
      const current = {
        strokes: JSON.parse(JSON.stringify(state.strokes)),
        timestamp: Date.now(),
      }
      redoStack.push(current)
      const prev = undoStack.pop()
      state.strokes = prev.strokes
      state.selectedIds = []
      spatialIndex.rebuild(state.strokes)
      redrawAll()
      logger.info('Undo completed')
      return true
    } catch (err) {
      logger.error('Undo failed:', err)
      return false
    }
  }

  function redo() {
    if (redoStack.length === 0) {
      logger.info('Nothing to redo')
      return false
    }
    try {
      const current = {
        strokes: JSON.parse(JSON.stringify(state.strokes)),
        timestamp: Date.now(),
      }
      undoStack.push(current)
      const next = redoStack.pop()
      state.strokes = next.strokes
      state.selectedIds = []
      spatialIndex.rebuild(state.strokes)
      redrawAll()
      logger.info('Redo completed')
      return true
    } catch (err) {
      logger.error('Redo failed:', err)
      return false
    }
  }

  // ========== 绘制相关 ==========

  function getPressureWidth(baseWidth, pressure = 0.5) {
    if (!state.pressureEnabled) return baseWidth
    const factor = 0.3 + pressure * 1.2
    return baseWidth * factor
  }

  function drawStroke(ctx, stroke, isSelected = false) {
    const pts = stroke.points
    if (!pts || pts.length === 0) return

    ctx.globalCompositeOperation = 'source-over'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (pts.length === 1) {
      const pt = pts[0]
      const w = getPressureWidth(stroke.width, pt.pressure)
      ctx.fillStyle = stroke.color
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, w / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i]
        const p2 = pts[i + 1]
        const w1 = getPressureWidth(stroke.width, p1.pressure)
        const w2 = getPressureWidth(stroke.width, p2.pressure)
        const avgWidth = (w1 + w2) / 2

        ctx.strokeStyle = stroke.color
        ctx.lineWidth = avgWidth
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }

    if (isSelected) {
      const aabb = getAABB(pts)
      if (aabb) {
        const pad = stroke.width / 2 + 4
        ctx.strokeStyle = '#2563eb'
        ctx.lineWidth = 2 / state.viewport.scale
        ctx.setLineDash([6 / state.viewport.scale, 4 / state.viewport.scale])
        ctx.strokeRect(
          aabb.minX - pad,
          aabb.minY - pad,
          aabb.maxX - aabb.minX + pad * 2,
          aabb.maxY - aabb.minY + pad * 2
        )
        ctx.setLineDash([])
      }
    }
  }

  // ========== 脏矩形渲染 ==========

  /**
   * 全量重绘
   * Canvas 保持透明，背景由 CSS 提供
   */
  function redrawAll() {
    const ctx = getCtx()
    if (!ctx || !canvasEl.value) return
    const { w, h } = logicalSize.value
    if (w <= 0 || h <= 0) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    // 只清除，不填充背景（保持透明，背景由 CSS 提供）
    ctx.clearRect(0, 0, w, h)

    const { x: vx, y: vy, scale } = state.viewport
    ctx.translate(vx, vy)
    ctx.scale(scale, scale)

    for (const s of state.strokes) {
      const isSelected = state.selectedIds.includes(s.id)
      drawStroke(ctx, s, isSelected)
    }
  }

  /**
   * 脏矩形局部重绘 - 仅重绘指定区域
   */
  function redrawDirtyRect(dirtyRect) {
    if (!dirtyRect) {
      redrawAll()
      return
    }
    
    const ctx = getCtx()
    if (!ctx || !canvasEl.value) return
    const { w, h } = logicalSize.value
    if (w <= 0 || h <= 0) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const { x: vx, y: vy, scale } = state.viewport
    
    // 将逻辑坐标转换为屏幕坐标
    const screenRect = {
      x: dirtyRect.minX * scale + vx,
      y: dirtyRect.minY * scale + vy,
      w: (dirtyRect.maxX - dirtyRect.minX) * scale,
      h: (dirtyRect.maxY - dirtyRect.minY) * scale,
    }
    
    // 添加边距
    const pad = 4
    screenRect.x -= pad
    screenRect.y -= pad
    screenRect.w += pad * 2
    screenRect.h += pad * 2
    
    // 裁剪到画布范围
    screenRect.x = Math.max(0, screenRect.x)
    screenRect.y = Math.max(0, screenRect.y)
    screenRect.w = Math.min(w - screenRect.x, screenRect.w)
    screenRect.h = Math.min(h - screenRect.y, screenRect.h)
    
    if (screenRect.w <= 0 || screenRect.h <= 0) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    
    // 使用 clip 限制重绘范围
    ctx.save()
    ctx.beginPath()
    ctx.rect(screenRect.x, screenRect.y, screenRect.w, screenRect.h)
    ctx.clip()
    
    // 只清除，不填充背景（保持透明）
    ctx.clearRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h)
    
    // 应用视口变换
    ctx.translate(vx, vy)
    ctx.scale(scale, scale)

    // 仅绘制与脏矩形相交的笔画
    for (const s of state.strokes) {
      const strokeAABB = getAABB(s.points)
      if (!strokeAABB) continue
      
      // 扩展笔画包围盒
      const strokePad = s.width / 2
      const expandedStroke = {
        minX: strokeAABB.minX - strokePad,
        minY: strokeAABB.minY - strokePad,
        maxX: strokeAABB.maxX + strokePad,
        maxY: strokeAABB.maxY + strokePad,
      }
      
      // 检查是否与脏矩形相交
      if (aabbIntersect(expandedStroke, dirtyRect, 0)) {
        const isSelected = state.selectedIds.includes(s.id)
        drawStroke(ctx, s, isSelected)
      }
    }
    
    ctx.restore()
  }

  // ========== 橡皮擦逻辑（视觉实时 + 逻辑延迟）==========

  /**
   * 执行橡皮擦逻辑层切割
   * 优先使用 Web Worker 异步执行，避免阻塞 UI（规范 5.4）
   */
  function executeEraserSplit() {
    if (eraserPath.length < 1) {
      eraserPath = []
      eraserDirtyRect = null
      return
    }
    
    if (state.strokes.length === 0) {
      eraserPath = []
      eraserDirtyRect = null
      redrawAll()
      return
    }
    
    // 保存路径和脏矩形副本
    const eraserPathCopy = [...eraserPath]
    const eraserSizeCopy = state.eraserSize
    const dirtyRectCopy = eraserDirtyRect ? { ...eraserDirtyRect } : null
    
    try {
      // 使用空间索引快速筛选受影响的笔画
      const affectedIds = spatialIndex.getStrokeIdsInEraserPath(eraserPathCopy, eraserSizeCopy)
      if (affectedIds.size === 0) {
        // 没有受影响的笔画，使用脏矩形局部重绘
        // 注意：这里需要先清空路径，再重绘，否则视觉擦除效果会被保留
        eraserPath = []
        eraserDirtyRect = null
        if (dirtyRectCopy) {
          redrawDirtyRect(dirtyRectCopy)
        } else {
          redrawAll()
        }
        return
      }

      const toSplit = state.strokes.filter(s => affectedIds.has(s.id))
      const affectedIdArray = Array.from(affectedIds)
      
      // 优先使用 Web Worker 异步处理
      if (strokeSplitWorker) {
        // 标记 Worker 正在处理
        isWorkerProcessing = true
        
        // 保存脏矩形供 Worker 返回后使用
        pendingDirtyRect = dirtyRectCopy
        
        // 深拷贝数据以便传递给 Worker（避免 DataCloneError）
        const strokesForWorker = JSON.parse(JSON.stringify(toSplit))
        const pathForWorker = JSON.parse(JSON.stringify(eraserPathCopy))
        
        // 清空路径（但保留视觉擦除效果，直到 Worker 返回）
        eraserPath = []
        eraserDirtyRect = null
        
        strokeSplitWorker.postMessage({
          type: 'split',
          strokes: strokesForWorker,
          eraserPath: pathForWorker,
          eraserSize: eraserSizeCopy,
          affectedIds: affectedIdArray,
        })
        logger.info(`Sent ${toSplit.length} strokes to Worker`)
        // Worker 模式：不在这里重绘，等 Worker 返回结果后再重绘
      } else {
        // 降级：主线程同步处理
        // 先清空路径
        eraserPath = []
        eraserDirtyRect = null
        
        const unchanged = state.strokes.filter(s => !affectedIds.has(s.id))
        const newStrokes = recognizeRemainingObjects(toSplit, eraserPathCopy, eraserSizeCopy)
        state.strokes = [...unchanged, ...newStrokes]
        spatialIndex.rebuild(state.strokes)
        
        // 使用脏矩形局部重绘（规范 5.2）
        if (dirtyRectCopy) {
          redrawDirtyRect(dirtyRectCopy)
        } else {
          redrawAll()
        }
        logger.info(`Sync split: ${toSplit.length} -> ${newStrokes.length}`)
      }
    } catch (err) {
      logger.error('Erase failed:', err)
      eraserPath = []
      eraserDirtyRect = null
      redrawAll()
    }
  }

  // ========== 选择工具 ==========

  function selectStrokeAt(p, additive = false) {
    let found = null
    for (let i = state.strokes.length - 1; i >= 0; i--) {
      const s = state.strokes[i]
      const pts = s.points
      if (!pts || pts.length === 0) continue

      const hitRadius = s.width / 2 + 8 / state.viewport.scale
      if (pts.length === 1) {
        const dx = p.x - pts[0].x
        const dy = p.y - pts[0].y
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          found = s
          break
        }
      } else {
        for (let j = 0; j < pts.length - 1; j++) {
          const distSq = distToSegmentSquared(p, pts[j], pts[j + 1])
          if (distSq <= hitRadius * hitRadius) {
            found = s
            break
          }
        }
        if (found) break
      }
    }

    if (found) {
      if (additive) {
        const idx = state.selectedIds.indexOf(found.id)
        if (idx >= 0) {
          state.selectedIds.splice(idx, 1)
        } else {
          state.selectedIds.push(found.id)
        }
      } else {
        state.selectedIds = [found.id]
      }
    } else if (!additive) {
      state.selectedIds = []
    }
    redrawAll()
  }

  function moveSelectedStrokes(dx, dy) {
    if (state.selectedIds.length === 0) return
    for (const s of state.strokes) {
      if (state.selectedIds.includes(s.id)) {
        for (const pt of s.points) {
          pt.x += dx
          pt.y += dy
        }
      }
    }
    spatialIndex.rebuild(state.strokes)
  }

  function deleteSelectedStrokes() {
    if (state.selectedIds.length === 0) return
    saveHistory()
    const count = state.selectedIds.length
    state.strokes = state.strokes.filter(s => !state.selectedIds.includes(s.id))
    for (const id of state.selectedIds) spatialIndex.removeStroke(id)
    state.selectedIds = []
    redrawAll()
    logger.info(`Deleted ${count} strokes`)
  }

  // ========== 多点触控手势 ==========

  function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function handlePinchGesture(p1, p2) {
    if (!gestureState.value) return

    const currentDist = distance(p1, p2)
    const currentCenter = midpoint(p1, p2)
    const { initialDistance, initialScale, initialCenter, initialViewport } = gestureState.value

    const scaleRatio = currentDist / initialDistance
    let newScale = initialScale * scaleRatio
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))

    const dx = currentCenter.x - initialCenter.x
    const dy = currentCenter.y - initialCenter.y

    state.viewport.scale = newScale
    state.viewport.x = initialViewport.x + dx + (initialCenter.x - initialViewport.x) * (1 - newScale / initialScale)
    state.viewport.y = initialViewport.y + dy + (initialCenter.y - initialViewport.y) * (1 - newScale / initialScale)

    redrawAll()
  }

  // ========== 指针事件处理 ==========

  function getPointerScreenPos(e) {
    const c = canvasEl.value
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    const pos = { x: e.clientX - r.left, y: e.clientY - r.top }
    mousePos.value = pos
    return pos
  }

  function onPointerDown(e) {
    e.preventDefault()
    const screenPos = getPointerScreenPos(e)
    activePointers.value.set(e.pointerId, screenPos)

    // 双指手势开始
    if (activePointers.value.size === 2) {
      const [p1, p2] = [...activePointers.value.values()]
      gestureState.value = {
        initialDistance: distance(p1, p2),
        initialScale: state.viewport.scale,
        initialCenter: midpoint(p1, p2),
        initialViewport: { x: state.viewport.x, y: state.viewport.y },
      }
      isDragging.value = false
      return
    }

    if (activePointers.value.size > 1) return

    const p = clientToCanvas(e)
    const pressure = e.pressure > 0 ? e.pressure : 0.5
    isDragging.value = true
    lastPoint.value = { ...p, pressure }

    if (state.tool === 'pen') {
      saveHistory()
      const pt = { ...p, pressure }
      state.currentStroke = {
        id: uid(),
        points: [pt],
        color: state.penColor,
        width: state.penWidth,
        timestamp: Date.now(),
      }
      const ctx = getCtx()
      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
        const { x: vx, y: vy, scale } = state.viewport
        ctx.translate(vx, vy)
        ctx.scale(scale, scale)
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = state.penColor
        const w = getPressureWidth(state.penWidth, pressure)
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, w / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (state.tool === 'eraser') {
      saveHistory()
      // 初始化橡皮擦路径，仅视觉擦除
      eraserPath = [p]
      renderEraserDot(p)
    } else if (state.tool === 'select') {
      selectStrokeAt(p, e.shiftKey)
      if (state.selectedIds.length > 0) {
        selectionDragStart.value = p
      }
    } else if (state.tool === 'pan') {
      panStartViewport.value = { x: state.viewport.x, y: state.viewport.y }
      panStartScreen.value = screenPos
    }
  }

  function onPointerMove(e) {
    const screenPos = getPointerScreenPos(e)
    activePointers.value.set(e.pointerId, screenPos)

    if (activePointers.value.size === 2 && gestureState.value) {
      const [p1, p2] = [...activePointers.value.values()]
      handlePinchGesture(p1, p2)
      return
    }

    if (!isDragging.value || activePointers.value.size > 1) return
    e.preventDefault()

    const p = clientToCanvas(e)
    const prev = lastPoint.value
    if (!prev) return

    const pressure = e.pressure > 0 ? e.pressure : 0.5

    if (state.tool === 'pen' && state.currentStroke) {
      const pt = { ...p, pressure }
      const downsampled = downsamplePoints([...state.currentStroke.points, pt], DOWNSAMPLE_MIN_DIST)
      state.currentStroke.points = downsampled

      const ctx = getCtx()
      if (ctx) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)
        const { x: vx, y: vy, scale } = state.viewport
        ctx.translate(vx, vy)
        ctx.scale(scale, scale)

        ctx.globalCompositeOperation = 'source-over'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = state.penColor

        const prevPressure = prev.pressure ?? 0.5
        const w1 = getPressureWidth(state.penWidth, prevPressure)
        const w2 = getPressureWidth(state.penWidth, pressure)
        ctx.lineWidth = (w1 + w2) / 2

        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      lastPoint.value = pt
    } else if (state.tool === 'eraser') {
      // 视觉层实时擦除（仅绘制白色，不修改数据）
      renderEraserVisual(prev, p)
      eraserPath.push(p)
      lastPoint.value = p
    } else if (state.tool === 'select' && selectionDragStart.value) {
      const dx = p.x - selectionDragStart.value.x
      const dy = p.y - selectionDragStart.value.y
      moveSelectedStrokes(dx, dy)
      selectionDragStart.value = p
      redrawAll()
    } else if (state.tool === 'pan') {
      const screenDx = screenPos.x - (panStartScreen.value?.x ?? screenPos.x)
      const screenDy = screenPos.y - (panStartScreen.value?.y ?? screenPos.y)
      
      if (panStartViewport.value) {
        state.viewport.x = panStartViewport.value.x + screenDx
        state.viewport.y = panStartViewport.value.y + screenDy
      }
      scheduleRedraw()
    }

    if (state.tool !== 'pen') {
      lastPoint.value = p
    }
  }

  function onPointerUp(e) {
    activePointers.value.delete(e.pointerId)

    if (gestureState.value && activePointers.value.size < 2) {
      gestureState.value = null
    }

    if (!isDragging.value) return
    e.preventDefault()
    isDragging.value = false

    const p = clientToCanvas(e)
    const pressure = e.pressure > 0 ? e.pressure : 0.5

    if (state.tool === 'pen' && state.currentStroke) {
      const pt = { ...p, pressure }
      const downsampled = downsamplePoints([...state.currentStroke.points, pt], DOWNSAMPLE_MIN_DIST)
      state.currentStroke.points = downsampled
      if (state.currentStroke.points.length > 0) {
        spatialIndex.addStroke(state.currentStroke)
        state.strokes.push(state.currentStroke)
        logger.info(`Stroke added: ${state.currentStroke.points.length} points`)
      }
      state.currentStroke = null
    } else if (state.tool === 'eraser') {
      // 逻辑层切割（仅在松开时执行）
      executeEraserSplit()
    } else if (state.tool === 'select') {
      selectionDragStart.value = null
      if (state.selectedIds.length > 0) {
        saveHistory()
      }
    } else if (state.tool === 'pan') {
      panStartViewport.value = null
      panStartScreen.value = null
      redrawAll()
    }

    lastPoint.value = null
  }

  // ========== 视口控制 ==========

  function zoom(delta, center) {
    const { w, h } = logicalSize.value
    const cx = center?.x ?? w / 2
    const cy = center?.y ?? h / 2

    const oldScale = state.viewport.scale
    let newScale = oldScale * (1 + delta)
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))

    const canvasX = (cx - state.viewport.x) / oldScale
    const canvasY = (cy - state.viewport.y) / oldScale

    state.viewport.scale = newScale
    state.viewport.x = cx - canvasX * newScale
    state.viewport.y = cy - canvasY * newScale

    redrawAll()
  }

  function pan(dx, dy) {
    state.viewport.x += dx
    state.viewport.y += dy
    redrawAll()
  }

  function resetViewport() {
    state.viewport = { x: 0, y: 0, scale: 1 }
    redrawAll()
    logger.info('Viewport reset')
  }

  function onWheel(e) {
    e.preventDefault()
    const c = canvasEl.value
    if (!c) return
    const r = c.getBoundingClientRect()
    const center = { x: e.clientX - r.left, y: e.clientY - r.top }

    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.001
      zoom(delta, center)
    } else {
      pan(-e.deltaX, -e.deltaY)
    }
  }

  // ========== 初始化与工具函数 ==========

  function setCanvas(el) {
    canvasEl.value = el
    if (!el) return
    
    try {
      // 初始化 Web Worker（规范 5.4）
      initWorker()
      
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const rect = el.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      
      if (w <= 0 || h <= 0) {
        logger.warn('Invalid canvas size:', w, h)
        return
      }
      
      logicalSize.value = { w, h }
      el.width = w * dpr
      el.height = h * dpr
      
      redrawAll()
      logger.info(`Canvas initialized: ${w}x${h} (dpr: ${dpr})`)
    } catch (err) {
      logger.error('Failed to initialize canvas:', err)
    }
  }

  function clear() {
    saveHistory()
    state.strokes = []
    state.currentStroke = null
    eraserPath = []
    eraserDirtyRect = null
    state.selectedIds = []
    spatialIndex.clear()
    redrawAll()
    logger.info('Canvas cleared')
  }

  function exportImage(format = 'png', quality = 0.92) {
    try {
      const c = canvasEl.value
      if (!c) return null

      const allPoints = state.strokes.flatMap(s => s.points)
      const aabb = getAABB(allPoints)
      if (!aabb) {
        logger.warn('No strokes to export')
        return null
      }

      const padding = 20
      const width = aabb.maxX - aabb.minX + padding * 2
      const height = aabb.maxY - aabb.minY + padding * 2

      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = width * 2
      tempCanvas.height = height * 2
      const ctx = tempCanvas.getContext('2d')
      if (!ctx) return null

      ctx.scale(2, 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.translate(-aabb.minX + padding, -aabb.minY + padding)

      for (const s of state.strokes) {
        drawStroke(ctx, s, false)
      }

      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
      return tempCanvas.toDataURL(mimeType, quality)
    } catch (err) {
      logger.error('Export failed:', err)
      return null
    }
  }

  function downloadImage(filename = 'canvas', format = 'png') {
    const dataUrl = exportImage(format)
    if (!dataUrl) return
    const link = document.createElement('a')
    link.download = `${filename}.${format}`
    link.href = dataUrl
    link.click()
    logger.info(`Image downloaded: ${filename}.${format}`)
  }

  function handleKeyboard(e) {
    const key = e.key.toLowerCase()
    const ctrl = e.ctrlKey || e.metaKey

    if (ctrl && key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
    } else if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) {
      e.preventDefault()
      redo()
    } else if (key === 'p' && !ctrl) {
      state.tool = 'pen'
    } else if (key === 'e' && !ctrl) {
      state.tool = 'eraser'
    } else if (key === 'v' && !ctrl) {
      state.tool = 'select'
    } else if (key === 'h' && !ctrl) {
      state.tool = 'pan'
    } else if (key === 'c' && !ctrl) {
      clear()
    } else if (ctrl && key === 's') {
      e.preventDefault()
      downloadImage()
    } else if ((key === 'delete' || key === 'backspace') && state.selectedIds.length > 0) {
      e.preventDefault()
      deleteSelectedStrokes()
    } else if (key === '0' && ctrl) {
      e.preventDefault()
      resetViewport()
    } else if (key === '=' && ctrl) {
      e.preventDefault()
      zoom(0.2)
    } else if (key === '-' && ctrl) {
      e.preventDefault()
      zoom(-0.2)
    }
  }

  return {
    canvasEl,
    state,
    undoStack,
    redoStack,
    mousePos,
    setCanvas,
    redrawAll,
    clear,
    undo,
    redo,
    exportImage,
    downloadImage,
    handleKeyboard,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    zoom,
    pan,
    resetViewport,
    deleteSelectedStrokes,
  }
}
