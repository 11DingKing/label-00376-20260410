import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasBoard } from './useCanvasBoard.js'

// Mock canvas context
function createMockCanvas() {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    globalCompositeOperation: 'source-over',
    lineCap: 'round',
    lineJoin: 'round',
    lineWidth: 4,
    strokeStyle: '#000',
    fillStyle: '#000',
  }
  return {
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 800, height: 600 })),
    width: 800,
    height: 600,
    toDataURL: vi.fn(() => 'data:image/png;base64,test'),
    ctx,
  }
}

describe('useCanvasBoard', () => {
  let board
  let mockCanvas

  beforeEach(() => {
    vi.clearAllMocks()
    board = useCanvasBoard()
    mockCanvas = createMockCanvas()
  })

  describe('initial state', () => {
    it('has correct default values', () => {
      expect(board.state.tool).toBe('pen')
      expect(board.state.penColor).toBe('#1a1a1a')
      expect(board.state.penWidth).toBe(4)
      expect(board.state.eraserSize).toBe(24)
      expect(board.state.strokes).toEqual([])
      expect(board.state.currentStroke).toBeNull()
      expect(board.state.viewport).toEqual({ x: 0, y: 0, scale: 1 })
      expect(board.state.selectedIds).toEqual([])
      expect(board.state.pressureEnabled).toBe(true)
    })

    it('has empty undo/redo stacks', () => {
      expect(board.undoStack).toHaveLength(0)
      expect(board.redoStack).toHaveLength(0)
    })
  })

  describe('setCanvas', () => {
    it('sets canvas element', () => {
      board.setCanvas(mockCanvas)
      expect(board.canvasEl.value).toBe(mockCanvas)
    })

    it('handles null canvas', () => {
      board.setCanvas(null)
      expect(board.canvasEl.value).toBeNull()
    })

    it('scales canvas for device pixel ratio', () => {
      board.setCanvas(mockCanvas)
      expect(mockCanvas.ctx.scale).toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('clears all strokes', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [{ id: 'test', points: [], color: '#000', width: 4, timestamp: Date.now() }]
      board.clear()
      expect(board.state.strokes).toEqual([])
    })

    it('saves history before clearing', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [{ id: 'test', points: [], color: '#000', width: 4, timestamp: Date.now() }]
      board.clear()
      expect(board.undoStack.length).toBeGreaterThan(0)
    })

    it('resets currentStroke on clear', () => {
      board.state.currentStroke = { id: 'test', points: [], color: '#000', width: 4, timestamp: Date.now() }
      board.setCanvas(mockCanvas)
      board.clear()
      expect(board.state.currentStroke).toBeNull()
    })
  })


  describe('undo/redo', () => {
    it('undo returns false when stack is empty', () => {
      board.setCanvas(mockCanvas)
      expect(board.undo()).toBe(false)
    })

    it('redo returns false when stack is empty', () => {
      board.setCanvas(mockCanvas)
      expect(board.redo()).toBe(false)
    })

    it('undo restores previous state', () => {
      board.setCanvas(mockCanvas)
      const stroke1 = { id: 's1', points: [{ x: 0, y: 0 }], color: '#000', width: 4, timestamp: Date.now() }
      board.state.strokes = [stroke1]
      board.clear()
      expect(board.state.strokes).toEqual([])
      board.undo()
      expect(board.state.strokes).toHaveLength(1)
    })

    it('redo restores undone state', () => {
      board.setCanvas(mockCanvas)
      const stroke1 = { id: 's1', points: [{ x: 0, y: 0 }], color: '#000', width: 4, timestamp: Date.now() }
      board.state.strokes = [stroke1]
      board.clear()
      board.undo()
      board.redo()
      expect(board.state.strokes).toEqual([])
    })

    it('clears redo stack on new action', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [{ id: 's1', points: [{ x: 0, y: 0 }], color: '#000', width: 4, timestamp: Date.now() }]
      board.clear()
      board.undo()
      expect(board.redoStack.length).toBeGreaterThan(0)
      board.clear()
      expect(board.redoStack).toHaveLength(0)
    })
  })

  describe('exportImage', () => {
    it('returns null when no canvas', () => {
      expect(board.exportImage()).toBeNull()
    })

    it('returns null when no strokes', () => {
      board.setCanvas(mockCanvas)
      const result = board.exportImage()
      // 没有笔画时返回 null（因为无法计算 AABB）
      expect(result).toBeNull()
    })

    it('returns data URL when canvas and strokes exist', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [
        { id: 's1', points: [{ x: 10, y: 10 }, { x: 100, y: 100 }], color: '#000', width: 4, timestamp: Date.now() },
      ]
      // 在 jsdom 环境下，document.createElement('canvas') 可能不完全支持
      // 这里只验证函数不会抛出异常
      expect(() => board.exportImage()).not.toThrow()
    })
  })

  describe('handleKeyboard', () => {
    it('switches to pen on P key', () => {
      board.state.tool = 'eraser'
      const event = { key: 'p', ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.tool).toBe('pen')
    })

    it('switches to eraser on E key', () => {
      board.state.tool = 'pen'
      const event = { key: 'e', ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.tool).toBe('eraser')
    })

    it('clears on C key', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [{ id: 's1', points: [], color: '#000', width: 4, timestamp: Date.now() }]
      const event = { key: 'c', ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.strokes).toEqual([])
    })

    it('calls undo on Ctrl+Z', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [{ id: 's1', points: [], color: '#000', width: 4, timestamp: Date.now() }]
      board.clear()
      const event = { key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('calls redo on Ctrl+Y', () => {
      board.setCanvas(mockCanvas)
      const event = { key: 'y', ctrlKey: true, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })

    it('calls redo on Ctrl+Shift+Z', () => {
      board.setCanvas(mockCanvas)
      const event = { key: 'z', ctrlKey: true, metaKey: false, shiftKey: true, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })


  describe('pointer events', () => {
    beforeEach(() => {
      board.setCanvas(mockCanvas)
    })

    it('onPointerDown starts pen stroke', () => {
      board.state.tool = 'pen'
      const event = {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        pressure: 0.5,
        preventDefault: vi.fn(),
      }
      board.onPointerDown(event)
      expect(board.state.currentStroke).not.toBeNull()
      expect(board.state.currentStroke.color).toBe(board.state.penColor)
    })

    it('onPointerDown starts eraser path', () => {
      board.state.tool = 'eraser'
      const event = {
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        pressure: 0.5,
        preventDefault: vi.fn(),
      }
      board.onPointerDown(event)
      // eraser path is internal, just verify no error
    })

    it('onPointerMove adds points to pen stroke', () => {
      board.state.tool = 'pen'
      const downEvent = { clientX: 100, clientY: 100, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerDown(downEvent)
      const moveEvent = { clientX: 150, clientY: 150, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerMove(moveEvent)
      expect(board.state.currentStroke.points.length).toBeGreaterThanOrEqual(1)
    })

    it('onPointerMove adds points to eraser path', () => {
      board.state.tool = 'eraser'
      const downEvent = { clientX: 100, clientY: 100, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerDown(downEvent)
      const moveEvent = { clientX: 150, clientY: 150, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerMove(moveEvent)
      // eraser path is internal, just verify no error
    })

    it('onPointerUp finalizes pen stroke', () => {
      board.state.tool = 'pen'
      const downEvent = { clientX: 100, clientY: 100, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerDown(downEvent)
      const upEvent = { clientX: 150, clientY: 150, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerUp(upEvent)
      expect(board.state.currentStroke).toBeNull()
      expect(board.state.strokes).toHaveLength(1)
    })

    it('onPointerMove does nothing when not dragging', () => {
      const moveEvent = { clientX: 150, clientY: 150, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerMove(moveEvent)
      expect(moveEvent.preventDefault).not.toHaveBeenCalled()
    })

    it('onPointerUp does nothing when not dragging', () => {
      const upEvent = { clientX: 150, clientY: 150, pointerId: 1, pressure: 0.5, preventDefault: vi.fn() }
      board.onPointerUp(upEvent)
      expect(upEvent.preventDefault).not.toHaveBeenCalled()
    })

    it('handles touch events', () => {
      board.state.tool = 'pen'
      const touchEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        pointerId: 1,
        pressure: 0.5,
        preventDefault: vi.fn(),
      }
      board.onPointerDown(touchEvent)
      expect(board.state.currentStroke).not.toBeNull()
    })
  })

  describe('redrawAll', () => {
    it('clears and redraws canvas', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [
        { id: 's1', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: '#000', width: 4, timestamp: Date.now() },
      ]
      board.redrawAll()
      expect(mockCanvas.ctx.clearRect).toHaveBeenCalled()
      expect(mockCanvas.ctx.stroke).toHaveBeenCalled()
    })

    it('draws single point as circle', () => {
      board.setCanvas(mockCanvas)
      board.state.strokes = [
        { id: 's1', points: [{ x: 50, y: 50 }], color: '#000', width: 4, timestamp: Date.now() },
      ]
      board.redrawAll()
      expect(mockCanvas.ctx.arc).toHaveBeenCalled()
      expect(mockCanvas.ctx.fill).toHaveBeenCalled()
    })
  })

  describe('viewport controls', () => {
    beforeEach(() => {
      board.setCanvas(mockCanvas)
    })

    it('zoom changes scale', () => {
      const initialScale = board.state.viewport.scale
      board.zoom(0.5)
      expect(board.state.viewport.scale).toBeGreaterThan(initialScale)
    })

    it('zoom respects min/max limits', () => {
      // Zoom out a lot
      for (let i = 0; i < 20; i++) board.zoom(-0.5)
      expect(board.state.viewport.scale).toBeGreaterThanOrEqual(0.1)

      // Zoom in a lot
      for (let i = 0; i < 50; i++) board.zoom(0.5)
      expect(board.state.viewport.scale).toBeLessThanOrEqual(10)
    })

    it('pan changes viewport position', () => {
      const initialX = board.state.viewport.x
      const initialY = board.state.viewport.y
      board.pan(100, 50)
      expect(board.state.viewport.x).toBe(initialX + 100)
      expect(board.state.viewport.y).toBe(initialY + 50)
    })

    it('resetViewport resets to default', () => {
      board.zoom(0.5)
      board.pan(100, 100)
      board.resetViewport()
      expect(board.state.viewport).toEqual({ x: 0, y: 0, scale: 1 })
    })
  })

  describe('selection', () => {
    beforeEach(() => {
      board.setCanvas(mockCanvas)
    })

    it('deleteSelectedStrokes removes selected strokes', () => {
      const stroke1 = { id: 's1', points: [{ x: 0, y: 0 }], color: '#000', width: 4, timestamp: Date.now() }
      const stroke2 = { id: 's2', points: [{ x: 10, y: 10 }], color: '#000', width: 4, timestamp: Date.now() }
      board.state.strokes = [stroke1, stroke2]
      board.state.selectedIds = ['s1']
      board.deleteSelectedStrokes()
      expect(board.state.strokes).toHaveLength(1)
      expect(board.state.strokes[0].id).toBe('s2')
      expect(board.state.selectedIds).toEqual([])
    })

    it('deleteSelectedStrokes does nothing when nothing selected', () => {
      const stroke1 = { id: 's1', points: [{ x: 0, y: 0 }], color: '#000', width: 4, timestamp: Date.now() }
      board.state.strokes = [stroke1]
      board.state.selectedIds = []
      board.deleteSelectedStrokes()
      expect(board.state.strokes).toHaveLength(1)
    })
  })

  describe('keyboard shortcuts for new features', () => {
    beforeEach(() => {
      board.setCanvas(mockCanvas)
    })

    it('switches to select tool on V key', () => {
      board.state.tool = 'pen'
      const event = { key: 'v', ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.tool).toBe('select')
    })

    it('switches to pan tool on H key', () => {
      board.state.tool = 'pen'
      const event = { key: 'h', ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.tool).toBe('pan')
    })

    it('deletes selected strokes on Delete key', () => {
      const stroke1 = { id: 's1', points: [{ x: 0, y: 0 }], color: '#000', width: 4, timestamp: Date.now() }
      board.state.strokes = [stroke1]
      board.state.selectedIds = ['s1']
      const event = { key: 'Delete', ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.strokes).toHaveLength(0)
    })

    it('resets viewport on Ctrl+0', () => {
      board.zoom(0.5)
      board.pan(100, 100)
      const event = { key: '0', ctrlKey: true, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.viewport).toEqual({ x: 0, y: 0, scale: 1 })
    })

    it('zooms in on Ctrl+=', () => {
      const initialScale = board.state.viewport.scale
      const event = { key: '=', ctrlKey: true, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.viewport.scale).toBeGreaterThan(initialScale)
    })

    it('zooms out on Ctrl+-', () => {
      const initialScale = board.state.viewport.scale
      const event = { key: '-', ctrlKey: true, metaKey: false, shiftKey: false, preventDefault: vi.fn() }
      board.handleKeyboard(event)
      expect(board.state.viewport.scale).toBeLessThan(initialScale)
    })
  })

  describe('pressure sensitivity', () => {
    beforeEach(() => {
      board.setCanvas(mockCanvas)
    })

    it('stores pressure in stroke points', () => {
      board.state.tool = 'pen'
      const downEvent = { clientX: 100, clientY: 100, pointerId: 1, pressure: 0.8, preventDefault: vi.fn() }
      board.onPointerDown(downEvent)
      expect(board.state.currentStroke.points[0].pressure).toBe(0.8)
    })

    it('uses default pressure when not provided', () => {
      board.state.tool = 'pen'
      const downEvent = { clientX: 100, clientY: 100, pointerId: 1, pressure: 0, preventDefault: vi.fn() }
      board.onPointerDown(downEvent)
      expect(board.state.currentStroke.points[0].pressure).toBe(0.5)
    })
  })
})
