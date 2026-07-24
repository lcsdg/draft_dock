import { ref } from "vue";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";

const DEBOUNCE_MS = 800;

export function useAutoSave() {
  const documentsStore = useDocumentsStore();
  const uiStore = useUiStore();
  const timer = ref<ReturnType<typeof setTimeout> | null>(null);
  const pendingDocId = ref<string | null>(null);
  const pendingContent = ref<string>("");

  function scheduleSave(docId: string, content: string) {
    pendingDocId.value = docId;
    pendingContent.value = content;

    if (timer.value) {
      clearTimeout(timer.value);
    }

    uiStore.setSaveStatus("saving");

    timer.value = setTimeout(async () => {
      await doSave();
    }, DEBOUNCE_MS);
  }

  async function doSave() {
    if (!pendingDocId.value) return;

    try {
      await documentsStore.saveDocumentContent(
        pendingDocId.value,
        pendingContent.value,
      );
      uiStore.setSaveStatus("saved");
    } catch (e) {
      console.error("Auto-save failed:", e);
      uiStore.setSaveStatus("error");
    } finally {
      pendingDocId.value = null;
      pendingContent.value = "";
      timer.value = null;
    }
  }

  async function flushSave() {
    if (timer.value) {
      clearTimeout(timer.value);
      timer.value = null;
    }
    if (pendingDocId.value) {
      await doSave();
    }
  }

  return {
    scheduleSave,
    flushSave,
  };
}
