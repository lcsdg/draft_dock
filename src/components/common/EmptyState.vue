<script setup lang="ts">
</script>

<template>
  <div class="empty-state">
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.8;
}
</style>
