import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CanvasBoard from './CanvasBoard.vue'

const mockClear = vi.fn()
const mockSetCanvas = vi.fn()
const mockOnPointerDown = vi.fn()
const mockOnPointerMove = vi.fn()
const mockOnPointerUp = vi.fn()

vi.mock('@/composables/useCanvasBoard.js', () => ({
  useCanvasBoard: () => ({
    state: {
      tool: 'pen',
      penColor: '#000',
      penWidth: 4,
      eraserSize: 24,
      viewport: { x: 0, y: 0, scale: 1 },
      selectedIds: [],
      pressureEnabled: true,
    },
    undoStack: [],
    redoStack: [],
    setCanvas: mockSetCanvas,
    clear: mockClear,
    undo: vi.fn(),
    redo: vi.fn(),
    handleKeyboard: vi.fn(),
    downloadImage: vi.fn(),
    onPointerDown: mockOnPointerDown,
    onPointerMove: mockOnPointerMove,
    onPointerUp: mockOnPointerUp,
    onWheel: vi.fn(),
    zoom: vi.fn(),
    resetViewport: vi.fn(),
    deleteSelectedStrokes: vi.fn(),
    redrawAll: vi.fn(),
  }),
}))

describe('CanvasBoard', () => {
  it('renders toolbar and canvas', () => {
    const wrapper = mount(CanvasBoard)
    expect(wrapper.find('.toolbar').exists()).toBe(true)
    expect(wrapper.find('.canvas-wrap').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('has pen, eraser, select and pan tool buttons', () => {
    const wrapper = mount(CanvasBoard)
    const btns = wrapper.findAll('.tool-btn')
    expect(btns).toHaveLength(4)
  })

  it('has clear button', () => {
    const wrapper = mount(CanvasBoard)
    expect(wrapper.find('.clear-btn').exists()).toBe(true)
  })

  it('calls clear when clear button clicked', async () => {
    mockClear.mockClear()
    const wrapper = mount(CanvasBoard)
    await wrapper.find('.clear-btn').trigger('click')
    expect(mockClear).toHaveBeenCalledTimes(1)
  })
})
