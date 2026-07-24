<script setup lang="ts">
import { computed } from "vue";
import { useUiStore } from "@/stores/ui";

const uiStore = useUiStore();

const statusText = computed(() => {
  switch (uiStore.saveStatus) {
    case "saving": return "保存中";
    case "saved":  return "已保存";
    case "error":  return "保存失败";
    default:       return "";
  }
});

const statusClass = computed(() => `status-${uiStore.saveStatus}`);
</script>

<template>
  <div class="save-indicator" :class="statusClass">
    <span class="dot"></span>
    <span class="label">{{ statusText }}</span>
  </div>
</template>

<style scoped>
.save-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-weight: 450;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: all var(--transition);
}

.label {
  transition: color var(--transition);
}

.status-saving .dot {
  background: var(--warning);
  box-shadow: 0 0 6px var(--warning);
  animation: blink 1.2s ease-in-out infinite;
}

.status-saved .dot {
  background: var(--success);
  box-shadow: 0 0 4px var(--success);
}

.status-error .dot {
  background: var(--danger);
  box-shadow: 0 0 4px var(--danger);
}

.status-error .label {
  color: var(--danger);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
</style>
