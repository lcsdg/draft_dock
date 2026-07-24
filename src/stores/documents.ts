import { defineStore } from "pinia";
import { ref } from "vue";
import type { Document } from "@/types";
import * as cmd from "@/lib/commands";
import { useProjectsStore } from "./projects";

export const useDocumentsStore = defineStore("documents", () => {
  const documents = ref<Document[]>([]);
  const selectedDocumentId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const projectsStore = useProjectsStore();

  async function loadDocuments(projectId?: string) {
    const pid = projectId ?? projectsStore.selectedProjectId;
    if (!pid) {
      documents.value = [];
      selectedDocumentId.value = null;
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      documents.value = await cmd.listDocuments(pid);
      // Auto-select first document if nothing is selected
      if (documents.value.length > 0 && !selectedDocumentId.value) {
        selectedDocumentId.value = documents.value[0].id;
      } else if (documents.value.length === 0) {
        selectedDocumentId.value = null;
      }
    } catch (e) {
      error.value = `加载文案失败: ${e}`;
      console.error("Failed to load documents:", e);
    } finally {
      loading.value = false;
    }
  }

  async function addDocument(name: string): Promise<Document | null> {
    const projectId = projectsStore.selectedProjectId;
    if (!projectId) return null;
    try {
      const doc = await cmd.createDocument(projectId, name);
      documents.value.push(doc);
      selectedDocumentId.value = doc.id;
      return doc;
    } catch (e) {
      error.value = `创建文案失败: ${e}`;
      console.error("Failed to create document:", e);
    }
    return null;
  }

  async function renameDocument(id: string, name: string) {
    try {
      await cmd.updateDocument(id, name, undefined);
      const d = documents.value.find((d) => d.id === id);
      if (d) d.name = name;
    } catch (e) {
      error.value = `重命名失败: ${e}`;
      console.error("Failed to rename document:", e);
    }
  }

  async function saveDocumentContent(id: string, content: string) {
    try {
      await cmd.updateDocument(id, undefined, content);
      const d = documents.value.find((d) => d.id === id);
      if (d) {
        d.content = content;
        d.updated_at = new Date().toISOString();
      }
    } catch (e) {
      error.value = `保存失败: ${e}`;
      throw e;
    }
  }

  async function setDocumentFontSize(id: string, size: number) {
    try {
      await cmd.setDocumentFontSize(id, size);
      const idx = documents.value.findIndex((d) => d.id === id);
      if (idx !== -1) {
        documents.value[idx] = { ...documents.value[idx], font_size: size };
      }
    } catch (e) {
      error.value = `设置字体大小失败: ${e}`;
    }
  }

  async function removeDocument(id: string) {
    try {
      await cmd.deleteDocument(id);
      documents.value = documents.value.filter((d) => d.id !== id);
      if (selectedDocumentId.value === id) {
        selectedDocumentId.value = documents.value[0]?.id ?? null;
      }
    } catch (e) {
      error.value = `删除文案失败: ${e}`;
      console.error("Failed to delete document:", e);
    }
  }

  function selectDocument(id: string | null) {
    selectedDocumentId.value = id;
  }

  const selectedDocument = () =>
    documents.value.find((d) => d.id === selectedDocumentId.value) ?? null;

  const documentCount = () => documents.value.length;

  return {
    documents,
    selectedDocumentId,
    loading,
    error,
    loadDocuments,
    addDocument,
    renameDocument,
    saveDocumentContent,
    setDocumentFontSize,
    removeDocument,
    selectDocument,
    selectedDocument,
    documentCount,
  };
});
