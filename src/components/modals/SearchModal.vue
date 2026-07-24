<script setup lang="ts">
import { ref, watch } from "vue";
import { useUiStore } from "@/stores/ui";
import { useProjectsStore } from "@/stores/projects";
import { useDocumentsStore } from "@/stores/documents";
import * as cmd from "@/lib/commands";
import type { SearchResult } from "@/types";

const uiStore = useUiStore();
const projectsStore = useProjectsStore();
const documentsStore = useDocumentsStore();

const query = ref("");
const results = ref<SearchResult[]>([]);
const searching = ref(false);
const noResults = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(() => uiStore.showSearch, (show) => {
  if (show) { query.value = ""; results.value = []; noResults.value = false; }
});

function doSearch() {
  const q = query.value.trim();
  if (!q) { results.value = []; noResults.value = false; return; }
  searching.value = true;
  cmd.search(q)
    .then((r) => { results.value = r; noResults.value = r.length === 0; })
    .catch(() => { results.value = []; noResults.value = true; })
    .finally(() => { searching.value = false; });
}

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 250);
}

function navigateTo(docId: string, projectId: string) {
  projectsStore.selectProject(projectId);
  setTimeout(() => documentsStore.selectDocument(docId), 100);
  close();
}

function close() { uiStore.showSearch = false; }
</script>

<template>
  <Teleport to="body">
    <div v-if="uiStore.showSearch" class="modal-overlay" @click.self="close">
      <div class="modal search-modal">
        <div class="search-input-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="search-icon-big">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="搜索项目、文案名称或内容..."
            class="search-input-big"
            @input="onInput"
            @keydown.escape="close"
          />
          <kbd class="esc-hint">esc</kbd>
        </div>

        <div v-if="searching" class="search-status">搜索中...</div>
        <div v-else-if="noResults" class="search-status">没有找到匹配的结果</div>

        <div v-if="results.length > 0" class="search-results">
          <div
            v-for="r in results"
            :key="r.document_id"
            class="search-result-item"
            @click="navigateTo(r.document_id, r.project_id)"
          >
            <div class="result-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="result-icon">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/>
              </svg>
              <span class="result-project">{{ r.project_name }}</span>
              <span class="result-sep">›</span>
              <span class="result-doc">{{ r.document_name }}</span>
            </div>
            <div v-if="r.snippet" class="result-snippet">{{ r.snippet }}</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.search-modal {
  width: 540px;
  max-width: 92vw;
  max-height: 70vh;
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.search-icon-big {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input-big {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  padding: 0;
  color: var(--text-primary);
  outline: none;
  font-weight: 450;
}

.search-input-big::placeholder {
  color: var(--text-tertiary);
}

.esc-hint {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
}

.search-status {
  text-align: center;
  padding: 32px 20px;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.search-results {
  max-height: 50vh;
  overflow-y: auto;
  padding: 4px;
}

.search-result-item {
  padding: 10px 16px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.search-result-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  margin-bottom: 3px;
}

.result-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.result-project {
  color: var(--text-accent);
  font-weight: 500;
}

.result-sep {
  color: var(--text-tertiary);
  font-size: 10px;
}

.result-doc {
  color: var(--text-primary);
  font-weight: 500;
}

.result-snippet {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  white-space: pre-wrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 36px;
  padding-left: 18px;
}
</style>
