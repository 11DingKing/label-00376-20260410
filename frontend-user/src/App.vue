<script setup>
import CanvasBoard from './components/CanvasBoard.vue'
import ToastContainer from './components/ToastContainer.vue'
</script>

<template>
  <div class="app">
    <CanvasBoard />
    <ToastContainer />
  </div>
</template>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  background-image: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99, 102, 241, 0.06) 0%, transparent 55%);
}
</style>
