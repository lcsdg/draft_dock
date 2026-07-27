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
  const loadedProjectId = ref<string | null>(null);

  const projectsStore = useProjectsStore();

  async function loadDocuments(projectId?: string) {
    const pid = projectId ?? projectsStore.selectedProjectId;
    if (!pid) {
      documents.value = [];
      selectedDocumentId.value = null;
      loadedProjectId.value = null;
      return;
    }

    if (loadedProjectId.value !== pid) {
      // 切换项目时先断开旧项目文案的选中关系，避免接口返回前继续展示上一个项目的内容。
      // 文案 ID 是业务 ID，始终保持 string 类型；这里只做同项目归属校验，不做数值转换。
      documents.value = [];
      selectedDocumentId.value = null;
      loadedProjectId.value = pid;
    }

    loading.value = true;
    error.value = null;
    try {
      documents.value = await cmd.listDocuments(pid);
      // 加载完成后，选中文档必须收敛到当前项目的文案集合：
      // 1. 如果搜索跳转或启动恢复已经指定了当前项目内的文案，则保留该选择；
      // 2. 如果仍然指向旧项目文案或没有选择，则选当前项目第一篇；
      // 3. 如果当前项目没有文案，则置空，让编辑区显示空态。
      const selectedDocStillInProject = selectedDocumentId.value
        ? documents.value.some((d) => d.id === selectedDocumentId.value)
        : false;
      selectedDocumentId.value = selectedDocStillInProject
        ? selectedDocumentId.value
        : documents.value[0]?.id ?? null;
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
