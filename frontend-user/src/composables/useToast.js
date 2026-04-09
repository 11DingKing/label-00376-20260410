import { reactive } from 'vue'

/**
 * @typedef {'success'|'info'|'warning'|'error'} ToastType
 */

/**
 * @typedef {Object} Toast
 * @property {number} id
 * @property {string} message
 * @property {ToastType} type
 * @property {number} duration
 */

/** @type {Toast[]} */
const toasts = reactive([])
let nextId = 1

export function useToast() {
  /**
   * @param {string} message
   * @param {ToastType} type
   * @param {number} [duration=2500]
   * @returns {number}
   */
  function show(message, type, duration = 2500) {
    const id = nextId++
    toasts.push({ id, message, type, duration })
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  /**
   * @param {string} message
   * @param {number} [duration]
   */
  function success(message, duration) {
    return show(message, 'success', duration)
  }

  /**
   * @param {string} message
   * @param {number} [duration]
   */
  function info(message, duration) {
    return show(message, 'info', duration)
  }

  /**
   * @param {string} message
   * @param {number} [duration]
   */
  function warning(message, duration) {
    return show(message, 'warning', duration)
  }

  /**
   * @param {string} message
   * @param {number} [duration]
   */
  function error(message, duration) {
    return show(message, 'error', duration)
  }

  /**
   * @param {number} id
   */
  function dismiss(id) {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.splice(idx, 1)
  }

  function clearAll() {
    toasts.length = 0
  }

  return { toasts, show, success, info, warning, error, dismiss, clearAll }
}

export { toasts }
