<script setup lang="ts">
import { ref } from "vue";
import { useUiStore } from "@/stores/ui";
import { useProjectsStore } from "@/stores/projects";
import { useDocumentsStore } from "@/stores/documents";
import * as cmd from "@/lib/commands";
import { validateExportData } from "@/lib/importExport";

const uiStore = useUiStore();
const projectsStore = useProjectsStore();
const documentsStore = useDocumentsStore();

const show = ref(false);
const mode = ref<"merge" | "replace">("merge");
const errorMessage = ref("");
const successMessage = ref("");
const importing = ref(false);
const importJsonText = ref("");

function open() {
  show.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  mode.value = "merge";
  importJsonText.value = "";
}

async function handleExport() {
  try {
    const data = await cmd.exportData();
    const json = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(json);
    successMessage.value = "数据已导出并复制到剪贴板，请保存为 JSON 文件。";
  } catch (e) { errorMessage.value = `导出失败: ${e}`; }
}

async function doImport() {
  const text = importJsonText.value.trim();
  if (!text) { errorMessage.value = "请输入 JSON 数据"; return; }
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { errorMessage.value = "JSON 格式错误，无法解析"; return; }
  const errors = validateExportData(data);
  if (errors.length > 0) { errorMessage.value = "数据格式错误:\n" + errors.join("\n"); return; }
  if (mode.value === "replace") {
    const confirmed = await uiStore.openConfirmDialog("覆盖数据", "覆盖模式将删除所有现有项目与文案，此操作不可撤销，确定继续？", true);
    if (!confirmed) return;
  }
  importing.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await cmd.importData(text, mode.value);
    successMessage.value = "导入成功！";
    await projectsStore.loadProjects();
    if (projectsStore.selectedProjectId) await documentsStore.loadDocuments(projectsStore.selectedProjectId);
  } catch (e) { errorMessage.value = `导入失败: ${e}`; }
  finally { importing.value = false; }
}

defineExpose({ open });
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-overlay" @click.self="show = false">
      <div class="modal import-modal">
        <div class="modal-header">
          <span>导入 / 导出</span>
          <button class="ghost icon-close" @click="show = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="section">
            <h3 class="section-title">导出数据</h3>
            <p class="section-desc">将所有项目和文案导出为 JSON（复制到剪贴板）</p>
            <button class="primary" @click="handleExport">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              导出 JSON
            </button>
          </div>

          <hr class="divider" />

          <div class="section">
            <h3 class="section-title">导入数据</h3>
            <div class="mode-select">
              <label class="radio-label" :class="{ active: mode === 'merge' }">
                <input v-model="mode" type="radio" value="merge" />
                <span class="radio-title">合并</span>
                <span class="radio-desc">添加新数据，保留现有数据</span>
              </label>
              <label class="radio-label" :class="{ active: mode === 'replace' }">
                <input v-model="mode" type="radio" value="replace" />
                <span class="radio-title">覆盖</span>
                <span class="radio-desc">删除所有数据后导入（高风险）</span>
              </label>
            </div>
            <textarea v-model="importJsonText" class="import-textarea" rows="8" placeholder="请粘贴 JSON 数据..."></textarea>
          </div>

          <div v-if="successMessage" class="feedback success">{{ successMessage }}</div>
          <div v-if="errorMessage" class="feedback error">{{ errorMessage }}</div>
        </div>
        <div class="modal-footer">
          <button @click="show = false">关闭</button>
          <button class="primary" :disabled="importing || !importJsonText.trim()" @click="doImport">
            {{ importing ? "导入中..." : "执行导入" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.import-modal { width: 540px; max-width: 90vw; }
.icon-close { padding: 4px; background: transparent; color: var(--text-tertiary); }
.icon-close:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }

.section { margin-bottom: 14px; }
.section-title { font-size: var(--font-size); font-weight: 600; margin-bottom: 3px; color: var(--text-primary); }
.section-desc { font-size: var(--font-size-sm); color: var(--text-tertiary); margin-bottom: 8px; }
.divider { border: none; border-top: 1px solid var(--border-subtle); margin: 16px 0; }

.mode-select { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.radio-label {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 10px 12px; border-radius: var(--radius);
  border: 1px solid var(--border-subtle); transition: all var(--transition-fast);
}
.radio-label:hover { background: rgba(255,255,255,0.02); }
.radio-label.active { border-color: var(--border-active); background: var(--accent-muted); }
.radio-label input { margin: 0; accent-color: var(--accent); }
.radio-title { font-weight: 500; font-size: var(--font-size-sm); }
.radio-desc { color: var(--text-tertiary); font-size: var(--font-size-xs); margin-left: auto; }

.import-textarea {
  width: 100%; font-family: var(--font-mono); font-size: 12px; padding: 10px;
  background: rgba(0,0,0,0.2); border: 1px solid var(--border-default); border-radius: var(--radius);
  color: var(--text-primary); resize: vertical;
}
.import-textarea:focus { border-color: var(--border-active); }

.feedback { font-size: var(--font-size-sm); margin-top: 10px; white-space: pre-wrap; }
.feedback.success { color: var(--success); }
.feedback.error { color: var(--danger); }
</style>
