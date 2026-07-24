<script setup lang="ts">
import { ref, watch, computed } from "vue";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import SaveIndicator from "@/components/common/SaveIndicator.vue";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";
import { useProjectsStore } from "@/stores/projects";
import { hasVariables } from "@/lib/template";

const documentsStore = useDocumentsStore();
const uiStore = useUiStore();
const projectsStore = useProjectsStore();

const editorContent = ref("");

const currentDoc = computed(() => documentsStore.selectedDocument());
const canFillVariables = computed(() => hasVariables(editorContent.value));
const currentFontSize = computed(() => currentDoc.value?.font_size ?? 14);

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24];

watch(
  () => documentsStore.selectedDocumentId,
  () => {
    editorContent.value = currentDoc.value?.content ?? "";
  },
  { immediate: true },
);

watch(
  () => currentDoc.value?.content,
  (newContent) => {
    if (newContent !== undefined && newContent !== editorContent.value) {
      editorContent.value = newContent;
    }
  },
);

function handleContentChange(content: string) {
  editorContent.value = content;
}

function handleOpenVariableFill() {
  if (canFillVariables) {
    uiStore.showVariableFill = true;
  }
}

function handleFontSizeChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const size = parseInt(target.value, 10);
  const docId = documentsStore.selectedDocumentId;
  if (docId && size > 0) {
    documentsStore.setDocumentFontSize(docId, size);
  }
}

const noProject = computed(() => !projectsStore.selectedProjectId);
const noDoc = computed(() => !!projectsStore.selectedProjectId && !documentsStore.selectedDocumentId);
</script>

<template>
  <div class="editor-area">
    <div v-if="noProject" class="empty-area">
      <div class="empty-brand">
        <svg class="empty-logo" viewBox="0 0 24 24" fill="none" width="40" height="40">
          <rect x="3" y="8" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.6"/>
        </svg>
        <p class="empty-title">DraftDock</p>
        <p class="empty-desc">开发者业务文案管理工具</p>
        <p class="empty-hint">从左侧选择或创建一个项目开始</p>
      </div>
    </div>

    <div v-else-if="noDoc" class="empty-area">
      <div class="empty-brand">
        <svg class="empty-logo" viewBox="0 0 24 24" fill="none" width="40" height="40">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 2v6h6M12 18v-6M9 15h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p class="empty-title">还没有文案</p>
        <p class="empty-hint">点击 <kbd>+</kbd> 或按 <kbd>⌘N</kbd> 创建第一篇文案</p>
      </div>
    </div>

    <template v-else>
      <div class="editor-toolbar">
        <SaveIndicator />
        <div class="toolbar-right">
          <select
            class="font-size-select"
            :value="currentFontSize"
            title="字体大小"
            @change="handleFontSizeChange"
          >
            <option v-for="size in FONT_SIZES" :key="size" :value="size">{{ size }}px</option>
          </select>
          <div class="toolbar-divider"></div>
          <button
            class="fill-btn"
            :class="{ disabled: !canFillVariables }"
            :title="canFillVariables ? '填充变量 (⌘⇧F)' : '当前文案中没有可填充的变量，例如 \${name}'"
            @click="handleOpenVariableFill"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/>
              <path d="M18 2l4 4-10 10H8v-4L18 2z"/>
            </svg>
            填充变量
          </button>
        </div>
      </div>
      <div class="editor-container">
        <CodeEditor
          :key="uiStore.theme"
          :content="editorContent"
          :font-size="currentFontSize"
          @change="handleContentChange"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

/* Toolbar */
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 30px;
  background: var(--bg-surface);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

[data-theme="dark"] .editor-toolbar {
  background: rgba(14, 14, 24, 0.7);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.font-size-select {
  padding: 2px 6px;
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
  height: 22px;
  transition: all var(--transition-fast);
}

.font-size-select:hover {
  color: var(--text-primary);
  border-color: var(--border-default);
}

.toolbar-divider {
  width: 1px;
  height: 14px;
  background: var(--border-subtle);
}

.fill-btn {
  padding: 3px 12px;
  font-size: var(--font-size-sm);
  font-weight: 500;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  gap: 5px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 0 6px var(--accent-glow);
  transition: all var(--transition-fast);
}

.fill-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 12px var(--accent-glow);
}

.fill-btn.disabled {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-tertiary);
  box-shadow: none;
  cursor: default;
}

.fill-btn.disabled:hover {
  background: rgba(255, 255, 255, 0.04);
  box-shadow: none;
}

/* Editor */
.editor-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-editor);
}

/* Empty */
.empty-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
}

[data-theme="dark"] .empty-area {
  background: radial-gradient(ellipse at 50% 40%, rgba(40, 45, 80, 0.15) 0%, transparent 60%), var(--bg-base);
}

.empty-brand {
  text-align: center;
  animation: fadeUp 0.5s ease;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.empty-logo {
  color: var(--text-tertiary);
  opacity: 0.5;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  margin-bottom: 4px;
}

.empty-desc {
  font-size: var(--font-size);
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.empty-hint {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.empty-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}
</style>
