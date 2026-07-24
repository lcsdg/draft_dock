<script setup lang="ts">
import { useUiStore } from "@/stores/ui";

const uiStore = useUiStore();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="uiStore.showConfirmDialog && uiStore.confirmDialogConfig"
      class="modal-overlay"
      @click.self="uiStore.closeConfirmDialog(false)"
    >
      <div class="modal confirm-dialog">
        <div class="modal-header">
          {{ uiStore.confirmDialogConfig.title }}
        </div>
        <div class="modal-body">
          <p class="confirm-message">{{ uiStore.confirmDialogConfig.message }}</p>
        </div>
        <div class="modal-footer">
          <button @click="uiStore.closeConfirmDialog(false)">取消</button>
          <button
            :class="uiStore.confirmDialogConfig.danger ? 'danger' : 'primary'"
            @click="uiStore.closeConfirmDialog(true)"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-dialog {
  min-width: 360px;
  max-width: 460px;
}

.confirm-message {
  font-size: var(--font-size);
  color: var(--text-secondary);
  line-height: 1.6;
}
</style>
