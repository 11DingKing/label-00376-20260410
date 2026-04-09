import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ToastContainer from './ToastContainer.vue'
import { useToast } from '@/composables/useToast.js'

describe('ToastContainer', () => {
  beforeEach(() => {
    const { clearAll } = useToast()
    clearAll()
  })

  it('renders toast list', () => {
    const wrapper = mount(ToastContainer)
    expect(wrapper.find('.toast-root').exists()).toBe(true)
    expect(wrapper.find('.toast-list').exists()).toBe(true)
  })

  it('displays toasts when added', async () => {
    const { show } = useToast()
    show('Test message', 'info', 5000)
    const wrapper = mount(ToastContainer)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toast').exists()).toBe(true)
    expect(wrapper.text()).toContain('Test message')
  })

  it('dismisses toast on click', async () => {
    const { show, toasts } = useToast()
    show('Click me', 'success', 5000)
    const wrapper = mount(ToastContainer)
    await wrapper.vm.$nextTick()
    await wrapper.find('.toast').trigger('click')
    expect(toasts).toHaveLength(0)
  })
})
