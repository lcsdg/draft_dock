<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import AppLayout from "@/components/layout/AppLayout.vue";
import ConfirmDialog from "@/components/modals/ConfirmDialog.vue";
import SearchModal from "@/components/modals/SearchModal.vue";
import VariableFillModal from "@/components/modals/VariableFillModal.vue";
import ImportDialog from "@/components/modals/ImportDialog.vue";
import { useProjectsStore } from "@/stores/projects";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";
import { useKeyboard } from "@/composables/useKeyboard";
import * as cmd from "@/lib/commands";

const projectsStore = useProjectsStore();
const documentsStore = useDocumentsStore();
const uiStore = useUiStore();
const importDialogRef = ref<InstanceType<typeof ImportDialog> | null>(null);

function openImportExport() {
  importDialogRef.value?.open();
}

onMounted(async () => {
  document.addEventListener("draftdock:import-export", openImportExport);

  // Initialize database connection
  try {
    await cmd.ping();
  } catch (e) {
    console.error("Database initialization failed:", e);
    uiStore.setSaveStatus("error");
    return;
  }

  // Load projects
  await projectsStore.loadProjects();

  // Restore last open project and document
  try {
    const lastProjectId = await cmd.getSetting("lastProjectId");
    if (lastProjectId && projectsStore.projects.some((p) => p.id === lastProjectId)) {
      projectsStore.selectProject(lastProjectId);
      // Explicitly load documents for this project
      await documentsStore.loadDocuments(lastProjectId);

      // Now restore last document (documents are loaded)
      const lastDocId = await cmd.getSetting("lastDocumentId");
      if (lastDocId && documentsStore.documents.some((d) => d.id === lastDocId)) {
        documentsStore.selectDocument(lastDocId);
      }
    }

    // Restore theme
    const savedTheme = await cmd.getSetting("theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      uiStore.setTheme(savedTheme);
    } else {
      uiStore.applyTheme();
    }

    // Restore sidebar width
    const savedWidth = await cmd.getSetting("sidebarWidth");
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (!isNaN(w) && w >= 160 && w <= 500) {
        uiStore.sidebarWidth = w;
      }
    }
  } catch (e) {
    console.error("Failed to restore settings:", e);
  }
});

onUnmounted(() => {
  document.removeEventListener("draftdock:import-export", openImportExport);
});

// Persist settings on changes (debounced by the async nature)
watch(
  () => projectsStore.selectedProjectId,
  (id) => {
    if (id) {
      cmd.setSetting("lastProjectId", id).catch(() => {});
      // Load documents when project changes
      documentsStore.loadDocuments(id);
    }
  },
);

watch(
  () => documentsStore.selectedDocumentId,
  (id) => {
    if (id) {
      cmd.setSetting("lastDocumentId", id).catch(() => {});
    }
  },
);

watch(
  () => uiStore.theme,
  (t) => {
    cmd.setSetting("theme", t).catch(() => {});
  },
);

watch(
  () => uiStore.sidebarWidth,
  (w) => {
    cmd.setSetting("sidebarWidth", String(w)).catch(() => {});
  },
);

useKeyboard();
</script>

<template>
  <AppLayout />
  <ConfirmDialog />
  <SearchModal />
  <VariableFillModal />
  <ImportDialog ref="importDialogRef" />
</template>
