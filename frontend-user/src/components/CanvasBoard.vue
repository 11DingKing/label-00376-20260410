<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useCanvasBoard } from '@/composables/useCanvasBoard.js'
import { useToast } from '@/composables/useToast.js'

const {
  state,
  setCanvas,
  clear: clearBoard,
  undo,
  redo,
  undoStack,
  redoStack,
  mousePos,
  handleKeyboard,
  downloadImage,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  zoom,
  resetViewport,
  deleteSelectedStrokes,
  redrawAll,
} = useCanvasBoard()
const toast = useToast()

const wrapRef = ref(null)
const showEraserCursor = ref(false)
const canvasRef = (el) => {
  setCanvas(el)
}

const PRESET_COLORS = [
  '#1a1a1a',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

const TOOL_LABELS = {
  pen: '画笔',
  eraser: '橡皮擦',
  select: '选择',
  pan: '平移',
}

function handlePointerDown(e) {
  e.target.setPointerCapture(e.pointerId)
  onPointerDown(e)
}

function handlePointerMove(e) {
  onPointerMove(e)
}

function handlePointerEnter() {
  if (state.tool === 'eraser') {
    showEraserCursor.value = true
  }
}

function handlePointerLeave(e) {
  e.target.releasePointerCapture(e.pointerId)
  onPointerUp(e)
  showEraserCursor.value = false
}

function handlePointerUp(e) {
  e.target.releasePointerCapture(e.pointerId)
  onPointerUp(e)
}

function handleWheel(e) {
  onWheel(e)
}

function updateCanvasSize() {
  const el = wrapRef.value?.querySelector('canvas')
  if (el) setCanvas(el)
}

function selectTool(tool) {
  // 切换工具时清除选中状态
  if (state.selectedIds.length > 0) {
    state.selectedIds = []
    redrawAll()
  }
  state.tool = tool
  showEraserCursor.value = tool === 'eraser'
  toast.info(`已切换至${TOOL_LABELS[tool]}`)
}

function setColor(c) {
  state.penColor = c
}

function clear() {
  clearBoard()
  toast.success('画布已清空')
}

function doUndo() {
  if (undoStack.length === 0) {
    toast.warning('没有可撤销的操作')
    return
  }
  if (undo()) toast.info('已撤销')
}

function doRedo() {
  if (redoStack.length === 0) {
    toast.warning('没有可重做的操作')
    return
  }
  if (redo()) toast.info('已重做')
}

function save() {
  downloadImage('canvas', 'png')
  toast.success('已保存图片')
}

function zoomIn() {
  zoom(0.2)
}

function zoomOut() {
  zoom(-0.2)
}

function resetZoom() {
  resetViewport()
  toast.info('视图已重置')
}

function deleteSelected() {
  if (state.selectedIds.length > 0) {
    deleteSelectedStrokes()
    toast.info('已删除选中笔画')
  }
}

function togglePressure() {
  state.pressureEnabled = !state.pressureEnabled
  toast.info(state.pressureEnabled ? '压感已启用' : '压感已禁用')
}

function onKeydown(e) {
  handleKeyboard(e)
}

let ro = null
onMounted(() => {
  window.addEventListener('resize', updateCanvasSize)
  window.addEventListener('keydown', onKeydown)
  ro = new ResizeObserver(updateCanvasSize)
  const wrap = wrapRef.value
  if (wrap) ro.observe(wrap)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateCanvasSize)
  window.removeEventListener('keydown', onKeydown)
  ro?.disconnect()
})
</script>

<template>
  <div class="board">
    <header class="toolbar">
      <div class="toolbar-left">
        <div class="logo">
          <svg class="logo-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 15.5L13 18l5-5z" />
          </svg>
          <span class="logo-text">Web Canvas</span>
        </div>
        <div class="tool-sep" />
        <div class="tools">
          <button
            class="tool-btn"
            :class="{ active: state.tool === 'pen' }"
            @click="selectTool('pen')"
            title="画笔 (P)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 15.5L13 18l5-5z" />
            </svg>
            <span class="tool-label">画笔</span>
          </button>
          <button
            class="tool-btn"
            :class="{ active: state.tool === 'eraser' }"
            @click="selectTool('eraser')"
            title="橡皮擦 (E)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 20H7L3 16a2 2 0 0 1 0-2.83L13.17 3a2 2 0 0 1 2.83 0l6 6a2 2 0 0 1 0 2.83L14 20" />
            </svg>
            <span class="tool-label">橡皮擦</span>
          </button>
          <button
            class="tool-btn"
            :class="{ active: state.tool === 'select' }"
            @click="selectTool('select')"
            title="选择 (V)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="M13 13l6 6" />
            </svg>
            <span class="tool-label">选择</span>
          </button>
          <button
            class="tool-btn"
            :class="{ active: state.tool === 'pan' }"
            @click="selectTool('pan')"
            title="平移 (H)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
            <span class="tool-label">平移</span>
          </button>
        </div>
      </div>

      <div class="toolbar-center">
        <template v-if="state.tool === 'pen'">
          <div class="options-group">
            <span class="options-label">颜色</span>
            <div class="color-swatches">
              <button
                v-for="c in PRESET_COLORS"
                :key="c"
                type="button"
                class="swatch"
                :class="{ active: state.penColor === c }"
                :style="{ background: c }"
                :title="c"
                @click="setColor(c)"
              />
            </div>
            <label class="color-picker-wrap">
              <input v-model="state.penColor" type="color" class="color-picker" />
              <span class="color-picker-btn" :style="{ background: state.penColor }" />
            </label>
          </div>
          <div class="options-group">
            <span class="options-label">粗细</span>
            <div class="slider-wrap">
              <input v-model.number="state.penWidth" type="range" min="1" max="24" class="slider" />
              <span class="opt-value">{{ state.penWidth }}px</span>
            </div>
          </div>
          <div class="options-group">
            <button
              class="toggle-btn"
              :class="{ active: state.pressureEnabled }"
              @click="togglePressure"
              title="压感支持"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M2 12h20" />
              </svg>
              <span>压感</span>
            </button>
          </div>
        </template>
        <template v-else-if="state.tool === 'eraser'">
          <div class="options-group">
            <span class="options-label">大小</span>
            <div class="slider-wrap">
              <input v-model.number="state.eraserSize" type="range" min="8" max="64" class="slider" />
              <span class="opt-value">{{ state.eraserSize }}px</span>
            </div>
          </div>
        </template>
        <template v-else-if="state.tool === 'select'">
          <div class="options-group">
            <span class="options-label" v-if="state.selectedIds.length > 0">
              已选择 {{ state.selectedIds.length }} 个笔画
            </span>
            <span class="options-label" v-else>点击笔画选择，Shift+点击多选</span>
            <button
              v-if="state.selectedIds.length > 0"
              class="action-btn danger"
              @click="deleteSelected"
              title="删除选中 (Delete)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
              </svg>
              删除
            </button>
          </div>
        </template>
        <template v-else-if="state.tool === 'pan'">
          <div class="options-group">
            <span class="options-label">缩放: {{ Math.round(state.viewport.scale * 100) }}%</span>
            <button class="action-btn" @click="zoomOut" title="缩小 (Ctrl+-)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35M8 11h6" />
              </svg>
            </button>
            <button class="action-btn" @click="zoomIn" title="放大 (Ctrl+=)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
              </svg>
            </button>
            <button class="action-btn" @click="resetZoom" title="重置视图 (Ctrl+0)">
              重置
            </button>
          </div>
        </template>
      </div>

      <div class="toolbar-right">
        <button 
          class="action-btn" 
          :class="{ disabled: undoStack.length === 0 }"
          @click="doUndo" 
          title="撤销 (Ctrl+Z)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button 
          class="action-btn" 
          :class="{ disabled: redoStack.length === 0 }"
          @click="doRedo" 
          title="重做 (Ctrl+Y)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
          </svg>
        </button>
        <div class="tool-sep" />
        <button class="action-btn" @click="save" title="保存图片 (Ctrl+S)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        <button class="clear-btn" @click="clear" title="清空画布 (C)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <span>清空</span>
        </button>
      </div>
    </header>

    <div ref="wrapRef" class="canvas-wrap dot-grid">
      <div class="canvas-container">
        <canvas
          :ref="canvasRef"
          class="canvas"
          :class="{ 
            'cursor-grab': state.tool === 'pan', 
            'cursor-pointer': state.tool === 'select',
            'cursor-none': state.tool === 'eraser'
          }"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerenter="handlePointerEnter"
          @pointerleave="handlePointerLeave"
          @pointercancel="handlePointerLeave"
          @wheel.passive="false"
          @wheel="handleWheel"
        />
        <!-- 橡皮擦光标指示器 -->
        <div
          v-if="state.tool === 'eraser' && showEraserCursor"
          class="eraser-cursor"
          :style="{
            left: mousePos.x + 'px',
            top: mousePos.y + 'px',
            width: state.eraserSize * state.viewport.scale + 'px',
            height: state.eraserSize * state.viewport.scale + 'px',
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0 1.5rem;
  min-height: 60px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-toolbar);
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-center {
  flex: 1;
  justify-content: center;
  min-width: 0;
  gap: 1.5rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.logo-text {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.03em;
}

.tool-sep {
  width: 1px;
  height: 22px;
  background: var(--border);
  border-radius: 1px;
  margin: 0 0.5rem;
}

.tools {
  display: flex;
  gap: 2px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.15s var(--ease-out);
}

.tool-btn:hover {
  background: var(--bg-toolbar-hover);
  color: var(--text);
}

.tool-btn:active {
  transform: scale(0.98);
}

.tool-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}

.tool-label {
  white-space: nowrap;
}

.options-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.options-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-dim);
  white-space: nowrap;
}

.color-swatches {
  display: flex;
  gap: 6px;
}

.swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
}

.swatch:hover {
  transform: scale(1.15);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(255, 255, 255, 0.8), 0 0 0 3px currentColor;
}

.swatch.active {
  transform: scale(1.2);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1), 0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 0 3px currentColor;
}

.color-picker-wrap {
  position: relative;
  cursor: pointer;
  margin-left: 4px;
}

.color-picker {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.color-picker-btn {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
  position: relative;
}

.color-picker-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
  opacity: 0.3;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: xor;
  -webkit-mask-composite: xor;
  padding: 2px;
}

.color-picker-wrap:hover .color-picker-btn {
  transform: scale(1.15);
}

.slider-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider {
  width: 100px;
}

.opt-value {
  min-width: 2.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-toolbar-hover);
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.15s var(--ease-out);
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.disabled:hover {
  background: var(--bg-toolbar-hover);
  color: var(--text-muted);
}

.action-btn.disabled:active {
  transform: none;
}

.action-btn.danger {
  background: var(--danger-soft);
  color: var(--danger);
}

.action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--danger-hover);
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-toolbar-hover);
  color: var(--text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out);
}

.toggle-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.clear-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 36px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s var(--ease-out), color 0.2s var(--ease-out), transform 0.15s var(--ease-out);
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--danger-hover);
}

.clear-btn:active {
  transform: scale(0.98);
}

.canvas-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  overflow: hidden;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-canvas);
  overflow: hidden;
  transition: box-shadow 0.3s var(--ease-out);
}

.canvas-container:hover {
  box-shadow: var(--shadow-canvas-hover);
}

.canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--bg-canvas);
  touch-action: none;
  cursor: crosshair;
}

.canvas.cursor-grab {
  cursor: grab;
}

.canvas.cursor-grab:active {
  cursor: grabbing;
}

.canvas.cursor-pointer {
  cursor: pointer;
}

.canvas.cursor-none {
  cursor: none;
}

.eraser-cursor {
  position: absolute;
  border: 2px solid rgba(99, 102, 241, 0.8);
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
  background: rgba(99, 102, 241, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
  z-index: 10;
}
</style>
