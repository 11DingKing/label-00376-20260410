<script setup>
import { useToast } from '@/composables/useToast.js'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-root" aria-live="polite">
    <TransitionGroup name="toast" tag="div" class="toast-list">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="t.type"
        role="alert"
        @click="dismiss(t.id)"
      >
        <span class="toast-icon">
          <svg v-if="t.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else-if="t.type === 'info'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <svg v-else-if="t.type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </span>
        <span class="toast-msg">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-root {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
}

.toast-list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}

.toast {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  white-space: nowrap;
}

.toast:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-icon svg {
  width: 14px;
  height: 14px;
}

.toast-msg {
  color: #374151;
  line-height: 1;
}

/* Success */
.toast.success .toast-icon {
  color: #16a34a;
}

/* Info */
.toast.info .toast-icon {
  color: #2563eb;
}

/* Warning */
.toast.warning .toast-icon {
  color: #d97706;
}

/* Error */
.toast.error .toast-icon {
  color: #dc2626;
}

/* Animations */
.toast-enter-active {
  transition: all 0.25s cubic-bezier(0.21, 1.02, 0.73, 1);
}

.toast-leave-active {
  transition: all 0.15s ease-out;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.toast-move {
  transition: transform 0.25s ease;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .toast {
    background: rgba(38, 38, 42, 0.95);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .toast:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .toast-msg {
    color: #e5e7eb;
  }
}
</style>
