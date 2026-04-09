/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 * @property {number} [pressure] - 压感值 0-1
 */

/**
 * @typedef {Object} Stroke
 * @property {string} id - 唯一标识符
 * @property {Point[]} points - 路径点集合
 * @property {string} color - 笔画颜色
 * @property {number} width - 笔画基础宽度
 * @property {number} timestamp - 创建时间
 * @property {boolean} [selected] - 是否被选中
 */

/**
 * @typedef {Object} AABB
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 */

/**
 * @typedef {Object} EraserCapsule
 * @property {Point} p1
 * @property {Point} p2
 * @property {number} radius
 */

/**
 * @typedef {Object} Viewport
 * @property {number} x - 平移 X
 * @property {number} y - 平移 Y
 * @property {number} scale - 缩放比例
 */

/**
 * @typedef {Object} DirtyRect
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {'pen'|'eraser'|'select'|'pan'} ToolType
 */

/**
 * @typedef {Object} AppState
 * @property {Stroke[]} strokes - 所有笔画列表
 * @property {Stroke|null} currentStroke - 当前正在绘制的笔画
 * @property {Point[]} eraserPath - 橡皮擦移动轨迹
 * @property {ToolType} tool - 当前工具
 * @property {string} penColor - 画笔颜色
 * @property {number} penWidth - 画笔宽度
 * @property {number} eraserSize - 橡皮擦大小
 * @property {Viewport} viewport - 视口变换
 * @property {string[]} selectedIds - 选中的笔画 ID
 * @property {boolean} pressureEnabled - 是否启用压感
 */

/**
 * @typedef {Object} HistorySnapshot
 * @property {Stroke[]} strokes
 * @property {number} timestamp
 */

/**
 * @typedef {Object} GestureState
 * @property {number} initialDistance - 双指初始距离
 * @property {number} initialScale - 初始缩放
 * @property {Point} initialCenter - 双指中心点
 * @property {Point} initialViewport - 初始视口位置
 */

export {}
