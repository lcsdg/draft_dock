<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";

const documentsStore = useDocumentsStore();
const uiStore = useUiStore();

const editingId = ref<string | null>(null);
const editingName = ref("");
const showNewDocInput = ref(false);
const newDocName = ref("");
const contextMenu = ref<{ docId: string; docName: string; x: number; y: number } | null>(null);

function openNewDocInput() {
  newDocName.value = "新建文案";
  showNewDocInput.value = true;
}

function triggerNewDoc() {
  openNewDocInput();
}

function cancelNewDoc() {
  showNewDocInput.value = false;
  newDocName.value = "";
}

onMounted(() => {
  document.addEventListener("draftdock:new-document", triggerNewDoc);
});

onUnmounted(() => {
  document.removeEventListener("draftdock:new-document", triggerNewDoc);
});

async function handleCreate() {
  const name = newDocName.value.trim();
  if (!name) {
    cancelNewDoc();
    return;
  }
  const doc = await documentsStore.addDocument(name);
  if (doc) {
    showNewDocInput.value = false;
    newDocName.value = "";
  }
}

function startRename(id: string, currentName: string) {
  editingId.value = id;
  editingName.value = currentName;
}

async function finishRename() {
  if (editingId.value && editingName.value.trim()) {
    await documentsStore.renameDocument(editingId.value, editingName.value.trim());
  }
  editingId.value = null;
  editingName.value = "";
}

async function handleDelete(id: string, name: string) {
  const confirmed = await uiStore.openConfirmDialog(
    "删除文案",
    `确定要删除文案「${name}」吗？`,
    true,
  );
  if (confirmed) {
    await documentsStore.removeDocument(id);
  }
}

function showContextMenu(e: MouseEvent, docId: string, docName: string) {
  e.preventDefault();
  contextMenu.value = { docId, docName, x: e.clientX, y: e.clientY };
}

function hideContextMenu() {
  contextMenu.value = null;
}

async function exportToFile() {
  if (!contextMenu.value) return;
  const { docId, docName } = contextMenu.value;
  hideContextMenu();

  const doc = documentsStore.documents.find(d => d.id === docId);
  if (!doc) return;

  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { saveToFile } = await import("@/lib/commands");
    const path = await save({
      defaultPath: `${docName}.md`,
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "文本文件", extensions: ["txt"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    if (path) {
      await saveToFile(path, doc.content);
    }
  } catch (e) {
    console.error("Export failed:", e);
  }
}
</script>

<template>
  <div class="doc-tabs-bar">
    <div class="tabs-scroll">
      <div
        v-for="doc in documentsStore.documents"
        :key="doc.id"
        class="tab"
        :class="{ selected: doc.id === documentsStore.selectedDocumentId }"
        @click="documentsStore.selectDocument(doc.id)"
        @contextmenu="showContextMenu($event, doc.id, doc.name)"
      >
        <span
          v-if="editingId !== doc.id"
          class="tab-name"
          @dblclick.stop="startRename(doc.id, doc.name)"
        >{{ doc.name }}</span>
        <input
          v-else
          v-model="editingName"
          type="text"
          class="tab-edit-input"
          @keydown.enter="finishRename"
          @keydown.escape="editingId = null"
          @blur="finishRename"
          @click.stop
        />
        <button
          class="tab-close"
          title="删除"
          @click.stop="handleDelete(doc.id, doc.name)"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="tab-actions">
      <button
        class="theme-toggle-btn"
        :title="uiStore.theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'"
        @click="uiStore.toggleTheme()"
      >
        <!-- Sun icon -->
        <svg v-if="uiStore.theme === 'dark'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
        <!-- Moon icon -->
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
      <button
        class="add-tab-btn"
        title="新建文案 (Cmd+N)"
        @click="openNewDocInput"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showNewDocInput" class="new-doc-overlay" @click.self="cancelNewDoc">
        <div class="new-doc-card">
          <p class="card-label">新建文案</p>
          <input
            v-model="newDocName"
            type="text"
            placeholder="文案名称"
            class="new-doc-input"
            autofocus
            @keydown.enter="handleCreate"
            @keydown.escape="cancelNewDoc"
          />
          <div class="card-actions">
            <button class="ghost" @click="cancelNewDoc">取消</button>
            <button class="primary" @click="handleCreate">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="context-menu-overlay"
        @click="hideContextMenu"
        @contextmenu.prevent="hideContextMenu"
      >
        <div
          class="context-menu"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
          @click.stop
        >
          <button class="context-menu-item" @click="exportToFile">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            保存到本地...
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.doc-tabs-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  position: relative;
}

[data-theme="dark"] .doc-tabs-bar {
  background: linear-gradient(180deg, rgba(18, 18, 30, 0.9) 0%, rgba(14, 14, 24, 0.95) 100%);
}

.tabs-scroll {
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  padding: 0 4px;
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 14px;
  height: 100%;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 450;
  white-space: nowrap;
  gap: 8px;
  transition: all var(--transition-fast);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  position: relative;
  margin-top: 4px;
  height: calc(100% - 4px);
}

.tab::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 14px;
  right: 14px;
  height: 1.5px;
  background: transparent;
  border-radius: 1px;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.02);
}

.tab.selected {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.03);
}

.tab.selected::after {
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent-glow);
}

.tab-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-edit-input {
  width: 110px;
  padding: 2px 6px;
  font-size: var(--font-size-sm);
  background: var(--bg-base);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  outline: none;
}

.tab-close {
  width: 18px;
  height: 18px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  opacity: 0;
  transition: all var(--transition-fast);
}

.tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: var(--danger-muted);
  color: var(--danger);
  opacity: 1;
}

.tab-actions {
  display: flex;
  align-items: center;
  padding: 0 6px;
  flex-shrink: 0;
}

.theme-toggle-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.theme-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

.add-tab-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.add-tab-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}

/* New document */
.new-doc-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.new-doc-card {
  background: var(--bg-glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-lg);
  min-width: 300px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: cardIn var(--transition) ease;
}

@keyframes cardIn {
  from { opacity: 0; transform: scale(0.95) translateY(-8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.card-label {
  font-weight: 600;
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.new-doc-input {
  width: 100%;
  padding: 7px 10px;
  font-size: var(--font-size);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-active);
  border-radius: var(--radius);
  color: var(--text-primary);
  outline: none;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Context menu */
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
}

.context-menu {
  position: fixed;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  min-width: 160px;
  animation: menuIn 100ms ease;
}

@keyframes menuIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  font-size: var(--font-size-sm);
  font-weight: 450;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  text-align: left;
  transition: all var(--transition-fast);
}

.context-menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}
</style>
