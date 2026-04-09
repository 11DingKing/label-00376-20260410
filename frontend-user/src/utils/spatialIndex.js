/**
 * 空间索引模块
 * 实现 Prompt 5.1 节的网格空间索引优化
 */
import { getAABB } from './geometry.js'

const CELL_SIZE = 50
const LOG_PREFIX = '[SpatialIndex]'

function cellKey(cx, cy) {
  return `${cx},${cy}`
}

/**
 * 网格空间索引：将画布划分为 N×N 网格，加速擦除时的碰撞检测
 */
export class SpatialIndex {
  constructor() {
    this.grid = new Map()
    this.strokeAABBs = new Map()
  }

  /**
   * 添加笔画到索引
   */
  addStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) {
      console.warn(`${LOG_PREFIX} Cannot add invalid stroke`)
      return
    }
    
    try {
      const aabb = getAABB(stroke.points)
      if (!aabb) return
      
      // 考虑笔画宽度
      const padding = (stroke.width || 4) / 2
      const paddedAABB = {
        minX: aabb.minX - padding,
        minY: aabb.minY - padding,
        maxX: aabb.maxX + padding,
        maxY: aabb.maxY + padding,
      }
      
      this.strokeAABBs.set(stroke.id, paddedAABB)
      
      const minCX = Math.floor(paddedAABB.minX / CELL_SIZE)
      const minCY = Math.floor(paddedAABB.minY / CELL_SIZE)
      const maxCX = Math.floor(paddedAABB.maxX / CELL_SIZE)
      const maxCY = Math.floor(paddedAABB.maxY / CELL_SIZE)
      
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          const k = cellKey(cx, cy)
          if (!this.grid.has(k)) this.grid.set(k, new Set())
          this.grid.get(k).add(stroke.id)
        }
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Error adding stroke:`, err)
    }
  }

  /**
   * 从索引中移除笔画
   */
  removeStroke(id) {
    const aabb = this.strokeAABBs.get(id)
    if (!aabb) return
    
    try {
      this.strokeAABBs.delete(id)
      
      const minCX = Math.floor(aabb.minX / CELL_SIZE)
      const minCY = Math.floor(aabb.minY / CELL_SIZE)
      const maxCX = Math.floor(aabb.maxX / CELL_SIZE)
      const maxCY = Math.floor(aabb.maxY / CELL_SIZE)
      
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          const k = cellKey(cx, cy)
          this.grid.get(k)?.delete(id)
        }
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Error removing stroke:`, err)
    }
  }

  /**
   * 获取橡皮擦路径所覆盖网格内的笔画 ID 集合
   */
  getStrokeIdsInEraserPath(eraserPath, eraserSize) {
    const ids = new Set()
    
    if (!eraserPath || eraserPath.length === 0) {
      return ids
    }
    
    if (eraserSize <= 0) {
      console.warn(`${LOG_PREFIX} Invalid eraser size: ${eraserSize}`)
      return ids
    }
    
    try {
      const aabb = getAABB(eraserPath)
      if (!aabb) return ids
      
      const pad = eraserSize / 2
      const minCX = Math.floor((aabb.minX - pad) / CELL_SIZE)
      const minCY = Math.floor((aabb.minY - pad) / CELL_SIZE)
      const maxCX = Math.floor((aabb.maxX + pad) / CELL_SIZE)
      const maxCY = Math.floor((aabb.maxY + pad) / CELL_SIZE)
      
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cy = minCY; cy <= maxCY; cy++) {
          const k = cellKey(cx, cy)
          const cellIds = this.grid.get(k)
          if (cellIds) {
            for (const id of cellIds) {
              ids.add(id)
            }
          }
        }
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Error getting stroke IDs:`, err)
    }
    
    return ids
  }

  /**
   * 清空索引
   */
  clear() {
    this.grid.clear()
    this.strokeAABBs.clear()
  }

  /**
   * 重建索引
   */
  rebuild(strokes) {
    this.clear()
    if (!strokes) return
    
    for (const s of strokes) {
      this.addStroke(s)
    }
    
    console.log(`${LOG_PREFIX} Rebuilt index with ${strokes.length} strokes`)
  }
}
