import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useToast } from './useToast.js'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const { clearAll } = useToast()
    clearAll()
  })

  it('show adds toast and returns id', () => {
    const { show, toasts } = useToast()
    const id = show('hello', 'info', 1000)
    expect(id).toBeTypeOf('number')
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('hello')
    expect(toasts[0].type).toBe('info')
  })

  it('success creates success toast', () => {
    const { success, toasts } = useToast()
    success('ok')
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].message).toBe('ok')
  })

  it('info creates info toast', () => {
    const { info, toasts } = useToast()
    info('info msg')
    expect(toasts[0].type).toBe('info')
  })

  it('warning creates warning toast', () => {
    const { warning, toasts } = useToast()
    warning('warn')
    expect(toasts[0].type).toBe('warning')
  })

  it('dismiss removes toast by id', () => {
    const { show, dismiss, toasts } = useToast()
    const id = show('x', 'info', 5000)
    expect(toasts).toHaveLength(1)
    dismiss(id)
    expect(toasts).toHaveLength(0)
  })

  it('auto dismisses after duration', () => {
    const { show, toasts } = useToast()
    show('auto', 'info', 1000)
    expect(toasts).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(toasts).toHaveLength(0)
  })

  it('dismiss handles non-existent id', () => {
    const { dismiss, toasts } = useToast()
    dismiss(999)
    expect(toasts).toHaveLength(0)
  })

  it('clearAll removes all toasts', () => {
    const { show, clearAll, toasts } = useToast()
    show('a', 'info', 5000)
    show('b', 'success', 5000)
    expect(toasts).toHaveLength(2)
    clearAll()
    expect(toasts).toHaveLength(0)
  })

  it('multiple toasts have unique ids', () => {
    const { show, toasts } = useToast()
    const id1 = show('a', 'info', 5000)
    const id2 = show('b', 'info', 5000)
    expect(id1).not.toBe(id2)
    expect(toasts).toHaveLength(2)
  })
})


  it('does not auto dismiss when duration is 0', () => {
    const { show, toasts } = useToast()
    show('persistent', 'info', 0)
    vi.advanceTimersByTime(10000)
    expect(toasts).toHaveLength(1)
  })
