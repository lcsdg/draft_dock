<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useProjectsStore } from "@/stores/projects";
import { useUiStore } from "@/stores/ui";

const projectsStore = useProjectsStore();
const uiStore = useUiStore();

const searchQuery = ref("");
const editingId = ref<string | null>(null);
const editingName = ref("");
const showNewProjectInput = ref(false);
const newProjectName = ref("");

function openNewProjectInput() {
  newProjectName.value = "新建项目";
  showNewProjectInput.value = true;
}

function triggerNewProject() {
  openNewProjectInput();
}

function cancelNewProject() {
  showNewProjectInput.value = false;
  newProjectName.value = "";
}

const filteredProjects = computed(() => {
  if (!searchQuery.value.trim()) return projectsStore.projects;
  const q = searchQuery.value.toLowerCase();
  return projectsStore.projects.filter((p) =>
    p.name.toLowerCase().includes(q),
  );
});

function triggerImportExport() {
  document.dispatchEvent(new CustomEvent("draftdock:import-export"));
}

onMounted(() => {
  document.addEventListener("draftdock:new-project", triggerNewProject);
});

onUnmounted(() => {
  document.removeEventListener("draftdock:new-project", triggerNewProject);
});

async function handleCreateProject() {
  const name = newProjectName.value.trim();
  if (!name) {
    cancelNewProject();
    return;
  }
  const project = await projectsStore.addProject(name);
  if (project) {
    showNewProjectInput.value = false;
    newProjectName.value = "";
    projectsStore.selectProject(project.id);
  }
}

function startRename(id: string, currentName: string) {
  editingId.value = id;
  editingName.value = currentName;
}

async function finishRename() {
  if (editingId.value && editingName.value.trim()) {
    await projectsStore.renameProject(editingId.value, editingName.value.trim());
  }
  editingId.value = null;
  editingName.value = "";
}

async function handleDelete(id: string, name: string) {
  const confirmed = await uiStore.openConfirmDialog(
    "删除项目",
    `确定要删除项目「${name}」吗？项目下的所有文案也会被删除。`,
    true,
  );
  if (confirmed) {
    await projectsStore.removeProject(id);
  }
}

function selectProject(id: string) {
  projectsStore.selectProject(id);
}
</script>

<template>
  <div class="project-sidebar">
    <div class="sidebar-header">
      <div class="header-brand">
        <svg class="logo" viewBox="0 0 24 24" fill="none" width="18" height="18">
          <rect x="3" y="8" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
        </svg>
        <span class="brand-name">DraftDock</span>
      </div>
      <button
        class="icon-btn"
        title="新建项目 (Cmd+Shift+N)"
        @click="openNewProjectInput"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </div>

    <div class="search-box">
      <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索项目..."
        class="search-input"
      />
    </div>

    <div v-if="showNewProjectInput" class="new-project-row">
      <input
        v-model="newProjectName"
        type="text"
        class="inline-input"
        @keydown.enter="handleCreateProject"
        @keydown.escape="cancelNewProject"
        @blur="handleCreateProject"
      />
    </div>

    <div class="project-list">
      <div v-if="filteredProjects.length === 0 && !projectsStore.loading" class="empty-hint">
        <template v-if="!searchQuery">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
              <path d="M14 2v6h6M12 18v-6M9 15h6"/>
            </svg>
          </div>
          <p>还没有项目</p>
          <p class="sub">点击 + 创建第一个项目</p>
        </template>
        <template v-else>
          <p>没有找到匹配的项目</p>
        </template>
      </div>

      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="project-item"
        :class="{ selected: project.id === projectsStore.selectedProjectId }"
        @click="selectProject(project.id)"
      >
        <div class="project-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z"/>
          </svg>
        </div>
        <div class="project-info">
          <span
            v-if="editingId !== project.id"
            class="project-name truncate"
            @dblclick.stop="startRename(project.id, project.name)"
          >{{ project.name }}</span>
          <input
            v-else
            v-model="editingName"
            type="text"
            class="inline-input"
            @keydown.enter="finishRename"
            @keydown.escape="editingId = null"
            @blur="finishRename"
            @click.stop
          />
        </div>
        <div class="project-actions">
          <button
            class="action-btn"
            title="重命名"
            @click.stop="startRename(project.id, project.name)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          <button
            class="action-btn danger"
            title="删除"
            @click.stop="handleDelete(project.id, project.name)"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <button class="footer-btn" @click="triggerImportExport">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        导入 / 导出
      </button>
    </div>
  </div>
</template>

<style scoped>
.project-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header */
.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.logo {
  color: var(--accent);
  filter: drop-shadow(0 0 6px var(--accent-glow));
}

.brand-name {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: -0.02em;
}

.icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

/* Search */
.search-box {
  padding: 0 12px 8px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 5px 10px 5px 28px;
  font-size: var(--font-size-sm);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  color: var(--text-primary);
}

.search-input:focus {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-active);
  box-shadow: 0 0 0 2px var(--accent-muted);
}

/* New project */
.new-project-row {
  padding: 4px 12px 8px;
}

.inline-input {
  width: 100%;
  padding: 5px 8px;
  font-size: var(--font-size);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-active);
  border-radius: var(--radius-sm);
}

/* List */
.project-list {
  flex: 1;
  overflow-y: auto;
  padding: 2px 8px;
}

.project-item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  margin: 1px 0;
  cursor: pointer;
  gap: 8px;
  border-radius: var(--radius);
  transition: all var(--transition-fast);
  color: var(--text-secondary);
}

.project-item:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.project-item.selected {
  background: rgba(83, 115, 232, 0.12);
  color: var(--text-primary);
  box-shadow: 0 0 0 1px rgba(83, 115, 232, 0.15) inset;
}

.project-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
}

.project-item.selected .project-icon {
  color: var(--accent);
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: var(--font-size);
  display: block;
  font-weight: 450;
}

.project-actions {
  display: flex;
  gap: 1px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.project-item:hover .project-actions {
  opacity: 1;
}

.action-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.action-btn.danger:hover {
  background: var(--danger-muted);
  color: var(--danger);
}

/* Empty */
.empty-hint {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.empty-icon {
  margin-bottom: 10px;
  opacity: 0.4;
}

.sub {
  font-size: var(--font-size-xs);
  margin-top: 2px;
}

/* Footer */
.sidebar-footer {
  padding: 8px 10px;
  border-top: 1px solid var(--border-subtle);
}

.footer-btn {
  width: 100%;
  padding: 7px 10px;
  font-size: var(--font-size-sm);
  font-weight: 450;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all var(--transition-fast);
}

.footer-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  border-color: var(--border-default);
}
</style>
