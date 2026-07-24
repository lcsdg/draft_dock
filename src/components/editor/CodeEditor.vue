<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";
import { useAutoSave } from "@/composables/useAutoSave";

const props = defineProps<{
  content: string;
  fontSize: number;
}>();

const emit = defineEmits<{
  change: [content: string];
}>();

const editorEl = ref<HTMLDivElement>();
let view: EditorView | null = null;
const documentsStore = useDocumentsStore();
const uiStore = useUiStore();

const { scheduleSave, flushSave } = useAutoSave();

function createEditor() {
  if (!editorEl.value) return;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const content = update.state.doc.toString();
      emit("change", content);
      const docId = documentsStore.selectedDocumentId;
      if (docId) scheduleSave(docId, content);
    }
  });

  const extensions = [
    keymap.of([...defaultKeymap, ...historyKeymap]),
    history(),
    markdown(),
    cmPlaceholder("开始编辑..."),
    updateListener,
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
  ];

  // Only use oneDark in dark mode
  if (uiStore.theme === "dark") {
    extensions.push(oneDark);
  }

  view = new EditorView({
    doc: props.content,
    extensions,
    parent: editorEl.value,
  });

  applyFontSize(props.fontSize);
}

function applyFontSize(size: number) {
  if (!editorEl.value) return;
  editorEl.value.style.setProperty("--editor-font-size", `${size}px`);
}

onMounted(() => createEditor());

onUnmounted(() => {
  flushSave();
  view?.destroy();
  view = null;
});

watch(
  () => props.content,
  (newContent) => {
    if (view && newContent !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      });
    }
  },
);

watch(
  () => props.fontSize,
  (newSize) => applyFontSize(newSize),
);
</script>

<template>
  <div ref="editorEl" class="codemirror-wrapper"></div>
</template>

<style>
/* Global (non-scoped) to override CodeMirror theme */
.codemirror-wrapper {
  height: 100%;
  width: 100%;
  overflow: auto;
  --editor-font-size: 14px;
}

.codemirror-wrapper .cm-editor {
  height: 100%;
  font-family: var(--font-mono);
  font-size: var(--editor-font-size);
  background: var(--bg-editor) !important;
}

.codemirror-wrapper .cm-editor .cm-scroller {
  font-family: var(--font-mono);
  line-height: 1.65;
}

.codemirror-wrapper .cm-editor .cm-content {
  font-family: var(--font-mono);
  padding: 12px 0;
}

.codemirror-wrapper .cm-editor .cm-line {
  padding: 0 20px;
}

.codemirror-wrapper .cm-editor .cm-gutters {
  background: transparent !important;
  border-right: 1px solid rgba(255, 255, 255, 0.04) !important;
  color: var(--text-tertiary);
  padding-right: 8px;
}

.codemirror-wrapper .cm-editor .cm-activeLineGutter {
  background: rgba(255, 255, 255, 0.02) !important;
}

.codemirror-wrapper .cm-editor .cm-activeLine {
  background: rgba(255, 255, 255, 0.02) !important;
}

.codemirror-wrapper .cm-editor .cm-cursor {
  border-left-color: var(--accent) !important;
}

.codemirror-wrapper .cm-editor .cm-selectionBackground {
  background: rgba(83, 115, 232, 0.25) !important;
}

.codemirror-wrapper .cm-editor .cm-placeholder {
  color: var(--text-tertiary) !important;
  opacity: 0.5;
}

.codemirror-wrapper .cm-editor .cm-searchMatch {
  background: rgba(245, 184, 66, 0.3) !important;
  border: 1px solid rgba(245, 184, 66, 0.4);
}

.codemirror-wrapper .cm-editor .cm-searchMatch-selected {
  background: rgba(83, 115, 232, 0.4) !important;
  border: 1px solid rgba(83, 115, 232, 0.5);
}
</style>
