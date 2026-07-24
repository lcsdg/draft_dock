<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { sql, PostgreSQL, MySQL } from "@codemirror/lang-sql";
import { java } from "@codemirror/lang-java";
import { xml } from "@codemirror/lang-xml";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { editorPositions } from "@/lib/editorState";

// Language map for fenced code blocks in markdown
const codeLanguages: Record<string, any> = {
  js: javascript(), javascript: javascript(), ts: javascript({ typescript: true }), typescript: javascript({ typescript: true }),
  json: json(),
  sql: sql(), mysql: sql({ dialect: MySQL }), pgsql: sql({ dialect: PostgreSQL }), postgresql: sql({ dialect: PostgreSQL }),
  java: java(),
  xml: xml(), html: html(), css: css(),
  python: python(), py: python(),
  yaml: undefined, yml: undefined, sh: undefined, bash: undefined, shell: undefined,
};
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

let activeDocId: string | null = null;

function saveCurrentPosition() {
  if (!view || !activeDocId) return;
  editorPositions.set(activeDocId, {
    scrollTop: view.scrollDOM.scrollTop,
    head: view.state.selection.main.head,
  });
}

function restorePosition(docId: string) {
  if (!view) return;
  const pos = editorPositions.get(docId);
  if (!pos) return;
  // Restore cursor safely within doc bounds
  const safeHead = Math.min(pos.head, view.state.doc.length);
  view.dispatch({
    selection: { anchor: safeHead },
    scrollIntoView: false,
  });
  // Restore scroll after layout
  requestAnimationFrame(() => {
    if (view) view.scrollDOM.scrollTop = pos.scrollTop;
  });
}

function createEditor() {
  if (!editorEl.value) return;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const content = update.state.doc.toString();
      emit("change", content);
      if (activeDocId) scheduleSave(activeDocId, content);
    }
  });

  const extensions = [
    keymap.of([...defaultKeymap, ...historyKeymap]),
    history(),
    markdown({
      codeLanguages: (info: string) => {
        const lang = info.split(/\s+/)[0].toLowerCase();
        return (codeLanguages as Record<string, any>)[lang] || null;
      },
    }),
    cmPlaceholder("开始编辑..."),
    updateListener,
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
  ];

  if (uiStore.theme === "dark") extensions.push(oneDark);

  view = new EditorView({
    doc: props.content,
    extensions,
    parent: editorEl.value,
  });

  applyFontSize(props.fontSize);
  activeDocId = documentsStore.selectedDocumentId;
  restorePosition(activeDocId ?? "");
}

function applyFontSize(size: number) {
  if (!editorEl.value) return;
  editorEl.value.style.setProperty("--editor-font-size", `${size}px`);
}

onMounted(() => createEditor());

onUnmounted(() => {
  saveCurrentPosition();
  flushSave();
  view?.destroy();
  view = null;
});

// Save position BEFORE the document switches
watch(
  () => documentsStore.selectedDocumentId,
  (newId, oldId) => {
    if (oldId) saveCurrentPosition();
    activeDocId = newId;
  },
);

// When content changes externally (tab switch), dispatch + restore
watch(
  () => props.content,
  (newContent) => {
    if (!view) return;
    if (newContent !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newContent },
      });
      if (activeDocId) restorePosition(activeDocId);
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
