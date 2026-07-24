<script setup lang="ts">
import { ref } from "vue";
import ProjectSidebar from "./ProjectSidebar.vue";
import DocumentTabs from "./DocumentTabs.vue";
import EditorArea from "./EditorArea.vue";
import { useUiStore } from "@/stores/ui";

const uiStore = useUiStore();
const isResizing = ref(false);

function startResize(e: MouseEvent) {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = uiStore.sidebarWidth;

  function onMove(ev: MouseEvent) {
    const newWidth = Math.max(200, Math.min(420, startWidth + (ev.clientX - startX)));
    uiStore.sidebarWidth = newWidth;
  }

  function onUp() {
    isResizing.value = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar" :style="{ width: uiStore.sidebarWidth + 'px' }">
      <ProjectSidebar />
    </aside>
    <div
      class="resize-handle"
      :class="{ active: isResizing }"
      @mousedown="startResize"
    >
      <div class="resize-line"></div>
    </div>
    <main class="main-area">
      <DocumentTabs />
      <EditorArea />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  flex-shrink: 0;
  background: var(--bg-surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid var(--border-subtle);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

[data-theme="dark"] .sidebar {
  background: linear-gradient(180deg, rgba(18, 18, 32, 0.95) 0%, rgba(14, 14, 26, 0.98) 100%);
}

.resize-handle {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.resize-line {
  width: 1px;
  height: 100%;
  background: transparent;
  transition: background var(--transition-fast);
}

.resize-handle:hover .resize-line,
.resize-handle.active .resize-line {
  background: var(--accent);
  width: 2px;
  box-shadow: 0 0 8px var(--accent-glow);
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-base);
}

[data-theme="dark"] .main-area {
  background: radial-gradient(ellipse at 70% 30%, rgba(40, 45, 80, 0.12) 0%, transparent 60%), var(--bg-base);
}
</style>
