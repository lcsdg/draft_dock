<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useUiStore } from "@/stores/ui";
import { useDocumentsStore } from "@/stores/documents";
import { extractVariables, replaceVariables } from "@/lib/template";

const uiStore = useUiStore();
const documentsStore = useDocumentsStore();

interface VarInput { name: string; defaultValue: string; value: string; }

const variables = ref<VarInput[]>([]);
const step = ref<"form" | "preview">("form");
const copyFeedback = ref("");
const errorMessage = ref("");

const currentContent = computed(() => documentsStore.selectedDocument()?.content ?? "");

const filledContent = computed(() => {
  const vals: Record<string, string> = {};
  for (const v of variables.value) vals[v.name] = v.value;
  return replaceVariables(currentContent.value, vals);
});

watch(() => uiStore.showVariableFill, (show) => {
  if (show) {
    const vars = extractVariables(currentContent.value);
    if (vars.length === 0) { uiStore.showVariableFill = false; return; }
    variables.value = vars.map(v => ({ name: v.name, defaultValue: v.defaultValue, value: v.defaultValue }));
    step.value = "form";
    copyFeedback.value = "";
    errorMessage.value = "";
  }
});

function reset() { variables.value = variables.value.map(v => ({ ...v, value: v.defaultValue })); }
function close() { uiStore.showVariableFill = false; }
function goToPreview() { step.value = "preview"; }
function goBack() { step.value = "form"; }

async function copyToClipboard() {
  try { await navigator.clipboard.writeText(filledContent.value); copyFeedback.value = "已复制到剪贴板"; setTimeout(() => copyFeedback.value = "", 2000); }
  catch (e) { errorMessage.value = `复制失败: ${e}`; }
}

async function saveAsNewDocument() {
  try { const doc = await documentsStore.addDocument("填充结果"); if (doc) { await documentsStore.saveDocumentContent(doc.id, filledContent.value); close(); } }
  catch (e) { errorMessage.value = `保存失败: ${e}`; }
}

function isMultiLine(val: string): boolean { return val.includes("\n") || val.length > 60; }
</script>

<template>
  <Teleport to="body">
    <!-- Step 1: Form -->
    <div v-if="uiStore.showVariableFill && step === 'form'" class="modal-overlay" @click.self="close">
      <div class="modal variable-modal">
        <div class="modal-header">
          <span>填充变量</span>
          <button class="ghost icon-close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div v-for="v in variables" :key="v.name" class="var-field">
            <label class="var-label"><span class="var-sigil">$</span>{{ v.name }}</label>
            <textarea v-if="isMultiLine(v.value) || isMultiLine(v.defaultValue)" v-model="v.value" class="var-textarea" rows="3"></textarea>
            <input v-else v-model="v.value" type="text" class="var-input" />
            <span v-if="v.defaultValue" class="var-hint">默认: {{ v.defaultValue }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="close">取消</button>
          <button @click="reset">重置</button>
          <button class="primary" @click="goToPreview">生成结果</button>
        </div>
      </div>
    </div>

    <!-- Step 2: Preview -->
    <div v-if="uiStore.showVariableFill && step === 'preview'" class="modal-overlay" @click.self="close">
      <div class="modal preview-modal">
        <div class="modal-header">
          <span>预览结果</span>
          <button class="ghost icon-close" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body preview-body">
          <pre class="preview-content"><code>{{ filledContent }}</code></pre>
        </div>
        <div v-if="copyFeedback" class="feedback success">{{ copyFeedback }}</div>
        <div v-if="errorMessage" class="feedback error">{{ errorMessage }}</div>
        <div class="modal-footer">
          <button @click="close">关闭</button>
          <button @click="goBack">返回修改</button>
          <button class="primary" @click="copyToClipboard">一键复制</button>
          <button class="primary" @click="saveAsNewDocument">保存为新文案</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.variable-modal { width: 540px; max-width: 90vw; }
.preview-modal  { width: 700px; max-width: 92vw; }

.icon-close { padding: 4px; background: transparent; color: var(--text-tertiary); }
.icon-close:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }

.var-field { margin-bottom: 16px; }
.var-label {
  display: flex; align-items: center; gap: 2px;
  font-size: var(--font-size-sm); font-weight: 600; margin-bottom: 5px;
  color: var(--text-secondary); font-family: var(--font-mono);
}

.var-sigil { color: var(--accent); font-weight: 700; margin-right: 1px; }

.var-input, .var-textarea {
  width: 100%; padding: 7px 10px; font-family: var(--font-mono); font-size: var(--font-size);
  background: rgba(255,255,255,0.03); border: 1px solid var(--border-default); border-radius: var(--radius);
  color: var(--text-primary);
}
.var-input:focus, .var-textarea:focus { border-color: var(--border-active); }
.var-textarea { min-height: 60px; }
.var-hint { display: block; font-size: 10px; color: var(--text-tertiary); margin-top: 3px; font-family: var(--font-mono); }

.preview-body { max-height: 55vh; overflow: auto; }
.preview-content {
  margin: 0; white-space: pre-wrap; word-break: break-word;
  font-family: var(--font-mono); font-size: 13px; line-height: 1.65;
  color: var(--text-primary); background: rgba(0,0,0,0.25);
  padding: 14px; border-radius: var(--radius); border: 1px solid var(--border-subtle);
}
.preview-content code { font-family: var(--font-mono); }

.feedback { text-align: center; font-size: var(--font-size-sm); padding: 4px 20px; }
.feedback.success { color: var(--success); }
.feedback.error { color: var(--danger); }
</style>
