<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from "vue";
import { Decoration, EditorView, GutterMarker, ViewPlugin, gutterLineClass, keymap, lineNumbers, placeholder as cmPlaceholder, type DecorationSet, type Panel, type ViewUpdate } from "@codemirror/view";
import { EditorSelection, EditorState, RangeSetBuilder, StateEffect, StateField, type StateCommand } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from "@codemirror/commands";
import { closeSearchPanel, findNext, findPrevious, openSearchPanel, replaceAll, replaceNext, search, SearchQuery, searchPanelOpen, setSearchQuery } from "@codemirror/search";
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
import * as cmd from "@/lib/commands";

const SOFT_TAB = "  ";
const LINE_MARK_SETTING_PREFIX = "lineMarks:";
const LINE_MARK_COLORS = ["blue", "yellow", "green", "red"] as const;

type SearchStats = {
  total: number;
  current: number;
  valid: boolean;
};

type LineMarkColor = (typeof LINE_MARK_COLORS)[number];
type LineMarks = Record<string, LineMarkColor>;

const lineMarkerRefreshEffect = StateEffect.define<number>();
const lineMarkerRefreshField = StateField.define<number>({
  create: () => 0,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(lineMarkerRefreshEffect)) return effect.value;
    }
    return value;
  },
});

// 编辑器内的 Tab 只负责输入内容，不参与浏览器焦点跳转：
// 无选区时在每个光标处插入两个空格；有选区时缩进选中行，避免替换掉已选文本。
const insertSoftTab: StateCommand = ({ state, dispatch }) => {
  if (state.selection.ranges.some((range) => !range.empty)) {
    return indentMore({ state, dispatch });
  }

  dispatch(state.update(
    state.changeByRange((range) => ({
      changes: { from: range.from, insert: SOFT_TAB },
      range: EditorSelection.cursor(range.from + SOFT_TAB.length),
    })),
    { scrollIntoView: true, userEvent: "input" },
  ));
  return true;
};

function createHiddenSearchPanel(): Panel {
  const dom = document.createElement("div");
  dom.className = "cm-hidden-search-panel";
  return { dom };
}

class LineNumberColorClass extends GutterMarker {
  readonly elementClass: string;

  constructor(readonly color: LineMarkColor) {
    super();
    this.elementClass = `cm-line-number-marked-${color}`;
  }

  eq(other: LineNumberColorClass) {
    return other.color === this.color;
  }
}

const lineNumberColorClasses = Object.fromEntries(
  LINE_MARK_COLORS.map((color) => [color, new LineNumberColorClass(color)]),
) as Record<LineMarkColor, LineNumberColorClass>;
const lineHighlightDecorations = Object.fromEntries(
  LINE_MARK_COLORS.map((color) => [color, Decoration.line({ class: `cm-line-marked-${color}` })]),
) as Record<LineMarkColor, Decoration>;

const props = defineProps<{
  content: string;
  fontSize: number;
}>();

const emit = defineEmits<{
  change: [content: string];
}>();

const editorEl = ref<HTMLDivElement>();
const findInputEl = ref<HTMLInputElement>();
const replaceInputEl = ref<HTMLInputElement>();
let view: EditorView | null = null;
const documentsStore = useDocumentsStore();
const uiStore = useUiStore();
const { scheduleSave, flushSave } = useAutoSave();

let activeDocId: string | null = null;
const showFindPanel = ref(true);
const showReplacePanel = ref(false);
const findQuery = ref("");
const replaceText = ref("");
const caseSensitive = ref(false);
const regexp = ref(false);
const wholeWord = ref(false);
const searchStats = ref<SearchStats>({ total: 0, current: 0, valid: true });
const cursorLine = ref(1);
const cursorColumn = ref(1);
const lineMarks = ref<LineMarks>({});
const hasLineMarks = computed(() => Object.keys(lineMarks.value).length > 0);
let lineMarkerVersion = 0;
let pendingLineMarkSave: ReturnType<typeof setTimeout> | null = null;

function lineMarkSettingKey(docId: string) {
  return `${LINE_MARK_SETTING_PREFIX}${docId}`;
}

function isLineMarkColor(value: string): value is LineMarkColor {
  return (LINE_MARK_COLORS as readonly string[]).includes(value);
}

function normalizeLineMarks(raw: unknown): LineMarks {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const normalized: LineMarks = {};
  for (const [lineNumber, color] of Object.entries(raw)) {
    if (/^[1-9]\d*$/.test(lineNumber) && typeof color === "string" && isLineMarkColor(color)) {
      normalized[lineNumber] = color;
    }
  }
  return normalized;
}

function refreshLineMarkGutter() {
  if (!view) return;
  lineMarkerVersion += 1;
  view.dispatch({ effects: lineMarkerRefreshEffect.of(lineMarkerVersion) });
}

async function loadLineMarks(docId: string | null) {
  if (!docId) {
    lineMarks.value = {};
    refreshLineMarkGutter();
    return;
  }

  try {
    const saved = await cmd.getSetting(lineMarkSettingKey(docId));
    lineMarks.value = saved ? normalizeLineMarks(JSON.parse(saved)) : {};
  } catch (error) {
    console.error("Failed to load line marks:", error);
    lineMarks.value = {};
  } finally {
    refreshLineMarkGutter();
  }
}

function scheduleLineMarkSave() {
  if (!activeDocId) return;
  if (pendingLineMarkSave) clearTimeout(pendingLineMarkSave);

  const docId = activeDocId;
  const marksSnapshot = JSON.stringify(lineMarks.value);
  pendingLineMarkSave = setTimeout(() => {
    cmd.setSetting(lineMarkSettingKey(docId), marksSnapshot).catch((error) => {
      console.error("Failed to save line marks:", error);
    });
  }, 250);
}

function nextLineMarkColor(current: LineMarkColor | undefined) {
  if (!current) return LINE_MARK_COLORS[0];
  const currentIndex = LINE_MARK_COLORS.indexOf(current);
  return LINE_MARK_COLORS[currentIndex + 1] ?? null;
}

function toggleLineMark(lineNumber: number) {
  const key = String(lineNumber);
  const nextColor = nextLineMarkColor(lineMarks.value[key]);
  const nextMarks = { ...lineMarks.value };

  if (nextColor) nextMarks[key] = nextColor;
  else delete nextMarks[key];

  lineMarks.value = nextMarks;
  refreshLineMarkGutter();
  scheduleLineMarkSave();
}

function clearLineMarks() {
  lineMarks.value = {};
  refreshLineMarkGutter();
  scheduleLineMarkSave();
  view?.focus();
}

function shouldRefreshLineMarkers(update: ViewUpdate) {
  return update.docChanged || update.transactions.some((transaction) =>
    transaction.effects.some((effect) => effect.is(lineMarkerRefreshEffect)),
  );
}

function buildLineNumberMarkClasses(state: EditorState) {
  const builder = new RangeSetBuilder<GutterMarker>();
  const lineCount = state.doc.lines;

  for (const [lineNumberText, color] of Object.entries(lineMarks.value)) {
    const lineNumber = Number(lineNumberText);
    if (lineNumber < 1 || lineNumber > lineCount) continue;
    const line = state.doc.line(lineNumber);
    builder.add(line.from, line.from, lineNumberColorClasses[color]);
  }

  return builder.finish();
}

function buildLineMarkDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const lineCount = state.doc.lines;

  for (const [lineNumberText, color] of Object.entries(lineMarks.value)) {
    const lineNumber = Number(lineNumberText);
    if (lineNumber < 1 || lineNumber > lineCount) continue;
    const line = state.doc.line(lineNumber);
    builder.add(line.from, line.from, lineHighlightDecorations[color]);
  }

  return builder.finish();
}

const lineMarkHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(editorView: EditorView) {
      this.decorations = buildLineMarkDecorations(editorView.state);
    }

    update(update: ViewUpdate) {
      if (shouldRefreshLineMarkers(update)) {
        this.decorations = buildLineMarkDecorations(update.state);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

function buildSearchQuery() {
  return new SearchQuery({
    search: findQuery.value,
    replace: replaceText.value,
    caseSensitive: caseSensitive.value,
    regexp: regexp.value,
    wholeWord: wholeWord.value,
  });
}

function updateCursorPosition() {
  if (!view) return;
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  cursorLine.value = line.number;
  cursorColumn.value = view.state.selection.main.head - line.from + 1;
}

function updateSearchStats() {
  if (!view) return;
  const query = buildSearchQuery();

  if (!query.search) {
    searchStats.value = { total: 0, current: 0, valid: true };
    return;
  }

  if (!query.valid) {
    searchStats.value = { total: 0, current: 0, valid: false };
    return;
  }

  const matches: Array<{ from: number; to: number }> = [];
  const cursor = query.getCursor(view.state);
  for (let next = cursor.next(); !next.done; next = cursor.next()) {
    matches.push(next.value);
  }
  const selection = view.state.selection.main;
  const currentIndex = matches.findIndex(
    (match) => match.from === selection.from && match.to === selection.to,
  );

  searchStats.value = {
    total: matches.length,
    current: currentIndex >= 0 ? currentIndex + 1 : 0,
    valid: true,
  };
}

function syncSearchQuery() {
  if (!view) return;
  if (showFindPanel.value && !searchPanelOpen(view.state)) {
    openSearchPanel(view);
  }
  view.dispatch({ effects: setSearchQuery.of(buildSearchQuery()) });
  updateSearchStats();
}

function focusFindInput() {
  nextTick(() => findInputEl.value?.focus());
}

function focusReplaceInput() {
  nextTick(() => replaceInputEl.value?.focus());
}

function toggleFindPanel() {
  showFindPanel.value = !showFindPanel.value;
  if (showFindPanel.value) {
    syncSearchQuery();
    focusFindInput();
  } else {
    if (view && searchPanelOpen(view.state)) closeSearchPanel(view);
    view?.focus();
  }
}

function openReplacePanel() {
  showFindPanel.value = true;
  showReplacePanel.value = true;
  syncSearchQuery();
  focusReplaceInput();
}

function closeFindPanel() {
  showFindPanel.value = false;
  showReplacePanel.value = false;
  if (view && searchPanelOpen(view.state)) closeSearchPanel(view);
  view?.focus();
}

function findNextMatch() {
  syncSearchQuery();
  if (!view || !buildSearchQuery().valid || !findQuery.value) return;
  findNext(view);
  updateSearchStats();
}

function findPreviousMatch() {
  syncSearchQuery();
  if (!view || !buildSearchQuery().valid || !findQuery.value) return;
  findPrevious(view);
  updateSearchStats();
}

function replaceCurrentMatch() {
  syncSearchQuery();
  if (!view || !buildSearchQuery().valid || !findQuery.value) return;
  replaceNext(view);
  updateSearchStats();
}

function replaceEveryMatch() {
  syncSearchQuery();
  if (!view || !buildSearchQuery().valid || !findQuery.value) return;
  replaceAll(view);
  updateSearchStats();
}

function handleFindKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (event.shiftKey) findPreviousMatch();
    else findNextMatch();
    return;
  }
  if (event.key === "Escape") closeFindPanel();
}

function handleReplaceKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    replaceCurrentMatch();
    return;
  }
  if (event.key === "Escape") closeFindPanel();
}

function handleShellKeydown(event: KeyboardEvent) {
  const mod = event.metaKey || event.ctrlKey;
  if (!mod) return;

  // 查找/替换输入框获得焦点时，CodeMirror keymap 收不到快捷键；
  // 在编辑器外壳层统一兜底，避免浏览器查找或 macOS 隐藏应用抢走快捷键。
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFindPanel();
    return;
  }
  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    openReplacePanel();
  }
}

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
    if (update.selectionSet || update.docChanged) {
      updateCursorPosition();
      updateSearchStats();
    }
    if (update.docChanged) {
      const content = update.state.doc.toString();
      emit("change", content);
      if (activeDocId) scheduleSave(activeDocId, content);
    }
  });

  const extensions = [
    keymap.of([
      { key: "Mod-f", run: () => { toggleFindPanel(); return true; } },
      { key: "Mod-h", run: () => { openReplacePanel(); return true; } },
      { key: "Tab", run: insertSoftTab, shift: indentLess },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    lineNumbers({
      domEventHandlers: {
        click: (editorView, line, event) => {
          event.preventDefault();
          event.stopPropagation();
          const lineNumber = editorView.state.doc.lineAt(line.from).number;
          toggleLineMark(lineNumber);
          return true;
        },
      },
    }),
    lineMarkerRefreshField,
    gutterLineClass.compute([lineMarkerRefreshField], buildLineNumberMarkClasses),
    lineMarkHighlighter,
    history(),
    search({ top: false, createPanel: createHiddenSearchPanel }),
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
  loadLineMarks(activeDocId);
  syncSearchQuery();
  updateCursorPosition();
}

function applyFontSize(size: number) {
  if (!editorEl.value) return;
  editorEl.value.style.setProperty("--editor-font-size", `${size}px`);
}

onMounted(() => createEditor());

onUnmounted(() => {
  saveCurrentPosition();
  flushSave();
  if (pendingLineMarkSave) {
    clearTimeout(pendingLineMarkSave);
    if (activeDocId) {
      cmd.setSetting(lineMarkSettingKey(activeDocId), JSON.stringify(lineMarks.value)).catch(() => {});
    }
  }
  view?.destroy();
  view = null;
});

// Save position BEFORE the document switches
watch(
  () => documentsStore.selectedDocumentId,
  (newId, oldId) => {
    if (oldId) saveCurrentPosition();
    activeDocId = newId;
    loadLineMarks(newId);
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
  <div
    class="editor-shell"
    :class="{ 'find-panel-open': showFindPanel, 'replace-panel-open': showReplacePanel }"
    @keydown.capture="handleShellKeydown"
  >
    <div ref="editorEl" class="codemirror-wrapper"></div>

    <button
      v-if="hasLineMarks"
      class="line-mark-clear-btn"
      type="button"
      title="清除当前文档所有行标记"
      @click="clearLineMarks"
    >
      清除
    </button>

    <button
      v-if="!showFindPanel"
      class="floating-find-btn"
      type="button"
      title="查找/替换"
      @click="toggleFindPanel"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <span>查找</span>
    </button>

    <div v-if="showFindPanel" class="editor-find-panel" :class="{ expanded: showReplacePanel }">
      <div class="find-options" aria-label="查找选项">
        <button
          class="find-option-btn"
          :class="{ active: regexp }"
          type="button"
          title="正则表达式"
          @click="regexp = !regexp; syncSearchQuery()"
        >
          .*
        </button>
        <button
          class="find-option-btn"
          :class="{ active: caseSensitive }"
          type="button"
          title="区分大小写"
          @click="caseSensitive = !caseSensitive; syncSearchQuery()"
        >
          Aa
        </button>
        <button
          class="find-option-btn"
          :class="{ active: wholeWord }"
          type="button"
          title="整词匹配"
          @click="wholeWord = !wholeWord; syncSearchQuery()"
        >
          “”
        </button>
        <button
          class="find-option-btn"
          :class="{ active: showReplacePanel }"
          type="button"
          title="替换"
          @click="showReplacePanel = !showReplacePanel"
        >
          AB
        </button>
      </div>

      <div class="find-fields">
        <div class="find-row">
          <label class="find-label" for="editor-find-input">查找</label>
          <input
            id="editor-find-input"
            ref="findInputEl"
            v-model="findQuery"
            class="find-input"
            :class="{ invalid: !searchStats.valid }"
            type="text"
            autocomplete="off"
            spellcheck="false"
            @input="syncSearchQuery"
            @keydown="handleFindKeydown"
          />
          <span class="find-count" :class="{ invalid: !searchStats.valid }">
            {{ searchStats.valid ? `${searchStats.current || 0}/${searchStats.total}` : "正则无效" }}
          </span>
          <button class="find-action-btn" type="button" @click="findNextMatch">查找</button>
          <button class="find-action-btn" type="button" @click="findPreviousMatch">上一个</button>
        </div>

        <div v-if="showReplacePanel" class="find-row replace-row">
          <label class="find-label" for="editor-replace-input">替换</label>
          <input
            id="editor-replace-input"
            ref="replaceInputEl"
            v-model="replaceText"
            class="find-input"
            type="text"
            autocomplete="off"
            spellcheck="false"
            @input="syncSearchQuery"
            @keydown="handleReplaceKeydown"
          />
          <span class="find-count"></span>
          <button class="find-action-btn" type="button" @click="replaceCurrentMatch">替换</button>
          <button class="find-action-btn" type="button" @click="replaceEveryMatch">全部替换</button>
        </div>
      </div>

      <button class="find-close-btn" type="button" title="关闭查找栏" @click="closeFindPanel">
        ×
      </button>
    </div>

    <div class="editor-statusbar">
      <div class="status-left">
        行 {{ cursorLine }}，列 {{ cursorColumn }}
      </div>
      <div class="status-right">
        <button
          class="status-icon-btn"
          :class="{ active: showFindPanel }"
          type="button"
          title="查找/替换"
          @click="toggleFindPanel"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <span>查找</span>
        </button>
        <span>Tab: 2</span>
        <span>Plain Text</span>
      </div>
    </div>
  </div>
</template>

<style>
.editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  position: relative;
  background: var(--bg-editor);
}

.codemirror-wrapper {
  flex: 1;
  min-height: 0;
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
  padding: 0 20px 0 12px;
}

.codemirror-wrapper .cm-editor .cm-gutters {
  background: transparent !important;
  border-right: 1px solid rgba(255, 255, 255, 0.04) !important;
  color: var(--text-tertiary);
  padding: 0 6px 0 0;
  min-width: 46px;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers {
  min-width: 40px;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement {
  position: relative;
  min-width: 40px;
  padding: 0 10px 0 8px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: var(--editor-font-size);
  line-height: 1.65;
  color: var(--text-tertiary);
  opacity: 0.72;
  cursor: pointer;
  transition: color var(--transition-fast), opacity var(--transition-fast), background var(--transition-fast);
}

.codemirror-wrapper .cm-editor .cm-activeLineGutter {
  background: rgba(83, 115, 232, 0.16) !important;
  color: var(--text-primary) !important;
  opacity: 1;
  border-radius: 0;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement:hover {
  color: var(--text-primary);
  opacity: 1;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--border-strong);
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement:hover::before {
  opacity: 0.6;
  background: rgba(255, 255, 255, 0.08);
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-blue,
.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-yellow,
.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-green,
.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-red {
  opacity: 1;
  font-weight: 700;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-blue {
  color: #78a1ff;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-yellow {
  color: #ffd15c;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-green {
  color: #52df87;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-red {
  color: #ff7479;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-blue::before,
.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-yellow::before,
.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-green::before,
.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-red::before {
  opacity: 1;
  border-color: transparent;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-blue::before {
  background: #5b8cff;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-yellow::before {
  background: #f5b842;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-green::before {
  background: #30c96e;
}

.codemirror-wrapper .cm-editor .cm-lineNumbers .cm-gutterElement.cm-line-number-marked-red::before {
  background: #e5484d;
}

.line-mark-clear-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 25;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: rgba(18, 18, 30, 0.78);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 500;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.line-mark-clear-btn:hover {
  background: var(--danger-muted);
  border-color: rgba(229, 72, 77, 0.35);
  color: var(--danger-hover);
}

.codemirror-wrapper .cm-editor .cm-activeLine {
  background: rgba(255, 255, 255, 0.02) !important;
}

.codemirror-wrapper .cm-editor .cm-line.cm-line-marked-blue {
  background: rgba(91, 140, 255, 0.22);
  box-shadow: inset 4px 0 0 rgba(91, 140, 255, 0.95);
}

.codemirror-wrapper .cm-editor .cm-line.cm-line-marked-yellow {
  background: rgba(245, 184, 66, 0.23);
  box-shadow: inset 4px 0 0 rgba(245, 184, 66, 0.96);
}

.codemirror-wrapper .cm-editor .cm-line.cm-line-marked-green {
  background: rgba(48, 201, 110, 0.22);
  box-shadow: inset 4px 0 0 rgba(48, 201, 110, 0.94);
}

.codemirror-wrapper .cm-editor .cm-line.cm-line-marked-red {
  background: rgba(229, 72, 77, 0.22);
  box-shadow: inset 4px 0 0 rgba(229, 72, 77, 0.94);
}

.codemirror-wrapper .cm-editor .cm-line.cm-activeLine.cm-line-marked-blue {
  background: rgba(91, 140, 255, 0.28) !important;
}

.codemirror-wrapper .cm-editor .cm-line.cm-activeLine.cm-line-marked-yellow {
  background: rgba(245, 184, 66, 0.29) !important;
}

.codemirror-wrapper .cm-editor .cm-line.cm-activeLine.cm-line-marked-green {
  background: rgba(48, 201, 110, 0.28) !important;
}

.codemirror-wrapper .cm-editor .cm-line.cm-activeLine.cm-line-marked-red {
  background: rgba(229, 72, 77, 0.28) !important;
}

.codemirror-wrapper .cm-editor .cm-cursor {
  border-left-color: var(--accent) !important;
}

.codemirror-wrapper .cm-editor .cm-selectionBackground {
  background: rgba(83, 115, 232, 0.34) !important;
}

.codemirror-wrapper .cm-editor.cm-focused .cm-selectionBackground {
  background: rgba(83, 115, 232, 0.45) !important;
}

.codemirror-wrapper .cm-editor .cm-content ::selection {
  background: rgba(83, 115, 232, 0.45);
}

.codemirror-wrapper .cm-editor .cm-placeholder {
  color: var(--text-tertiary) !important;
  opacity: 0.5;
}

.codemirror-wrapper .cm-editor .cm-searchMatch {
  background: rgba(245, 184, 66, 0.34) !important;
  border: 1px solid rgba(245, 184, 66, 0.55);
  border-radius: 2px;
}

.codemirror-wrapper .cm-editor .cm-searchMatch-selected {
  background: rgba(83, 115, 232, 0.58) !important;
  border: 1px solid rgba(160, 187, 255, 0.85);
  box-shadow: 0 0 0 1px rgba(83, 115, 232, 0.22);
}

.cm-hidden-search-panel {
  display: none;
}

.editor-find-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: stretch;
  padding: 8px 10px;
  background: var(--bg-overlay);
  border-top: 1px solid var(--border-default);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.find-options {
  display: grid;
  grid-template-columns: repeat(4, 34px);
  gap: 6px;
  align-content: start;
}

.find-option-btn,
.status-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.find-option-btn {
  height: 28px;
  min-width: 34px;
  padding: 0 6px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

.find-option-btn:hover,
.status-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.find-option-btn.active,
.status-icon-btn.active {
  background: var(--accent-muted);
  border-color: var(--border-active);
  color: var(--text-accent-bright);
}

.find-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.find-row {
  display: grid;
  grid-template-columns: 42px minmax(120px, 1fr) 72px repeat(2, minmax(72px, 90px));
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.replace-row {
  grid-template-columns: 42px minmax(120px, 1fr) 72px repeat(2, minmax(72px, 90px));
}

.find-label {
  text-align: right;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.find-input {
  height: 28px;
  min-width: 0;
  border-color: var(--border-default);
  background: rgba(255, 255, 255, 0.06);
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 4px 8px;
}

.find-input.invalid {
  border-color: var(--danger);
  box-shadow: 0 0 0 2px var(--danger-muted);
}

.find-count {
  min-width: 0;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  white-space: nowrap;
  text-align: center;
}

.find-count.invalid {
  color: var(--danger);
}

.find-action-btn {
  height: 28px;
  min-width: 0;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  font-size: var(--font-size-sm);
  font-weight: 500;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.find-action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.find-close-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 24px;
  line-height: 1;
  border-radius: var(--radius-sm);
}

.find-close-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.floating-find-btn {
  position: absolute;
  right: 12px;
  bottom: 36px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border-active);
  background: rgba(83, 115, 232, 0.18);
  color: var(--text-accent-bright);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24), 0 0 14px var(--accent-glow);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: transform var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.floating-find-btn:hover {
  transform: translateY(-1px);
  background: var(--accent);
  color: #fff;
}

.editor-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  padding: 0 10px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.status-icon-btn {
  min-width: 54px;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  gap: 5px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

@media (max-width: 900px) {
  .editor-find-panel {
    grid-template-columns: 1fr auto;
  }

  .find-options {
    grid-column: 1 / -1;
    grid-template-columns: repeat(4, 34px);
  }

  .find-row,
  .replace-row {
    grid-template-columns: 42px minmax(100px, 1fr) 58px;
  }

  .find-action-btn {
    display: none;
  }
}
</style>
